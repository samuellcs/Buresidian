import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Save, Eye, Edit, MessageCircle, Upload, Trash, History, Network, RotateCcw, Clock } from 'lucide-react';
import axios from 'axios';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAutoSave, useLocalBackup } from '../hooks/useAutoSave';
import { useNotifications } from '../contexts/NotificationContext';
import OnlineUsers from './OnlineUsers';
import VersionHistory from './VersionHistory';
import NotesGraph from './NotesGraph';
import '../styles/NoteEditor.css';

const NoteEditor = ({ note, onNoteUpdate }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showNotesGraph, setShowNotesGraph] = useState(false);
  const [reactions, setReactions] = useState({});
  
  // WebSocket para colaboração
  const { isConnected, onlineUsers, sendContentChange } = useWebSocket(note?.id);
  
  // Sistema de notificações
  const { showSuccess, showError, showWarning } = useNotifications();
  
  // Sistema de backup local
  const { createBackup, restoreBackup, listBackups } = useLocalBackup(
    `note_${note?.id}`, 
    { title, content },
    { interval: 30000, maxBackups: 5 }
  );
  
  // Refs para controle de debounce e websocket
  const saveTimeout = useRef(null);
  const wsTimeout = useRef(null);
  const textareaRef = useRef(null);
  const lastContentRef = useRef('');

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      lastContentRef.current = note.content;
      loadComments();
    }
  }, [note]);

  // Escutar mudanças do WebSocket
  useEffect(() => {
    if (!note) return;

    const handleWebSocketMessage = (event) => {
      const message = event.detail;
      
      if (message.type === 'content_change' && message.user_id !== note.user_id) {
        // Atualizar conteúdo apenas se for de outro usuário
        if (message.content !== lastContentRef.current) {
          setContent(message.content);
          lastContentRef.current = message.content;
          setIsTyping(true);
          setTimeout(() => setIsTyping(false), 2000);
        }
      } else if (message.type === 'reaction_update' && message.note_id === note.id) {
        // Atualizar reações em tempo real
        setReactions(prev => ({
          ...prev,
          [message.emoji]: message.count
        }));
      }
    };

    // Escutar evento customizado do WebSocket
    window.addEventListener('websocket-message', handleWebSocketMessage);
    
    return () => {
      window.removeEventListener('websocket-message', handleWebSocketMessage);
    };
  }, [note]);

  const loadComments = useCallback(async () => {
    if (!note) return;
    try {
      const response = await axios.get(`/notes/${note.id}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  }, [note]);

  const loadReactions = useCallback(async () => {
    if (!note) return;
    try {
      const response = await axios.get(`/notes/${note.id}/reactions`);
      setReactions(response.data);
    } catch (error) {
      console.error('Error loading reactions:', error);
    }
  }, [note]);

  const toggleReaction = async (emoji) => {
    if (!note) return;
    try {
      const response = await axios.post(`/notes/${note.id}/reactions`, { emoji });
      setReactions(prev => ({
        ...prev,
        [emoji]: response.data.count
      }));
      if (response.data.count === 0) {
        setReactions(prev => {
          const newReactions = { ...prev };
          delete newReactions[emoji];
          return newReactions;
        });
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
      showError('Erro ao reagir à nota');
    }
  };

  const saveNote = useCallback(async () => {
    if (!note) return;
    
    try {
      setSaving(true);
      await axios.put(`/notes/${note.id}`, {
        title,
        content
      });
      setLastSaved(new Date());
      if (onNoteUpdate) onNoteUpdate();
      return true;
    } catch (error) {
      console.error('Error saving note:', error);
      showError('Erro ao salvar nota');
      throw error;
    } finally {
      setSaving(false);
    }
  }, [note, title, content, onNoteUpdate, showError]);

  // Auto-save inteligente
  const { hasChanges, forceSave } = useAutoSave(
    { title, content },
    saveNote,
    {
      delay: 3000, // 3 segundos
      enabled: !!note,
      onSaveSuccess: () => setLastSaved(new Date()),
      compareFunction: (newData, oldData) => {
        return newData.title !== oldData.title || newData.content !== oldData.content;
      }
    }
  );

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      loadComments();
      loadReactions();
    }
  }, [note, loadComments, loadReactions]);

  useEffect(() => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    
    saveTimeout.current = setTimeout(() => {
      if (note && (title !== note.title || content !== note.content)) {
        saveNote();
      }
    }, 2000); // Auto-save após 2 segundos de inatividade

    return () => clearTimeout(saveTimeout.current);
  }, [title, content, note, saveNote]);

  // Enviar mudanças via WebSocket com debounce
  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
    
    // Cancelar timeout anterior
    if (wsTimeout.current) {
      clearTimeout(wsTimeout.current);
    }
    
    // Enviar via WebSocket após 500ms de inatividade
    wsTimeout.current = setTimeout(() => {
      if (newContent !== lastContentRef.current) {
        sendContentChange(newContent);
        lastContentRef.current = newContent;
      }
    }, 500);
  }, [sendContentChange]);

  const deleteNote = async () => {
    if (!note) return;
    if (!window.confirm('Tem certeza que deseja excluir esta nota?')) return;
    
    try {
      await axios.delete(`/notes/${note.id}`);
      if (onNoteUpdate) onNoteUpdate();
      // Voltar para lista de notas
      window.history.back();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !note) return;
    
    try {
      await axios.post('/comments', {
        content: newComment,
        note_id: note.id
      });
      setNewComment('');
      loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const uploadImage = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const imageUrl = `http://localhost:8000${response.data.url}`;
      const markdownImage = `![${file.name}](${imageUrl})`;
      setContent(prev => prev + '\n\n' + markdownImage);
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  const handleImagePaste = (e) => {
    const items = e.clipboardData.items;
    for (let item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        uploadImage(file);
      }
    }
  };

  if (!note) {
    return (
      <div className="editor-empty">
        <Edit size={48} className="empty-icon" />
        <h3>Selecione uma nota para editar</h3>
        <p>Escolha uma nota da lista ou crie uma nova</p>
      </div>
    );
  }

  return (
    <div className="note-editor">
      <div className="editor-header">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da nota..."
          className="note-title-input"
        />
        
        <div className="editor-actions">
          <OnlineUsers users={onlineUsers} isConnected={isConnected} />
          
          <div className="editor-tabs">
            <button
              className={`tab ${!isPreview ? 'active' : ''}`}
              onClick={() => setIsPreview(false)}
            >
              <Edit size={16} />
              Editar
            </button>
            <button
              className={`tab ${isPreview ? 'active' : ''}`}
              onClick={() => setIsPreview(true)}
            >
              <Eye size={16} />
              Visualizar
            </button>
          </div>
          
          <button onClick={saveNote} disabled={saving} className="save-button">
            <Save size={16} />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          
          <button 
            onClick={() => setShowVersionHistory(true)} 
            className="history-button"
            title="Histórico de Versões"
          >
            <History size={16} />
          </button>
          
          <button 
            onClick={() => setShowNotesGraph(true)} 
            className="graph-button"
            title="Visualizar conexões entre notas"
          >
            <Network size={16} />
          </button>
          
          <button 
            onClick={createBackup}
            className="backup-button"
            title="Criar backup local"
          >
            <Clock size={16} />
          </button>
          
          <button 
            onClick={() => {
              const backups = listBackups();
              if (backups.length > 0) {
                const backup = restoreBackup(0);
                if (backup) {
                  setTitle(backup.title);
                  setContent(backup.content);
                  showSuccess('Backup restaurado com sucesso');
                }
              } else {
                showWarning('Nenhum backup disponível');
              }
            }}
            className="restore-button"
            title="Restaurar último backup"
          >
            <RotateCcw size={16} />
          </button>
          
          <button onClick={deleteNote} className="delete-button">
            <Trash size={16} />
          </button>
        </div>
      </div>

      {lastSaved && (
        <div className="save-status">
          Salvo em {lastSaved.toLocaleTimeString()}
          {isTyping && <span className="typing-indicator"> • Outro usuário digitando...</span>}
        </div>
      )}

      <div className="editor-body">
        <div className="editor-main">
          {isPreview ? (
            <div className="markdown-preview">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="editor-container">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                onPaste={handleImagePaste}
                placeholder="Digite sua nota em Markdown...

# Título
## Subtítulo

**Negrito** *Itálico*

- Lista
- de 
- itens

```javascript
console.log('Código');
```

[Link](https://example.com)

Cole imagens diretamente!"
                className={`editor-textarea ${isTyping ? 'typing' : ''}`}
              />
              
              <div className="editor-toolbar">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => uploadImage(e.target.files[0])}
                  style={{ display: 'none' }}
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="toolbar-button">
                  <Upload size={16} />
                  Upload Imagem
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Seção de Reações */}
        <div className="reactions-section">
          <h3>Reações</h3>
          <div className="reactions-buttons">
            {['👍', '❤️', '🔥'].map(emoji => (
              <button
                key={emoji}
                className={`reaction-button ${reactions[emoji] > 0 ? 'active' : ''}`}
                onClick={() => toggleReaction(emoji)}
              >
                {emoji} {reactions[emoji] || 0}
              </button>
            ))}
          </div>
        </div>

        <div className="comments-panel">
          <div className="comments-header">
            <h3>
              <MessageCircle size={16} />
              Comentários ({comments.length})
            </h3>
          </div>

          <div className="comments-list">
            {comments.map(comment => (
              <div key={comment.id} className="comment">
                <div className="comment-header">
                  <span className="comment-author">@{comment.username}</span>
                  <span className="comment-date">
                    {new Date(comment.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="comment-content">{comment.content}</div>
              </div>
            ))}
          </div>

          <div className="comment-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Adicionar comentário..."
              className="comment-input"
              rows="3"
            />
            <button 
              onClick={addComment}
              disabled={!newComment.trim()}
              className="comment-submit"
            >
              Comentar
            </button>
          </div>
        </div>
      </div>
      
      <VersionHistory 
        noteId={note?.id}
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        onVersionRestore={() => {
          // Recarregar a nota após restaurar uma versão
          if (onNoteUpdate) onNoteUpdate();
          // Recarregar dados locais
          if (note) {
            setTitle(note.title);
            setContent(note.content);
          }
        }}
      />
      
      <NotesGraph 
        isOpen={showNotesGraph}
        onClose={() => setShowNotesGraph(false)}
        currentNoteId={note?.id}
      />
    </div>
  );
};

export default NoteEditor;
