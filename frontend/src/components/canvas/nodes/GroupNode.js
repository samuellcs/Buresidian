import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

const GroupNode = ({ data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(data.title || 'Novo Grupo');
  const [description, setDescription] = useState(data.description || '');
  const [backgroundColor, setBackgroundColor] = useState(data.backgroundColor || 'rgba(139, 92, 246, 0.1)');
  const [borderColor, setBorderColor] = useState(data.borderColor || '#8b5cf6');
  const [isCollapsed, setIsCollapsed] = useState(data.isCollapsed || false);

  const handleSave = () => {
    setIsEditing(false);
    
    if (data.onUpdate) {
      data.onUpdate({
        title,
        description,
        backgroundColor,
        borderColor,
        isCollapsed
      });
    }
  };

  const toggleCollapsed = (e) => {
    e.stopPropagation();
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    
    if (data.onUpdate) {
      data.onUpdate({
        title,
        description,
        backgroundColor,
        borderColor,
        isCollapsed: newCollapsed
      });
    }
  };

  const colorPresets = [
    { bg: 'rgba(139, 92, 246, 0.1)', border: '#8b5cf6', name: 'Roxo' },
    { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', name: 'Azul' },
    { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', name: 'Verde' },
    { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', name: 'Amarelo' },
    { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', name: 'Vermelho' },
    { bg: 'rgba(156, 163, 175, 0.1)', border: '#9ca3af', name: 'Cinza' },
  ];

  return (
    <div 
      className={`rounded-lg p-4 min-w-[300px] max-w-[500px] shadow-lg transition-all ${
        selected ? 'ring-2 ring-opacity-75' : ''
      }`}
      style={{ 
        backgroundColor: backgroundColor,
        border: `2px ${isCollapsed ? 'dashed' : 'solid'} ${borderColor}`,
        ringColor: borderColor
      }}
      onDoubleClick={() => setIsEditing(true)}
    >
      {/* Handles para conexões */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3"
        style={{ backgroundColor: borderColor }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3"
        style={{ backgroundColor: borderColor }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3"
        style={{ backgroundColor: borderColor }}
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3"
        style={{ backgroundColor: borderColor }}
      />

      {/* Header com ícone e controles */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleCollapsed}
            className="text-lg hover:scale-110 transition-transform"
            title={isCollapsed ? 'Expandir grupo' : 'Recolher grupo'}
          >
            {isCollapsed ? '📁' : '📂'}
          </button>
          <span className="text-xs opacity-70 text-white">Grupo</span>
        </div>
        
        {!isEditing ? (
          <div className="flex items-center space-x-1">
            <button
              onClick={toggleCollapsed}
              className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors text-white"
              title={isCollapsed ? 'Expandir' : 'Recolher'}
            >
              {isCollapsed ? '📖' : '📕'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="text-xs opacity-70 hover:opacity-100 transition-opacity p-1 rounded text-white"
              title="Editar grupo"
            >
              ✏️
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-1">
            <button
              onClick={handleSave}
              className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded transition-colors text-white"
              title="Salvar"
            >
              ✅
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setTitle(data.title || 'Novo Grupo');
                setDescription(data.description || '');
                setBackgroundColor(data.backgroundColor || 'rgba(139, 92, 246, 0.1)');
                setBorderColor(data.borderColor || '#8b5cf6');
              }}
              className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors text-white"
              title="Cancelar"
            >
              ❌
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      {!isCollapsed && (
        <>
          {isEditing ? (
            <div className="space-y-4">
              {/* Título */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Título do Grupo:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 focus:border-purpleAccent outline-none rounded px-2 py-1 text-sm text-white"
                  placeholder="Nome do grupo"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Descrição:
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 focus:border-purpleAccent outline-none rounded px-2 py-1 text-sm text-white resize-none"
                  rows="3"
                  placeholder="Descrição opcional do grupo"
                />
              </div>

              {/* Presets de cores */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">
                  Esquema de cores:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {colorPresets.map((preset, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setBackgroundColor(preset.bg);
                        setBorderColor(preset.border);
                      }}
                      className={`p-2 rounded text-xs transition-all ${
                        backgroundColor === preset.bg && borderColor === preset.border
                          ? 'ring-2 ring-white'
                          : 'hover:scale-105'
                      }`}
                      style={{ 
                        backgroundColor: preset.bg,
                        border: `1px solid ${preset.border}`,
                        color: 'white'
                      }}
                      title={preset.name}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cores personalizadas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Cor de fundo:
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={borderColor}
                      onChange={(e) => {
                        const color = e.target.value;
                        setBorderColor(color);
                        // Converter para rgba com transparência
                        const r = parseInt(color.slice(1, 3), 16);
                        const g = parseInt(color.slice(3, 5), 16);
                        const b = parseInt(color.slice(5, 7), 16);
                        setBackgroundColor(`rgba(${r}, ${g}, ${b}, 0.1)`);
                      }}
                      className="w-8 h-8 rounded cursor-pointer"
                    />
                    <span className="text-xs text-gray-400">
                      {borderColor}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Opacidade:
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={backgroundColor.match(/[\d\.]+(?=\))/)?.[0] || 0.1}
                    onChange={(e) => {
                      const opacity = e.target.value;
                      const r = parseInt(borderColor.slice(1, 3), 16);
                      const g = parseInt(borderColor.slice(3, 5), 16);
                      const b = parseInt(borderColor.slice(5, 7), 16);
                      setBackgroundColor(`rgba(${r}, ${g}, ${b}, ${opacity})`);
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Título do grupo */}
              <h3 className="font-semibold text-lg text-white">
                {title}
              </h3>

              {/* Descrição */}
              {description && (
                <p className="text-sm text-gray-300 leading-relaxed">
                  {description}
                </p>
              )}

              {/* Área de conteúdo (onde outros nós podem ser agrupados) */}
              <div 
                className="min-h-[120px] border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center text-gray-400"
                style={{ borderColor: borderColor + '40' }}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">📦</div>
                  <div className="text-xs">
                    Arraste outros elementos aqui<br />
                    para agrupá-los
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Versão recolhida */}
      {isCollapsed && (
        <div className="text-center">
          <h4 className="font-medium text-sm text-white">
            {title}
          </h4>
          <div className="text-xs text-gray-400 mt-1">
            Grupo recolhido • Clique em 📁 para expandir
          </div>
        </div>
      )}

      {/* Dica de uso */}
      {!isEditing && !isCollapsed && (
        <div className="mt-3 text-xs opacity-50 text-center text-gray-400">
          Duplo clique para editar • Use como container para outros elementos
        </div>
      )}
    </div>
  );
};

export default GroupNode;
