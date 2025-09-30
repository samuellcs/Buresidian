import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Note, Folder } from '../types/index';
import '../styles/ObsidianSidebar.css';

interface ObsidianSidebarProps {
  folders: Folder[];
  notes: Note[];
  selectedFolder?: number | null;
  onFolderSelect: (folderId: number | null) => void;
  onCreateFolder: () => void;
  onCreateNote: () => void;
  onNoteSelect: (note: Note) => void;
  currentNote?: Note | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

type SidebarTab = 'explorer' | 'search' | 'tags' | 'graph' | 'settings';

const ObsidianSidebar: React.FC<ObsidianSidebarProps> = ({
  folders,
  notes,
  selectedFolder,
  onFolderSelect,
  onCreateFolder,
  onCreateNote,
  onNoteSelect,
  currentNote,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SidebarTab>('explorer');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [searchResults, setSearchResults] = useState<Note[]>([]);

  // Extract tags from all notes
  const allTags = useMemo(() => {
    const tagMap = new Map<string, { count: number; notes: Note[] }>();
    
    notes.forEach(note => {
      const tagMatches = note.content.match(/#[\w\-/]+/g) || [];
      tagMatches.forEach(tag => {
        const cleanTag = tag.substring(1);
        if (!tagMap.has(cleanTag)) {
          tagMap.set(cleanTag, { count: 0, notes: [] });
        }
        const tagData = tagMap.get(cleanTag)!;
        tagData.count++;
        tagData.notes.push(note);
      });
    });
    
    return Array.from(tagMap.entries())
      .map(([tag, data]) => ({ tag, ...data }))
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

  // Recent notes
  const recentNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10);
  }, [notes]);

  const toggleFolder = (folderId: number) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'hoje';
    if (diffDays === 2) return 'ontem';
    if (diffDays <= 7) return `${diffDays}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const sidebarTabs = [
    { id: 'explorer', icon: '📁', title: 'Files' },
    { id: 'search', icon: '🔍', title: 'Search' },
    { id: 'tags', icon: '#', title: 'Tags' },
    { id: 'graph', icon: '🕸️', title: 'Graph' },
    { id: 'settings', icon: '⚙️', title: 'Settings' }
  ];

  const renderExplorer = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h3>Files</h3>
        <div className="tab-actions">
          <button 
            className="icon-btn" 
            onClick={onCreateNote}
            title="New note"
          >
            📄
          </button>
          <button 
            className="icon-btn" 
            onClick={onCreateFolder}
            title="New folder"
          >
            📁
          </button>
        </div>
      </div>
      
      <div className="file-tree">
        <div 
          className={`tree-item root ${selectedFolder === null ? 'active' : ''}`}
          onClick={() => onFolderSelect(null)}
        >
          <span className="tree-icon">📄</span>
          <span className="tree-label">All files</span>
          <span className="tree-count">{notes.length}</span>
        </div>

        {folders.map(folder => {
          const folderNotes = notes.filter(note => note.folder_id === folder.id);
          const isExpanded = expandedFolders.has(folder.id);
          
          return (
            <div key={folder.id} className="folder-container">
              <div 
                className={`tree-item folder ${selectedFolder === folder.id ? 'active' : ''}`}
                onClick={() => onFolderSelect(folder.id)}
              >
                <button 
                  className="folder-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(folder.id);
                  }}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
                <span className="tree-icon">📁</span>
                <span className="tree-label">{folder.name}</span>
                <span className="tree-count">{folderNotes.length}</span>
              </div>
              
              {isExpanded && (
                <div className="folder-contents">
                  {folderNotes.map(note => (
                    <div 
                      key={note.id}
                      className={`tree-item note ${currentNote?.id === note.id ? 'active' : ''}`}
                      onClick={() => onNoteSelect(note)}
                    >
                      <span className="note-icon">📝</span>
                      <span className="note-title">{note.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Unorganized notes */}
        {notes.filter(note => !note.folder_id).length > 0 && (
          <div className="unorganized-notes">
            <div className="section-divider">Unorganized</div>
            {notes.filter(note => !note.folder_id).map(note => (
              <div 
                key={note.id}
                className={`tree-item note ${currentNote?.id === note.id ? 'active' : ''}`}
                onClick={() => onNoteSelect(note)}
              >
                <span className="note-icon">📝</span>
                <span className="note-title">{note.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderSearch = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h3>Search</h3>
      </div>
      
      <div className="search-container">
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {searchQuery && (
        <div className="search-results">
          {searchResults.length > 0 ? (
            searchResults.map(note => (
              <div
                key={note.id}
                className="search-result"
                onClick={() => onNoteSelect(note)}
              >
                <div className="result-header">
                  <span className="result-icon">📝</span>
                  <span className="result-title">{note.title}</span>
                </div>
                <div className="result-snippet">
                  {note.content.substring(0, 100)}...
                </div>
                <div className="result-meta">
                  {note.folder_name && (
                    <span className="result-folder">📁 {note.folder_name}</span>
                  )}
                  <span className="result-date">{formatDate(note.updated_at)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="no-results">
              <p>No files found</p>
              <button 
                className="create-from-search"
                onClick={() => {
                  onCreateNote();
                  setSearchQuery('');
                }}
              >
                Create "{searchQuery}"
              </button>
            </div>
          )}
        </div>
      )}

      {!searchQuery && (
        <div className="recent-searches">
          <h4>Recent files</h4>
          {recentNotes.slice(0, 5).map(note => (
            <div
              key={note.id}
              className="recent-item"
              onClick={() => onNoteSelect(note)}
            >
              <span className="recent-icon">📝</span>
              <div className="recent-content">
                <span className="recent-title">{note.title}</span>
                <span className="recent-date">{formatDate(note.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTags = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h3>Tags</h3>
        <button 
          className="icon-btn"
          onClick={() => navigate('/tags')}
          title="Open tag explorer"
        >
          🔗
        </button>
      </div>
      
      <div className="tags-list">
        {allTags.length > 0 ? (
          allTags.map(({ tag, count, notes: tagNotes }) => (
            <div key={tag} className="tag-item">
              <div 
                className="tag-header"
                onClick={() => {
                  // Navigate to tag explorer with selected tag
                  navigate(`/tags?selected=${encodeURIComponent(tag)}`);
                }}
              >
                <span className="tag-name">#{tag}</span>
                <span className="tag-count">{count}</span>
              </div>
              
              <div className="tag-notes">
                {tagNotes.slice(0, 3).map(note => (
                  <div
                    key={note.id}
                    className="tag-note"
                    onClick={() => onNoteSelect(note)}
                  >
                    <span className="note-icon">📝</span>
                    <span className="note-title">{note.title}</span>
                  </div>
                ))}
                {tagNotes.length > 3 && (
                  <div className="more-notes">
                    +{tagNotes.length - 3} more...
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>No tags found</p>
            <p className="help-text">Add #hashtags to your notes to see them here</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderGraph = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h3>Graph view</h3>
        <button 
          className="icon-btn"
          onClick={() => navigate('/graph')}
          title="Open graph view"
        >
          🔗
        </button>
      </div>
      
      <div className="graph-preview">
        <div className="graph-placeholder">
          <span className="graph-icon">🕸️</span>
          <p>Graph view shows connections between your notes</p>
          <button 
            className="graph-open-btn"
            onClick={() => navigate('/graph')}
          >
            Open full graph
          </button>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="tab-content">
      <div className="tab-header">
        <h3>Settings</h3>
      </div>
      
      <div className="settings-list">
        <div className="setting-item">
          <span className="setting-label">Appearance</span>
          <span className="setting-icon">🎨</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Hotkeys</span>
          <span className="setting-icon">⌨️</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">Core plugins</span>
          <span className="setting-icon">🔌</span>
        </div>
        <div className="setting-item">
          <span className="setting-label">About</span>
          <span className="setting-icon">ℹ️</span>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'explorer': return renderExplorer();
      case 'search': return renderSearch();
      case 'tags': return renderTags();
      case 'graph': return renderGraph();
      case 'settings': return renderSettings();
      default: return renderExplorer();
    }
  };

  if (isCollapsed) {
    return (
      <div className="obsidian-sidebar collapsed">
        <div className="sidebar-tabs">
          {sidebarTabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-icon ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id as SidebarTab);
                onToggleCollapse?.();
              }}
              title={tab.title}
            >
              {tab.icon}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="obsidian-sidebar">
      <div className="sidebar-tabs">
        {sidebarTabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-icon ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as SidebarTab)}
            title={tab.title}
          >
            {tab.icon}
          </button>
        ))}
      </div>
      
      <div className="sidebar-content">
        {renderTabContent()}
      </div>
      
      <div className="sidebar-footer">
        <button 
          className="collapse-btn"
          onClick={onToggleCollapse}
          title="Collapse sidebar"
        >
          ◀
        </button>
      </div>
    </div>
  );
};

export default ObsidianSidebar;