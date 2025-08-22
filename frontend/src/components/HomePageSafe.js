import React from 'react';
import '../styles/HomePage.css';

const HomePageSafe = ({ folders, notes, onCreateFolder, onCreateNote, onSelectFolder, onSelectNote }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  return (
    <div className="home-page">
      <div className="welcome-section">
        <h1>Bem-vindo ao Buresidian</h1>
        <p>Organize suas ideias, conecte seus pensamentos</p>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-number">{notes.length}</span>
              <span className="stat-label">Notas</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-number">{folders.length}</span>
              <span className="stat-label">Pastas</span>
            </div>
          </div>
        </div>
      </div>

      <div className="content-grid">
        <div className="content-section">
          <h2>Ações Rápidas</h2>
          <div className="quick-actions">
            <button onClick={onCreateNote} className="quick-action-card">
              <span>+ Nova Nota</span>
            </button>
            <button onClick={onCreateFolder} className="quick-action-card">
              <span>📁 Nova Pasta</span>
            </button>
          </div>
        </div>

        <div className="content-section">
          <h2>Suas Pastas</h2>
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
                    <div className="folder-info">
                      <h3>📁 {folder.name}</h3>
                      <span className="folder-count">{folderNotes.length} notas</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <p>Nenhuma pasta criada ainda</p>
                <button onClick={onCreateFolder} className="create-first-button">
                  Criar primeira pasta
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="content-section">
          <h2>Notas Recentes</h2>
          <div className="recent-notes">
            {notes.length > 0 ? (
              notes
                .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
                .slice(0, 5)
                .map(note => (
                  <div 
                    key={note.id} 
                    className="recent-note-card"
                    onClick={() => onSelectNote(note)}
                  >
                    <div className="note-header">
                      <h3>{note.title}</h3>
                      <span className="note-date">{formatDate(note.updated_at)}</span>
                    </div>
                    <p className="note-preview">
                      {note.content.length > 120 
                        ? note.content.substring(0, 120) + '...'
                        : note.content || 'Nota vazia...'
                      }
                    </p>
                    {note.folder_name && (
                      <div className="note-folder">
                        📁 {note.folder_name}
                      </div>
                    )}
                  </div>
                ))
            ) : (
              <div className="empty-state">
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

export default HomePageSafe;
