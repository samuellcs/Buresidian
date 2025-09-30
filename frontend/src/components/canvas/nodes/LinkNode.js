import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

const LinkNode = ({ data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [url, setUrl] = useState(data.url || 'https://');
  const [title, setTitle] = useState(data.title || 'Novo Link');
  const [description, setDescription] = useState(data.description || '');
  const [openInNewTab, setOpenInNewTab] = useState(data.openInNewTab !== false);

  const handleSave = () => {
    setIsEditing(false);
    
    if (data.onUpdate) {
      data.onUpdate({
        url,
        title,
        description,
        openInNewTab
      });
    }
  };

  const handleOpenLink = (e) => {
    e.stopPropagation();
    if (url && url !== 'https://') {
      if (openInNewTab) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = url;
      }
    }
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const getDomain = (url) => {
    try {
      return new URL(url).hostname;
    } catch (_) {
      return 'Link inválido';
    }
  };

  const getFavicon = (url) => {
    if (!isValidUrl(url)) return null;
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch (_) {
      return null;
    }
  };

  return (
    <div 
      className={`rounded-lg p-3 min-w-[250px] max-w-[350px] shadow-lg bg-gray-800 transition-all ${
        selected ? 'ring-2 ring-purpleAccent ring-opacity-50 border-2 border-purpleAccent' : 'border border-gray-600'
      }`}
      onDoubleClick={() => setIsEditing(true)}
    >
      {/* Handles para conexões */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-yellow-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-yellow-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-yellow-500"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-yellow-500"
      />

      {/* Header com ícone e controles */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🔗</span>
          <span className="text-xs opacity-70 text-white">Link</span>
        </div>
        
        <div className="flex items-center space-x-1">
          {!isEditing && isValidUrl(url) && url !== 'https://' && (
            <button
              onClick={handleOpenLink}
              className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-white"
              title="Abrir link"
            >
              🔗 Abrir
            </button>
          )}
          
          {!isEditing ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="text-xs opacity-70 hover:opacity-100 transition-opacity p-1 rounded text-white"
              title="Editar link"
            >
              ✏️
            </button>
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
                  setUrl(data.url || 'https://');
                  setTitle(data.title || 'Novo Link');
                  setDescription(data.description || '');
                }}
                className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors text-white"
                title="Cancelar"
              >
                ❌
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      {isEditing ? (
        <div className="space-y-3">
          {/* URL */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              URL:
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 focus:border-purpleAccent outline-none rounded px-2 py-1 text-sm text-white"
              placeholder="https://exemplo.com"
            />
            {url && !isValidUrl(url) && (
              <div className="text-xs text-red-400 mt-1">
                URL inválida
              </div>
            )}
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Título:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 focus:border-purpleAccent outline-none rounded px-2 py-1 text-sm text-white"
              placeholder="Nome do link"
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
              placeholder="Descrição opcional do link"
            />
          </div>

          {/* Configurações */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="openInNewTab"
              checked={openInNewTab}
              onChange={(e) => setOpenInNewTab(e.target.checked)}
              className="w-4 h-4 text-purpleAccent bg-gray-700 border-gray-600 rounded focus:ring-purpleAccent"
            />
            <label htmlFor="openInNewTab" className="text-xs text-gray-300">
              Abrir em nova aba
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Preview do link */}
          <div 
            className="cursor-pointer hover:bg-gray-700/50 rounded p-2 transition-colors"
            onClick={handleOpenLink}
          >
            <div className="flex items-start space-x-3">
              {/* Favicon */}
              <div className="flex-shrink-0 mt-1">
                {isValidUrl(url) && url !== 'https://' ? (
                  <img
                    src={getFavicon(url)}
                    alt=""
                    className="w-4 h-4"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-4 h-4 bg-gray-600 rounded-sm flex items-center justify-center">
                    <span className="text-xs">🌐</span>
                  </div>
                )}
              </div>

              {/* Conteúdo do link */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-white break-words">
                  {title}
                </h4>
                
                {description && (
                  <p className="text-xs text-gray-300 mt-1 break-words">
                    {description}
                  </p>
                )}
                
                <div className="text-xs text-gray-500 mt-1 break-words">
                  {isValidUrl(url) ? getDomain(url) : 'URL inválida'}
                </div>
              </div>

              {/* Indicador de nova aba */}
              {openInNewTab && isValidUrl(url) && url !== 'https://' && (
                <div className="flex-shrink-0">
                  <span className="text-xs text-gray-500" title="Abre em nova aba">
                    ↗️
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Status da URL */}
          {url === 'https://' && (
            <div className="text-xs text-gray-500 text-center italic">
              Configure o URL para ativar o link
            </div>
          )}
        </div>
      )}

      {/* Dica de uso */}
      {!isEditing && (
        <div className="mt-2 text-xs opacity-50 text-center text-gray-400">
          Duplo clique para editar • Clique no preview para abrir
        </div>
      )}
    </div>
  );
};

export default LinkNode;
