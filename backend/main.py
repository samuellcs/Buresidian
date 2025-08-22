import os
from datetime import datetime, timedelta
from typing import Optional, List
import sqlite3
from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import BaseModel
import json
import asyncio
import aiofiles
from pathlib import Path

# Configurações
SECRET_KEY = "buresidian-local-secret-key-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 43200  # 30 dias para uso local

# Inicialização
app = FastAPI(title="Buresidian API", version="1.0.0")
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# CORS para desenvolvimento local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Criar diretórios necessários
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)

# Servir arquivos estáticos
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Modelos Pydantic
class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None

class NoteCreate(BaseModel):
    title: str
    content: str = ""
    folder_id: Optional[int] = None

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    folder_id: Optional[int] = None

class CommentCreate(BaseModel):
    content: str
    note_id: int

# Database
def init_db():
    conn = sqlite3.connect('buresidian.db')
    cursor = conn.cursor()
    
    # Usuários
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Pastas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            parent_id INTEGER,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES folders (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Notas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            folder_id INTEGER,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (folder_id) REFERENCES folders (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Comentários
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            note_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (note_id) REFERENCES notes (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Criar usuário demo
    try:
        hashed_password = pwd_context.hash("demo123")
        cursor.execute("INSERT INTO users (username, hashed_password) VALUES (?, ?)", 
                      ("demo", hashed_password))
        print("Usuário demo criado: demo/demo123")
    except sqlite3.IntegrityError:
        print("Usuário demo já existe")
    
    conn.commit()
    conn.close()

# Funções auxiliares
def get_db_connection():
    return sqlite3.connect('buresidian.db')

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()
    
    if user is None:
        raise credentials_exception
    return {"id": user[0], "username": user[1]}

# WebSocket Manager para colaboração em tempo real
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict = {}  # note_id -> list of connections
        
    async def connect(self, websocket: WebSocket, note_id: int, user_id: int, username: str):
        await websocket.accept()
        if note_id not in self.active_connections:
            self.active_connections[note_id] = []
        
        connection_info = {
            "websocket": websocket,
            "user_id": user_id,
            "username": username
        }
        self.active_connections[note_id].append(connection_info)
        
        # Enviar lista de usuários online para o novo usuário
        await self.send_online_users(note_id)
        
        # Notificar outros usuários
        await self.broadcast_to_note(note_id, {
            "type": "user_joined",
            "user_id": user_id,
            "username": username
        }, user_id)
        
    def disconnect(self, websocket: WebSocket, note_id: int):
        if note_id in self.active_connections:
            disconnected_user = None
            self.active_connections[note_id] = [
                conn for conn in self.active_connections[note_id] 
                if conn["websocket"] != websocket or (disconnected_user := conn)
            ]
            
            if not self.active_connections[note_id]:
                del self.active_connections[note_id]
            elif disconnected_user:
                # Notificar outros usuários sobre a saída
                asyncio.create_task(self.broadcast_to_note(note_id, {
                    "type": "user_left",
                    "user_id": disconnected_user["user_id"],
                    "username": disconnected_user["username"]
                }, disconnected_user["user_id"]))
                
    async def send_online_users(self, note_id: int):
        if note_id in self.active_connections:
            users = [
                {"user_id": conn["user_id"], "username": conn["username"]}
                for conn in self.active_connections[note_id]
            ]
            await self.broadcast_to_note(note_id, {
                "type": "users_online",
                "users": users
            })
                
    async def broadcast_to_note(self, note_id: int, message: dict, sender_user_id: int = None):
        if note_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[note_id]:
                if sender_user_id is None or connection["user_id"] != sender_user_id:
                    try:
                        await connection["websocket"].send_text(json.dumps(message))
                    except:
                        disconnected.append(connection["websocket"])
            
            # Remover conexões mortas
            for ws in disconnected:
                self.disconnect(ws, note_id)

manager = ConnectionManager()

# Rotas de Autenticação
@app.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se usuário já existe
    cursor.execute("SELECT id FROM users WHERE username = ?", (user.username,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Criar usuário
    hashed_password = get_password_hash(user.password)
    cursor.execute("INSERT INTO users (username, hashed_password) VALUES (?, ?)",
                  (user.username, hashed_password))
    conn.commit()
    conn.close()
    
    # Criar token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/login", response_model=Token)
async def login(user: UserLogin):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT username, hashed_password FROM users WHERE username = ?", (user.username,))
    db_user = cursor.fetchone()
    conn.close()
    
    if not db_user or not verify_password(user.password, db_user[1]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user

# Rotas de Pastas
@app.post("/folders")
async def create_folder(folder: FolderCreate, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO folders (name, parent_id, user_id) VALUES (?, ?, ?)",
                  (folder.name, folder.parent_id, current_user["id"]))
    folder_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": folder_id, "name": folder.name, "parent_id": folder.parent_id}

@app.get("/folders")
async def get_folders(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, parent_id FROM folders WHERE user_id = ?", (current_user["id"],))
    folders = [{"id": row[0], "name": row[1], "parent_id": row[2]} for row in cursor.fetchall()]
    conn.close()
    return folders

# Rotas de Notas
@app.post("/notes")
async def create_note(note: NoteCreate, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO notes (title, content, folder_id, user_id) VALUES (?, ?, ?, ?)",
                  (note.title, note.content, note.folder_id, current_user["id"]))
    note_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": note_id, "title": note.title, "content": note.content, "folder_id": note.folder_id}

@app.get("/notes")
async def get_notes(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT n.id, n.title, n.content, n.folder_id, f.name as folder_name, n.created_at, n.updated_at
        FROM notes n
        LEFT JOIN folders f ON n.folder_id = f.id
        WHERE n.user_id = ?
        ORDER BY n.updated_at DESC
    """, (current_user["id"],))
    notes = []
    for row in cursor.fetchall():
        notes.append({
            "id": row[0],
            "title": row[1],
            "content": row[2],
            "folder_id": row[3],
            "folder_name": row[4],
            "created_at": row[5],
            "updated_at": row[6]
        })
    conn.close()
    return notes

@app.get("/notes/{note_id}")
async def get_note(note_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, content, folder_id FROM notes WHERE id = ? AND user_id = ?",
                  (note_id, current_user["id"]))
    note = cursor.fetchone()
    conn.close()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    return {"id": note[0], "title": note[1], "content": note[2], "folder_id": note[3]}

@app.put("/notes/{note_id}")
async def update_note(note_id: int, note: NoteUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se a nota existe e pertence ao usuário
    cursor.execute("SELECT id FROM notes WHERE id = ? AND user_id = ?", (note_id, current_user["id"]))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Atualizar campos fornecidos
    updates = []
    params = []
    if note.title is not None:
        updates.append("title = ?")
        params.append(note.title)
    if note.content is not None:
        updates.append("content = ?")
        params.append(note.content)
    if note.folder_id is not None:
        updates.append("folder_id = ?")
        params.append(note.folder_id)
    
    if updates:
        updates.append("updated_at = CURRENT_TIMESTAMP")
        query = f"UPDATE notes SET {', '.join(updates)} WHERE id = ?"
        params.append(note_id)
        cursor.execute(query, params)
        conn.commit()
    
    conn.close()
    return {"message": "Note updated successfully"}

@app.delete("/notes/{note_id}")
async def delete_note(note_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM notes WHERE id = ? AND user_id = ?", (note_id, current_user["id"]))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    conn.commit()
    conn.close()
    return {"message": "Note deleted successfully"}

# Rotas de Comentários
@app.post("/comments")
async def create_comment(comment: CommentCreate, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO comments (content, note_id, user_id) VALUES (?, ?, ?)",
                  (comment.content, comment.note_id, current_user["id"]))
    comment_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": comment_id, "content": comment.content, "note_id": comment.note_id}

@app.get("/notes/{note_id}/comments")
async def get_comments(note_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, c.content, c.created_at, u.username
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.note_id = ?
        ORDER BY c.created_at ASC
    """, (note_id,))
    comments = []
    for row in cursor.fetchall():
        comments.append({
            "id": row[0],
            "content": row[1],
            "created_at": row[2],
            "username": row[3]
        })
    conn.close()
    return comments

# Upload de imagens
@app.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Gerar nome único para o arquivo
    import uuid
    file_extension = file.filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = uploads_dir / unique_filename
    
    # Salvar arquivo
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    return {"filename": unique_filename, "url": f"/uploads/{unique_filename}"}

# WebSocket para colaboração em tempo real
@app.websocket("/ws/notes/{note_id}")
async def websocket_endpoint(websocket: WebSocket, note_id: int, user_id: int = 1, username: str = "user"):
    # Em produção, seria necessário validar o token JWT aqui
    await manager.connect(websocket, note_id, user_id, username)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Atualizar nota no banco se for uma mudança de conteúdo
            if message.get("type") == "content_change":
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                              (message.get("content", ""), note_id))
                conn.commit()
                conn.close()
                
                # Broadcast para outros usuários
                await manager.broadcast_to_note(note_id, {
                    "type": "content_change",
                    "content": message.get("content", ""),
                    "user_id": message.get("user_id"),
                    "username": message.get("username")
                }, message.get("user_id"))
            
            elif message.get("type") == "cursor_position":
                # Broadcast posição do cursor
                await manager.broadcast_to_note(note_id, {
                    "type": "cursor_position",
                    "position": message.get("position"),
                    "user_id": message.get("user_id"),
                    "username": message.get("username")
                }, message.get("user_id"))
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, note_id)

# Busca
@app.get("/search")
async def search_notes(q: str, folder_id: int = None, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    search_term = f"%{q}%"
    
    # Construir query baseada nos filtros
    base_query = """
        SELECT n.id, n.title, n.content, n.folder_id, f.name as folder_name
        FROM notes n
        LEFT JOIN folders f ON n.folder_id = f.id
        WHERE n.user_id = ? AND (n.title LIKE ? OR n.content LIKE ?)
    """
    
    params = [current_user["id"], search_term, search_term]
    
    if folder_id is not None:
        base_query += " AND n.folder_id = ?"
        params.append(folder_id)
    
    base_query += " ORDER BY n.updated_at DESC"
    
    cursor.execute(base_query, params)
    
    results = []
    for row in cursor.fetchall():
        results.append({
            "id": row[0],
            "title": row[1],
            "content": row[2][:200] + "..." if len(row[2]) > 200 else row[2],  # Preview
            "folder_id": row[3],
            "folder_name": row[4]
        })
    conn.close()
    return results

if __name__ == "__main__":
    init_db()
    uvicorn.run(app, host="0.0.0.0", port=8000)
