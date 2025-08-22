import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import '../styles/Dashboard.css';

// Simple fallback components to avoid import issues
const SimpleSidebar = ({ folders, selectedFolder, onFolderSelect }) => (
  <aside className="sidebar">
    <div className="sidebar-header">
      <h3>📁 Pastas</h3>
    </div>
    <ul className="folders-list">
      <li 
        className={!selectedFolder ? 'selected' : ''}
        onClick={() => onFolderSelect(null)}
      >
        📄 Todas as notas
      </li>
      {folders.map(folder => (
        <li 
          key={folder.id}
          className={selectedFolder === folder.id ? 'selected' : ''}
          onClick={() => onFolderSelect(folder.id)}
        >
          📁 {folder.name}
        </li>
      ))}
    </ul>
  </aside>
);

const SimpleHomePage = ({ folders, notes, onCreateFolder, onCreateNote, onNoteSelect, onNoteDelete }) => (
  <div className="home-page">
    <h2>🏠 Bem-vindo ao Buresidian</h2>
    <div className="stats">
      <div className="stat-card">
        <h3>📁 {folders.length}</h3>
        <p>Pastas</p>
      </div>
      <div className="stat-card">
        <h3>📝 {notes.length}</h3>
        <p>Notas</p>
      </div>
    </div>
    <div className="quick-actions">
      <button onClick={onCreateFolder} className="quick-action-btn">
        ➕ Nova Pasta
      </button>
      <button onClick={onCreateNote} className="quick-action-btn">
        📝 Nova Nota
      </button>
    </div>
    <div className="recent-notes">
      <h3>📄 Notas Recentes</h3>
      {notes.slice(0, 5).map(note => (
        <div key={note.id} className="recent-note" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '10px', border: '1px solid #333', borderRadius: '4px' }}>
          <div onClick={() => onNoteSelect && onNoteSelect(note)} style={{ cursor: 'pointer', flex: 1 }}>
            <h4>{note.title}</h4>
            <p>{new Date(note.updated_at).toLocaleDateString('pt-BR')}</p>
          </div>
          {onNoteDelete && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Tem certeza que deseja excluir a nota "${note.title}"?`)) {
                  onNoteDelete(note.id);
                }
              }}
              style={{
                background: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '5px 8px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🗑️
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
);

const SimpleNotesList = ({ notes, onNoteSelect, onNoteDelete }) => (
  <div className="notes-list">
    <h2>📝 Suas Notas</h2>
    <div className="notes-grid">
      {notes.map(note => (
        <div key={note.id} className="note-card">
          <div onClick={() => onNoteSelect(note)} style={{ cursor: 'pointer', flex: 1 }}>
            <h3>{note.title}</h3>
            <p>{note.content.substring(0, 100)}...</p>
            <small>{new Date(note.updated_at).toLocaleDateString('pt-BR')}</small>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Tem certeza que deseja excluir a nota "${note.title}"?`)) {
                onNoteDelete(note.id);
              }
            }}
            className="delete-note-btn"
            title="Excluir nota"
            style={{
              background: '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '5px 8px',
              cursor: 'pointer',
              fontSize: '12px',
              marginTop: '10px'
            }}
          >
            🗑️ Excluir
          </button>
        </div>
      ))}
    </div>
  </div>
);

