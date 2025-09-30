import axios, { AxiosInstance } from 'axios';
import { 
    GraphData,
    GraphViewConfig,
    GraphNode,
    GraphLink,
    Note,
    User
} from '@/types';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://api.buresidian.com' 
    : 'http://localhost:8000';

interface NodePosition {
    x: number;
    y: number;
}

interface GraphLayout {
    nodes: Map<number, NodePosition>;
    center: NodePosition;
    bounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    };
}

interface GraphStats {
    totalNodes: number;
    totalLinks: number;
    avgDegree: number;
    maxDegree: number;
    clusters: number;
    density: number;
}

interface GraphFilter {
    tags?: string[];
    dateRange?: {
        start: Date;
        end: Date;
    };
    authorIds?: number[];
    minConnections?: number;
    maxConnections?: number;
    nodeTypes?: string[];
}

interface ClusterInfo {
    id: number;
    nodes: number[];
    size: number;
    density: number;
    centralNode: number;
    color: string;
}

class GraphService {
    private axios: AxiosInstance;
    private layoutCache: Map<string, GraphLayout> = new Map();
    private configCache: GraphViewConfig | null = null;

    constructor() {
        this.axios = axios.create({
            baseURL: API_BASE_URL,
        });

        // Interceptor para adicionar token
        this.axios.interceptors.request.use(
            (config) => {
                const token = localStorage.getItem('token');
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );
    }

    /**
     * Buscar dados completos do grafo
     */
    async getGraphData(filter?: GraphFilter): Promise<GraphData> {
        try {
            const params = new URLSearchParams();
            
            if (filter?.tags && filter.tags.length > 0) {
                params.append('tags', filter.tags.join(','));
            }
            
            if (filter?.dateRange) {
                params.append('start_date', filter.dateRange.start.toISOString());
                params.append('end_date', filter.dateRange.end.toISOString());
            }
            
            if (filter?.authorIds && filter.authorIds.length > 0) {
                params.append('authors', filter.authorIds.join(','));
            }
            
            if (filter?.minConnections !== undefined) {
                params.append('min_connections', filter.minConnections.toString());
            }
            
            if (filter?.maxConnections !== undefined) {
                params.append('max_connections', filter.maxConnections.toString());
            }

            const queryString = params.toString();
            const url = queryString ? `/api/graph?${queryString}` : '/api/graph';
            
            const response = await this.axios.get<GraphData>(url);
            
            // Processar e enriquecer os dados
            const processedData = this.processGraphData(response.data);
            
            return processedData;
        } catch (error) {
            console.error('Erro ao buscar dados do grafo:', error);
            throw error;
        }
    }

    /**
     * Processar e enriquecer dados do grafo
     */
    private processGraphData(data: GraphData): GraphData {
        // Calcular graus dos nós
        const nodeDegrees = new Map<number, number>();
        
        data.links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            nodeDegrees.set(sourceId, (nodeDegrees.get(sourceId) || 0) + 1);
            nodeDegrees.set(targetId, (nodeDegrees.get(targetId) || 0) + 1);
        });

        // Enriquecer nós com informações calculadas
        const enrichedNodes = data.nodes.map(node => ({
            ...node,
            degree: nodeDegrees.get(node.id) || 0,
            size: this.calculateNodeSize(node, nodeDegrees.get(node.id) || 0),
            color: this.calculateNodeColor(node, nodeDegrees.get(node.id) || 0)
        }));

        // Enriquecer links com informações calculadas
        const enrichedLinks = data.links.map(link => ({
            ...link,
            strength: this.calculateLinkStrength(link),
            weight: this.calculateLinkWeight(link)
        }));

