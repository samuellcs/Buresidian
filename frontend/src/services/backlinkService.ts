import axios, { AxiosInstance } from 'axios';
import { 
    BacklinksResponse,
    OutlinksResponse, 
    BrokenLinksResponse,
    LinkSuggestionsResponse,
    Note
} from '@/types';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://api.buresidian.com' 
    : 'http://localhost:8000';

interface WikiLink {
    target: string;
    display: string;
    fullMatch: string;
    index: number;
}

interface Mention {
    text: string;
    index: number;
    context: string;
}

interface NetworkNode {
    id: number;
    title: string;
    content: string;
    size: number;
}

interface NetworkLink {
    source: number;
    target: number;
    type: 'wiki-link' | 'mention';
    strength: number;
    mentions?: number;
}

interface NotesNetwork {
    nodes: NetworkNode[];
    links: NetworkLink[];
}

interface LinkStats {
    backlinks: number;
    outlinks: number;
    brokenLinks: number;
    validLinks: number;
}

class BacklinkService {
    private axios: AxiosInstance;

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
     * Buscar todas as notas que fazem referência a uma nota específica
     */
    async getNoteBacklinks(noteId: number): Promise<BacklinksResponse> {
        try {
            const response = await this.axios.get<BacklinksResponse>(`/api/notes/${noteId}/backlinks`);
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar backlinks:', error);
            throw error;
        }
    }

    /**
     * Buscar todas as referências que uma nota faz para outras notas
     */
    async getNoteOutlinks(noteId: number): Promise<OutlinksResponse> {
        try {
            const response = await this.axios.get<OutlinksResponse>(`/api/notes/${noteId}/outlinks`);
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar outlinks:', error);
            throw error;
        }
    }

    /**
     * Buscar todos os links quebrados no sistema
     */
    async getBrokenLinks(): Promise<BrokenLinksResponse> {
        try {
            const response = await this.axios.get<BrokenLinksResponse>('/api/notes/broken-links');
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar links quebrados:', error);
            throw error;
        }
    }

    /**
     * Buscar sugestões de notas para criar links
     */
    async getLinkSuggestions(query: string): Promise<LinkSuggestionsResponse> {
        try {
            const response = await this.axios.get<LinkSuggestionsResponse>(
                `/api/notes/link-suggestions?query=${encodeURIComponent(query)}`
            );
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar sugestões de links:', error);
            throw error;
        }
    }

    /**
     * Extrair todos os wiki links de um texto
     */
    extractWikiLinks(text: string): WikiLink[] {
        if (!text) return [];
        
        const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
        const links: WikiLink[] = [];
        let match;
        
        while ((match = wikiLinkRegex.exec(text)) !== null) {
            links.push({
                target: match[1].trim(),
                display: match[2] ? match[2].trim() : match[1].trim(),
                fullMatch: match[0],
                index: match.index
            });
        }
        
        return links;
    }

    /**
     * Criar um wiki link formatado
     */
    createWikiLink(target: string, display?: string): string {
        if (display && display !== target) {
            return `[[${target}|${display}]]`;
        }
        return `[[${target}]]`;
    }

    /**
     * Verificar se um texto contém menções de uma nota
     */
    findMentions(text: string, noteTitle: string): Mention[] {
        if (!text || !noteTitle) return [];
        
        const mentions: Mention[] = [];
        const regex = new RegExp(noteTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            // Verificar se não está dentro de um wiki link
            const beforeMatch = text.substring(0, match.index);
            const openBrackets = (beforeMatch.match(/\[\[/g) || []).length;
            const closeBrackets = (beforeMatch.match(/\]\]/g) || []).length;
            
            // Se não está dentro de um wiki link
            if (openBrackets === closeBrackets) {
                mentions.push({
                    text: match[0],
                    index: match.index,
                    context: text.substring(
                        Math.max(0, match.index - 50),
                        Math.min(text.length, match.index + match[0].length + 50)
                    )
                });
            }
        }
        
        return mentions;
    }