const SimpleNoteEditor = ({ note, onNoteUpdate, onNoteDelete, onBackToHome }) => {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');

  const saveNote = async () => {
    if (!note) return;
    
    try {
      await axios.put(`/notes/${note.id}`, { title, content });
      onNoteUpdate();
      alert('Nota salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar nota:', error);
      alert('Erro ao salvar nota');
    }
  };

  const deleteNote = async () => {
    if (!note) return;
    
    if (window.confirm(`Tem certeza que deseja excluir a nota "${note.title}"?`)) {
      try {
        await axios.delete(`/notes/${note.id}`);
        alert('Nota excluída com sucesso!');
        onNoteDelete(note.id);
        onBackToHome();
      } catch (error) {
        console.error('Erro ao excluir nota:', error);
        alert('Erro ao excluir nota');
      }
    }
  };

  if (!note) {
    return (
      <div className="note-editor">
        <h2>Selecione uma nota para editar</h2>
      </div>
    );
  }

  return (
    <div className="note-editor">
      <div className="editor-header">
        <input 
          value={title} 
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da nota..."
          className="note-title-input"
        />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={saveNote} className="save-btn">💾 Salvar</button>
          <button 
            onClick={deleteNote} 
            className="delete-btn"
            style={{
              background: '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer'
            }}
          >
            🗑️ Excluir
          </button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Escreva sua nota aqui..."
        className="note-content-textarea"
      />
    </div>
  );
};

const DashboardClean = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [folders, setFolders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [foldersResponse, notesResponse] = await Promise.all([
        axios.get('/folders'),
        axios.get('/notes')
      ]);
      setFolders(foldersResponse.data);
      setNotes(notesResponse.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createFolder = async () => {
    const name = prompt('Nome da pasta:');
    if (name) {
      try {
        const response = await axios.post('/folders', { name });
        setFolders([...folders, response.data]);
      } catch (error) {
        console.error('Error creating folder:', error);
      }
    }
  };

  const createNote = async () => {
    const title = prompt('Título da nota:');
    if (title) {
      try {
        const noteData = {
          title,
          content: '',
          folder_id: selectedFolder
        };
        const response = await axios.post('/notes', noteData);
        setNotes([response.data, ...notes]);
        setSelectedNote(response.data);
        navigate('/dashboard/editor');
      } catch (error) {
        console.error('Error creating note:', error);
      }
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await axios.delete(`/notes/${noteId}`);
      setNotes(notes.filter(note => note.id !== noteId));
      if (selectedNote && selectedNote.id === noteId) {
        setSelectedNote(null);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Erro ao excluir nota');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="dashboard-title">Buresidian</h1>
        </div>
        
        <div className="header-actions">
          <button onClick={createFolder} className="action-button" title="Nova Pasta">
            📁
          </button>
          <button onClick={createNote} className="action-button" title="Nova Nota">
            ➕
          </button>
          <button onClick={toggleTheme} className="theme-toggle" title={`Alternar para tema ${isDark ? 'claro' : 'escuro'}`}>
            {isDark ? '☀️' : '🌙'}
          </button>
          <div className="user-menu">
            <span className="username">@{user.username}</span>
            <button onClick={handleLogout} className="logout-button" title="Sair">
              🚪
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-body">
        <SimpleSidebar 
          folders={folders}
          selectedFolder={selectedFolder}
          onFolderSelect={setSelectedFolder}
        />
        
        <main className="dashboard-main">
          <Routes>
            <Route 
              path="/" 
              element={
                <SimpleHomePage 
                  folders={folders}
                  notes={notes}
                  onCreateFolder={createFolder}
                  onCreateNote={createNote}
                  onNoteSelect={(note) => {
                    setSelectedNote(note);
                    navigate('/dashboard/editor');
                  }}
                  onNoteDelete={deleteNote}
                />
              } 
            />
            <Route 
              path="/notes" 
              element={
                <SimpleNotesList 
                  notes={selectedFolder ? notes.filter(note => note.folder_id === selectedFolder) : notes}
                  onNoteSelect={(note) => {
                    setSelectedNote(note);
                    navigate('/dashboard/editor');
                  }}
                  onNoteDelete={deleteNote}
                />
              } 
            />
            <Route 
              path="/editor" 
              element={
                <SimpleNoteEditor 
                  note={selectedNote}
                  onNoteUpdate={loadData}
                  onNoteDelete={deleteNote}
                  onBackToHome={() => navigate('/dashboard')}
                />
              } 
            />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default DashboardClean;
