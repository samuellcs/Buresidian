import React, { useState } from 'react';

const CanvasToolbar = ({ onAddNode }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const nodeTypes = [
    {
      type: 'note',
      icon: '📝',
      name: 'Nota',
      description: 'Adicionar uma nota de texto',
      defaultData: {
        title: 'Nova Nota',
        content: 'Clique para editar...',
        backgroundColor: '#8b5cf6'
      }
    },
    {
      type: 'text',
      icon: '📄',
      name: 'Texto',
      description: 'Bloco de texto simples',
      defaultData: {
        content: 'Digite seu texto aqui...',
        fontSize: 14,
        textAlign: 'left'
      }
    },
    {
      type: 'image',
      icon: '🖼️',
      name: 'Imagem',
      description: 'Adicionar imagem ou arquivo',
      defaultData: {
        url: '',
        alt: 'Imagem',
        caption: ''
      }
    },
    {
      type: 'link',
      icon: '🔗',
      name: 'Link',
      description: 'Link para página externa',
      defaultData: {
        url: 'https://',
        title: 'Novo Link',
        description: ''
      }
    },
    {
      type: 'group',
      icon: '📦',
      name: 'Grupo',
      description: 'Agrupar outros elementos',
      defaultData: {
        title: 'Novo Grupo',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderColor: '#8b5cf6'
      }
    }
  ];

  const handleAddNode = (nodeType) => {
    onAddNode(nodeType.type, nodeType.defaultData);
    setIsExpanded(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-lg">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-white hover:bg-gray-800 transition-colors rounded-lg"
      >
        <div className="flex items-center space-x-2">
          <span className="text-lg">🧰</span>
          <span className="font-medium">Ferramentas</span>
        </div>
        <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-2">
          <div className="grid gap-2">
            {nodeTypes.map((nodeType) => (
              <button
                key={nodeType.type}
                onClick={() => handleAddNode(nodeType)}
                className="w-full px-3 py-2 text-left hover:bg-gray-800 rounded-md transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{nodeType.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white group-hover:text-purpleAccent transition-colors">
                      {nodeType.name}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {nodeType.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          {/* Ações adicionais */}
          <div className="border-t border-gray-700 mt-3 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <button className="px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-md transition-colors text-white">
                📤 Exportar
              </button>
              <button className="px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-md transition-colors text-white">
                🗑️ Limpar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasToolbar;
