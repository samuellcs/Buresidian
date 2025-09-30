import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

const NoteNode = ({ data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(data.title || 'Nova Nota');
  const [content, setContent] = useState(data.content || 'Clique para editar...');
  const [showPreview, setShowPreview] = useState(true);
  
  const titleRef = useRef(null);
  const contentRef = useRef(null);

  const backgroundColor = data.backgroundColor || '#8b5cf6';
  const textColor = data.textColor || '#ffffff';

  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    if (data.noteId) {
      // Se tem noteId, abrir a nota no app principal
      window.open(`/notes/${data.noteId}`, '_blank');
    } else {
      // Senão, editar in-place
      setIsEditing(true);
      setShowPreview(false);
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    setShowPreview(true);
    
    if (data.onUpdate) {
      data.onUpdate({
        title,
        content,
        noteId: data.noteId
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setShowPreview(true);
      // Restaurar valores originais
      setTitle(data.title || 'Nova Nota');
      setContent(data.content || 'Clique para editar...');
    }
  };

  const truncateText = (text, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div 
      className={`bg-gray-800 border rounded-lg p-3 min-w-[200px] max-w-[300px] shadow-lg ${
        selected ? 'border-purpleAccent ring-2 ring-purpleAccent ring-opacity-50' : 'border-gray-600'
      }`}
      style={{ 
        backgroundColor: backgroundColor,
        color: textColor,
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Handles para conexões */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-purpleAccent"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-purpleAccent"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purpleAccent"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purpleAccent"
      />

      {/* Header com ícone e ações */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">📝</span>
          {data.noteId && (
            <span className="text-xs opacity-70" title="Nota vinculada">
              🔗
            </span>
          )}
        </div>
        
        {!isEditing && !data.noteId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="text-xs opacity-70 hover:opacity-100 transition-opacity"
            title="Editar"
          >
            ✏️
          </button>
        )}
      </div>

      {/* Conteúdo */}
      {isEditing ? (
        <div className="space-y-2">
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyPress}
            className="w-full bg-transparent border-b border-white/30 focus:border-white/60 outline-none font-medium text-sm"
            placeholder="Título da nota..."
          />
          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyPress}
            className="w-full bg-transparent border border-white/30 focus:border-white/60 outline-none text-xs resize-none rounded p-2"
            rows="4"
            placeholder="Conteúdo da nota..."
          />
          <div className="flex justify-center space-x-2">
            <button
              onClick={handleSave}
              className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded transition-colors"
              title="Salvar (Ctrl+Enter)"
            >
              ✅ Salvar
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setShowPreview(true);
                setTitle(data.title || 'Nova Nota');
                setContent(data.content || 'Clique para editar...');
              }}
              className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
              title="Cancelar (Esc)"
            >
              ❌ Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <h4 className="font-medium text-sm break-words">{title}</h4>
          <p className="text-xs opacity-80 break-words leading-relaxed">
            {showPreview ? truncateText(content, 120) : content}
          </p>
          {content.length > 120 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPreview(!showPreview);
              }}
              className="text-xs opacity-60 hover:opacity-100 transition-opacity underline"
            >
              {showPreview ? 'Ver mais' : 'Ver menos'}
            </button>
          )}
          
          {data.noteId && (
            <div className="text-xs opacity-60 border-t border-white/20 pt-2 mt-2">
              Nota vinculada • Duplo clique para abrir
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NoteNode;
