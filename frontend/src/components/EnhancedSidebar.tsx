import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Note, Folder, Tag } from '../types/index';
import '../styles/EnhancedSidebar.css';

interface EnhancedSidebarProps {
  folders: Folder[];
  notes: Note[];
  selectedFolder?: number | null;
  onFolderSelect: (folderId: number | null) => void;
  onCreateFolder: () => void;
  onCreateNote: () => void;
  onNoteSelect: (note: Note) => void;
  currentNote?: Note | null;
}

interface SidebarSection {
  id: string;
  title: string;
  icon: string;
  isCollapsed: boolean;
}

const EnhancedSidebar: React.FC<EnhancedSidebarProps> = ({
  folders,
  notes,
  selectedFolder,
  onFolderSelect,
  onCreateFolder,
  onCreateNote,
  onNoteSelect,
  currentNote
}) => {
  const navigate = useNavigate();
  const [sections, setSections] = useState<Record<string, boolean>>({
    explorer: false,
    search: false,
    tags: false,
    backlinks: false,
    recent: false
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Note[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Extract tags from all notes
  const allTags = useMemo(() => {
    const tagMap = new Map<string, number>();
    
    notes.forEach(note => {
      const tagMatches = note.content.match(/#[\w\-/]+/g) || [];
      tagMatches.forEach(tag => {
        const cleanTag = tag.substring(1); // Remove #
        tagMap.set(cleanTag, (tagMap.get(cleanTag) || 0) + 1);
      });
    });
    
    return Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [notes]);

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = notes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, notes]);

  // Get notes by selected tags
  const tagFilteredNotes = useMemo(() => {
    if (selectedTags.length === 0) return [];
    
    return notes.filter(note => {
      const noteTags = note.content.match(/#[\w\-/]+/g) || [];
      const noteTagNames = noteTags.map(tag => tag.substring(1));
      return selectedTags.every(selectedTag => 
        noteTagNames.includes(selectedTag)
      );
    });
  }, [notes, selectedTags]);

  // Get backlinks for current note
  const backlinks = useMemo(() => {
    if (!currentNote) return [];
    
    const noteTitle = currentNote.title.toLowerCase();
    return notes.filter(note => 
      note.id !== currentNote.id && 
      (note.content.toLowerCase().includes(`[[${noteTitle}]]`) ||
       note.content.toLowerCase().includes(noteTitle))
    );
  }, [currentNote, notes]);

  // Recent notes (last 10)
  const recentNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10);
  }, [notes]);

  const toggleSection = (sectionId: string) => {
    setSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearTagFilter = () => {
    setSelectedTags([]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'hoje';
    if (diffDays === 2) return 'ontem';
    if (diffDays <= 7) return `${diffDays}d`;
    if (diffDays <= 30) return `${Math.ceil(diffDays / 7)}sem`;
    return `${Math.ceil(diffDays / 30)}m`;
  };

  const SectionHeader: React.FC<{
    id: string;
    title: string;
    icon: string;
    count?: number;
    onAction?: () => void;
    actionIcon?: string;
    actionTitle?: string;
  }> = ({ id, title, icon, count, onAction, actionIcon, actionTitle }) => (
    <div className="section-header">
      <button 
        className="section-toggle"
        onClick={() => toggleSection(id)}
      >
        <span className="toggle-icon">
          {sections[id] ? '▼' : '▶'}
        </span>
        <span className="section-icon">{icon}</span>
        <span className="section-title">{title}</span>
        {count !== undefined && (
          <span className="section-count">{count}</span>
        )}
      </button>
      {onAction && (
        <button 
          className="section-action"
          onClick={onAction}
          title={actionTitle}
        >
          {actionIcon}
        </button>
      )}
    </div>
  );

  return (
    <aside className="enhanced-sidebar">
      {/* Explorer Section */}
      <div className="sidebar-section">
        <SectionHeader
          id="explorer"
          title="Explorer"
          icon="📁"
          count={folders.length + 1}
          onAction={onCreateFolder}
          actionIcon="+"
          actionTitle="Criar nova pasta"
        />
        
        {!sections.explorer && (
          <div className="section-content">
            <div className="explorer-tree">
              <button
                className={`tree-item ${selectedFolder === null ? 'active' : ''}`}
                onClick={() => onFolderSelect(null)}
              >
                <span className="tree-icon">📄</span>
                <span className="tree-label">Todas as notas</span>
                <span className="tree-count">{notes.length}</span>
              </button>
              
              {folders.map(folder => {
                const folderNotes = notes.filter(note => note.folder_id === folder.id);
                return (
                  <button
                    key={folder.id}
                    className={`tree-item ${selectedFolder === folder.id ? 'active' : ''}`}
                    onClick={() => onFolderSelect(folder.id)}
                  >
                    <span className="tree-icon">📁</span>
                    <span className="tree-label">{folder.name}</span>
                    <span className="tree-count">{folderNotes.length}</span>
                  </button>
                );
              })}
            </div>
            
            <button className="create-note-btn" onClick={onCreateNote}>
              <span>📝</span>
              Nova Nota
            </button>
          </div>
        )}
      </div>

      {/* Search Section */}
      <div className="sidebar-section">
        <SectionHeader
          id="search"
          title="Busca"
          icon="🔍"
          count={searchResults.length}
        />
        
        {!sections.search && (
          <div className="section-content">
            <div className="search-container">
              <input
                type="text"
                placeholder="Buscar notas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button 
                  className="search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>
            
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(note => (
                  <button
                    key={note.id}
                    className="search-result"
                    onClick={() => onNoteSelect(note)}
                  >
                    <span className="result-icon">📝</span>
                    <div className="result-content">
                      <div className="result-title">{note.title}</div>
                      <div className="result-snippet">
                        {note.content.substring(0, 60)}...
                      </div>
                    </div>
                    <span className="result-date">
                      {formatDate(note.updated_at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            
            {searchQuery && searchResults.length === 0 && (
              <div className="no-results">
                <p>Nenhuma nota encontrada</p>
                <button 
                  onClick={() => {
                    onCreateNote();
                    setSearchQuery('');
                  }}
                  className="create-from-search"
                >
                  Criar nota "{searchQuery}"
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tags Section */}
      <div className="sidebar-section">
        <SectionHeader
          id="tags"
          title="Tags"
          icon="#️⃣"
          count={allTags.length}
          onAction={() => navigate('/tags')}
          actionIcon="🔗"
          actionTitle="Abrir Tag Explorer"
        />
        
        {!sections.tags && (
          <div className="section-content">
            {selectedTags.length > 0 && (
              <div className="tag-filter">
                <div className="active-tags">
                  {selectedTags.map(tag => (
                    <span key={tag} className="active-tag">
                      #{tag}
                      <button onClick={() => toggleTag(tag)}>✕</button>
                    </span>
                  ))}
                </div>
                <button className="clear-filter" onClick={clearTagFilter}>
                  Limpar filtro
                </button>
              </div>
            )}
            
            <div className="tags-list">
              {allTags.slice(0, 20).map(({ tag, count }) => (
                <button
                  key={tag}
                  className={`tag-item ${selectedTags.includes(tag) ? 'selected' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  <span className="tag-name">#{tag}</span>
                  <span className="tag-count">{count}</span>
                </button>
              ))}
            </div>
            
            {selectedTags.length > 0 && tagFilteredNotes.length > 0 && (
              <div className="filtered-notes">
                <h4>Notas com tags selecionadas:</h4>
                {tagFilteredNotes.map(note => (
                  <button
                    key={note.id}
                    className="filtered-note"
                    onClick={() => onNoteSelect(note)}
                  >
                    📝 {note.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Backlinks Section */}
      {currentNote && (
        <div className="sidebar-section">
          <SectionHeader
            id="backlinks"
            title="Backlinks"
            icon="🔗"
            count={backlinks.length}
          />
          
          {!sections.backlinks && (
            <div className="section-content">
              {backlinks.length > 0 ? (
                <div className="backlinks-list">
                  {backlinks.map(note => (
                    <button
                      key={note.id}
                      className="backlink-item"
                      onClick={() => onNoteSelect(note)}
                    >
                      <span className="backlink-icon">📝</span>
                      <div className="backlink-content">
                        <div className="backlink-title">{note.title}</div>
                        <div className="backlink-context">
                          {note.content.substring(0, 80)}...
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="no-backlinks">
                  <p>Nenhuma nota referencia esta nota</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recent Notes Section */}
      <div className="sidebar-section">
        <SectionHeader
          id="recent"
          title="Recentes"
          icon="🕒"
          count={recentNotes.length}
        />
        
        {!sections.recent && (
          <div className="section-content">
            <div className="recent-list">
              {recentNotes.map(note => (
                <button
                  key={note.id}
                  className={`recent-item ${currentNote?.id === note.id ? 'current' : ''}`}
                  onClick={() => onNoteSelect(note)}
                >
                  <span className="recent-icon">📝</span>
                  <div className="recent-content">
                    <div className="recent-title">{note.title}</div>
                    <div className="recent-date">
                      {formatDate(note.updated_at)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="sidebar-section">
        <div className="quick-actions">
          <button 
            onClick={() => navigate('/graph')}
            className="quick-action"
            title="Graph View"
          >
            🕸️
          </button>
          <button 
            onClick={() => navigate('/canvas')}
            className="quick-action"
            title="Canvas"
          >
            🎨
          </button>
          <button 
            onClick={() => navigate('/tags')}
            className="quick-action"
            title="Tag Explorer"
          >
            #️⃣
          </button>
          <button 
            onClick={() => {/* Open settings */}}
            className="quick-action"
            title="Configurações"
          >
            ⚙️
          </button>
        </div>
      </div>
    </aside>
  );
};

export default EnhancedSidebar;