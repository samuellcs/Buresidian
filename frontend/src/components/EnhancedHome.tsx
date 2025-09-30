import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Note, Folder, WorkspaceStats } from '../types/index';
import '../styles/EnhancedHome.css';

interface EnhancedHomeProps {
  folders: Folder[];
  notes: Note[];
  onCreateFolder: () => void;
  onCreateNote: () => void;
  onNoteSelect: (note: Note) => void;
  onFolderSelect: (folderId: number | null) => void;
  onOpenCanvas: () => void;
}

const EnhancedHome: React.FC<EnhancedHomeProps> = ({
  folders,
  notes,
  onCreateFolder,
  onCreateNote,
  onNoteSelect,
  onFolderSelect,
  onOpenCanvas
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteNotes, setFavoriteNotes] = useState<number[]>([]);

  // Calcular estatísticas do workspace
  const stats: WorkspaceStats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const notesThisWeek = notes.filter(note => 
      new Date(note.updated_at) >= weekAgo
    ).length;

    const notesThisMonth = notes.filter(note => 
      new Date(note.updated_at) >= monthAgo
    ).length;

    const totalWords = notes.reduce((acc, note) => 
      acc + (note.content?.split(/\s+/).length || 0), 0
    );

    return {
      totalNotes: notes.length,
      totalFolders: folders.length,
      totalTags: 0, // Será calculado baseado nas tags das notas
      notesThisWeek,
      notesThisMonth,
      totalWords,
      averageNotesPerDay: notesThisMonth / 30
    };
  }, [notes, folders]);

  // Notas recentes (últimas 8)
  const recentNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8);
  }, [notes]);

  // Notas favoritas
  const pinnedNotes = useMemo(() => {
    return notes.filter(note => favoriteNotes.includes(note.id));
  }, [notes, favoriteNotes]);

  // Filtrar notas por busca
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return recentNotes;
    
    return notes.filter(note =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [notes, searchQuery, recentNotes]);

  const toggleFavorite = (noteId: number) => {
    setFavoriteNotes(prev => 
      prev.includes(noteId) 
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Hoje';
    if (diffDays === 2) return 'Ontem';
    if (diffDays <= 7) return `${diffDays} dias atrás`;
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Bom dia';
    if (hour < 18) return '☀️ Boa tarde';
    return '🌙 Boa noite';
  };

  return (
    <div className="enhanced-home">
      {/* Header de Boas-vindas */}
      <section className="welcome-header">
        <div className="welcome-content">
          <h1 className="welcome-title">
            {getGreeting()}, seja bem-vindo ao Buresidian
          </h1>
          <p className="welcome-subtitle">
            Organize suas ideias, conecte seus pensamentos e explore seu conhecimento
          </p>
        </div>
        
        {/* Busca Global */}
        <div className="global-search">
          <div className="search-container">
            <input
              type="text"
              placeholder="🔍 Buscar notas, tags, pastas... (Ctrl+O)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="search-clear"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Resultados de busca rápida */}
          {searchQuery && (
            <div className="search-results">
              {filteredNotes.length > 0 ? (
                filteredNotes.map(note => (
                  <div
                    key={note.id}
                    className="search-result-item"
                    onClick={() => onNoteSelect(note)}
                  >
                    <div className="search-result-icon">📝</div>
                    <div className="search-result-content">
                      <h4>{note.title}</h4>
                      <p>{note.content.substring(0, 80)}...</p>
                    </div>
                    <span className="search-result-date">
                      {formatDate(note.updated_at)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="search-no-results">
                  <p>Nenhuma nota encontrada</p>
                  <button 
                    onClick={() => {
                      onCreateNote();
                      setSearchQuery('');
                    }}
                    className="create-note-suggestion"
                  >
                    Criar nova nota "{searchQuery}"
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Estatísticas do Workspace */}
      <section className="workspace-stats">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-content">
              <span className="stat-number">{stats.totalNotes}</span>
              <span className="stat-label">Notas</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📁</div>
            <div className="stat-content">
              <span className="stat-number">{stats.totalFolders}</span>
              <span className="stat-label">Pastas</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-content">
              <span className="stat-number">{stats.notesThisWeek}</span>
              <span className="stat-label">Esta semana</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">💬</div>
            <div className="stat-content">
              <span className="stat-number">{stats.totalWords.toLocaleString()}</span>
              <span className="stat-label">Palavras</span>
            </div>
          </div>
        </div>
      </section>

      {/* Ações Rápidas */}
      <section className="quick-actions">
        <h2 className="section-title">🚀 Ações Rápidas</h2>
        <div className="actions-grid">
          <button onClick={onCreateNote} className="action-card primary">
            <div className="action-icon">✨</div>
            <div className="action-content">
              <h3>Nova Nota</h3>
              <p>Comece a escrever suas ideias</p>
            </div>
            <div className="action-shortcut">Ctrl+N</div>
          </button>

          <button onClick={onCreateFolder} className="action-card">
            <div className="action-icon">📁</div>
            <div className="action-content">
              <h3>Nova Pasta</h3>
              <p>Organize suas notas</p>
            </div>
          </button>

          <button onClick={onOpenCanvas} className="action-card">
            <div className="action-icon">🎨</div>
            <div className="action-content">
              <h3>Abrir Canvas</h3>
              <p>Visualize conexões</p>
            </div>
          </button>

          <button 
            onClick={() => navigate('/graph')} 
            className="action-card"
          >
            <div className="action-icon">🕸️</div>
            <div className="action-content">
              <h3>Graph View</h3>
              <p>Explore relações</p>
            </div>
          </button>

          <button 
            onClick={() => navigate('/tags')} 
            className="action-card"
          >
            <div className="action-icon">#️⃣</div>
            <div className="action-content">
              <h3>Tags</h3>
              <p>Navegue por temas</p>
            </div>
          </button>

          <button 
            onClick={() => {/* Implementar busca avançada */}} 
            className="action-card"
          >
            <div className="action-icon">🔍</div>
            <div className="action-content">
              <h3>Busca Avançada</h3>
              <p>Encontre qualquer coisa</p>
            </div>
            <div className="action-shortcut">Ctrl+F</div>
          </button>
        </div>
      </section>

      <div className="content-columns">
        {/* Coluna Esquerda */}
        <div className="left-column">
          {/* Notas Favoritas/Fixadas */}
          {pinnedNotes.length > 0 && (
            <section className="pinned-notes">
              <h2 className="section-title">📌 Notas Fixadas</h2>
              <div className="notes-list">
                {pinnedNotes.map(note => (
                  <div key={note.id} className="note-item pinned">
                    <div 
                      className="note-content"
                      onClick={() => onNoteSelect(note)}
                    >
                      <h3>{note.title}</h3>
                      <p>{note.content.substring(0, 100)}...</p>
                      <span className="note-date">{formatDate(note.updated_at)}</span>
                    </div>
                    <button
                      onClick={() => toggleFavorite(note.id)}
                      className="favorite-btn active"
                      title="Remover dos favoritos"
                    >
                      ⭐
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Notas Recentes */}
          <section className="recent-notes">
            <h2 className="section-title">🕒 Notas Recentes</h2>
            <div className="notes-list">
              {recentNotes.length > 0 ? (
                recentNotes.map(note => (
                  <div key={note.id} className="note-item">
                    <div 
                      className="note-content"
                      onClick={() => onNoteSelect(note)}
                    >
                      <h3>{note.title}</h3>
                      <p>{note.content.substring(0, 100)}...</p>
                      <div className="note-meta">
                        <span className="note-date">{formatDate(note.updated_at)}</span>
                        {note.folder_name && (
                          <span className="note-folder">📁 {note.folder_name}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFavorite(note.id)}
                      className={`favorite-btn ${favoriteNotes.includes(note.id) ? 'active' : ''}`}
                      title={favoriteNotes.includes(note.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    >
                      {favoriteNotes.includes(note.id) ? '⭐' : '☆'}
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📝</div>
                  <h3>Nenhuma nota criada ainda</h3>
                  <p>Comece criando sua primeira nota</p>
                  <button onClick={onCreateNote} className="create-first-btn">
                    Criar primeira nota
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Coluna Direita */}
        <div className="right-column">
          {/* Explorer de Pastas */}
          <section className="folders-explorer">
            <h2 className="section-title">📁 Explorador</h2>
            <div className="folders-tree">
              <button
                className="folder-item root"
                onClick={() => onFolderSelect(null)}
              >
                <span className="folder-icon">📄</span>
                <span>Todas as notas ({notes.length})</span>
              </button>
              
              {folders.map(folder => {
                const folderNotes = notes.filter(note => note.folder_id === folder.id);
                return (
                  <button
                    key={folder.id}
                    className="folder-item"
                    onClick={() => onFolderSelect(folder.id)}
                  >
                    <span className="folder-icon">📁</span>
                    <span>{folder.name} ({folderNotes.length})</span>
                  </button>
                );
              })}
              
              {folders.length === 0 && (
                <div className="empty-folders">
                  <p>Nenhuma pasta criada</p>
                  <button onClick={onCreateFolder} className="create-folder-btn">
                    ➕ Criar pasta
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Resumo de Atividade */}
          <section className="activity-summary">
            <h2 className="section-title">📊 Atividade</h2>
            <div className="activity-stats">
              <div className="activity-item">
                <span className="activity-label">Notas este mês:</span>
                <span className="activity-value">{stats.notesThisMonth}</span>
              </div>
              <div className="activity-item">
                <span className="activity-label">Média por dia:</span>
                <span className="activity-value">{stats.averageNotesPerDay.toFixed(1)}</span>
              </div>
              <div className="activity-item">
                <span className="activity-label">Total de palavras:</span>
                <span className="activity-value">{stats.totalWords.toLocaleString()}</span>
              </div>
            </div>
          </section>

          {/* Links Rápidos */}
          <section className="quick-links">
            <h2 className="section-title">🔗 Acesso Rápido</h2>
            <div className="links-list">
              <button 
                onClick={() => navigate('/canvas')}
                className="link-item"
              >
                <span className="link-icon">🎨</span>
                <span>Canvas Boards</span>
              </button>
              <button 
                onClick={() => navigate('/graph')}
                className="link-item"
              >
                <span className="link-icon">🕸️</span>
                <span>Graph View</span>
              </button>
              <button 
                onClick={() => navigate('/tags')}
                className="link-item"
              >
                <span className="link-icon">#️⃣</span>
                <span>Tag Explorer</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default EnhancedHome;