    /**
     * Converter menções simples em wiki links
     */
    convertMentionsToLinks(text: string, noteTitle: string): string {
        if (!text || !noteTitle) return text;
        
        const mentions = this.findMentions(text, noteTitle);
        let updatedText = text;
        
        // Processar de trás para frente para manter os índices corretos
        mentions.reverse().forEach(mention => {
            const wikiLink = this.createWikiLink(noteTitle);
            updatedText = 
                updatedText.substring(0, mention.index) +
                wikiLink +
                updatedText.substring(mention.index + mention.text.length);
        });
        
        return updatedText;
    }

    /**
     * Obter estatísticas de links de uma nota
     */
    async getNoteLinksStats(noteId: number): Promise<LinkStats> {
        try {
            const [backlinksData, outlinksData] = await Promise.all([
                this.getNoteBacklinks(noteId),
                this.getNoteOutlinks(noteId)
            ]);

            const brokenLinks = outlinksData.outlinks.filter(link => !link.exists);
            
            return {
                backlinks: backlinksData.total_backlinks,
                outlinks: outlinksData.total_outlinks,
                brokenLinks: brokenLinks.length,
                validLinks: outlinksData.total_outlinks - brokenLinks.length
            };
        } catch (error) {
            console.error('Erro ao buscar estatísticas de links:', error);
            return {
                backlinks: 0,
                outlinks: 0,
                brokenLinks: 0,
                validLinks: 0
            };
        }
    }

