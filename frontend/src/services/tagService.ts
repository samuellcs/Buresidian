import axios, { AxiosInstance } from 'axios';
import { 
    TagAutocompleteResponse, 
    TagsResponse, 
    PopularTagsResponse, 
    TagHierarchy 
} from '@/types';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://api.buresidian.com' 
    : 'http://localhost:8000';

class TagService {
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
     * Autocomplete de tags baseado no input do usuário
     */
    async getTagsAutocomplete(query: string): Promise<TagAutocompleteResponse> {
        try {
            const response = await this.axios.get<TagAutocompleteResponse>(
                `/api/tags/autocomplete?query=${encodeURIComponent(query)}`
            );
            return response.data;
        } catch (error) {
            console.error('Erro no autocomplete de tags:', error);
            throw error;
        }
    }

    /**
     * Buscar hierarquia completa de tags
     */
    async getTagsHierarchy(): Promise<{ hierarchy: TagHierarchy }> {
        try {
            const response = await this.axios.get<{ hierarchy: TagHierarchy }>('/api/tags/hierarchy');
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar hierarquia de tags:', error);
            throw error;
        }
    }

    /**
     * Buscar todas as tags do usuário
     */
    async getAllTags(): Promise<TagsResponse> {
        try {
            const response = await this.axios.get<TagsResponse>('/api/graph/tags');
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar todas as tags:', error);
            throw error;
        }
    }

    /**
     * Buscar notas que contêm uma tag específica
     */
    async getNotesByTag(tagPath: string): Promise<{
        tag: string;
        notes: Array<{
            id: number;
            title: string;
            content: string;
            created_at: string;
            updated_at: string;
            folder_id?: number;
            matched_tag: string;
        }>;
        count: number;
    }> {
        try {
            const response = await this.axios.get(
                `/api/tags/${encodeURIComponent(tagPath)}/notes`
            );
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar notas por tag:', error);
            throw error;
        }
    }

    /**
     * Buscar tags mais populares
     */
    async getPopularTags(limit: number = 20): Promise<PopularTagsResponse> {
        try {
            const response = await this.axios.get<PopularTagsResponse>(
                `/api/tags/popular?limit=${limit}`
            );
            return response.data;
        } catch (error) {
            console.error('Erro ao buscar tags populares:', error);
            throw error;
        }
    }

    /**
     * Extrair tags de um texto
     */
    extractTagsFromText(text: string): Array<{ tag: string; index: number }> {
        if (!text) return [];
        
        const tagRegex = /#([a-zA-Z0-9_/-]+)/g;
        const tags: Array<{ tag: string; index: number }> = [];
        let match;
        
        while ((match = tagRegex.exec(text)) !== null) {
            tags.push({
                tag: match[1],
                index: match.index
            });
        }
        
        return tags;
    }

    /**
     * Gerar cor única para uma tag baseada no hash do nome
     */
    getTagColor(tag: string): string {
        if (!tag) return '#6b7280';
        
        let hash = 0;
        for (let i = 0; i < tag.length; i++) {
            const char = tag.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Gerar cor HSL para melhor distribuição
        const hue = Math.abs(hash) % 360;
        const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
        const lightness = 45 + (Math.abs(hash) % 15); // 45-60%
        
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    /**
     * Formatar tag para exibição (converter / em →)
     */
    formatTagForDisplay(tag: string): string {
        if (!tag) return '';
        return tag.replace(/\//g, ' → ');
    }

    /**
     * Obter hierarquia de uma tag (pais e filhos)
     */
    getTagHierarchyPath(tag: string): string[] {
        if (!tag) return [];
        return tag.split('/');
    }

    /**
     * Verificar se uma tag é filha de outra
     */
    isChildTag(parentTag: string, childTag: string): boolean {
        if (!parentTag || !childTag) return false;
        return childTag.startsWith(parentTag + '/');
    }

    /**
     * Obter tag pai de uma tag
     */
    getParentTag(tag: string): string | null {
        if (!tag || !tag.includes('/')) return null;
        const parts = tag.split('/');
        return parts.slice(0, -1).join('/');
    }

    /**
     * Obter todas as tags filhas de uma tag
     */
    getChildTags(parentTag: string, allTags: string[]): string[] {
        if (!parentTag) return [];
        return allTags.filter(tag => this.isChildTag(parentTag, tag));
    }

    /**
     * Normalizar tag (remover caracteres especiais, converter para lowercase)
     */
    normalizeTag(tag: string): string {
        if (!tag) return '';
        return tag
            .toLowerCase()
            .replace(/[^a-zA-Z0-9_/-]/g, '')
            .replace(/\/+/g, '/') // Remover barras duplas
            .replace(/^\/|\/$/g, ''); // Remover barras no início e fim
    }

    /**
     * Validar se uma tag é válida
     */
    isValidTag(tag: string): boolean {
        if (!tag || tag.trim().length === 0) return false;
        
        // Não pode começar ou terminar com /
        if (tag.startsWith('/') || tag.endsWith('/')) return false;
        
        // Não pode ter barras duplas
        if (tag.includes('//')) return false;
        
        // Deve conter apenas caracteres permitidos
        const validChars = /^[a-zA-Z0-9_/-]+$/;
        return validChars.test(tag);
    }

    /**
     * Sugerir correções para tags inválidas
     */
    suggestTagCorrection(tag: string): string {
        if (!tag) return '';
        
        return tag
            .trim()
            .replace(/[^a-zA-Z0-9_/-]/g, '_') // Substituir caracteres inválidos
            .replace(/\/+/g, '/') // Remover barras duplas
            .replace(/^\/|\/$/g, '') // Remover barras no início e fim
            .replace(/_+/g, '_'); // Remover underscores duplos
    }

    /**
     * Buscar tags similares para autocomplete
     */
    findSimilarTags(query: string, allTags: string[]): string[] {
        if (!query || !allTags?.length) return [];
        
        const queryLower = query.toLowerCase();
        
        // Filtrar e ordenar por relevância
        return allTags
            .filter(tag => tag.toLowerCase().includes(queryLower))
            .sort((a, b) => {
                const aLower = a.toLowerCase();
                const bLower = b.toLowerCase();
                
                // Tags que começam com a query têm prioridade
                const aStarts = aLower.startsWith(queryLower);
                const bStarts = bLower.startsWith(queryLower);
                
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                
                // Em caso de empate, ordenar por tamanho
                return a.length - b.length;
            });
    }

    /**
     * Calcular estatísticas de uso de tags
     */
    calculateTagStats(tags: string[]): {
        totalTags: number;
        uniqueTags: number;
        averageTagsPerNote: number;
        mostUsedTag: string | null;
        hierarchyDepth: number;
    } {
        const uniqueTags = new Set(tags);
        const tagCounts = new Map<string, number>();
        
        tags.forEach(tag => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
        
        let mostUsedTag: string | null = null;
        let maxCount = 0;
        
        tagCounts.forEach((count, tag) => {
            if (count > maxCount) {
                maxCount = count;
                mostUsedTag = tag;
            }
        });
        
        const maxDepth = Math.max(
            ...Array.from(uniqueTags).map(tag => tag.split('/').length),
            0
        );
        
        return {
            totalTags: tags.length,
            uniqueTags: uniqueTags.size,
            averageTagsPerNote: tags.length / uniqueTags.size || 0,
            mostUsedTag,
            hierarchyDepth: maxDepth
        };
    }
}

export default new TagService();