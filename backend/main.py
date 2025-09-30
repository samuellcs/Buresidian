import os
from datetime import datetime, timedelta
from typing import Optional, List
import sqlite3
import time
import json
import asyncio
from functools import wraps
from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, WebSocket, WebSocketDisconnect, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import BaseModel

# Variável global para rastrear tempo de inicialização
startup_time = time.time()
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

class ReactionCreate(BaseModel):
    emoji: str
    note_id: int

class ReactionToggle(BaseModel):
    emoji: str

class NoteVersionCreate(BaseModel):
    change_description: Optional[str] = ""

class NoteVersionRestore(BaseModel):
    version_id: int

# Canvas Models - Seguindo especificações exatas
class CanvasBoardCreate(BaseModel):
    name: str

class CanvasBoardUpdate(BaseModel):
    name: Optional[str] = None

class CanvasNodeCreate(BaseModel):
    type: str  # 'note', 'text', 'image', 'link', 'group'
    ref_note_id: Optional[int] = None
    text: Optional[str] = None
    url: Optional[str] = None
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    color: Optional[str] = None
    z_index: Optional[int] = 0

class CanvasNodeUpdate(BaseModel):
    type: Optional[str] = None
    ref_note_id: Optional[int] = None
    text: Optional[str] = None
    url: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    color: Optional[str] = None
    z_index: Optional[int] = None

class CanvasEdgeCreate(BaseModel):
    source_node_id: int
    target_node_id: int
    label: Optional[str] = None
    style: Optional[str] = None  # JSON as string

class CanvasEdgeUpdate(BaseModel):
    source_node_id: Optional[int] = None
    target_node_id: Optional[int] = None
    label: Optional[str] = None
    style: Optional[str] = None

class CanvasBoardState(BaseModel):
    nodes: List[dict]
    edges: List[dict]

