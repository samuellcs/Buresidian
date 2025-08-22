# Buresidian - Sistema Colaborativo de Notas

Um sistema local estilo "Obsidian colaborativo" para criar, organizar e editar notas em Markdown com colaboração em tempo real.

## ✨ Funcionalidades

- 📝 **Editor Markdown**: Criação e edição de notas com suporte completo a Markdown
- 🗂️ **Organização**: Sistema de pastas para organizar suas notas
- 👥 **Colaboração em Tempo Real**: Edição simultânea via WebSocket
- 💬 **Comentários**: Sistema de comentários nas notas
- 🔍 **Busca**: Busca por título e conteúdo das notas
- 🖼️ **Upload de Imagens**: Suporte a imagens com armazenamento local
- 🌙 **Tema Escuro**: Interface inspirada no Obsidian com cores preto e roxo
- 🔐 **Autenticação Simples**: Login local com JWT

## 🚀 Como Rodar

### Pré-requisitos
- Docker e Docker Compose instalados
- Porta 5173 (frontend) e 8000 (backend) disponíveis

### Iniciando o Sistema

```bash
# Clone o repositório (se não estiver local)
git clone <repo-url>
cd Buresidian

# Subir os serviços
docker compose up

# Para rodar em background
docker compose up -d
```

### Acessando o Sistema

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Documentação API**: http://localhost:8000/docs

### Login Demo

- **Usuário**: `demo`
- **Senha**: `demo123`

## 🛠️ Stack Tecnológica

### Backend
- **Python 3.11** com FastAPI
- **SQLite** para banco de dados local
- **WebSocket** para colaboração em tempo real
- **JWT** para autenticação
- **Uvicorn** como servidor ASGI

### Frontend
- **React 18** com Hooks
- **React Router** para navegação
- **Axios** para requisições HTTP
- **React Markdown** para renderização
- **Lucide React** para ícones

### Infraestrutura
- **Docker** para containerização
- **Docker Compose** para orquestração
- **Volume local** para persistência de dados

## 📁 Estrutura do Projeto

```
Buresidian/
├── backend/
│   ├── main.py              # API principal
│   ├── requirements.txt     # Dependências Python
│   ├── Dockerfile          # Container backend
│   └── uploads/            # Imagens uploadadas
├── frontend/
│   ├── src/                # Código React
│   ├── public/             # Arquivos estáticos
│   ├── package.json        # Dependências Node
│   └── Dockerfile          # Container frontend
├── docker-compose.yml      # Orquestração dos serviços
└── README.md              # Este arquivo
```

## 🔧 Desenvolvimento

### Backend (Python)
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Frontend (React)
```bash
cd frontend
npm install
npm start
```

## 📝 API Endpoints

### Autenticação
- `POST /auth/register` - Registrar usuário
- `POST /auth/login` - Login
- `GET /auth/me` - Usuário atual

### Notas
- `GET /notes` - Listar notas
- `POST /notes` - Criar nota
- `GET /notes/{id}` - Obter nota
- `PUT /notes/{id}` - Atualizar nota
- `DELETE /notes/{id}` - Deletar nota

### Pastas
- `GET /folders` - Listar pastas
- `POST /folders` - Criar pasta

### Comentários
- `GET /notes/{id}/comments` - Comentários da nota
- `POST /comments` - Criar comentário

### Outros
- `POST /upload` - Upload de imagem
- `GET /search` - Buscar notas
- `WS /ws/notes/{id}` - WebSocket para colaboração

## 🎨 Design System

- **Cor Principal**: Preto (#000000)
- **Cor Secundária**: Roxo (#6366f1)
- **Interface**: Inspirada no Obsidian
- **Responsivo**: Desktop e tablet

## 🔒 Segurança

⚠️ **ATENÇÃO**: Este sistema foi projetado para uso local apenas.
- Não exponha na internet
- Use apenas em redes confiáveis
- Dados armazenados localmente

## 📋 Roadmap

- [x] CRUD de usuários e notas
- [x] Sistema de pastas
- [x] Editor Markdown
- [x] Upload de imagens
- [x] Colaboração em tempo real
- [x] Sistema de comentários
- [x] Busca local
- [ ] Tema claro/escuro toggle
- [ ] Melhorias de UX
- [ ] Exportação de notas

## 📄 Licença

Este projeto é para uso pessoal/educacional apenas.
