import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import '../styles/ObsidianTopBar.css';

interface ObsidianTopBarProps {
  currentNote?: any;
  onCreateNote: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

const ObsidianTopBar: React.FC<ObsidianTopBarProps> = ({
  currentNote,
  onCreateNote,
  onToggleSidebar,
  sidebarCollapsed = false
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to search with query
      navigate(`/dashboard?search=${encodeURIComponent(searchQuery)}`);
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  return (
    <div className="obsidian-topbar">
      {/* Left Section */}
      <div className="topbar-left">
        <button 
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        >
          {sidebarCollapsed ? '▶' : '◀'}
        </button>
        
        <div className="nav-buttons">
          <button className="nav-btn" title="Go back">
            ←
          </button>
          <button className="nav-btn" title="Go forward">
            →
          </button>
        </div>
      </div>

      {/* Center Section */}
      <div className="topbar-center">
        {currentNote ? (
          <div className="current-note">
            <span className="note-icon">📝</span>
            <span className="note-title">{currentNote.title}</span>
          </div>
        ) : (
          <div className="workspace-title">
            <span 
              className="workspace-name"
              onClick={() => navigate('/dashboard')}
            >
              Buresidian
            </span>
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="topbar-right">
        <div className="action-buttons">
          {/* Global Search */}
          {showSearch ? (
            <form onSubmit={handleGlobalSearch} className="search-form">
              <input
                type="text"
                placeholder="Search everything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="global-search-input"
                autoFocus
                onBlur={() => {
                  setTimeout(() => setShowSearch(false), 200);
                }}
              />
            </form>
          ) : (
            <button 
              className="action-btn"
              onClick={() => setShowSearch(true)}
              title="Search (Ctrl+K)"
            >
              🔍
            </button>
          )}

          {/* Quick Actions */}
          <button 
            className="action-btn primary"
            onClick={onCreateNote}
            title="New note (Ctrl+N)"
          >
            ➕
          </button>

          <button 
            className="action-btn"
            onClick={() => navigate('/graph')}
            title="Graph view"
          >
            🕸️
          </button>

          <button 
            className="action-btn"
            onClick={() => navigate('/canvas')}
            title="Canvas"
          >
            🎨
          </button>

          {/* Theme Toggle */}
          <button 
            className="action-btn"
            onClick={toggleTheme}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {/* User Menu */}
          <div className="user-section">
            <div className="user-info">
              <span className="username">{user?.username}</span>
            </div>
            <button 
              className="action-btn"
              onClick={logout}
              title="Sign out"
            >
              🚪
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ObsidianTopBar;