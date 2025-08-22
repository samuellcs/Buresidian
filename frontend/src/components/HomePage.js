import React from 'react';
import { Folder, FileText, Plus, Clock } from 'lucide-react';
import '../styles/HomePage.css';

const HomePage = ({ folders, notes, onCreateFolder, onCreateNote, onSelectFolder, onSelectNote }) => {
  // Notas recentes (últimas 5)
  const recentNotes = notes
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5);

  // Estatísticas
  const stats = {
    totalNotes: notes.length,
    totalFolders: folders.length,
    notesThisWeek: notes.filter(note => {
      const noteDate = new Date(note.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return noteDate > weekAgo;
    }).length
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="home-page">
      <div className="welcome-section">
        <h1>Bem-vindo ao Buresidian</h1>
        <p>Organize suas ideias, conecte seus pensamentos</p>
        
        <div className="stats-grid">
          <div className="stat-card">
            <FileText className="stat-icon" />
            <div className="stat-info">
              <span className="stat-number">{stats.totalNotes}</span>
              <span className="stat-label">Notas</span>
            </div>
          </div>
          
          <div className="stat-card">
            <Folder className="stat-icon" />
            <div className="stat-info">
              <span className="stat-number">{stats.totalFolders}</span>
              <span className="stat-label">Pastas</span>
            </div>
          </div>
          
          <div className="stat-card">
            <FileText className="stat-icon" />
            <div className="stat-info">
              <span className="stat-number">{stats.notesThisWeek}</span>
              <span className="stat-label">Esta semana</span>
            </div>
          </div>
        </div>
      </div>

      <div className="content-grid">
        {/* Ações rápidas */}
        <div className="content-section">
          <h2>Começar</h2>
          <div className="quick-actions">
            <button onClick={onCreateNote} className="quick-action-card">
              <Plus size={24} />
              <span>Nova Nota</span>
            </button>
            <button onClick={onCreateFolder} className="quick-action-card">
              <Folder size={24} />
              <span>Nova Pasta</span>
            </button>
          </div>
        </div>

        {/* Pastas */}
        <div className="content-section">
          <h2>Pastas ({folders.length})</h2>
          <div className="folders-grid">
            {folders.length > 0 ? (
              folders.map(folder => {
                const folderNotes = notes.filter(note => note.folder_id === folder.id);
                return (
                  <div 
                    key={folder.id} 
                    className="folder-card"
                    onClick={() => onSelectFolder(folder.id)}
                  >
                    <Folder className="folder-icon" />
                    <div className="folder-info">
                      <h3>{folder.name}</h3>
                      <span className="folder-count">{folderNotes.length} notas</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <Folder size={48} className="empty-icon" />
                <p>Nenhuma pasta criada ainda</p>
                <button onClick={onCreateFolder} className="create-first-button">
                  Criar primeira pasta
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notas recentes */}
        <div className="content-section">
          <h2>Notas Recentes</h2>
          <div className="recent-notes">
            {recentNotes.length > 0 ? (
              recentNotes.map(note => (
                <div 
                  key={note.id} 
                  className="recent-note-card"
                  onClick={() => onSelectNote(note)}
                >
                  <div className="note-header">
                    <h3>{note.title}</h3>
                    <span className="note-date">
                      <Clock size={14} />
                      {formatDate(note.updated_at)}
                    </span>
                  </div>
                  <p className="note-preview">
                    {note.content.length > 120 
                      ? note.content.substring(0, 120) + '...'
                      : note.content || 'Nota vazia...'
                    }
                  </p>
                  {note.folder_name && (
                    <div className="note-folder">
                      <Folder size={12} />
                      {note.folder_name}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-state">
                <FileText size={48} className="empty-icon" />
                <p>Nenhuma nota criada ainda</p>
                <button onClick={onCreateNote} className="create-first-button">
                  Criar primeira nota
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