        return {
            ...data,
            nodes: enrichedNodes,
            links: enrichedLinks
        };
    }

    /**
     * Calcular tamanho do nó baseado em métricas
     */
    private calculateNodeSize(node: GraphNode, degree: number): number {
        const baseSize = 8;
        const maxSize = 30;
        
        // Fator baseado no grau de conexões
        const degreeFactor = Math.min(degree / 10, 1) * 15;
        
        // Fator baseado no tamanho do conteúdo
        const contentFactor = node.content ? Math.min(node.content.length / 1000, 1) * 10 : 0;
        
        // Fator baseado na idade (notas mais recentes são maiores)
        const ageFactor = node.updated_at ? this.calculateAgeFactor(node.updated_at) * 5 : 0;
        
        return Math.min(baseSize + degreeFactor + contentFactor + ageFactor, maxSize);
    }

    /**
     * Calcular cor do nó baseado em características
     */
    private calculateNodeColor(node: GraphNode, degree: number): string {
        // Cores baseadas no tipo/categoria
        if (node.tags && node.tags.length > 0) {
            return this.getColorFromTags(node.tags);
        }
        
        // Cores baseadas no grau de conexão
        if (degree === 0) return '#ff6b6b'; // Nós isolados em vermelho
        if (degree < 3) return '#4ecdc4'; // Poucos conexões em azul claro
        if (degree < 6) return '#45b7d1'; // Médias conexões em azul
        if (degree < 10) return '#96ceb4'; // Muitas conexões em verde
        return '#feca57'; // Hubs em amarelo
    }

    /**
     * Gerar cor baseada nas tags
     */
    private getColorFromTags(tags: string[]): string {
        const colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', 
            '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd',
            '#00d2d3', '#ff9f43', '#48dbfb', '#0abde3'
        ];
        
        // Usar a primeira tag para determinar a cor
        const tag = tags[0].toLowerCase();
        let hash = 0;
        for (let i = 0; i < tag.length; i++) {
            hash = tag.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Calcular fator de idade (mais recente = maior)
     */
    private calculateAgeFactor(updatedAt: string): number {
        const now = new Date();
        const updated = new Date(updatedAt);
        const daysDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
        
        // Notas dos últimos 7 dias têm fator máximo
        if (daysDiff <= 7) return 1;
        if (daysDiff <= 30) return 0.7;
        if (daysDiff <= 90) return 0.4;
        return 0.1;
    }

    /**
     * Calcular força do link
     */
    private calculateLinkStrength(link: GraphLink): number {
        // Links baseados em wiki-links são mais fortes
        if (link.type === 'wiki-link') return 1.0;
        if (link.type === 'mention') return 0.6;
        if (link.type === 'tag-related') return 0.4;
        return 0.3;
    }

    /**
     * Calcular peso do link
     */
    private calculateLinkWeight(link: GraphLink): number {
        return link.mentions || 1;
    }

    /**
     * Aplicar layout força-dirigida
     */
    applyForceDirectedLayout(
        nodes: GraphNode[], 
        links: GraphLink[], 
        config?: {
            width?: number;
            height?: number;
            iterations?: number;
            repulsion?: number;
            attraction?: number;
            damping?: number;
        }
    ): GraphLayout {
        const width = config?.width || 800;
        const height = config?.height || 600;
        const iterations = config?.iterations || 100;
        const repulsion = config?.repulsion || 100;
        const attraction = config?.attraction || 0.01;
        const damping = config?.damping || 0.9;

        const positions = new Map<number, NodePosition>();
        const velocities = new Map<number, NodePosition>();

        // Inicializar posições aleatórias
        nodes.forEach(node => {
            positions.set(node.id, {
                x: Math.random() * width,
                y: Math.random() * height
            });
            velocities.set(node.id, { x: 0, y: 0 });
        });

        // Executar simulação
        for (let i = 0; i < iterations; i++) {
            // Calcular forças repulsivas
            nodes.forEach(node1 => {
                const pos1 = positions.get(node1.id)!;
                const vel1 = velocities.get(node1.id)!;
                
                nodes.forEach(node2 => {
                    if (node1.id === node2.id) return;
                    
                    const pos2 = positions.get(node2.id)!;
                    const dx = pos1.x - pos2.x;
                    const dy = pos1.y - pos2.y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    
                    const force = repulsion / (distance * distance);
                    vel1.x += (dx / distance) * force;
                    vel1.y += (dy / distance) * force;
                });
            });

            // Calcular forças atrativas dos links
            links.forEach(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                
                const pos1 = positions.get(sourceId);
                const pos2 = positions.get(targetId);
                const vel1 = velocities.get(sourceId);
                const vel2 = velocities.get(targetId);
                
                if (!pos1 || !pos2 || !vel1 || !vel2) return;
                
                const dx = pos2.x - pos1.x;
                const dy = pos2.y - pos1.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                
                const force = attraction * distance * (link.strength || 1);
                vel1.x += (dx / distance) * force;
                vel1.y += (dy / distance) * force;
                vel2.x -= (dx / distance) * force;
                vel2.y -= (dy / distance) * force;
            });

            // Aplicar velocidades e damping
            nodes.forEach(node => {
                const pos = positions.get(node.id)!;
                const vel = velocities.get(node.id)!;
                
                pos.x += vel.x;
                pos.y += vel.y;
                
                // Manter dentro dos limites
                pos.x = Math.max(50, Math.min(width - 50, pos.x));
                pos.y = Math.max(50, Math.min(height - 50, pos.y));
                
                // Aplicar damping
                vel.x *= damping;
                vel.y *= damping;
            });
        }

        // Calcular bounds
        const xPositions = Array.from(positions.values()).map(p => p.x);
        const yPositions = Array.from(positions.values()).map(p => p.y);
        
        const bounds = {
            minX: Math.min(...xPositions),
            maxX: Math.max(...xPositions),
            minY: Math.min(...yPositions),
            maxY: Math.max(...yPositions)
        };

        const center = {
            x: (bounds.minX + bounds.maxX) / 2,
            y: (bounds.minY + bounds.maxY) / 2
        };

        return {
            nodes: positions,
            center,
            bounds
        };
    }

    /**
     * Detectar clusters no grafo
     */
    detectClusters(nodes: GraphNode[], links: GraphLink[]): ClusterInfo[] {
        const clusters: ClusterInfo[] = [];
        const visited = new Set<number>();
        const adjacencyList = new Map<number, Set<number>>();

        // Construir lista de adjacência
        nodes.forEach(node => {
            adjacencyList.set(node.id, new Set());
        });

        links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            adjacencyList.get(sourceId)?.add(targetId);
            adjacencyList.get(targetId)?.add(sourceId);
        });

        // DFS para encontrar componentes conectados
        const dfs = (nodeId: number, cluster: number[]): void => {
            visited.add(nodeId);
            cluster.push(nodeId);
            
            const neighbors = adjacencyList.get(nodeId) || new Set();
            neighbors.forEach(neighborId => {
                if (!visited.has(neighborId)) {
                    dfs(neighborId, cluster);
                }
            });
        };

        let clusterId = 0;
        nodes.forEach(node => {
            if (!visited.has(node.id)) {
                const cluster: number[] = [];
                dfs(node.id, cluster);
                
                if (cluster.length > 1) { // Apenas clusters com mais de 1 nó
                    // Calcular densidade do cluster
                    const clusterLinks = links.filter(link => {
                        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                        return cluster.includes(sourceId) && cluster.includes(targetId);
                    });
                    
                    const maxPossibleLinks = (cluster.length * (cluster.length - 1)) / 2;
                    const density = clusterLinks.length / maxPossibleLinks;
                    
                    // Encontrar nó central (com mais conexões)
                    let centralNode = cluster[0];
                    let maxConnections = 0;
                    
                    cluster.forEach(nodeId => {
                        const connections = adjacencyList.get(nodeId)?.size || 0;
                        if (connections > maxConnections) {
                            maxConnections = connections;
                            centralNode = nodeId;
                        }
                    });

                    clusters.push({
                        id: clusterId++,
                        nodes: cluster,
                        size: cluster.length,
                        density,
                        centralNode,
                        color: this.generateClusterColor(clusterId)
                    });
                }
            }
        });

        return clusters;
    }

    /**
     * Gerar cor para cluster
     */
    private generateClusterColor(clusterId: number): string {
        const colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', 
            '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd',
            '#00d2d3', '#ff9f43', '#48dbfb', '#0abde3'
        ];
        return colors[clusterId % colors.length];
    }

    /**
     * Calcular estatísticas do grafo
     */
    calculateGraphStats(nodes: GraphNode[], links: GraphLink[]): GraphStats {
        const totalNodes = nodes.length;
        const totalLinks = links.length;
        
        // Calcular graus
        const degrees = new Map<number, number>();
        links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            degrees.set(sourceId, (degrees.get(sourceId) || 0) + 1);
            degrees.set(targetId, (degrees.get(targetId) || 0) + 1);
        });

        const degreeValues = Array.from(degrees.values());
        const avgDegree = degreeValues.length > 0 ? 
            degreeValues.reduce((sum, deg) => sum + deg, 0) / degreeValues.length : 0;
        const maxDegree = degreeValues.length > 0 ? Math.max(...degreeValues) : 0;

        // Calcular densidade
        const maxPossibleLinks = (totalNodes * (totalNodes - 1)) / 2;
        const density = maxPossibleLinks > 0 ? totalLinks / maxPossibleLinks : 0;

        // Contar clusters
        const clusters = this.detectClusters(nodes, links);

        return {
            totalNodes,
            totalLinks,
            avgDegree,
            maxDegree,
            clusters: clusters.length,
            density
        };
    }

    /**
     * Encontrar nós mais importantes (hubs)
     */
    findHubs(nodes: GraphNode[], links: GraphLink[], topN: number = 5): GraphNode[] {
        const degrees = new Map<number, number>();
        
        links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            degrees.set(sourceId, (degrees.get(sourceId) || 0) + 1);
            degrees.set(targetId, (degrees.get(targetId) || 0) + 1);
        });

        return nodes
            .map(node => ({
                ...node,
                degree: degrees.get(node.id) || 0
            }))
            .sort((a, b) => b.degree - a.degree)
            .slice(0, topN);
    }

    /**
     * Buscar nós por proximidade
     */
    findNodesInRadius(
        centerNodeId: number, 
        radius: number, 
        nodes: GraphNode[], 
        links: GraphLink[]
    ): GraphNode[] {
        const visited = new Set<number>();
        const result: GraphNode[] = [];
        const queue: Array<{ nodeId: number; distance: number }> = [{ nodeId: centerNodeId, distance: 0 }];

        // Construir lista de adjacência
        const adjacencyList = new Map<number, Set<number>>();
        nodes.forEach(node => {
            adjacencyList.set(node.id, new Set());
        });

        links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            adjacencyList.get(sourceId)?.add(targetId);
            adjacencyList.get(targetId)?.add(sourceId);
        });

        // BFS para encontrar nós no raio
        while (queue.length > 0) {
            const { nodeId, distance } = queue.shift()!;
            
            if (visited.has(nodeId) || distance > radius) continue;
            
            visited.add(nodeId);
            const node = nodes.find(n => n.id === nodeId);
            if (node) {
                result.push(node);
            }

            // Adicionar vizinhos à queue
            const neighbors = adjacencyList.get(nodeId) || new Set();
            neighbors.forEach(neighborId => {
                if (!visited.has(neighborId)) {
                    queue.push({ nodeId: neighborId, distance: distance + 1 });
                }
            });
        }

        return result;
    }

    /**
     * Salvar configuração do grafo
     */
    async saveGraphConfig(config: GraphViewConfig): Promise<void> {
        try {
            await this.axios.post('/api/graph/config', config);
            this.configCache = config;
        } catch (error) {
            console.error('Erro ao salvar configuração do grafo:', error);
            throw error;
        }
    }

    /**
     * Carregar configuração do grafo
     */
    async loadGraphConfig(): Promise<GraphViewConfig> {
        try {
            if (this.configCache) {
                return this.configCache;
            }

            const response = await this.axios.get<GraphViewConfig>('/api/graph/config');
            this.configCache = response.data;
            return response.data;
        } catch (error) {
            console.error('Erro ao carregar configuração do grafo:', error);
            // Retornar configuração padrão
            return {
                layout: 'force-directed',
                showLabels: true,
                showIsolatedNodes: false,
                linkThickness: 'medium',
                nodeSize: 'medium',
                colorScheme: 'default',
                physicsEnabled: true,
                linkDistance: 100,
                repulsion: 200,
                gravity: 0.1,
                damping: 0.9
            };
        }
    }

    /**
     * Limpar cache
     */
    clearCache(): void {
        this.layoutCache.clear();
        this.configCache = null;
    }
}

export default new GraphService();