    /**
     * Sugerir links automaticamente baseado no conteúdo
     */
    async suggestLinksForContent(content: string, excludeNoteId?: number): Promise<Array<{
        note_id: number;
        title: string;
        snippet: string;
        updated_at: string;
        relevance: number;
        matchedWord: string;
        autoSuggestion: boolean;
    }>> {
        try {
            if (!content || content.length < 10) return [];

            // Extrair palavras/frases importantes do conteúdo
            const words = content
                .toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 3)
                .slice(0, 10); // Limitar para performance

            const suggestions: Array<{
                note_id: number;
                title: string;
                snippet: string;
                updated_at: string;
                relevance: number;
                matchedWord: string;
                autoSuggestion: boolean;
            }> = [];
            
            for (const word of words) {
                try {
                    const result = await this.getLinkSuggestions(word);
                    
                    result.suggestions
                        .filter(note => note.note_id !== excludeNoteId)
                        .forEach(note => {
                            const existing = suggestions.find(s => s.note_id === note.note_id);
                            if (!existing) {
                                suggestions.push({
                                    ...note,
                                    matchedWord: word,
                                    autoSuggestion: true
                                });
                            }
                        });
                } catch (error) {
                    // Ignorar erros individuais de palavras
                    continue;
                }
            }

            // Ordenar por relevância e retornar os top 5
            return suggestions
                .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
                .slice(0, 5);
                
        } catch (error) {
            console.error('Erro ao sugerir links automáticos:', error);
            return [];
        }
    }

    /**
     * Validar e normalizar wiki links em um texto
     */
    validateAndNormalizeLinks(text: string): {
        text: string;
        issues: Array<{
            type: string;
            link?: string;
            message: string;
        }>;
        linksCount: number;
    } {
        if (!text) return { text, issues: [], linksCount: 0 };
        
        const issues: Array<{
            type: string;
            link?: string;
            message: string;
        }> = [];
        let normalizedText = text;
        
        // Encontrar todos os wiki links
        const links = this.extractWikiLinks(text);
        
        // Verificar links malformados
        const malformedLinks = text.match(/\[\[([^\]]*\|[^\]]*\|[^\]]*)\]\]/g);
        if (malformedLinks) {
            malformedLinks.forEach(link => {
                issues.push({
                    type: 'malformed',
                    link,
                    message: 'Link possui múltiplos separadores |'
                });
            });
        }

        // Verificar links vazios
        const emptyLinks = text.match(/\[\[\s*\]\]/g);
        if (emptyLinks) {
            issues.push({
                type: 'empty',
                message: 'Encontrados links vazios [[]]'
            });
        }

        return {
            text: normalizedText,
            issues,
            linksCount: links.length
        };
    }

    /**
     * Criar uma rede de conexões entre notas
     */
    async buildNotesNetwork(notes: Note[]): Promise<NotesNetwork> {
        try {
            const network: NotesNetwork = {
                nodes: [],
                links: []
            };

            // Adicionar nós
            notes.forEach(note => {
                network.nodes.push({
                    id: note.id,
                    title: note.title,
                    content: note.content,
                    size: note.content ? note.content.length : 0
                });
            });

            // Encontrar conexões
            for (const note of notes) {
                if (!note.content) continue;

                const wikiLinks = this.extractWikiLinks(note.content);
                
                wikiLinks.forEach(link => {
                    const targetNote = notes.find(n => 
                        n.title.toLowerCase() === link.target.toLowerCase()
                    );
                    
                    if (targetNote) {
                        network.links.push({
                            source: note.id,
                            target: targetNote.id,
                            type: 'wiki-link',
                            strength: 1
                        });
                    }
                });

                // Buscar menções diretas
                notes.forEach(otherNote => {
                    if (otherNote.id === note.id) return;
                    
                    const mentions = this.findMentions(note.content, otherNote.title);
                    if (mentions.length > 0) {
                        // Verificar se já não existe um wiki link
                        const existingLink = network.links.find(l => 
                            l.source === note.id && l.target === otherNote.id
                        );
                        
                        if (!existingLink) {
                            network.links.push({
                                source: note.id,
                                target: otherNote.id,
                                type: 'mention',
                                strength: 0.5,
                                mentions: mentions.length
                            });
                        }
                    }
                });
            }

            return network;
            
        } catch (error) {
            console.error('Erro ao construir rede de notas:', error);
            throw error;
        }
    }

    /**
     * Analisar a força de conexão entre duas notas
     */
    calculateConnectionStrength(sourceNote: Note, targetNote: Note): number {
        if (!sourceNote.content || !targetNote.title) return 0;
        
        let strength = 0;
        
        // Wiki links têm força máxima
        const wikiLinks = this.extractWikiLinks(sourceNote.content);
        const hasWikiLink = wikiLinks.some(link => 
            link.target.toLowerCase() === targetNote.title.toLowerCase()
        );
        
        if (hasWikiLink) {
            strength += 1.0;
        }
        
        // Menções diretas têm força média
        const mentions = this.findMentions(sourceNote.content, targetNote.title);
        if (mentions.length > 0) {
            strength += 0.5 * Math.min(mentions.length / 5, 1); // Máximo de 0.5
        }
        
        // Tags compartilhadas têm força baixa
        // (implementar quando integrar com o sistema de tags)
        
        return Math.min(strength, 1.0); // Normalizar para 0-1
    }

    /**
     * Encontrar o caminho mais curto entre duas notas
     */
    findShortestPath(network: NotesNetwork, sourceId: number, targetId: number): number[] | null {
        if (sourceId === targetId) return [sourceId];
        
        const visited = new Set<number>();
        const queue = [{ nodeId: sourceId, path: [sourceId] }];
        
        while (queue.length > 0) {
            const { nodeId, path } = queue.shift()!;
            
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);
            
            // Encontrar conexões do nó atual
            const connections = network.links
                .filter(link => link.source === nodeId)
                .map(link => link.target);
            
            for (const connectedId of connections) {
                if (connectedId === targetId) {
                    return [...path, connectedId];
                }
                
                if (!visited.has(connectedId)) {
                    queue.push({
                        nodeId: connectedId,
                        path: [...path, connectedId]
                    });
                }
            }
        }
        
        return null; // Sem caminho encontrado
    }
}

export default new BacklinkService();