import axios from 'axios';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://api.buresidian.com' 
    : 'http://localhost:8000';

class TagService {
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
     * Autocomplete de tags baseado no input do usuário
     */
    async getTagsAutocomplete(query) {
        try {
            const response = await this.axios.get(`/api/tags/autocomplete?query=${encodeURIComponent(query)}`);
            return response.data;
        } catch (error) {
            console.error('Erro no autocomplete de tags:', error);
            throw error;
        }
    }

    /**
     * Buscar estrutura hierárquica de tags
     */
    async getTagsHierarchy() {
        try {
            const response = await this.axios.get('/api/tags/hierarchy');
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar hierarquia de tags:', error);
            throw error;
        }
    }

    /**
     * Buscar todas as tags (flat e hierárquicas)
     */
    async getAllTags() {
        try {
            const response = await this.axios.get('/api/graph/tags');
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar todas as tags:', error);
            throw error;
        }
    }

    /**
     * Buscar notas que contêm uma tag específica
     */
    async getNotesByTag(tagPath) {
        try {
            const response = await this.axios.get(`/api/tags/${encodeURIComponent(tagPath)}/notes`);
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar notas por tag:', error);
            throw error;
        }
    }

    /**
     * Buscar tags mais populares
     */
    async getPopularTags(limit = 20) {
        try {
            const response = await this.axios.get(`/api/tags/popular?limit=${limit}`);
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar tags populares:', error);
            throw error;
        }
    }

    /**
     * Extrair tags de um texto
     */
    extractTagsFromText(text) {
        if (!text) return [];
        const tagRegex = /#([a-zA-Z0-9_/-]+)/g;
        const matches = [];
        let match;
        
        while ((match = tagRegex.exec(text)) !== null) {
            matches.push({
                tag: match[1],
                fullMatch: match[0],
                index: match.index
            });
        }
        
        return matches;
    }

    /**
     * Organizar tags em estrutura hierárquica
     */
    organizeTagsHierarchically(tags) {
        const hierarchy = {};
        
        tags.forEach(tag => {
            const parts = tag.split('/');
            let current = hierarchy;
            
            parts.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = {
                        name: part,
                        fullPath: parts.slice(0, index + 1).join('/'),
                        children: {},
                        isLeaf: index === parts.length - 1
                    };
                }
                current = current[part].children;
            });
        });
        
        return hierarchy;
    }

    /**
     * Buscar tags similares para sugestões
     */
    findSimilarTags(query, allTags) {
        if (!query || !allTags) return [];
        
        const queryLower = query.toLowerCase();
        
        return allTags
            .filter(tag => tag.toLowerCase().includes(queryLower))
            .sort((a, b) => {
                const aStarts = a.toLowerCase().startsWith(queryLower);
                const bStarts = b.toLowerCase().startsWith(queryLower);
                
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                
                return a.length - b.length;
            })
            .slice(0, 10);
    }

    /**
     * Validar formato de tag
     */
    isValidTag(tag) {
        if (!tag || typeof tag !== 'string') return false;
        
        // Tag deve começar com letra ou número
        // Pode conter letras, números, _, - e /
        const tagRegex = /^[a-zA-Z0-9][a-zA-Z0-9_/-]*$/;
        return tagRegex.test(tag);
    }

    /**
     * Formatação de tag para exibição
     */
    formatTagForDisplay(tag) {
        if (!tag) return '';
        
        // Capitalizar primeira letra de cada parte
        return tag
            .split('/')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' › ');
    }

    /**
     * Obter cor para tag baseada no hash do nome
     */
    getTagColor(tag) {
        if (!tag) return '#6366f1';
        
        // Gerar cor baseada no hash da tag
        let hash = 0;
        for (let i = 0; i < tag.length; i++) {
            hash = tag.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const colors = [
            '#ef4444', '#f97316', '#f59e0b', '#eab308',
            '#84cc16', '#22c55e', '#10b981', '#14b8a6',
            '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
            '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
            '#f43f5e'
        ];
        
        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Buscar tags relacionadas
     */
    async getRelatedTags(tag, limit = 5) {
        try {
            // Buscar notas que contêm a tag
            const notesData = await this.getNotesByTag(tag);
            const notes = notesData.notes;
            
            // Extrair todas as tags dessas notas
            const relatedTagsCount = {};
            
            notes.forEach(note => {
                const tags = this.extractTagsFromText(note.content);
                tags.forEach(tagInfo => {
                    if (tagInfo.tag !== tag) {
                        relatedTagsCount[tagInfo.tag] = (relatedTagsCount[tagInfo.tag] || 0) + 1;
                    }
                });
            });
            
            // Ordenar por frequência e retornar as mais relacionadas
            const sortedRelated = Object.entries(relatedTagsCount)
                .sort(([,a], [,b]) => b - a)
                .slice(0, limit)
                .map(([tagName, count]) => ({
                    tag: tagName,
                    count,
                    color: this.getTagColor(tagName)
                }));
            
            return sortedRelated;
        } catch (error) {
            console.error('Erro ao buscar tags relacionadas:', error);
            return [];
        }
    }
}

export default new TagService();