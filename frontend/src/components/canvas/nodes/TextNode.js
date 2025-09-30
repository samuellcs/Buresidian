import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

const TextNode = ({ data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content || 'Digite seu texto aqui...');
  const [fontSize, setFontSize] = useState(data.fontSize || 14);
  const [textAlign, setTextAlign] = useState(data.textAlign || 'left');
  const [textColor, setTextColor] = useState(data.textColor || '#ffffff');
  const [backgroundColor, setBackgroundColor] = useState(data.backgroundColor || '#374151');
  
  const textRef = useRef(null);

  useEffect(() => {
    if (isEditing && textRef.current) {
      textRef.current.focus();
      // Selecionar todo o texto se for o texto padrão
      if (content === 'Digite seu texto aqui...') {
        textRef.current.select();
      }
    }
  }, [isEditing, content]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    
    if (data.onUpdate) {
      data.onUpdate({
        content,
        fontSize,
        textAlign,
        textColor,
        backgroundColor
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      // Restaurar valor original
      setContent(data.content || 'Digite seu texto aqui...');
    }
  };

  const textAlignOptions = [
    { value: 'left', icon: '⬅️', label: 'Esquerda' },
    { value: 'center', icon: '↔️', label: 'Centro' },
    { value: 'right', icon: '➡️', label: 'Direita' },
    { value: 'justify', icon: '📄', label: 'Justificado' }
  ];

  const fontSizeOptions = [10, 12, 14, 16, 18, 20, 24, 28, 32];

  return (
    <div 
      className={`rounded-lg p-3 min-w-[200px] max-w-[400px] shadow-lg transition-all ${
        selected ? 'ring-2 ring-purpleAccent ring-opacity-50' : ''
      }`}
      style={{ 
        backgroundColor: backgroundColor,
        border: selected ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.2)'
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Handles para conexões */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-blue-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500"
      />

      {/* Header com ícone e controles */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">📄</span>
          <span className="text-xs opacity-70">Texto</span>
        </div>
        
        {!isEditing ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="text-xs opacity-70 hover:opacity-100 transition-opacity p-1 rounded"
            title="Editar texto"
          >
            ✏️
          </button>
        ) : (
          <div className="flex items-center space-x-1">
            <button
              onClick={handleSave}
              className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded transition-colors"
              title="Salvar (Ctrl+Enter)"
            >
              ✅
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setContent(data.content || 'Digite seu texto aqui...');
              }}
              className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
              title="Cancelar (Esc)"
            >
              ❌
            </button>
          </div>
        )}
      </div>

      {/* Barra de ferramentas de formatação (só durante edição) */}
      {isEditing && (
        <div className="mb-3 p-2 bg-black/20 rounded-md space-y-2">
          <div className="flex items-center justify-between text-xs">
            {/* Tamanho da fonte */}
            <div className="flex items-center space-x-1">
              <span className="opacity-70">Tamanho:</span>
              <select 
                value={fontSize} 
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="bg-gray-700 text-white rounded px-1 text-xs"
              >
                {fontSizeOptions.map(size => (
                  <option key={size} value={size}>{size}px</option>
                ))}
              </select>
            </div>

            {/* Alinhamento */}
            <div className="flex items-center space-x-1">
              {textAlignOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setTextAlign(option.value)}
                  className={`p-1 rounded transition-colors ${
                    textAlign === option.value 
                      ? 'bg-purpleAccent text-white' 
                      : 'hover:bg-gray-600'
                  }`}
                  title={option.label}
                >
                  {option.icon}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            {/* Cor do texto */}
            <div className="flex items-center space-x-1">
              <span className="opacity-70">Cor:</span>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer"
              />
            </div>

            {/* Cor de fundo */}
            <div className="flex items-center space-x-1">
              <span className="opacity-70">Fundo:</span>
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      {isEditing ? (
        <textarea
          ref={textRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyPress}
          className="w-full bg-transparent border border-white/30 focus:border-white/60 outline-none rounded p-2 resize-none"
          rows="6"
          style={{
            fontSize: `${fontSize}px`,
            textAlign: textAlign,
            color: textColor
          }}
          placeholder="Digite seu texto aqui..."
        />
      ) : (
        <div 
          className="min-h-[60px] break-words whitespace-pre-wrap leading-relaxed"
          style={{
            fontSize: `${fontSize}px`,
            textAlign: textAlign,
            color: textColor
          }}
        >
          {content}
        </div>
      )}

      {/* Dica de uso */}
      {!isEditing && (
        <div className="mt-2 text-xs opacity-50 text-center">
          Duplo clique para editar
        </div>
      )}
    </div>
  );
};

export default TextNode;