class CanvasCollaboratorAdd(BaseModel):
    user_id: int
    permission: str = "view"  # 'view', 'edit', 'admin'

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
    
    # Canvas/Boards - Seguindo especificações exatas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS canvas_boards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            owner_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users (id)
        )
    ''')
    
    # Nós do Canvas - Seguindo especificações exatas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS canvas_nodes (
            id TEXT PRIMARY KEY,  -- IDs customizados (string)
            board_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('note', 'text', 'image', 'link', 'group')),
            ref_note_id INTEGER,
            text TEXT,
            url TEXT,
            x REAL NOT NULL,
            y REAL NOT NULL,
            width REAL,
            height REAL,
            color TEXT,
            z_index INTEGER DEFAULT 0,
            FOREIGN KEY (board_id) REFERENCES canvas_boards (id) ON DELETE CASCADE,
            FOREIGN KEY (ref_note_id) REFERENCES notes (id)
        )
    ''')
    
    # Arestas/Conexões do Canvas - Seguindo especificações exatas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS canvas_edges (
            id TEXT PRIMARY KEY,  -- IDs customizados (string)
            board_id INTEGER NOT NULL,
            source_node_id TEXT NOT NULL,  -- Referencias para IDs de nós (text)
            target_node_id TEXT NOT NULL,  -- Referencias para IDs de nós (text)
            label TEXT,
            style TEXT,
            FOREIGN KEY (board_id) REFERENCES canvas_boards (id) ON DELETE CASCADE,
            FOREIGN KEY (source_node_id) REFERENCES canvas_nodes (id) ON DELETE CASCADE,
            FOREIGN KEY (target_node_id) REFERENCES canvas_nodes (id) ON DELETE CASCADE
        )
    ''')

    # Colaboradores do Canvas (mantém como estava)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS canvas_collaborators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            permission TEXT DEFAULT 'view' CHECK(permission IN ('view', 'edit', 'admin')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (board_id) REFERENCES canvas_boards (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id),
            UNIQUE(board_id, user_id)
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
    
    # Reações nas notas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            emoji TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(note_id, user_id, emoji),
            FOREIGN KEY (note_id) REFERENCES notes (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Histórico de versões das notas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS note_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            version_number INTEGER NOT NULL,
            change_description TEXT DEFAULT '',
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

def create_note_version(note_id: int, title: str, content: str, user_id: int, change_description: str = ""):
    """Cria uma nova versão da nota no histórico"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Obter o próximo número de versão
    cursor.execute("SELECT COALESCE(MAX(version_number), 0) + 1 FROM note_versions WHERE note_id = ?", (note_id,))
    version_number = cursor.fetchone()[0]
    
    # Inserir nova versão
    cursor.execute("""
        INSERT INTO note_versions (note_id, title, content, version_number, change_description, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (note_id, title, content, version_number, change_description, user_id))
    
    conn.commit()
    conn.close()
    
    return version_number

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
        self.board_connections: dict = {}   # board_id -> list of connections
        
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
    
    async def connect_to_board(self, websocket: WebSocket, board_id: int, user_id: int, username: str):
        await websocket.accept()
        if board_id not in self.board_connections:
            self.board_connections[board_id] = []
        
        connection_info = {
            "websocket": websocket,
            "user_id": user_id,
            "username": username
        }
        self.board_connections[board_id].append(connection_info)
        
        # Enviar lista de usuários online para o novo usuário
        await self.send_online_users_board(board_id)
        
        # Notificar outros usuários
        await self.broadcast_to_board(board_id, {
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
    
    def disconnect_from_board(self, websocket: WebSocket, board_id: int):
        if board_id in self.board_connections:
            disconnected_user = None
            self.board_connections[board_id] = [
                conn for conn in self.board_connections[board_id] 
                if conn["websocket"] != websocket or (disconnected_user := conn)
            ]
            
            if not self.board_connections[board_id]:
                del self.board_connections[board_id]
            elif disconnected_user:
                # Notificar outros usuários sobre a saída
                asyncio.create_task(self.broadcast_to_board(board_id, {
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
    
    async def send_online_users_board(self, board_id: int):
        if board_id in self.board_connections:
            users = [
                {"user_id": conn["user_id"], "username": conn["username"]}
                for conn in self.board_connections[board_id]
            ]
            await self.broadcast_to_board(board_id, {
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
    
    async def broadcast_to_board(self, board_id: int, message: dict, sender_user_id: int = None):
        if board_id in self.board_connections:
            disconnected = []
            for connection in self.board_connections[board_id]:
                if sender_user_id is None or connection["user_id"] != sender_user_id:
                    try:
                        await connection["websocket"].send_text(json.dumps(message))
                    except:
                        disconnected.append(connection["websocket"])
            
            # Remover conexões mortas
            for ws in disconnected:
                self.disconnect_from_board(ws, board_id)

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
    
    # Verificar se a nota existe e obter dados atuais
    cursor.execute("SELECT title, content FROM notes WHERE id = ? AND user_id = ?", (note_id, current_user["id"]))
    current_note = cursor.fetchone()
    if not current_note:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    
    current_title, current_content = current_note
    
    # Preparar dados para atualização
    new_title = note.title if note.title is not None else current_title
    new_content = note.content if note.content is not None else current_content
    
    # Criar versão no histórico antes de atualizar (apenas se houve mudança significativa)
    if (note.title and note.title != current_title) or (note.content and note.content != current_content):
        create_note_version(note_id, current_title, current_content, current_user["id"], "Auto-save")
    
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

# Endpoints de reações
@app.post("/notes/{note_id}/reactions")
async def toggle_reaction(note_id: int, reaction: ReactionToggle, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verifica se a nota existe
    cursor.execute("SELECT id FROM notes WHERE id = ?", (note_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Verifica se já existe uma reação do usuário para essa nota
    cursor.execute(
        "SELECT id FROM reactions WHERE note_id = ? AND user_id = ? AND emoji = ?",
        (note_id, current_user["id"], reaction.emoji)
    )
    existing_reaction = cursor.fetchone()
    
    if existing_reaction:
        # Remove a reação existente
        cursor.execute("DELETE FROM reactions WHERE id = ?", (existing_reaction[0],))
        action = "removed"
    else:
        # Adiciona nova reação
        cursor.execute(
            "INSERT INTO reactions (note_id, user_id, emoji) VALUES (?, ?, ?)",
            (note_id, current_user["id"], reaction.emoji)
        )
        action = "added"
    
    conn.commit()
    
    # Busca o número atualizado de reações para esse emoji
    cursor.execute(
        "SELECT COUNT(*) FROM reactions WHERE note_id = ? AND emoji = ?",
        (note_id, reaction.emoji)
    )
    count = cursor.fetchone()[0]
    
    conn.close()
    
    # Notifica via WebSocket sobre a atualização
    await manager.broadcast_to_note(note_id, {
        "type": "reaction_update",
        "note_id": note_id,
        "emoji": reaction.emoji,
        "count": count,
        "action": action,
        "user": current_user["username"]
    })
    
    return {"action": action, "emoji": reaction.emoji, "count": count}

@app.get("/notes/{note_id}/reactions")
async def get_note_reactions(note_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verifica se a nota existe
    cursor.execute("SELECT id FROM notes WHERE id = ?", (note_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Busca todas as reações da nota agrupadas por emoji
    cursor.execute("""
        SELECT emoji, COUNT(*) as count
        FROM reactions 
        WHERE note_id = ? 
        GROUP BY emoji
        ORDER BY emoji
    """, (note_id,))
    
    reactions = {}
    for row in cursor.fetchall():
        reactions[row[0]] = row[1]
    
    conn.close()
    return reactions

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

# Rotas de Histórico de Versões
@app.get("/notes/{note_id}/versions")
async def get_note_versions(note_id: int, current_user: dict = Depends(get_current_user)):
    """Obter histórico de versões de uma nota"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se a nota existe e pertence ao usuário
    cursor.execute("SELECT id FROM notes WHERE id = ? AND user_id = ?", (note_id, current_user["id"]))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Buscar versões
    cursor.execute("""
        SELECT nv.id, nv.version_number, nv.title, nv.content, nv.change_description, 
               nv.created_at, u.username
        FROM note_versions nv
        JOIN users u ON nv.user_id = u.id
        WHERE nv.note_id = ?
        ORDER BY nv.version_number DESC
    """, (note_id,))
    
    versions = []
    for row in cursor.fetchall():
        versions.append({
            "id": row[0],
            "version_number": row[1],
            "title": row[2],
            "content": row[3],
            "change_description": row[4],
            "created_at": row[5],
            "username": row[6]
        })
    
    conn.close()
    return versions

@app.post("/notes/{note_id}/versions")
async def create_manual_version(note_id: int, version_data: NoteVersionCreate, current_user: dict = Depends(get_current_user)):
    """Criar versão manual com descrição personalizada"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se a nota existe e obter dados atuais
    cursor.execute("SELECT title, content FROM notes WHERE id = ? AND user_id = ?", (note_id, current_user["id"]))
    note_data = cursor.fetchone()
    if not note_data:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    
    title, content = note_data
    conn.close()
    
    # Criar versão
    version_number = create_note_version(
        note_id, title, content, current_user["id"], 
        version_data.change_description or "Manual save"
    )
    
    return {"message": "Version created successfully", "version_number": version_number}

@app.post("/notes/{note_id}/restore")
async def restore_note_version(note_id: int, restore_data: NoteVersionRestore, current_user: dict = Depends(get_current_user)):
    """Restaurar uma versão específica da nota"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se a nota existe e pertence ao usuário
    cursor.execute("SELECT id FROM notes WHERE id = ? AND user_id = ?", (note_id, current_user["id"]))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Buscar dados da versão
    cursor.execute("""
        SELECT title, content FROM note_versions 
        WHERE id = ? AND note_id = ?
    """, (restore_data.version_id, note_id))
    
    version_data = cursor.fetchone()
    if not version_data:
        conn.close()
        raise HTTPException(status_code=404, detail="Version not found")
    
    title, content = version_data
    
    # Criar backup da versão atual antes de restaurar
    cursor.execute("SELECT title, content FROM notes WHERE id = ?", (note_id,))
    current_note = cursor.fetchone()
    if current_note:
        create_note_version(note_id, current_note[0], current_note[1], current_user["id"], "Before restore")
    
    # Restaurar versão
    cursor.execute("""
        UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    """, (title, content, note_id))
    
    conn.commit()
    conn.close()
    
    return {"message": "Version restored successfully", "title": title}

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
            
            elif message.get("type") == "version_created":
                # Notificar outros usuários sobre nova versão
                await manager.broadcast_to_note(note_id, {
                    "type": "version_created",
                    "version_number": message.get("version_number"),
                    "user_id": message.get("user_id"),
                    "username": message.get("username")
                }, message.get("user_id"))
            
            elif message.get("type") == "version_restored":
                # Notificar outros usuários sobre restauração
                await manager.broadcast_to_note(note_id, {
                    "type": "version_restored",
                    "version_number": message.get("version_number"),
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

# WebSocket para colaboração em Canvas boards
@app.websocket("/ws/canvas/{board_id}")
async def canvas_websocket_endpoint(websocket: WebSocket, board_id: int, user_id: int = 1, username: str = "user"):
    # Em produção, seria necessário validar o token JWT aqui
    await manager.connect_to_board(websocket, board_id, user_id, username)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Broadcast para outros usuários baseado no tipo de mensagem
            if message.get("type") in ["node_moved", "node_resized", "edge_created", "edge_deleted", "viewport_changed"]:
                await manager.broadcast_to_board(board_id, {
                    "type": message.get("type"),
                    "board_id": board_id,
                    "data": message.get("data"),
                    "user_id": message.get("user_id"),
                    "username": message.get("username")
                }, message.get("user_id"))
            
            elif message.get("type") == "cursor_position":
                # Broadcast posição do cursor no canvas
                await manager.broadcast_to_board(board_id, {
                    "type": "cursor_position",
                    "position": message.get("position"),
                    "user_id": message.get("user_id"),
                    "username": message.get("username")
                }, message.get("user_id"))
            
    except WebSocketDisconnect:
        manager.disconnect_from_board(websocket, board_id)

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

# Endpoints para grafo de conexões
@app.get("/notes/graph")
async def get_notes_graph(current_user: dict = Depends(get_current_user)):
    """Gerar dados do grafo de conexões entre notas"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Buscar todas as notas do usuário
    cursor.execute("""
        SELECT n.id, n.title, n.content, n.folder_id, f.name as folder_name
        FROM notes n
        LEFT JOIN folders f ON n.folder_id = f.id
        WHERE n.user_id = ?
        ORDER BY n.updated_at DESC
    """, (current_user["id"],))
    
    notes = {}
    nodes = []
    edges = []
    
    # Criar nodes
    for row in cursor.fetchall():
        note_id, title, content, folder_id, folder_name = row
        notes[note_id] = {
            "id": note_id,
            "title": title,
            "content": content,
            "folder_id": folder_id,
            "folder_name": folder_name
        }
        
        nodes.append({
            "id": note_id,
            "label": title,
            "group": folder_name or "Sem pasta",
            "title": f"📝 {title}\n📁 {folder_name or 'Sem pasta'}\n✏️ {len(content)} caracteres"
        })
    
    # Detectar conexões através de menções de títulos
    import re
    for note_id, note in notes.items():
        content = note["content"].lower()
        
        # Buscar menções a outros títulos
        for other_id, other_note in notes.items():
            if note_id != other_id:
                other_title = other_note["title"].lower()
                
                # Detectar menções diretas do título
                if len(other_title) > 3 and other_title in content:
                    edges.append({
                        "from": note_id,
                        "to": other_id,
                        "label": "menciona",
                        "color": {"color": "#8b5cf6"},
                        "arrows": "to"
                    })
                
                # Detectar links markdown [[titulo]]
                markdown_links = re.findall(r'\[\[([^\]]+)\]\]', note["content"])
                for link in markdown_links:
                    if link.lower() == other_title:
                        edges.append({
                            "from": note_id,
                            "to": other_id,
                            "label": "link",
                            "color": {"color": "#10b981"},
                            "arrows": "to",
                            "width": 2
                        })
    
    conn.close()
    
    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_notes": len(nodes),
            "total_connections": len(edges),
            "folders": len(set(note["folder_name"] for note in notes.values()))
        }
    }

@app.get("/notes/{note_id}/connections")
async def get_note_connections(note_id: int, current_user: dict = Depends(get_current_user)):
    """Obter conexões específicas de uma nota"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se a nota existe
    cursor.execute("SELECT title, content FROM notes WHERE id = ? AND user_id = ?", (note_id, current_user["id"]))
    note_data = cursor.fetchone()
    if not note_data:
        conn.close()
        raise HTTPException(status_code=404, detail="Note not found")
    
    title, content = note_data
    
    # Buscar notas que mencionam esta nota
    cursor.execute("""
        SELECT id, title, content FROM notes 
        WHERE user_id = ? AND id != ? AND (LOWER(content) LIKE ? OR LOWER(content) LIKE ?)
    """, (current_user["id"], note_id, f"%{title.lower()}%", f"%[[{title.lower()}]]%"))
    
    incoming = []
    for row in cursor.fetchall():
        incoming.append({
            "id": row[0],
            "title": row[1],
            "preview": row[2][:100] + "..." if len(row[2]) > 100 else row[2]
        })
    
    # Buscar notas mencionadas por esta nota
    cursor.execute("""
        SELECT id, title FROM notes WHERE user_id = ? AND id != ?
    """, (current_user["id"], note_id))
    
    outgoing = []
    all_notes = cursor.fetchall()
    
    import re
    content_lower = content.lower()
    markdown_links = re.findall(r'\[\[([^\]]+)\]\]', content)
    
    for row in all_notes:
        other_id, other_title = row
        other_title_lower = other_title.lower()
        
        # Verificar menções diretas ou links markdown
        if (len(other_title) > 3 and other_title_lower in content_lower) or \
           any(link.lower() == other_title_lower for link in markdown_links):
            outgoing.append({
                "id": other_id,
                "title": other_title
            })
    
    conn.close()
    
    return {
        "note_id": note_id,
        "note_title": title,
        "incoming_connections": incoming,
        "outgoing_connections": outgoing,
        "total_connections": len(incoming) + len(outgoing)
    }

# Performance e Health Check Endpoints
@app.get("/health")
async def health_check():
    """Endpoint de health check para monitoramento"""
    try:
        # Teste básico de conexão com banco
        conn = sqlite3.connect('buresidian.db')
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM notes")
        note_count = cursor.fetchone()[0]
        conn.close()
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "database": "connected",
            "total_notes": note_count,
            "version": "1.0.0"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Health check failed: {str(e)}"
        )

@app.get("/metrics")
async def get_metrics():
    """Endpoint de métricas para monitoramento de performance"""
    try:
        conn = sqlite3.connect('buresidian.db')
        cursor = conn.cursor()
        
        # Estatísticas básicas
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM notes")
        note_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM folders")
        folder_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM comments")
        comment_count = cursor.fetchone()[0]
        
        # Notas criadas nas últimas 24h
        yesterday = datetime.now() - timedelta(days=1)
        cursor.execute("SELECT COUNT(*) FROM notes WHERE created_at > ?", (yesterday,))
        notes_24h = cursor.fetchone()[0]
        
        # Usuários ativos (com notas nas últimas 7 dias)
        week_ago = datetime.now() - timedelta(days=7)
        cursor.execute("""
            SELECT COUNT(DISTINCT user_id) FROM notes 
            WHERE updated_at > ?
        """, (week_ago,))
        active_users = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "timestamp": datetime.now().isoformat(),
            "database": {
                "users": user_count,
                "notes": note_count,
                "folders": folder_count,
                "comments": comment_count
            },
            "activity": {
                "notes_last_24h": notes_24h,
                "active_users_last_7d": active_users
            },
            "websocket": {
                "connected_clients": len(manager.active_connections)
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Metrics collection failed: {str(e)}"
        )

# Endpoint de saúde do sistema
@app.get("/health")
async def health_check():
    try:
        # Verificar banco de dados
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        conn.close()
        database_status = "healthy"
    except Exception:
        database_status = "error"
    
    try:
        # Verificar WebSocket
        websocket_status = "healthy" if len(manager.active_connections) >= 0 else "error"
    except Exception:
        websocket_status = "error"
    
    # Calcular uptime (em segundos)
    uptime = int(time.time() - startup_time)
    
    return {
        "status": "healthy" if database_status == "healthy" and websocket_status == "healthy" else "error",
        "uptime": uptime,
        "database": database_status,
        "websocket": websocket_status,
        "timestamp": time.time()
    }

# Endpoint para busca avançada com cache
@app.get("/search/advanced")
async def advanced_search(
    q: str = Query(..., min_length=2),
    folder_id: Optional[int] = None,
    user_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Busca avançada com filtros adicionais"""
    try:
        conn = sqlite3.connect('buresidian.db')
        cursor = conn.cursor()
        
        # Query base
        query = """
            SELECT DISTINCT n.id, n.title, n.content, n.created_at, n.updated_at, 
                   n.user_id, n.folder_id, f.name as folder_name
            FROM notes n
            LEFT JOIN folders f ON n.folder_id = f.id
            WHERE (n.title LIKE ? OR n.content LIKE ?)
        """
        params = [f"%{q}%", f"%{q}%"]
        
        # Adicionar filtros opcionais
        if folder_id:
            query += " AND n.folder_id = ?"
            params.append(folder_id)
            
        if user_id:
            query += " AND n.user_id = ?"
            params.append(user_id)
            
        if date_from:
            query += " AND n.created_at >= ?"
            params.append(date_from)
            
        if date_to:
            query += " AND n.created_at <= ?"
            params.append(date_to)
        
        # Ordenação e paginação
        query += " ORDER BY n.updated_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        notes = cursor.fetchall()
        
        # Contar total de resultados
        count_query = query.replace(
            "SELECT DISTINCT n.id, n.title, n.content, n.created_at, n.updated_at, n.user_id, n.folder_id, f.name as folder_name",
            "SELECT COUNT(DISTINCT n.id)"
        ).replace("ORDER BY n.updated_at DESC LIMIT ? OFFSET ?", "")
        cursor.execute(count_query, params[:-2])  # Remover limit e offset
        total_count = cursor.fetchone()[0]
        
        conn.close()
        
        results = []
        for note in notes:
            results.append({
                "id": note[0],
                "title": note[1],
                "content": note[2][:200] + "..." if len(note[2]) > 200 else note[2],
                "created_at": note[3],
                "updated_at": note[4],
                "user_id": note[5],
                "folder_id": note[6],
                "folder_name": note[7]
            })
        
        return {
            "results": results,
            "total_count": total_count,
            "page": offset // limit + 1,
            "per_page": limit,
            "has_more": offset + limit < total_count
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Advanced search failed: {str(e)}"
        )

# =================== CANVAS ENDPOINTS ===================

# 1) Boards REST
@app.get("/canvas/boards")
async def get_canvas_boards(current_user: dict = Depends(get_current_user)):
    """Listar boards do usuário"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, name, owner_id, created_at, updated_at
        FROM canvas_boards 
        WHERE owner_id = ? OR owner_id IS NULL
        ORDER BY updated_at DESC
    """, (current_user["id"],))
    
    boards = []
    for row in cursor.fetchall():
        boards.append({
            "id": row[0],
            "name": row[1],
            "owner_id": row[2],
            "created_at": row[3],
            "updated_at": row[4]
        })
    
    conn.close()
    return boards

@app.post("/canvas/boards")
async def create_canvas_board(board: CanvasBoardCreate, current_user: dict = Depends(get_current_user)):
    """Criar novo board"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO canvas_boards (name, owner_id)
        VALUES (?, ?)
    """, (board.name, current_user["id"]))
    
    board_id = cursor.lastrowid
    conn.commit()
    
    # Retornar o board criado
    cursor.execute("""
        SELECT id, name, owner_id, created_at, updated_at
        FROM canvas_boards WHERE id = ?
    """, (board_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    return {
        "id": row[0],
        "name": row[1],
        "owner_id": row[2],
        "created_at": row[3],
        "updated_at": row[4]
    }

@app.put("/canvas/boards/{board_id}")
async def update_canvas_board(board_id: int, board: CanvasBoardUpdate, current_user: dict = Depends(get_current_user)):
    """Renomear board"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se o usuário é owner
    cursor.execute("SELECT owner_id FROM canvas_boards WHERE id = ?", (board_id,))
    result = cursor.fetchone()
    
    if not result:
        conn.close()
        raise HTTPException(status_code=404, detail="Board not found")
    
    if result[0] != current_user["id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Atualizar
    cursor.execute("""
        UPDATE canvas_boards 
        SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (board.name, board_id))
    
    conn.commit()
    
    # Retornar board atualizado
    cursor.execute("""
        SELECT id, name, owner_id, created_at, updated_at
        FROM canvas_boards WHERE id = ?
    """, (board_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    return {
        "id": row[0],
        "name": row[1],
        "owner_id": row[2],
        "created_at": row[3],
        "updated_at": row[4]
    }

@app.delete("/canvas/boards/{board_id}")
async def delete_canvas_board(board_id: int, current_user: dict = Depends(get_current_user)):
    """Deletar board"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se o usuário é owner
    cursor.execute("SELECT owner_id FROM canvas_boards WHERE id = ?", (board_id,))
    result = cursor.fetchone()
    
    if not result:
        conn.close()
        raise HTTPException(status_code=404, detail="Board not found")
    
    if result[0] != current_user["id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Deletar (CASCADE remove nós e arestas)
    cursor.execute("DELETE FROM canvas_boards WHERE id = ?", (board_id,))
    conn.commit()
    conn.close()
    
    return {"message": "Board deleted successfully"}

# 2) Board state (nós + arestas)
@app.get("/canvas/boards/{board_id}/state")
async def get_canvas_board_state(board_id: int, current_user: dict = Depends(get_current_user)):
    """Obter estado completo do board (nós + arestas)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar acesso ao board
    cursor.execute("""
        SELECT id FROM canvas_boards 
        WHERE id = ? AND (owner_id = ? OR owner_id IS NULL)
    """, (board_id, current_user["id"]))
    
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Board not found or not authorized")
    
    # Buscar nós
    cursor.execute("""
        SELECT id, type, ref_note_id, text, url, x, y, width, height, color, z_index
        FROM canvas_nodes WHERE board_id = ?
        ORDER BY z_index, id
    """, (board_id,))
    
    nodes = []
    for row in cursor.fetchall():
        nodes.append({
            "id": row[0],
            "type": row[1],
            "ref_note_id": row[2],
            "text": row[3],
            "url": row[4],
            "x": row[5],
            "y": row[6],
            "width": row[7],
            "height": row[8],
            "color": row[9],
            "z_index": row[10]
        })
    
    # Buscar arestas
    cursor.execute("""
        SELECT id, source_node_id, target_node_id, label, style
        FROM canvas_edges WHERE board_id = ?
    """, (board_id,))
    
    edges = []
    for row in cursor.fetchall():
        edges.append({
            "id": row[0],
            "source_node_id": row[1],
            "target_node_id": row[2],
            "label": row[3],
            "style": row[4]
        })
    
    conn.close()
    return {"nodes": nodes, "edges": edges}

@app.put("/canvas/boards/{board_id}/state")
async def update_canvas_board_state(board_id: int, state: CanvasBoardState, current_user: dict = Depends(get_current_user)):
    """Salvar estado completo do board (substitui tudo)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar acesso ao board
    cursor.execute("""
        SELECT id FROM canvas_boards 
        WHERE id = ? AND (owner_id = ? OR owner_id IS NULL)
    """, (board_id, current_user["id"]))
    
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Board not found or not authorized")
    
    try:
        # Limpar estado atual
        cursor.execute("DELETE FROM canvas_edges WHERE board_id = ?", (board_id,))
        cursor.execute("DELETE FROM canvas_nodes WHERE board_id = ?", (board_id,))
        
        # Inserir nós
        for node in state.nodes:
            cursor.execute("""
                INSERT INTO canvas_nodes 
                (id, board_id, type, ref_note_id, text, url, x, y, width, height, color, z_index)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                node.get("id"), board_id, node["type"], node.get("ref_note_id"),
                node.get("text"), node.get("url"), node["x"], node["y"],
                node.get("width"), node.get("height"), node.get("color"), 
                node.get("z_index", 0)
            ))
        
        # Inserir arestas
        for edge in state.edges:
            cursor.execute("""
                INSERT INTO canvas_edges 
                (id, board_id, source_node_id, target_node_id, label, style)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                edge.get("id"), board_id, edge["source_node_id"], 
                edge["target_node_id"], edge.get("label"), edge.get("style")
            ))
        
        # Atualizar timestamp do board
        cursor.execute("""
            UPDATE canvas_boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
        """, (board_id,))
        
        conn.commit()
        conn.close()
        
        return {"message": "Board state updated successfully"}
        
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=400, detail=f"Error updating board state: {str(e)}")

# =================== CANVAS WEBSOCKET ===================
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar permissão
    cursor.execute("""
        SELECT b.*, u.username as owner
        FROM canvas_boards b
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN canvas_collaborators c ON b.id = c.board_id
        WHERE b.id = ? AND (b.user_id = ? OR c.user_id = ?)
    """, (board_id, current_user["id"], current_user["id"]))
    
    board_data = cursor.fetchone()
    if not board_data:
        conn.close()
        raise HTTPException(status_code=404, detail="Canvas board not found")
    
    # Buscar nós
    cursor.execute("""
        SELECT id, type, position_x, position_y, width, height, data, style, z_index
        FROM canvas_nodes WHERE board_id = ?
        ORDER BY z_index, created_at
    """, (board_id,))
    
    nodes = []
    for row in cursor.fetchall():
        nodes.append({
            "id": row[0],
            "type": row[1],
            "position": {"x": row[2], "y": row[3]},
            "data": json.loads(row[6]),
            "style": json.loads(row[7]) if row[7] else {},
            "width": row[4],
            "height": row[5],
            "zIndex": row[8]
        })
    
    # Buscar arestas
    cursor.execute("""
        SELECT id, source_node_id, target_node_id, source_handle, target_handle, label, style, animated
        FROM canvas_edges WHERE board_id = ?
    """, (board_id,))
    
    edges = []
    for row in cursor.fetchall():
        edges.append({
            "id": row[0],
            "source": row[1],
            "target": row[2],
            "sourceHandle": row[3],
            "targetHandle": row[4],
            "label": row[5],
            "style": json.loads(row[6]) if row[6] else {},
            "animated": bool(row[7])
        })
    
    board = {
        "id": board_data[0],
        "name": board_data[1],
        "description": board_data[2],
        "owner": board_data[9],
        "viewport": {
            "x": board_data[4],
            "y": board_data[5],
            "zoom": board_data[6]
        },
        "nodes": nodes,
        "edges": edges,
        "created_at": board_data[7],
        "updated_at": board_data[8]
    }
    
    conn.close()
    return board

@app.put("/canvas/boards/{board_id}")
async def update_canvas_board(board_id: int, board: CanvasBoardUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se é o dono ou tem permissão de edição
    cursor.execute("""
        SELECT b.user_id, c.permission
        FROM canvas_boards b
        LEFT JOIN canvas_collaborators c ON b.id = c.board_id AND c.user_id = ?
        WHERE b.id = ?
    """, (current_user["id"], board_id))
    
    result = cursor.fetchone()
    if not result or (result[0] != current_user["id"] and result[1] not in ['edit', 'admin']):
        conn.close()
        raise HTTPException(status_code=403, detail="No permission to edit this board")
    
    # Construir query de update dinamicamente
    updates = []
    params = []
    
    if board.name is not None:
        updates.append("name = ?")
        params.append(board.name)
    if board.description is not None:
        updates.append("description = ?")
        params.append(board.description)
    if board.viewport_x is not None:
        updates.append("viewport_x = ?")
        params.append(board.viewport_x)
    if board.viewport_y is not None:
        updates.append("viewport_y = ?")
        params.append(board.viewport_y)
    if board.viewport_zoom is not None:
        updates.append("viewport_zoom = ?")
        params.append(board.viewport_zoom)
    
    if updates:
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(board_id)
        
        query = f"UPDATE canvas_boards SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()
    
    conn.close()
    return {"message": "Canvas board updated successfully"}

# Canvas Nodes
@app.post("/canvas/boards/{board_id}/nodes")
async def create_canvas_node(board_id: int, node: CanvasNodeCreate, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar permissão
    cursor.execute("""
        SELECT b.user_id, c.permission
        FROM canvas_boards b
        LEFT JOIN canvas_collaborators c ON b.id = c.board_id AND c.user_id = ?
        WHERE b.id = ?
    """, (current_user["id"], board_id))
    
    result = cursor.fetchone()
    if not result or (result[0] != current_user["id"] and result[1] not in ['edit', 'admin']):
        conn.close()
        raise HTTPException(status_code=403, detail="No permission to edit this board")
    
    cursor.execute("""
        INSERT INTO canvas_nodes (id, board_id, type, position_x, position_y, width, height, data, style, z_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        node.id, board_id, node.type, node.position_x, node.position_y,
        node.width, node.height, json.dumps(node.data), json.dumps(node.style), node.z_index
    ))
    
    conn.commit()
    
    # Notificar via WebSocket
    await manager.broadcast_to_board(board_id, {
        "type": "node_created",
        "board_id": board_id,
        "node": {
            "id": node.id,
            "type": node.type,
            "position": {"x": node.position_x, "y": node.position_y},
            "data": node.data,
            "style": node.style,
            "width": node.width,
            "height": node.height,
            "zIndex": node.z_index
        },
        "user": current_user["username"]
    })
    
    conn.close()
    return {"message": "Canvas node created successfully"}

@app.put("/canvas/boards/{board_id}/nodes/{node_id}")
async def update_canvas_node(board_id: int, node_id: str, node: CanvasNodeUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar permissão
    cursor.execute("""
        SELECT b.user_id, c.permission
        FROM canvas_boards b
        LEFT JOIN canvas_collaborators c ON b.id = c.board_id AND c.user_id = ?
        WHERE b.id = ?
    """, (current_user["id"], board_id))
    
    result = cursor.fetchone()
    if not result or (result[0] != current_user["id"] and result[1] not in ['edit', 'admin']):
        conn.close()
        raise HTTPException(status_code=403, detail="No permission to edit this board")
    
    # Construir query de update
    updates = []
    params = []
    
    if node.position_x is not None:
        updates.append("position_x = ?")
        params.append(node.position_x)
    if node.position_y is not None:
        updates.append("position_y = ?")
        params.append(node.position_y)
    if node.width is not None:
        updates.append("width = ?")
        params.append(node.width)
    if node.height is not None:
        updates.append("height = ?")
        params.append(node.height)
    if node.data is not None:
        updates.append("data = ?")
        params.append(json.dumps(node.data))
    if node.style is not None:
        updates.append("style = ?")
        params.append(json.dumps(node.style))
    if node.z_index is not None:
        updates.append("z_index = ?")
        params.append(node.z_index)
    
    if updates:
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.extend([board_id, node_id])
        
        query = f"UPDATE canvas_nodes SET {', '.join(updates)} WHERE board_id = ? AND id = ?"
        cursor.execute(query, params)
        conn.commit()
        
        # Notificar via WebSocket
        await manager.broadcast_to_board(board_id, {
            "type": "node_updated",
            "board_id": board_id,
            "node_id": node_id,
            "updates": {
                "position_x": node.position_x,
                "position_y": node.position_y,
                "width": node.width,
                "height": node.height,
                "data": node.data,
                "style": node.style,
                "z_index": node.z_index
            },
            "user": current_user["username"]
        })
    
    conn.close()
    return {"message": "Canvas node updated successfully"}

@app.delete("/canvas/boards/{board_id}/nodes/{node_id}")
async def delete_canvas_node(board_id: int, node_id: str, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar permissão
    cursor.execute("""
        SELECT b.user_id, c.permission
        FROM canvas_boards b
        LEFT JOIN canvas_collaborators c ON b.id = c.board_id AND c.user_id = ?
        WHERE b.id = ?
    """, (current_user["id"], board_id))
    
    result = cursor.fetchone()
    if not result or (result[0] != current_user["id"] and result[1] not in ['edit', 'admin']):
        conn.close()
        raise HTTPException(status_code=403, detail="No permission to edit this board")
    
    cursor.execute("DELETE FROM canvas_nodes WHERE board_id = ? AND id = ?", (board_id, node_id))
    conn.commit()
    
    # Notificar via WebSocket
    await manager.broadcast_to_board(board_id, {
        "type": "node_deleted",
        "board_id": board_id,
        "node_id": node_id,
        "user": current_user["username"]
    })
    
    conn.close()
    return {"message": "Canvas node deleted successfully"}

# Canvas Edges
@app.post("/canvas/boards/{board_id}/edges")
async def create_canvas_edge(board_id: int, edge: CanvasEdgeCreate, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar permissão
    cursor.execute("""
        SELECT b.user_id, c.permission
        FROM canvas_boards b
        LEFT JOIN canvas_collaborators c ON b.id = c.board_id AND c.user_id = ?
        WHERE b.id = ?
    """, (current_user["id"], board_id))
    
    result = cursor.fetchone()
    if not result or (result[0] != current_user["id"] and result[1] not in ['edit', 'admin']):
        conn.close()
        raise HTTPException(status_code=403, detail="No permission to edit this board")
    
    cursor.execute("""
        INSERT INTO canvas_edges (id, board_id, source_node_id, target_node_id, source_handle, target_handle, label, style, animated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        edge.id, board_id, edge.source_node_id, edge.target_node_id,
        edge.source_handle, edge.target_handle, edge.label, json.dumps(edge.style), edge.animated
    ))
    
    conn.commit()
    
    # Notificar via WebSocket
    await manager.broadcast_to_board(board_id, {
        "type": "edge_created",
        "board_id": board_id,
        "edge": {
            "id": edge.id,
            "source": edge.source_node_id,
            "target": edge.target_node_id,
            "sourceHandle": edge.source_handle,
            "targetHandle": edge.target_handle,
            "label": edge.label,
            "style": edge.style,
            "animated": edge.animated
        },
        "user": current_user["username"]
    })
    
    conn.close()
    return {"message": "Canvas edge created successfully"}

@app.delete("/canvas/boards/{board_id}/edges/{edge_id}")
async def delete_canvas_edge(board_id: int, edge_id: str, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar permissão
    cursor.execute("""
        SELECT b.user_id, c.permission
        FROM canvas_boards b
        LEFT JOIN canvas_collaborators c ON b.id = c.board_id AND c.user_id = ?
        WHERE b.id = ?
    """, (current_user["id"], board_id))
    
    result = cursor.fetchone()
    if not result or (result[0] != current_user["id"] and result[1] not in ['edit', 'admin']):
        conn.close()
        raise HTTPException(status_code=403, detail="No permission to edit this board")
    
    cursor.execute("DELETE FROM canvas_edges WHERE board_id = ? AND id = ?", (board_id, edge_id))
    conn.commit()
    
    # Notificar via WebSocket
    await manager.broadcast_to_board(board_id, {
        "type": "edge_deleted",
        "board_id": board_id,
        "edge_id": edge_id,
        "user": current_user["username"]
    })
    
    conn.close()
    return {"message": "Canvas edge deleted successfully"}

# Canvas Export/Import
@app.get("/canvas/boards/{board_id}/export")
async def export_canvas_board(board_id: int, current_user: dict = Depends(get_current_user)):
    board_data = await get_canvas_board(board_id, current_user)
    return board_data

@app.post("/canvas/boards/{board_id}/import")
async def import_canvas_board(board_id: int, board_data: dict, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar permissão
    cursor.execute("""
        SELECT b.user_id, c.permission
        FROM canvas_boards b
        LEFT JOIN canvas_collaborators c ON b.id = c.board_id AND c.user_id = ?
        WHERE b.id = ?
    """, (current_user["id"], board_id))
    
    result = cursor.fetchone()
    if not result or (result[0] != current_user["id"] and result[1] not in ['edit', 'admin']):
        conn.close()
        raise HTTPException(status_code=403, detail="No permission to edit this board")
    
    # Limpar board atual
    cursor.execute("DELETE FROM canvas_edges WHERE board_id = ?", (board_id,))
    cursor.execute("DELETE FROM canvas_nodes WHERE board_id = ?", (board_id,))
    
    # Importar nodes
    for node in board_data.get('nodes', []):
        cursor.execute("""
            INSERT INTO canvas_nodes (id, board_id, type, position_x, position_y, width, height, data, style, z_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            node['id'], board_id, node['type'], 
            node['position']['x'], node['position']['y'],
            node.get('width', 200), node.get('height', 150),
            json.dumps(node['data']), json.dumps(node.get('style', {})),
            node.get('zIndex', 0)
        ))
    
    # Importar edges
    for edge in board_data.get('edges', []):
        cursor.execute("""
            INSERT INTO canvas_edges (id, board_id, source_node_id, target_node_id, source_handle, target_handle, label, style, animated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            edge['id'], board_id, edge['source'], edge['target'],
            edge.get('sourceHandle', ''), edge.get('targetHandle', ''),
            edge.get('label', ''), json.dumps(edge.get('style', {})),
            edge.get('animated', False)
        ))
    
    conn.commit()
    conn.close()
    
    return {"message": "Canvas board imported successfully"}

# =================== CANVAS WEBSOCKET ===================

# Gerenciador de rooms Canvas
canvas_rooms: dict = {}  # {board_id: {connections: set, state_cache: dict}}
canvas_debounce_tasks: dict = {}  # {board_id: asyncio.Task}

class CanvasConnectionManager:
    def __init__(self):
        self.rooms = canvas_rooms
    
    def add_connection(self, board_id: int, websocket: WebSocket):
        if board_id not in self.rooms:
            self.rooms[board_id] = {"connections": set(), "state_cache": {}}
        self.rooms[board_id]["connections"].add(websocket)
    
    def remove_connection(self, board_id: int, websocket: WebSocket):
        if board_id in self.rooms:
            self.rooms[board_id]["connections"].discard(websocket)
            if not self.rooms[board_id]["connections"]:
                del self.rooms[board_id]
    
    async def broadcast(self, board_id: int, message: dict, exclude: WebSocket = None):
        if board_id in self.rooms:
            for ws in self.rooms[board_id]["connections"].copy():
                if ws != exclude:
                    try:
                        await ws.send_text(json.dumps(message))
                    except:
                        self.rooms[board_id]["connections"].discard(ws)

canvas_manager = CanvasConnectionManager()

async def persist_canvas_state(board_id: int):
    """Persiste o estado do canvas no banco com debounce"""
    await asyncio.sleep(0.6)  # 600ms debounce
    
    if board_id in canvas_rooms and "state_cache" in canvas_rooms[board_id]:
        state = canvas_rooms[board_id]["state_cache"]
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Limpar e recriar estado
            cursor.execute("DELETE FROM canvas_edges WHERE board_id = ?", (board_id,))
            cursor.execute("DELETE FROM canvas_nodes WHERE board_id = ?", (board_id,))
            
            # Inserir nós
            for node in state.get("nodes", []):
                cursor.execute("""
                    INSERT INTO canvas_nodes 
                    (id, board_id, type, ref_note_id, text, url, x, y, width, height, color, z_index)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    node.get("id"), board_id, node["type"], node.get("ref_note_id"),
                    node.get("text"), node.get("url"), node["x"], node["y"],
                    node.get("width"), node.get("height"), node.get("color"), 
                    node.get("z_index", 0)
                ))
            
            # Inserir arestas
            for edge in state.get("edges", []):
                cursor.execute("""
                    INSERT INTO canvas_edges 
                    (id, board_id, source_node_id, target_node_id, label, style)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    edge.get("id"), board_id, edge["source_node_id"], 
                    edge["target_node_id"], edge.get("label"), edge.get("style")
                ))
            
            cursor.execute("UPDATE canvas_boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (board_id,))
            conn.commit()
            
        except Exception as e:
            conn.rollback()
            print(f"Error persisting canvas state: {e}")
        finally:
            conn.close()
    
    # Limpar task
    if board_id in canvas_debounce_tasks:
        del canvas_debounce_tasks[board_id]

@app.websocket("/ws/canvas/{board_id}")
async def canvas_websocket(websocket: WebSocket, board_id: int, token: str = Query(...)):
    """WebSocket para colaboração em tempo real no Canvas"""
    
    # Validar token
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=1008, reason="Invalid token")
            return
        
        # Buscar usuário
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, username FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            await websocket.close(code=1008, reason="User not found")
            return
            
        current_user = {"id": user[0], "username": user[1]}
        
    except JWTError:
        await websocket.close(code=1008, reason="Invalid token")
        return
    
    # Verificar acesso ao board
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id FROM canvas_boards 
        WHERE id = ? AND (owner_id = ? OR owner_id IS NULL)
    """, (board_id, current_user["id"]))
    
    if not cursor.fetchone():
        conn.close()
        await websocket.close(code=1008, reason="Board not found or not authorized")
        return
    
    conn.close()
    
    await websocket.accept()
    canvas_manager.add_connection(board_id, websocket)
    
    # Enviar estado atual + contagem online na conexão
    try:
        # Buscar estado atual
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, type, ref_note_id, text, url, x, y, width, height, color, z_index
            FROM canvas_nodes WHERE board_id = ?
        """, (board_id,))
        
        nodes = []
        for row in cursor.fetchall():
            nodes.append({
                "id": row[0], "type": row[1], "ref_note_id": row[2],
                "text": row[3], "url": row[4], "x": row[5], "y": row[6],
                "width": row[7], "height": row[8], "color": row[9], "z_index": row[10]
            })
        
        cursor.execute("""
            SELECT id, source_node_id, target_node_id, label, style
            FROM canvas_edges WHERE board_id = ?
        """, (board_id,))
        
        edges = []
        for row in cursor.fetchall():
            edges.append({
                "id": row[0], "source_node_id": row[1], "target_node_id": row[2],
                "label": row[3], "style": row[4]
            })
        
        conn.close()
        
        online_count = len(canvas_rooms.get(board_id, {}).get("connections", set()))
        
        await websocket.send_text(json.dumps({
            "type": "state",
            "nodes": nodes,
            "edges": edges,
            "online": online_count
        }))
        
        # Notificar outros usuários sobre novo usuário online
        await canvas_manager.broadcast(board_id, {
            "type": "user_joined",
            "online": online_count
        }, exclude=websocket)
        
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message["type"] == "sync":
                    # Enviar estado atual
                    online_count = len(canvas_rooms[board_id]["connections"])
                    await websocket.send_text(json.dumps({
                        "type": "state",
                        "nodes": nodes,
                        "edges": edges,
                        "online": online_count
                    }))
                
                elif message["type"] == "op":
                    # Operação de mudança
                    op = message["op"]
                    data = message["data"]
                    
                    # Atualizar cache em memória
                    if board_id not in canvas_rooms:
                        canvas_rooms[board_id] = {"connections": set(), "state_cache": {"nodes": [], "edges": []}}
                    
                    cache = canvas_rooms[board_id]["state_cache"]
                    if "nodes" not in cache:
                        cache["nodes"] = nodes.copy()
                    if "edges" not in cache:
                        cache["edges"] = edges.copy()
                    
                    # Aplicar operação
                    if op == "add_node":
                        cache["nodes"].append(data)
                        nodes.append(data)
                    elif op == "update_node":
                        for i, node in enumerate(cache["nodes"]):
                            if node["id"] == data["id"]:
                                cache["nodes"][i] = data
                                nodes[i] = data
                                break
                    elif op == "delete_node":
                        cache["nodes"] = [n for n in cache["nodes"] if n["id"] != data["id"]]
                        nodes = [n for n in nodes if n["id"] != data["id"]]
                    elif op == "add_edge":
                        cache["edges"].append(data)
                        edges.append(data)
                    elif op == "update_edge":
                        for i, edge in enumerate(cache["edges"]):
                            if edge["id"] == data["id"]:
                                cache["edges"][i] = data
                                edges[i] = data
                                break
                    elif op == "delete_edge":
                        cache["edges"] = [e for e in cache["edges"] if e["id"] != data["id"]]
                        edges = [e for e in edges if e["id"] != data["id"]]
                    
                    # Broadcast para outros clientes
                    await canvas_manager.broadcast(board_id, message, exclude=websocket)
                    
                    # Agendar persistência com debounce
                    if board_id in canvas_debounce_tasks:
                        canvas_debounce_tasks[board_id].cancel()
                    
                    canvas_debounce_tasks[board_id] = asyncio.create_task(
                        persist_canvas_state(board_id)
                    )
                
                elif message["type"] == "presence":
                    # Repassar cursor/presença para outros
                    await canvas_manager.broadcast(board_id, message, exclude=websocket)
                    
        except WebSocketDisconnect:
            pass
        except Exception as e:
            print(f"Canvas WebSocket error: {e}")
            
    finally:
        canvas_manager.remove_connection(board_id, websocket)
        
        # Notificar sobre usuário saindo
        if board_id in canvas_rooms:
            online_count = len(canvas_rooms[board_id]["connections"])
            await canvas_manager.broadcast(board_id, {
                "type": "user_left",
                "online": online_count
            })

# =================== GRAPH VIEW ENDPOINTS ===================

@app.get("/api/graph/connections")
async def get_graph_connections(
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna todas as conexões entre notas para o Graph View
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Buscar todas as notas do usuário
        cursor.execute("""
            SELECT id, title, content, created_at, updated_at, folder_id
            FROM notes WHERE user_id = ?
            ORDER BY updated_at DESC
        """, (current_user["id"],))
        
        notes = cursor.fetchall()
        
        # Estrutura para o grafo
        nodes = []
        edges = []
        
        # Criar nós do grafo
        for note in notes:
            note_id, title, content, created_at, updated_at, folder_id = note
            
            # Extrair tags da nota
            tags = []
            if content:
                # Buscar tags no formato #tag
                import re
                tag_matches = re.findall(r'#([a-zA-Z0-9_/-]+)', content)
                tags = list(set(tag_matches))
            
            nodes.append({
                "id": str(note_id),
                "title": title,
                "content_preview": content[:100] if content else "",
                "tags": tags,
                "created_at": created_at,
                "updated_at": updated_at,
                "word_count": len(content.split()) if content else 0,
                "folder_id": folder_id,
                "type": "note"
            })
        
        # Buscar referências entre notas (links do tipo [[Nota]])
        for note in notes:
            note_id, title, content, _, _, _ = note
            if content:
                # Buscar referências no formato [[título da nota]]
                import re
                referenced_titles = re.findall(r'\[\[([^\]]+)\]\]', content)
                
                for ref_title in referenced_titles:
                    # Encontrar nota referenciada
                    cursor.execute("""
                        SELECT id FROM notes 
                        WHERE user_id = ? AND LOWER(title) LIKE LOWER(?)
                    """, (current_user["id"], f"%{ref_title}%"))
                    
                    referenced_note = cursor.fetchone()
                    
                    if referenced_note:
                        edges.append({
                            "id": f"edge-{note_id}-{referenced_note[0]}",
                            "source": str(note_id),
                            "target": str(referenced_note[0]),
                            "type": "reference",
                            "strength": 1
                        })
        
        # Adicionar conexões por tags compartilhadas
        tag_connections = {}
        for note in notes:
            note_id, title, content, _, _, _ = note
            if content:
                import re
                note_tags = re.findall(r'#([a-zA-Z0-9_/-]+)', content)
                for tag in note_tags:
                    if tag not in tag_connections:
                        tag_connections[tag] = []
                    tag_connections[tag].append(str(note_id))
        
        # Criar arestas para notas com tags compartilhadas
        for tag, note_ids in tag_connections.items():
            if len(note_ids) > 1:
                for i in range(len(note_ids)):
                    for j in range(i + 1, len(note_ids)):
                        # Verificar se já existe uma aresta de referência
                        existing_edge = any(
                            (edge["source"] == note_ids[i] and edge["target"] == note_ids[j]) or
                            (edge["source"] == note_ids[j] and edge["target"] == note_ids[i])
                            for edge in edges
                        )
                        
                        if not existing_edge:
                            edges.append({
                                "id": f"tag-{note_ids[i]}-{note_ids[j]}-{tag}",
                                "source": note_ids[i],
                                "target": note_ids[j],
                                "type": "tag",
                                "tag": tag,
                                "strength": 0.5
                            })
        
        conn.close()
        
        return {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "total_notes": len(nodes),
                "total_connections": len(edges),
                "orphaned_notes": len([n for n in nodes if not any(
                    e["source"] == n["id"] or e["target"] == n["id"] for e in edges
                )])
            }
        }
        
    except Exception as e:
        print(f"Erro ao buscar conexões do grafo: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@app.get("/api/graph/tags")
async def get_all_tags(
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna todas as tags utilizadas pelo usuário
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, title, content FROM notes WHERE user_id = ?
        """, (current_user["id"],))
        
        notes = cursor.fetchall()
        tag_stats = {}
        
        for note in notes:
            note_id, title, content = note
            if content:
                # Extrair tags
                import re
                tags = re.findall(r'#([a-zA-Z0-9_/-]+)', content)
                
                for tag in tags:
                    if tag not in tag_stats:
                        tag_stats[tag] = {
                            "name": tag,
                            "count": 0,
                            "notes": []
                        }
                    tag_stats[tag]["count"] += 1
                    tag_stats[tag]["notes"].append({
                        "id": note_id,
                        "title": title
                    })
        
        # Organizar tags por hierarquia
        hierarchical_tags = {}
        for tag_name, tag_data in tag_stats.items():
            parts = tag_name.split('/')
            current_level = hierarchical_tags
            
            for part in parts:
                if part not in current_level:
                    current_level[part] = {
                        "name": part,
                        "children": {},
                        "data": None
                    }
                current_level = current_level[part]["children"]
            
            # Adicionar dados na folha
            if parts:
                target = hierarchical_tags
                for part in parts[:-1]:
                    target = target[part]["children"]
                target[parts[-1]]["data"] = tag_data
        
        conn.close()
        
        return {
            "flat_tags": list(tag_stats.values()),
            "hierarchical_tags": hierarchical_tags,
            "total_tags": len(tag_stats)
        }
        
    except Exception as e:
        print(f"Erro ao buscar tags: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

# =================== SISTEMA DE TAGS AVANÇADO ===================

@app.get("/api/tags/autocomplete")
async def get_tags_autocomplete(
    query: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user)
):
    """
    Autocomplete para tags baseado no input do usuário
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, title, content FROM notes WHERE user_id = ?
        """, (current_user["id"],))
        
        notes = cursor.fetchall()
        all_tags = set()
        
        for note in notes:
            note_id, title, content = note
            if content:
                import re
                tags = re.findall(r'#([a-zA-Z0-9_/-]+)', content)
                all_tags.update(tags)
        
        # Filtrar tags que contêm a query
        query_lower = query.lower()
        matching_tags = [
            tag for tag in all_tags 
            if query_lower in tag.lower()
        ]
        
        # Ordenar por relevância (começar com a query tem prioridade)
        matching_tags.sort(key=lambda x: (
            not x.lower().startswith(query_lower),  # Tags que começam com query primeiro
            len(x),  # Tags mais curtas primeiro
            x.lower()  # Ordem alfabética
        ))
        
        conn.close()
        
        return {
            "suggestions": matching_tags[:10],  # Limitar a 10 sugestões
            "query": query
        }
        
    except Exception as e:
        print(f"Erro no autocomplete de tags: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@app.get("/api/tags/hierarchy")
async def get_tags_hierarchy(
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna estrutura hierárquica de tags (#tag/subtag/subsubtag)
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, title, content FROM notes WHERE user_id = ?
        """, (current_user["id"],))
        
        notes = cursor.fetchall()
        tag_hierarchy = {}
        
        for note in notes:
            note_id, title, content = note
            if content:
                import re
                tags = re.findall(r'#([a-zA-Z0-9_/-]+)', content)
                
                for tag in tags:
                    parts = tag.split('/')
                    current_level = tag_hierarchy
                    
                    # Criar estrutura hierárquica
                    for i, part in enumerate(parts):
                        if part not in current_level:
                            current_level[part] = {
                                "name": part,
                                "fullPath": '/'.join(parts[:i+1]),
                                "children": {},
                                "notes": [],
                                "count": 0
                            }
                        
                        current_level[part]["notes"].append({
                            "id": note_id,
                            "title": title
                        })
                        current_level[part]["count"] += 1
                        current_level = current_level[part]["children"]
        
        conn.close()
        
        return {"hierarchy": tag_hierarchy}
        
    except Exception as e:
        print(f"Erro ao buscar hierarquia de tags: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@app.get("/api/tags/{tag_path:path}/notes")
async def get_notes_by_tag(
    tag_path: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna todas as notas que contêm uma tag específica
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, title, content, created_at, updated_at, folder_id 
            FROM notes WHERE user_id = ?
        """, (current_user["id"],))
        
        notes = cursor.fetchall()
        matching_notes = []
        
        for note in notes:
            note_id, title, content, created_at, updated_at, folder_id = note
            if content:
                import re
                tags = re.findall(r'#([a-zA-Z0-9_/-]+)', content)
                
                # Verificar se a tag ou uma sub-tag corresponde
                for tag in tags:
                    if tag == tag_path or tag.startswith(tag_path + '/'):
                        matching_notes.append({
                            "id": note_id,
                            "title": title,
                            "content": content[:200] + "..." if len(content) > 200 else content,
                            "created_at": created_at,
                            "updated_at": updated_at,
                            "folder_id": folder_id,
                            "matched_tag": tag
                        })
                        break
        
        conn.close()
        
        return {
            "tag": tag_path,
            "notes": matching_notes,
            "count": len(matching_notes)
        }
        
    except Exception as e:
        print(f"Erro ao buscar notas por tag: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@app.get("/api/tags/popular")
async def get_popular_tags(
    limit: int = Query(20, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna as tags mais populares do usuário
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, title, content FROM notes WHERE user_id = ?
        """, (current_user["id"],))
        
        notes = cursor.fetchall()
        tag_counts = {}
        
        for note in notes:
            note_id, title, content = note
            if content:
                import re
                tags = re.findall(r'#([a-zA-Z0-9_/-]+)', content)
                
                for tag in tags:
                    if tag not in tag_counts:
                        tag_counts[tag] = 0
                    tag_counts[tag] += 1
        
        # Ordenar por contagem e limitar
        popular_tags = sorted(
            tag_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]
        
        conn.close()
        
        return {
            "popular_tags": [
                {"name": tag, "count": count}
                for tag, count in popular_tags
            ]
        }
        
    except Exception as e:
        print(f"Erro ao buscar tags populares: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

# =================== SISTEMA DE BACKLINKS E MENTIONS ===================

@app.get("/api/notes/{note_id}/backlinks")
async def get_note_backlinks(
    note_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna todas as notas que fazem referência à nota especificada
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Buscar a nota alvo
        cursor.execute("""
            SELECT id, title, content FROM notes 
            WHERE id = ? AND user_id = ?
        """, (note_id, current_user["id"]))
        
        target_note = cursor.fetchone()
        if not target_note:
            raise HTTPException(status_code=404, detail="Nota não encontrada")
        
        target_id, target_title, target_content = target_note
        
        # Buscar todas as outras notas do usuário
        cursor.execute("""
            SELECT id, title, content, created_at, updated_at, folder_id
            FROM notes WHERE user_id = ? AND id != ?
        """, (current_user["id"], note_id))
        
        all_notes = cursor.fetchall()
        backlinks = []
        
        import re
        
        for note in all_notes:
            note_id_ref, title, content, created_at, updated_at, folder_id = note
            if content:
                # Buscar referências [[título da nota]] ou [[link|display]]
                wiki_links = re.findall(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', content)
                
                # Verificar se algum link aponta para a nota alvo
                for link_data in wiki_links:
                    link_target = link_data[0].strip()
                    link_display = link_data[1].strip() if link_data[1] else link_target
                    
                    # Verificar se o link corresponde ao título da nota alvo
                    if link_target.lower() == target_title.lower():
                        # Extrair contexto ao redor do link
                        link_pattern = re.escape(f"[[{link_data[0]}]]") if not link_data[1] else re.escape(f"[[{link_data[0]}|{link_data[1]}]]")
                        match = re.search(f'.{{0,50}}{link_pattern}.{{0,50}}', content)
                        context = match.group(0) if match else content[:100]
                        
                        backlinks.append({
                            "note_id": note_id_ref,
                            "title": title,
                            "context": context,
                            "link_text": link_display,
                            "created_at": created_at,
                            "updated_at": updated_at,
                            "folder_id": folder_id
                        })
                        break
                
                # Buscar menções diretas do título
                if target_title.lower() in content.lower():
                    # Não adicionar se já foi adicionado como wiki link
                    already_added = any(bl["note_id"] == note_id_ref for bl in backlinks)
                    if not already_added:
                        # Extrair contexto ao redor da menção
                        title_pattern = re.escape(target_title)
                        match = re.search(f'.{{0,50}}{title_pattern}.{{0,50}}', content, re.IGNORECASE)
                        context = match.group(0) if match else content[:100]
                        
                        backlinks.append({
                            "note_id": note_id_ref,
                            "title": title,
                            "context": context,
                            "link_text": target_title,
                            "created_at": created_at,
                            "updated_at": updated_at,
                            "folder_id": folder_id,
                            "is_mention": True
                        })
        
        conn.close()
        
        return {
            "note_id": target_id,
            "note_title": target_title,
            "backlinks": backlinks,
            "total_backlinks": len(backlinks)
        }
        
    except Exception as e:
        print(f"Erro ao buscar backlinks: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@app.get("/api/notes/{note_id}/outlinks")
async def get_note_outlinks(
    note_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna todas as referências que a nota faz para outras notas
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Buscar a nota
        cursor.execute("""
            SELECT id, title, content FROM notes 
            WHERE id = ? AND user_id = ?
        """, (note_id, current_user["id"]))
        
        source_note = cursor.fetchone()
        if not source_note:
            raise HTTPException(status_code=404, detail="Nota não encontrada")
        
        source_id, source_title, source_content = source_note
        
        if not source_content:
            return {
                "note_id": source_id,
                "note_title": source_title,
                "outlinks": [],
                "total_outlinks": 0
            }
        
        # Buscar todas as outras notas para encontrar correspondências
        cursor.execute("""
            SELECT id, title, content FROM notes 
            WHERE user_id = ? AND id != ?
        """, (current_user["id"], note_id))
        
        all_notes = cursor.fetchall()
        outlinks = []
        
        import re
        
        # Extrair todos os wiki links da nota fonte
        wiki_links = re.findall(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', source_content)
        
        for link_data in wiki_links:
            link_target = link_data[0].strip()
            link_display = link_data[1].strip() if link_data[1] else link_target
            
            # Buscar nota correspondente
            matching_note = None
            for note in all_notes:
                note_id_target, title, content = note
                if title.lower() == link_target.lower():
                    matching_note = {
                        "note_id": note_id_target,
                        "title": title,
                        "exists": True
                    }
                    break
            
            if not matching_note:
                # Link quebrado
                matching_note = {
                    "note_id": None,
                    "title": link_target,
                    "exists": False
                }
            
            # Extrair contexto
            link_pattern = re.escape(f"[[{link_data[0]}]]") if not link_data[1] else re.escape(f"[[{link_data[0]}|{link_data[1]}]]")
            match = re.search(f'.{{0,50}}{link_pattern}.{{0,50}}', source_content)
            context = match.group(0) if match else ""
            
            outlinks.append({
                **matching_note,
                "link_text": link_display,
                "context": context
            })
        
        conn.close()
        
        return {
            "note_id": source_id,
            "note_title": source_title,
            "outlinks": outlinks,
            "total_outlinks": len(outlinks)
        }
        
    except Exception as e:
        print(f"Erro ao buscar outlinks: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@app.get("/api/notes/broken-links")
async def get_broken_links(
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna todos os links quebrados no sistema do usuário
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, title, content FROM notes WHERE user_id = ?
        """, (current_user["id"],))
        
        all_notes = cursor.fetchall()
        broken_links = []
        
        import re
        
        # Criar um mapa de títulos para verificação rápida
        title_map = {note[1].lower(): note for note in all_notes}
        
        for note in all_notes:
            note_id, title, content = note
            if content:
                # Extrair wiki links
                wiki_links = re.findall(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', content)
                
                for link_data in wiki_links:
                    link_target = link_data[0].strip()
                    link_display = link_data[1].strip() if link_data[1] else link_target
                    
                    # Verificar se o link aponta para uma nota existente
                    if link_target.lower() not in title_map:
                        # Extrair contexto
                        link_pattern = re.escape(f"[[{link_data[0]}]]") if not link_data[1] else re.escape(f"[[{link_data[0]}|{link_data[1]}]]")
                        match = re.search(f'.{{0,50}}{link_pattern}.{{0,50}}', content)
                        context = match.group(0) if match else ""
                        
                        broken_links.append({
                            "source_note_id": note_id,
                            "source_note_title": title,
                            "broken_link": link_target,
                            "link_display": link_display,
                            "context": context
                        })
        
        conn.close()
        
        return {
            "broken_links": broken_links,
            "total_broken": len(broken_links)
        }
        
    except Exception as e:
        print(f"Erro ao buscar links quebrados: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@app.get("/api/notes/link-suggestions")
async def get_link_suggestions(
    query: str = Query(..., min_length=2),
    current_user: dict = Depends(get_current_user)
):
    """
    Sugere notas para criação de links baseado na query
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Buscar notas que correspondem à query
        cursor.execute("""
            SELECT id, title, content, updated_at FROM notes 
            WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)
            ORDER BY updated_at DESC
            LIMIT 10
        """, (current_user["id"], f"%{query}%", f"%{query}%"))
        
        notes = cursor.fetchall()
        suggestions = []
        
        for note in notes:
            note_id, title, content, updated_at = note
            
            # Calcular relevância
            title_score = 2 if query.lower() in title.lower() else 0
            content_score = 1 if query.lower() in content.lower() else 0
            relevance = title_score + content_score
            
            suggestions.append({
                "note_id": note_id,
                "title": title,
                "snippet": content[:100] + "..." if len(content) > 100 else content,
                "updated_at": updated_at,
                "relevance": relevance
            })
        
        # Ordenar por relevância
        suggestions.sort(key=lambda x: x["relevance"], reverse=True)
        
        conn.close()
        
        return {
            "query": query,
            "suggestions": suggestions
        }
        
    except Exception as e:
        print(f"Erro ao buscar sugestões de links: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

# =================== QUICK SWITCHER / BUSCA GLOBAL ===================

@app.get("/api/search/global")
async def global_search(
    query: str = Query(..., min_length=1),
    limit: int = Query(10, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Busca global por notas, tags e pastas para o Quick Switcher
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        results = []
        query_lower = query.lower()
        
        # Buscar notas
        cursor.execute("""
            SELECT id, title, content, updated_at, folder_id FROM notes 
            WHERE user_id = ? AND (
                LOWER(title) LIKE ? OR 
                LOWER(content) LIKE ?
            )
            ORDER BY 
                CASE 
                    WHEN LOWER(title) = ? THEN 1
                    WHEN LOWER(title) LIKE ? THEN 2
                    WHEN LOWER(title) LIKE ? THEN 3
                    ELSE 4
                END,
                updated_at DESC
            LIMIT ?
        """, (
            current_user["id"], 
            f"%{query_lower}%", 
            f"%{query_lower}%",
            query_lower,  # título exato
            f"{query_lower}%",  # título começa com
            f"%{query_lower}%",  # título contém
            limit
        ))
        
        notes = cursor.fetchall()
        for note in notes:
            note_id, title, content, updated_at, folder_id = note
            
            # Calcular score de relevância
            score = 0
            if title.lower() == query_lower:
                score = 100
            elif title.lower().startswith(query_lower):
                score = 50
            elif query_lower in title.lower():
                score = 20
            
            if content and query_lower in content.lower():
                score += 10
            
            # Snippet do conteúdo
            snippet = ""
            if content:
                # Encontrar a primeira ocorrência da query no conteúdo
                content_lower = content.lower()
                query_index = content_lower.find(query_lower)
                if query_index != -1:
                    start = max(0, query_index - 50)
                    end = min(len(content), query_index + len(query) + 50)
                    snippet = content[start:end]
                    if start > 0:
                        snippet = "..." + snippet
                    if end < len(content):
                        snippet = snippet + "..."
                else:
                    snippet = content[:100] + ("..." if len(content) > 100 else "")
            
            results.append({
                "id": note_id,
                "title": title,
                "type": "note",
                "snippet": snippet,
                "updated_at": updated_at,
                "folder_id": folder_id,
                "score": score
            })
        
        # Buscar pastas
        cursor.execute("""
            SELECT id, name, parent_id FROM folders 
            WHERE user_id = ? AND LOWER(name) LIKE ?
            ORDER BY 
                CASE 
                    WHEN LOWER(name) = ? THEN 1
                    WHEN LOWER(name) LIKE ? THEN 2
                    ELSE 3
                END
            LIMIT ?
        """, (
            current_user["id"], 
            f"%{query_lower}%",
            query_lower,
            f"{query_lower}%",
            5  # Limitar pastas
        ))
        
        folders = cursor.fetchall()
        for folder in folders:
            folder_id, name, parent_id = folder
            
            score = 0
            if name.lower() == query_lower:
                score = 80
            elif name.lower().startswith(query_lower):
                score = 40
            else:
                score = 15
            
            results.append({
                "id": folder_id,
                "title": name,
                "type": "folder",
                "snippet": "Pasta",
                "parent_id": parent_id,
                "score": score
            })
        
        # Buscar tags (usar sistema de tags existente)
        cursor.execute("""
            SELECT id, title, content FROM notes WHERE user_id = ?
        """, (current_user["id"],))
        
        all_notes = cursor.fetchall()
        tag_matches = set()
        
        import re
        for note in all_notes:
            note_id, title, content = note
            if content:
                tags = re.findall(r'#([a-zA-Z0-9_/-]+)', content)
                for tag in tags:
                    if query_lower in tag.lower():
                        tag_matches.add(tag)
        
        for tag in list(tag_matches)[:5]:  # Limitar tags
            score = 0
            if tag.lower() == query_lower:
                score = 70
            elif tag.lower().startswith(query_lower):
                score = 35
            else:
                score = 12
            
            results.append({
                "id": f"tag-{tag}",
                "title": f"#{tag}",
                "type": "tag",
                "snippet": f"Tag: {tag}",
                "tag": tag,
                "score": score
            })
        
        conn.close()
        
        # Ordenar por score e limitar
        results.sort(key=lambda x: x["score"], reverse=True)
        results = results[:limit]
        
        return {
            "query": query,
            "results": results,
            "total": len(results)
        }
        
    except Exception as e:
        print(f"Erro na busca global: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@app.get("/notes/search")
async def search_notes(
    query: str = Query(..., min_length=1),
    limit: int = Query(10, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Busca específica em notas para compatibilidade
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query_lower = query.lower()
        
        cursor.execute("""
            SELECT id, title, content, created_at, updated_at, folder_id 
            FROM notes 
            WHERE user_id = ? AND (
                LOWER(title) LIKE ? OR 
                LOWER(content) LIKE ?
            )
            ORDER BY 
                CASE 
                    WHEN LOWER(title) = ? THEN 1
                    WHEN LOWER(title) LIKE ? THEN 2
                    WHEN LOWER(title) LIKE ? THEN 3
                    ELSE 4
                END,
                updated_at DESC
            LIMIT ?
        """, (
            current_user["id"], 
            f"%{query_lower}%", 
            f"%{query_lower}%",
            query_lower,
            f"{query_lower}%",
            f"%{query_lower}%",
            limit
        ))
        
        notes = cursor.fetchall()
        results = []
        
        for note in notes:
            note_id, title, content, created_at, updated_at, folder_id = note
            results.append({
                "id": note_id,
                "title": title,
                "content": content[:200] + ("..." if len(content or "") > 200 else ""),
                "created_at": created_at,
                "updated_at": updated_at,
                "folder_id": folder_id
            })
        
        conn.close()
        
        return results
        
    except Exception as e:
        print(f"Erro na busca de notas: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

if __name__ == "__main__":
    init_db()
    uvicorn.run(app, host="0.0.0.0", port=8000)
