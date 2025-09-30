import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { graphService } from '../../services/graphService';
import { useNotifications } from '../../contexts/NotificationContext';

const GraphView = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const canvasRef = useRef(null);
  const animationRef = useRef();
  
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], stats: {} });
  const [filteredData, setFilteredData] = useState({ nodes: [], edges: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    tag: '',
    folder: '',
    minConnections: 0,
    layout: 'force' // force, circular, hierarchical
  });
  const [tags, setTags] = useState([]);
  const [simulation, setSimulation] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });

  // Canvas dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Carregar dados iniciais
  useEffect(() => {
    loadGraphData();
    loadTags();
  }, []);

  // Atualizar dimensões do canvas
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Aplicar filtros quando mudarem
  useEffect(() => {
    applyFilters();
  }, [graphData, searchTerm, activeFilters]);

  const loadGraphData = async () => {
    try {
      setLoading(true);
      const data = await graphService.getGraphConnections();
      setGraphData(data);
    } catch (error) {
      console.error('Erro ao carregar dados do grafo:', error);
      showNotification('Erro ao carregar grafo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const tagsData = await graphService.getAllTags();
      setTags(tagsData.flat_tags || []);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = { ...graphData };

    // Aplicar busca
    if (searchTerm) {
      filtered = graphService.searchInGraph(filtered, searchTerm);
    }

    // Aplicar filtro por tag
    if (activeFilters.tag) {
      filtered = graphService.filterGraphByTag(filtered, activeFilters.tag);
    }

    // Aplicar filtro por pasta
    if (activeFilters.folder) {
      filtered = graphService.filterGraphByFolder(filtered, activeFilters.folder);
    }

    // Aplicar filtro por conexões mínimas
    if (activeFilters.minConnections > 0) {
      filtered = graphService.filterGraphByConnections(filtered, activeFilters.minConnections);
    }

    // Aplicar layout
    const layoutNodes = applyLayout(filtered.nodes, filtered.edges, activeFilters.layout);
    
    setFilteredData({
      ...filtered,
      nodes: layoutNodes
    });
  }, [graphData, searchTerm, activeFilters]);

  const applyLayout = (nodes, edges, layoutType) => {
    const options = {
      width: dimensions.width,
      height: dimensions.height,
      centerX: dimensions.width / 2,
      centerY: dimensions.height / 2
    };

    switch (layoutType) {
      case 'circular':
        return graphService.calculateCircularLayout(nodes, options);
      case 'hierarchical':
        return graphService.calculateHierarchicalLayout(nodes, edges, options);
      case 'force':
      default:
        return graphService.calculateForceDirectedLayout(nodes, edges, options);
    }
  };

  // Renderização do canvas
  useEffect(() => {
    if (!canvasRef.current || filteredData.nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Configurar canvas
    canvas.width = dimensions.width * window.devicePixelRatio;
    canvas.height = dimensions.height * window.devicePixelRatio;
    canvas.style.width = dimensions.width + 'px';
    canvas.style.height = dimensions.height + 'px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const render = () => {
      // Limpar canvas
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      
      // Aplicar transformações de câmera
      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.zoom, camera.zoom);

      // Renderizar arestas
      filteredData.edges.forEach(edge => {
        const sourceNode = filteredData.nodes.find(n => n.id === edge.source);
        const targetNode = filteredData.nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          
          // Cor baseada no tipo de conexão
          if (edge.type === 'reference') {
            ctx.strokeStyle = '#10b981'; // Verde para referências
            ctx.lineWidth = 2;
          } else if (edge.type === 'tag') {
            ctx.strokeStyle = '#8b5cf6'; // Roxo para tags
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
          }
          
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // Renderizar nós
      filteredData.nodes.forEach(node => {
        const isSelected = selectedNode && selectedNode.id === node.id;
        const isSearchMatch = searchTerm && (
          node.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          node.content_preview.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Tamanho baseado no número de conexões
        const connections = filteredData.edges.filter(e => 
          e.source === node.id || e.target === node.id
        ).length;
        const radius = Math.max(8, Math.min(25, 8 + connections * 2));

        // Cor baseada no número de tags
        let fillColor = '#374151'; // Cinza padrão
        if (node.tags.length > 0) {
          const hue = (node.tags.length * 60) % 360;
          fillColor = `hsl(${hue}, 60%, 50%)`;
        }

        // Destacar nó selecionado ou correspondente à busca
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI);
          ctx.fillStyle = '#fbbf24';
          ctx.fill();
        }

        if (isSearchMatch) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Renderizar nó principal
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = fillColor;
        ctx.fill();
        
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Renderizar título (se zoom permitir)
        if (camera.zoom > 0.5) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `${Math.max(10, 12 * camera.zoom)}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          
          const maxWidth = radius * 4;
          const text = node.title.length > 20 ? node.title.substring(0, 20) + '...' : node.title;
          ctx.fillText(text, node.x, node.y + radius + 5, maxWidth);
        }
      });

      ctx.restore();
    };

    render();
    
    // Animação contínua para layouts dinâmicos
    if (activeFilters.layout === 'force') {
      animationRef.current = requestAnimationFrame(render);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [filteredData, selectedNode, searchTerm, camera, dimensions, activeFilters.layout]);

  // Handlers de mouse
  const handleCanvasClick = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - camera.x) / camera.zoom;
    const y = (event.clientY - rect.top - camera.y) / camera.zoom;

    // Encontrar nó clicado
    const clickedNode = filteredData.nodes.find(node => {
      const connections = filteredData.edges.filter(e => 
        e.source === node.id || e.target === node.id
      ).length;
      const radius = Math.max(8, Math.min(25, 8 + connections * 2));
      
      const distance = Math.sqrt(
        Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2)
      );
      
      return distance <= radius;
    });

    if (clickedNode) {
      setSelectedNode(clickedNode);
    } else {
      setSelectedNode(null);
    }
  };

  const handleCanvasDoubleClick = (event) => {
    if (selectedNode) {
      navigate(`/notes/${selectedNode.id}`);
    }
  };

  const handleWheel = (event) => {
    event.preventDefault();
    
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, camera.zoom * delta));
    
    setCamera(prev => ({
      ...prev,
      zoom: newZoom
    }));
  };

  // Handlers de filtros
  const handleFilterChange = (filterType, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const resetFilters = () => {
    setActiveFilters({
      tag: '',
      folder: '',
      minConnections: 0,
      layout: 'force'
    });
    setSearchTerm('');
  };

  const zoomToFit = () => {
    if (filteredData.nodes.length === 0) return;

    const padding = 50;
    const xs = filteredData.nodes.map(n => n.x);
    const ys = filteredData.nodes.map(n => n.y);
    
    const minX = Math.min(...xs) - padding;
    const maxX = Math.max(...xs) + padding;
    const minY = Math.min(...ys) - padding;
    const maxY = Math.max(...ys) + padding;
    
    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    
    const scaleX = dimensions.width / graphWidth;
    const scaleY = dimensions.height / graphHeight;
    const scale = Math.min(scaleX, scaleY, 1);
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    setCamera({
      x: dimensions.width / 2 - centerX * scale,
      y: dimensions.height / 2 - centerY * scale,
      zoom: scale
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purpleAccent mx-auto mb-4"></div>
          <p>Carregando grafo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-obsidian text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold flex items-center">
            <span className="text-2xl mr-3">🕸️</span>
            Graph View
          </h1>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-400">
              {filteredData.stats.total_notes} notas • {filteredData.stats.total_connections} conexões
            </div>
            <button
              onClick={zoomToFit}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            >
              🎯 Ajustar
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar de filtros */}
        <div className="w-80 border-r border-gray-800 p-4 bg-gray-900">
          <div className="space-y-6">
            {/* Busca */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Buscar notas
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 focus:border-purpleAccent outline-none rounded px-3 py-2 text-sm"
                placeholder="Digite para buscar..."
              />
            </div>

            {/* Filtro por tag */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Filtrar por tag
              </label>
              <select
                value={activeFilters.tag}
                onChange={(e) => handleFilterChange('tag', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 focus:border-purpleAccent outline-none rounded px-3 py-2 text-sm"
              >
                <option value="">Todas as tags</option>
                {tags.map(tag => (
                  <option key={tag.name} value={tag.name}>
                    #{tag.name} ({tag.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Conexões mínimas */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Conexões mínimas: {activeFilters.minConnections}
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={activeFilters.minConnections}
                onChange={(e) => handleFilterChange('minConnections', parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Layout */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Layout
              </label>
              <div className="space-y-2">
                {[
                  { value: 'force', label: '⚡ Force-directed' },
                  { value: 'circular', label: '⭕ Circular' },
                  { value: 'hierarchical', label: '🌳 Hierárquico' }
                ].map(layout => (
                  <label key={layout.value} className="flex items-center">
                    <input
                      type="radio"
                      name="layout"
                      value={layout.value}
                      checked={activeFilters.layout === layout.value}
                      onChange={(e) => handleFilterChange('layout', e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">{layout.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Estatísticas */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Estatísticas</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total:</span>
                  <span>{graphData.stats.total_notes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Visíveis:</span>
                  <span>{filteredData.stats.total_notes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Conexões:</span>
                  <span>{filteredData.stats.total_connections}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Órfãs:</span>
                  <span>{filteredData.stats.orphaned_notes}</span>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="space-y-2">
              <button
                onClick={resetFilters}
                className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                🔄 Resetar filtros
              </button>
              <button
                onClick={loadGraphData}
                className="w-full px-3 py-2 bg-purpleAccent hover:bg-purple-700 rounded text-sm transition-colors"
              >
                ♻️ Recarregar dados
              </button>
            </div>
          </div>
        </div>

        {/* Canvas principal */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-pointer"
            onClick={handleCanvasClick}
            onDoubleClick={handleCanvasDoubleClick}
            onWheel={handleWheel}
          />
          
          {/* Controles de zoom */}
          <div className="absolute top-4 right-4 flex flex-col space-y-2">
            <button
              onClick={() => setCamera(prev => ({ ...prev, zoom: Math.min(3, prev.zoom * 1.2) }))}
              className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded flex items-center justify-center text-lg"
            >
              +
            </button>
            <button
              onClick={() => setCamera(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom * 0.8) }))}
              className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded flex items-center justify-center text-lg"
            >
              -
            </button>
          </div>

          {/* Info do nó selecionado */}
          {selectedNode && (
            <div className="absolute bottom-4 left-4 right-4 bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-lg mb-2">{selectedNode.title}</h3>
                  <p className="text-gray-400 text-sm mb-2">{selectedNode.content_preview}</p>
                  
                  {selectedNode.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {selectedNode.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-purpleAccent bg-opacity-20 text-purpleAccent rounded text-xs"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500">
                    {selectedNode.word_count} palavras • Criada em {new Date(selectedNode.created_at).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => navigate(`/notes/${selectedNode.id}`)}
                    className="px-3 py-1 bg-purpleAccent hover:bg-purple-700 rounded text-sm transition-colors"
                  >
                    Abrir
                  </button>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GraphView;