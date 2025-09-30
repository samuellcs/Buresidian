import React, { useState, useRef } from 'react';
import { Handle, Position } from 'reactflow';

const ImageNode = ({ data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [url, setUrl] = useState(data.url || '');
  const [alt, setAlt] = useState(data.alt || 'Imagem');
  const [caption, setCaption] = useState(data.caption || '');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const fileInputRef = useRef(null);

  const handleSave = () => {
    setIsEditing(false);
    
    if (data.onUpdate) {
      data.onUpdate({
        url,
        alt,
        caption
      });
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Converter para base64 para demonstração
      // Em produção, você faria upload para um servidor
      const reader = new FileReader();
      reader.onload = (event) => {
        setUrl(event.target.result);
        setImageError(false);
        setImageLoaded(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoaded(false);
    setImageError(true);
  };

  return (
    <div 
      className={`rounded-lg p-3 min-w-[200px] max-w-[350px] shadow-lg bg-gray-800 transition-all ${
        selected ? 'ring-2 ring-purpleAccent ring-opacity-50 border-2 border-purpleAccent' : 'border border-gray-600'
      }`}
      onDoubleClick={() => setIsEditing(true)}
    >
      {/* Handles para conexões */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-green-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-green-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-green-500"
      />

      {/* Header com ícone e controles */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🖼️</span>
          <span className="text-xs opacity-70 text-white">Imagem</span>
        </div>
        
        {!isEditing ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="text-xs opacity-70 hover:opacity-100 transition-opacity p-1 rounded text-white"
            title="Editar imagem"
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
                setUrl(data.url || '');
                setAlt(data.alt || 'Imagem');
                setCaption(data.caption || '');
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
      {isEditing ? (
        <div className="space-y-3">
          {/* URL da imagem */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              URL da Imagem:
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 focus:border-purpleAccent outline-none rounded px-2 py-1 text-sm text-white"
              placeholder="https://exemplo.com/imagem.jpg"
            />
          </div>

          {/* Upload de arquivo */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Ou fazer upload:
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="w-full text-xs text-gray-300 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-purpleAccent file:text-white hover:file:bg-purple-700"
            />
          </div>

          {/* Texto alternativo */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Texto alternativo:
            </label>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 focus:border-purpleAccent outline-none rounded px-2 py-1 text-sm text-white"
              placeholder="Descrição da imagem"
            />
          </div>

          {/* Legenda */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Legenda:
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 focus:border-purpleAccent outline-none rounded px-2 py-1 text-sm text-white"
              placeholder="Legenda opcional"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Imagem */}
          <div className="relative">
            {url ? (
              <>
                {!imageLoaded && !imageError && (
                  <div className="h-32 bg-gray-700 rounded flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purpleAccent"></div>
                  </div>
                )}
                
                {imageError ? (
                  <div className="h-32 bg-gray-700 border-2 border-dashed border-gray-500 rounded flex flex-col items-center justify-center text-gray-400">
                    <span className="text-2xl mb-2">❌</span>
                    <span className="text-xs">Erro ao carregar imagem</span>
                  </div>
                ) : (
                  <img
                    src={url}
                    alt={alt}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    className={`max-w-full h-auto rounded transition-opacity ${
                      imageLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ maxHeight: '200px' }}
                  />
                )}
              </>
            ) : (
              <div className="h-32 bg-gray-700 border-2 border-dashed border-gray-500 rounded flex flex-col items-center justify-center text-gray-400">
                <span className="text-3xl mb-2">🖼️</span>
                <span className="text-xs text-center">
                  Duplo clique para<br />adicionar imagem
                </span>
              </div>
            )}
          </div>

          {/* Legenda */}
          {caption && (
            <div className="text-xs text-gray-300 text-center italic">
              {caption}
            </div>
          )}

          {/* Alt text (só visível durante hover) */}
          {alt && url && (
            <div className="text-xs text-gray-500 opacity-0 hover:opacity-100 transition-opacity">
              Alt: {alt}
            </div>
          )}
        </div>
      )}

      {/* Dica de uso */}
      {!isEditing && (
        <div className="mt-2 text-xs opacity-50 text-center text-gray-400">
          Duplo clique para editar
        </div>
      )}
    </div>
  );
};

export default ImageNode;
