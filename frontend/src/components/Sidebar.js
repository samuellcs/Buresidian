import React from 'react';
import { Folder, File } from 'lucide-react';
import '../styles/Sidebar.css';

const Sidebar = ({ folders, selectedFolder, onFolderSelect }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <h3 className="sidebar-title">Pastas</h3>
        <div className="folders-list">
          <button
            className={`folder-item ${selectedFolder === null ? 'active' : ''}`}
            onClick={() => onFolderSelect(null)}
          >
            <File size={16} />
            Todas as Notas
          </button>
          {folders.map(folder => (
            <button
              key={folder.id}
              className={`folder-item ${selectedFolder === folder.id ? 'active' : ''}`}
              onClick={() => onFolderSelect(folder.id)}
            >
              <Folder size={16} />
              {folder.name}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
