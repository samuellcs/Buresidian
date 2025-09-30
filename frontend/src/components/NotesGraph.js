import React, { useState, useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { Network as NetworkIcon, Search, Filter, Maximize, Eye, RotateCcw } from 'lucide-react';
import axios from 'axios';
import '../styles/NotesGraph.css';

const NotesGraph = ({ isOpen, onClose, onNoteSelect }) => {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], stats: {} });
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [connections, setConnections] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFolder, setFilterFolder] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const networkRef = useRef(null);
  const networkInstance = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadGraphData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (graphData.nodes.length > 0 && networkRef.current) {
      initializeNetwork();
    }
  }, [graphData, searchTerm, filterFolder]);

  const loadGraphData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/notes/graph');
      setGraphData(response.data);
    } catch (error) {
      console.error('Error loading graph data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNodeConnections = async (nodeId) => {
    try {
      const response = await axios.get(`/notes/${nodeId}/connections`);
      setConnections(response.data);
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  };

  const getFilteredData = () => {
    let nodes = graphData.nodes;
    let edges = graphData.edges;

    // Filtrar por busca
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const filteredNodeIds = new Set(
        nodes
          .filter(node => node.label.toLowerCase().includes(searchLower))
          .map(node => node.id)
      );
      
      nodes = nodes.filter(node => filteredNodeIds.has(node.id));
      edges = edges.filter(edge => 
        filteredNodeIds.has(edge.from) && filteredNodeIds.has(edge.to)
      );
    }

    // Filtrar por pasta
    if (filterFolder) {
      nodes = nodes.filter(node => node.group === filterFolder);
      const nodeIds = new Set(nodes.map(node => node.id));
      edges = edges.filter(edge => 
        nodeIds.has(edge.from) && nodeIds.has(edge.to)
      );
    }

    return { nodes, edges };
  };

  const initializeNetwork = () => {
    if (!networkRef.current) return;

    // Destruir rede anterior
    if (networkInstance.current) {
      networkInstance.current.destroy();
    }

    const filteredData = getFilteredData();
    
    // Configurar dados
    const nodes = new DataSet(filteredData.nodes.map(node => ({
      ...node,
      color: {
        background: getNodeColor(node.group),
        border: selectedNode === node.id ? '#8b5cf6' : '#333',
        highlight: {
          background: '#8b5cf6',
          border: '#7c3aed'
        }
      },
      font: {
        color: '#e0e0e0',
        size: 14
      },
      borderWidth: selectedNode === node.id ? 3 : 1,
      shadow: true
    })));

    const edges = new DataSet(filteredData.edges);

    // Configurações da rede
    const options = {
      nodes: {
        shape: 'dot',
        size: 25,
        borderWidth: 2,
        shadow: true,
        font: {
          size: 12,
          color: '#e0e0e0'
        }
      },
      edges: {
        width: 2,
        color: { inherit: 'from' },
        smooth: {
          type: 'dynamic',
          roundness: 0.5
        },
        arrows: {
          to: { enabled: true, scaleFactor: 1, type: 'arrow' }
        },
        font: {
          size: 10,
          color: '#999',
          strokeWidth: 3,
          strokeColor: '#1a1a1a'
        }
      },
      physics: {
        enabled: true,
        stabilization: { iterations: 100 },
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.3,
          springLength: 150,
          springConstant: 0.04,
          damping: 0.09
        }
      },
      interaction: {
        hover: true,
        selectConnectedEdges: false,
        tooltipDelay: 200
      },
      layout: {
        improvedLayout: true
      }
    };

    // Criar rede
    networkInstance.current = new Network(networkRef.current, { nodes, edges }, options);

    // Event listeners
    networkInstance.current.on('click', (event) => {
      if (event.nodes.length > 0) {
        const nodeId = event.nodes[0];
        setSelectedNode(nodeId);
        loadNodeConnections(nodeId);
      } else {
        setSelectedNode(null);
        setConnections(null);
      }
    });

    networkInstance.current.on('doubleClick', (event) => {
      if (event.nodes.length > 0) {
        const nodeId = event.nodes[0];
        onNoteSelect && onNoteSelect(nodeId);
        onClose();
      }
    });

    networkInstance.current.on('hoverNode', (event) => {
      document.body.style.cursor = 'pointer';
    });

    networkInstance.current.on('blurNode', () => {
      document.body.style.cursor = 'default';
    });
  };

  const getNodeColor = (group) => {
    const colors = [
      '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
      '#8b5a3c', '#06b6d4', '#84cc16', '#f97316', '#ec4899'
    ];
    const hash = group.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  const resetView = () => {
    if (networkInstance.current) {
      networkInstance.current.fit();
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const folders = [...new Set(graphData.nodes.map(node => node.group))];

  if (!isOpen) return null;

  return (
    <div className={`notes-graph-overlay ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="notes-graph-modal">
        <div className="graph-header">
          <div className="header-left">
            <NetworkIcon size={20} />
            <h2>Mapa de Conexões</h2>
            <div className="graph-stats">
              <span>{graphData.stats.total_notes} notas</span>
              <span>{graphData.stats.total_connections} conexões</span>
            </div>
          </div>
          
          <div className="header-controls">
            <div className="search-controls">
              <div className="search-input-wrapper">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar notas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              
              <select
                value={filterFolder}
                onChange={(e) => setFilterFolder(e.target.value)}
                className="folder-filter"
              >
                <option value="">Todas as pastas</option>
                {folders.map(folder => (
                  <option key={folder} value={folder}>{folder}</option>
                ))}
              </select>
            </div>
            
            <div className="action-buttons">
              <button onClick={resetView} title="Resetar visualização">
                <RotateCcw size={16} />
              </button>
              <button onClick={toggleFullscreen} title="Tela cheia">
                <Maximize size={16} />
              </button>
              <button onClick={onClose} className="close-btn">×</button>
            </div>
          </div>
        </div>

        <div className="graph-body">
          <div className="graph-container" ref={containerRef}>
            {loading ? (
              <div className="graph-loading">
                <div className="spinner"></div>
                <p>Carregando grafo...</p>
              </div>
            ) : (
              <div ref={networkRef} className="network-container" />
            )}
          </div>

          {selectedNode && connections && (
            <div className="node-details">
              <div className="details-header">
                <h3>📝 {connections.note_title}</h3>
                <button 
                  onClick={() => {
                    onNoteSelect && onNoteSelect(selectedNode);
                    onClose();
                  }}
                  className="open-note-btn"
                >
                  <Eye size={14} />
                  Abrir
                </button>
              </div>
              
              <div className="connections-info">
                <div className="connection-section">
                  <h4>📥 Mencionada por ({connections.incoming_connections.length})</h4>
                  {connections.incoming_connections.map(conn => (
                    <div key={conn.id} className="connection-item">
                      <span className="connection-title">{conn.title}</span>
                      <span className="connection-preview">{conn.preview}</span>
                    </div>
                  ))}
                </div>
                
                <div className="connection-section">
                  <h4>📤 Menciona ({connections.outgoing_connections.length})</h4>
                  {connections.outgoing_connections.map(conn => (
                    <div key={conn.id} className="connection-item">
                      <span className="connection-title">{conn.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="graph-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#8b5cf6' }}></div>
            <span>Menciona</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#10b981' }}></div>
            <span>Link [[titulo]]</span>
          </div>
          <div className="legend-tip">
            💡 Clique duplo para abrir nota • Arraste para navegar
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesGraph;
