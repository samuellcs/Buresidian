import React from 'react';
import '../styles/ObsidianFooter.css';

interface ObsidianFooterProps {
  workspace?: string;
  noteCount?: number;
  selectedText?: string;
}

const ObsidianFooter: React.FC<ObsidianFooterProps> = ({
  workspace = "Buresidian",
  noteCount = 0,
  selectedText
}) => {
  return (
    <div className="obsidian-footer">
      <div className="footer-left">
        <span className="workspace-info">
          📁 {workspace}
        </span>
        <span className="note-count">
          {noteCount} notes
        </span>
      </div>
      
      <div className="footer-center">
        {selectedText && (
          <span className="selected-text-info">
            {selectedText.length} characters selected
          </span>
        )}
      </div>
      
      <div className="footer-right">
        <button className="footer-btn" title="Community plugins">
          🔌
        </button>
        <button className="footer-btn" title="Settings">
          ⚙️
        </button>
        <button className="footer-btn" title="Help">
          ❓
        </button>
        <span className="sync-status">
          ✅ Synced
        </span>
      </div>
    </div>
  );
};

export default ObsidianFooter;