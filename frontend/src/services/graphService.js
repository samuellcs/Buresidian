// Serviço para Graph View - visualização de conexões entre notas
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class GraphService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  async getGraphConnections() {
    try {
      const response = await fetch(`${API_BASE}/api/graph/connections`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar conexões do grafo:', error);
      throw error;
    }
  }

  async getAllTags() {
    try {
      const response = await fetch(`${API_BASE}/api/graph/tags`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar tags:', error);
      throw error;
    }
  }

  async getNoteConnections(noteId) {
    try {
      const response = await fetch(`${API_BASE}/notes/${noteId}/connections`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar conexões da nota:', error);
      throw error;
    }
  }

  // Filtros para o grafo
  filterGraphByTag(graphData, tag) {
    const filteredNodes = graphData.nodes.filter(node => 
      node.tags && node.tags.includes(tag)
    );
    
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    
    const filteredEdges = graphData.edges.filter(edge =>
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      stats: {
        total_notes: filteredNodes.length,
        total_connections: filteredEdges.length,
        orphaned_notes: filteredNodes.filter(node => 
          !filteredEdges.some(edge => 
            edge.source === node.id || edge.target === node.id
          )
        ).length
      }
    };
  }

  filterGraphByFolder(graphData, folderId) {
    const filteredNodes = graphData.nodes.filter(node => 
      node.folder_id === folderId
    );
    
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    
    const filteredEdges = graphData.edges.filter(edge =>
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      stats: {
        total_notes: filteredNodes.length,
        total_connections: filteredEdges.length,
        orphaned_notes: filteredNodes.filter(node => 
          !filteredEdges.some(edge => 
            edge.source === node.id || edge.target === node.id
          )
        ).length
      }
    };
  }

  filterGraphByConnections(graphData, minConnections = 1) {
    // Contar conexões por nó
    const connectionCounts = {};
    graphData.nodes.forEach(node => {
      connectionCounts[node.id] = 0;
    });

    graphData.edges.forEach(edge => {
      connectionCounts[edge.source] = (connectionCounts[edge.source] || 0) + 1;
      connectionCounts[edge.target] = (connectionCounts[edge.target] || 0) + 1;
    });

    const filteredNodes = graphData.nodes.filter(node => 
      connectionCounts[node.id] >= minConnections
    );
    
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    
    const filteredEdges = graphData.edges.filter(edge =>
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      stats: {
        total_notes: filteredNodes.length,
        total_connections: filteredEdges.length,
        orphaned_notes: 0 // Por definição, não há órfãos quando filtramos por conexões mínimas
      }
    };
  }

  searchInGraph(graphData, searchTerm) {
    const term = searchTerm.toLowerCase();
    
    const filteredNodes = graphData.nodes.filter(node => 
      node.title.toLowerCase().includes(term) ||
      node.content_preview.toLowerCase().includes(term) ||
      node.tags.some(tag => tag.toLowerCase().includes(term))
    );
    
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    
    // Incluir nós conectados aos resultados da busca
    const connectedNodeIds = new Set();
    graphData.edges.forEach(edge => {
      if (nodeIds.has(edge.source)) {
        connectedNodeIds.add(edge.target);
      }
      if (nodeIds.has(edge.target)) {
        connectedNodeIds.add(edge.source);
      }
    });

    const allRelevantNodes = graphData.nodes.filter(node =>
      nodeIds.has(node.id) || connectedNodeIds.has(node.id)
    );

    const allRelevantNodeIds = new Set(allRelevantNodes.map(node => node.id));
    
    const filteredEdges = graphData.edges.filter(edge =>
      allRelevantNodeIds.has(edge.source) && allRelevantNodeIds.has(edge.target)
    );

    return {
      nodes: allRelevantNodes,
      edges: filteredEdges,
      searchMatches: Array.from(nodeIds), // Nós que correspondem diretamente à busca
      stats: {
        total_notes: allRelevantNodes.length,
        total_connections: filteredEdges.length,
        direct_matches: nodeIds.size,
        connected_notes: connectedNodeIds.size
      }
    };
  }

  // Algoritmos de layout para o grafo
  calculateForceDirectedLayout(nodes, edges, options = {}) {
    const {
      width = 800,
      height = 600,
      iterations = 100,
      repulsion = 1000,
      attraction = 0.1,
      damping = 0.9
    } = options;

    // Inicializar posições aleatórias
    const nodeMap = new Map();
    nodes.forEach(node => {
      nodeMap.set(node.id, {
        ...node,
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0
      });
    });

    // Simular forças por várias iterações
    for (let iter = 0; iter < iterations; iter++) {
      // Resetar forças
      nodeMap.forEach(node => {
        node.fx = 0;
        node.fy = 0;
      });

      // Forças de repulsão entre todos os nós
      const nodeArray = Array.from(nodeMap.values());
      for (let i = 0; i < nodeArray.length; i++) {
        for (let j = i + 1; j < nodeArray.length; j++) {
          const nodeA = nodeArray[i];
          const nodeB = nodeArray[j];
          
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = repulsion / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          nodeA.fx -= fx;
          nodeA.fy -= fy;
          nodeB.fx += fx;
          nodeB.fy += fy;
        }
      }

      // Forças de atração para nós conectados
      edges.forEach(edge => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = attraction * distance;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          source.fx += fx;
          source.fy += fy;
          target.fx -= fx;
          target.fy -= fy;
        }
      });

      // Aplicar forças e atualizar posições
      nodeMap.forEach(node => {
        node.vx = (node.vx + node.fx) * damping;
        node.vy = (node.vy + node.fy) * damping;
        
        node.x += node.vx;
        node.y += node.vy;
        
        // Manter dentro dos limites
        node.x = Math.max(50, Math.min(width - 50, node.x));
        node.y = Math.max(50, Math.min(height - 50, node.y));
      });
    }

    return Array.from(nodeMap.values());
  }

  calculateCircularLayout(nodes, options = {}) {
    const {
      centerX = 400,
      centerY = 300,
      radius = 200
    } = options;

    return nodes.map((node, index) => {
      const angle = (index / nodes.length) * 2 * Math.PI;
      return {
        ...node,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });
  }

  calculateHierarchicalLayout(nodes, edges, options = {}) {
    const {
      width = 800,
      levelHeight = 100,
      nodeSpacing = 150
    } = options;

    // Encontrar nós raiz (sem conexões de entrada)
    const incomingEdges = new Set();
    edges.forEach(edge => incomingEdges.add(edge.target));
    
    const rootNodes = nodes.filter(node => !incomingEdges.has(node.id));
    
    if (rootNodes.length === 0) {
      // Usar layout circular se não há hierarquia clara
      return this.calculateCircularLayout(nodes, options);
    }

    const levels = [];
    const visited = new Set();
    const queue = rootNodes.map(node => ({ node, level: 0 }));

    // BFS para determinar níveis
    while (queue.length > 0) {
      const { node, level } = queue.shift();
      
      if (visited.has(node.id)) continue;
      visited.add(node.id);

      if (!levels[level]) levels[level] = [];
      levels[level].push(node);

      // Adicionar nós conectados ao próximo nível
      edges.forEach(edge => {
        if (edge.source === node.id && !visited.has(edge.target)) {
          const targetNode = nodes.find(n => n.id === edge.target);
          if (targetNode) {
            queue.push({ node: targetNode, level: level + 1 });
          }
        }
      });
    }

    // Posicionar nós em níveis
    const layoutNodes = [];
    levels.forEach((levelNodes, levelIndex) => {
      const y = levelIndex * levelHeight + 50;
      const totalWidth = (levelNodes.length - 1) * nodeSpacing;
      const startX = (width - totalWidth) / 2;

      levelNodes.forEach((node, nodeIndex) => {
        layoutNodes.push({
          ...node,
          x: startX + nodeIndex * nodeSpacing,
          y: y
        });
      });
    });

    return layoutNodes;
  }
}

export const graphService = new GraphService();
export default graphService;