import React, { useState, useEffect } from 'react';
import { History, RotateCcw, Save, Clock, User, FileText } from 'lucide-react';
import axios from 'axios';
import '../styles/VersionHistory.css';

const VersionHistory = ({ noteId, isOpen, onClose, onVersionRestore }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (isOpen && noteId) {
      loadVersions();
    }
  }, [isOpen, noteId, loadVersions]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/notes/${noteId}/versions`);
      setVersions(response.data);
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createManualVersion = async (description) => {
    try {
      await axios.post(`/notes/${noteId}/versions`, {
        change_description: description
      });
      loadVersions();
      alert('Versão criada com sucesso!');
    } catch (error) {
      console.error('Error creating version:', error);
      alert('Erro ao criar versão');
    }
  };

  const restoreVersion = async (versionId) => {
    if (!window.confirm('Tem certeza que deseja restaurar esta versão? A versão atual será salva no histórico.')) {
      return;
    }

    try {
      await axios.post(`/notes/${noteId}/restore`, {
        version_id: versionId
      });
      
      onVersionRestore && onVersionRestore();
      alert('Versão restaurada com sucesso!');
      onClose();
    } catch (error) {
      console.error('Error restoring version:', error);
      alert('Erro ao restaurar versão');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVersionDiff = (version) => {
    const contentLength = version.content.length;
    return `${contentLength} caracteres`;
  };

  if (!isOpen) return null;

  return (
    <div className="version-history-overlay">
      <div className="version-history-modal">
        <div className="version-history-header">
          <div className="header-left">
            <History size={20} />
            <h2>Histórico de Versões</h2>
          </div>
          <div className="header-actions">
            <button 
              onClick={() => {
                const description = prompt('Descrição desta versão:');
                if (description !== null) {
                  createManualVersion(description);
                }
              }}
              className="create-version-btn"
            >
              <Save size={16} />
              Salvar Versão Atual
            </button>
            <button onClick={onClose} className="close-btn">×</button>
          </div>
        </div>

        <div className="version-history-body">
          {loading ? (
            <div className="loading">Carregando histórico...</div>
          ) : (
            <div className="versions-container">
              <div className="versions-list">
                {versions.length === 0 ? (
                  <div className="no-versions">
                    <History size={48} />
                    <p>Nenhuma versão encontrada</p>
                    <small>As versões são criadas automaticamente quando você edita a nota</small>
                  </div>
                ) : (
                  versions.map((version) => (
                    <div 
                      key={version.id} 
                      className={`version-item ${selectedVersion?.id === version.id ? 'selected' : ''}`}
                      onClick={() => setSelectedVersion(version)}
                    >
                      <div className="version-header">
                        <div className="version-info">
                          <span className="version-number">Versão {version.version_number}</span>
                          <span className="version-description">
                            {version.change_description || 'Sem descrição'}
                          </span>
                        </div>
                        <div className="version-meta">
                          <span className="version-date">
                            <Clock size={14} />
                            {formatDate(version.created_at)}
                          </span>
                          <span className="version-author">
                            <User size={14} />
                            {version.username}
                          </span>
                        </div>
                      </div>
                      
                      <div className="version-stats">
                        <span className="content-stats">
                          <FileText size={14} />
                          {getVersionDiff(version)}
                        </span>
                      </div>

                      <div className="version-actions">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVersion(version);
                            setPreviewMode(true);
                          }}
                          className="preview-btn"
                        >
                          Visualizar
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreVersion(version.id);
                          }}
                          className="restore-btn"
                        >
                          <RotateCcw size={14} />
                          Restaurar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {selectedVersion && previewMode && (
                <div className="version-preview">
                  <div className="preview-header">
                    <h3>Prévia - Versão {selectedVersion.version_number}</h3>
                    <button 
                      onClick={() => setPreviewMode(false)}
                      className="close-preview"
                    >
                      ×
                    </button>
                  </div>
                  <div className="preview-content">
                    <div className="preview-title">
                      <strong>Título:</strong> {selectedVersion.title}
                    </div>
                    <div className="preview-body">
                      <strong>Conteúdo:</strong>
                      <pre className="preview-text">{selectedVersion.content}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VersionHistory;
