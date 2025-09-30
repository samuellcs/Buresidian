import axios from 'axios';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://api.buresidian.com' 
    : 'http://localhost:8000';

class BacklinkService {
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
    async getNoteBacklinks(noteId) {
        try {
            const response = await this.axios.get(`/api/notes/${noteId}/backlinks`);
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar backlinks:', error);
            throw error;
        }
    }

    /**
     * Buscar todas as referências que uma nota faz para outras notas
     */
    async getNoteOutlinks(noteId) {
        try {
            const response = await this.axios.get(`/api/notes/${noteId}/outlinks`);
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar outlinks:', error);
            throw error;
        }
    }

    /**
     * Buscar todos os links quebrados no sistema
     */
    async getBrokenLinks() {
        try {
            const response = await this.axios.get('/api/notes/broken-links');
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar links quebrados:', error);
            throw error;
        }
    }

    /**
     * Buscar sugestões de notas para criar links
     */
    async getLinkSuggestions(query) {
        try {
            const response = await this.axios.get(`/api/notes/link-suggestions?query=${encodeURIComponent(query)}`);
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar sugestões de links:', error);
            throw error;
        }
    }

    /**
     * Extrair todos os wiki links de um texto
     */
    extractWikiLinks(text) {
        if (!text) return [];
        
        const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
        const links = [];
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
    createWikiLink(target, display = null) {
        if (display && display !== target) {
            return `[[${target}|${display}]]`;
        }
        return `[[${target}]]`;
    }

    /**
     * Verificar se um texto contém menções de uma nota
     */
    findMentions(text, noteTitle) {
        if (!text || !noteTitle) return [];
        
        const mentions = [];
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
    convertMentionsToLinks(text, noteTitle) {
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
    async getNoteLinksStats(noteId) {
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
    async suggestLinksForContent(content, excludeNoteId = null) {
        try {
            if (!content || content.length < 10) return [];

            // Extrair palavras/frases importantes do conteúdo
            const words = content
                .toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 3)
                .slice(0, 10); // Limitar para performance

            const suggestions = [];
            
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
    validateAndNormalizeLinks(text) {
        if (!text) return { text, issues: [] };
        
        const issues = [];
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
    async buildNotesNetwork(notes) {
        try {
            const network = {
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
}

export default new BacklinkService();