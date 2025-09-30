import React, { useState, useEffect, useRef } from 'react';
import { 
    Search, 
    FileText, 
    Hash, 
    Clock, 
    Star, 
    ArrowRight,
    Command,
    X,
    Plus,
    Folder
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const QuickSwitcher = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [recentNotes, setRecentNotes] = useState([]);
    const [searchType, setSearchType] = useState('all'); // 'all', 'notes', 'tags', 'folders'
    
    const inputRef = useRef(null);
    const resultsRef = useRef(null);
    const navigate = useNavigate();

    // Focus no input quando abrir
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            loadRecentNotes();
        } else {
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Buscar quando query mudar
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (query.trim()) {
                searchContent();
            } else {
                setResults(recentNotes.map(note => ({
                    ...note,
                    type: 'recent',
                    icon: Clock,
                    subtitle: `Acessado em ${new Date(note.accessed_at || note.updated_at).toLocaleDateString('pt-BR')}`
                })));
            }
        }, 200);

        return () => clearTimeout(timeoutId);
    }, [query, recentNotes]);

    // Reset do índice selecionado quando resultados mudarem
    useEffect(() => {
        setSelectedIndex(0);
    }, [results]);

    // Navegação por teclado
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!isOpen) return;

            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    setSelectedIndex(prev => 
                        prev < results.length - 1 ? prev + 1 : 0
                    );
                    break;
                
                case 'ArrowUp':
                    event.preventDefault();
                    setSelectedIndex(prev => 
                        prev > 0 ? prev - 1 : results.length - 1
                    );
                    break;
                
                case 'Enter':
                    event.preventDefault();
                    if (results[selectedIndex]) {
                        handleSelectResult(results[selectedIndex]);
                    } else if (query.trim()) {
                        handleCreateNote(query.trim());
                    }
                    break;
                
                case 'Escape':
                    onClose();
                    break;
                
                case 'Tab':
                    event.preventDefault();
                    cycleSearchType();
                    break;
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, results, selectedIndex, query]);

    // Scroll para manter item selecionado visível
    useEffect(() => {
        if (resultsRef.current && results.length > 0) {
            const selectedElement = resultsRef.current.children[selectedIndex];
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth'
                });
            }
        }
    }, [selectedIndex]);

    const loadRecentNotes = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('/notes', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Simular notas recentes (normalmente seria baseado em último acesso)
            const recent = response.data
                .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
                .slice(0, 5);
            
            setRecentNotes(recent);
        } catch (error) {
            console.error('Erro ao carregar notas recentes:', error);
        }
    };

    const searchContent = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            // Usar o novo endpoint de busca global
            const response = await axios.get(`/api/search/global?query=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const searchResults = response.data.results.map(result => {
                let icon, subtitle;
                
                switch (result.type) {
                    case 'note':
                        icon = FileText;
                        subtitle = result.snippet || result.title;
                        break;
                    case 'tag':
                        icon = Hash;
                        subtitle = `Tag: ${result.tag}`;
                        break;
                    case 'folder':
                        icon = Folder;
                        subtitle = 'Pasta';
                        break;
                    default:
                        icon = FileText;
                        subtitle = result.snippet || '';
                }
                
                return {
                    ...result,
                    icon,
                    subtitle
                };
            });
            
            // Adicionar opção de criar nova nota se não houver resultados exatos
            const results = [...searchResults];
            if (query.trim() && !results.some(r => r.title?.toLowerCase() === query.toLowerCase())) {
                results.unshift({
                    id: 'create-note',
                    title: query.trim(),
                    type: 'create',
                    icon: Plus,
                    subtitle: `Criar nova nota: "${query.trim()}"`,
                    score: 1000
                });
            }
            
            setResults(results);
            
        } catch (error) {
            console.error('Erro na busca:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const calculateRelevanceScore = (item, query) => {
        const queryLower = query.toLowerCase();
        const titleLower = (item.title || '').toLowerCase();
        const contentLower = (item.content || '').toLowerCase();
        
        let score = 0;
        
        // Título exato
        if (titleLower === queryLower) score += 100;
        // Título começa com query
        else if (titleLower.startsWith(queryLower)) score += 50;
        // Título contém query
        else if (titleLower.includes(queryLower)) score += 20;
        
        // Conteúdo contém query
        if (contentLower.includes(queryLower)) score += 10;
        
        // Boost para notas atualizadas recentemente
        const daysSinceUpdate = (Date.now() - new Date(item.updated_at)) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 7) score += 5;
        
        return score;
    };

    const cycleSearchType = () => {
        const types = ['all', 'notes', 'tags', 'folders'];
        const currentIndex = types.indexOf(searchType);
        const nextIndex = (currentIndex + 1) % types.length;
        setSearchType(types[nextIndex]);
    };

    const handleSelectResult = (result) => {
        switch (result.type) {
            case 'note':
            case 'recent':
                navigate(`/note/${result.id}`);
                break;
            case 'tag':
                navigate(`/tags?selected=${encodeURIComponent(result.tag)}`);
                break;
            case 'folder':
                navigate(`/dashboard?folder=${result.id}`);
                break;
            case 'create':
                handleCreateNote(result.title);
                break;
        }
        onClose();
    };

    const handleCreateNote = (title) => {
        // Implementar criação de nota
        console.log('Criar nota:', title);
        onClose();
    };

    const getSearchTypeLabel = () => {
        switch (searchType) {
            case 'notes': return 'Notas';
            case 'tags': return 'Tags';
            case 'folders': return 'Pastas';
            default: return 'Tudo';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
            <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl w-full max-w-2xl mx-4">
                {/* Header */}
                <div className="flex items-center p-4 border-b border-gray-700">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`Buscar ${getSearchTypeLabel().toLowerCase()}... (Tab para alternar tipo)`}
                            className="w-full pl-12 pr-20 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                            <span className="text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded">
                                {getSearchTypeLabel()}
                            </span>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-gray-600 rounded"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results */}
                <div 
                    ref={resultsRef}
                    className="max-h-96 overflow-y-auto"
                >
                    {loading ? (
                        <div className="flex items-center justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="py-2">
                            {results.map((result, index) => {
                                const Icon = result.icon;
                                return (
                                    <div
                                        key={result.id || index}
                                        className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                                            index === selectedIndex 
                                                ? 'bg-blue-600 text-white' 
                                                : 'hover:bg-gray-700 text-gray-200'
                                        }`}
                                        onClick={() => handleSelectResult(result)}
                                    >
                                        <Icon className="w-5 h-5 flex-shrink-0 opacity-70" />
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium truncate text-sm">
                                                {result.title}
                                            </h3>
                                            {result.subtitle && (
                                                <p className="text-xs opacity-75 truncate mt-1">
                                                    {result.subtitle}
                                                </p>
                                            )}
                                        </div>
                                        {result.type === 'create' && (
                                            <div className="flex-shrink-0 text-xs bg-green-600 bg-opacity-20 text-green-300 px-2 py-1 rounded">
                                                Novo
                                            </div>
                                        )}
                                        <ArrowRight className="w-4 h-4 flex-shrink-0 opacity-50" />
                                    </div>
                                );
                            })}
                        </div>
                    ) : query.trim() ? (
                        <div className="text-center py-8">
                            <Search className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400">Nenhum resultado encontrado</p>
                            <button
                                onClick={() => handleCreateNote(query.trim())}
                                className="mt-3 text-blue-400 hover:text-blue-300 text-sm"
                            >
                                Criar nota "{query.trim()}"
                            </button>
                        </div>
                    ) : (
                        <div className="py-4">
                            <h3 className="text-gray-400 text-sm font-medium px-4 mb-2">
                                Notas Recentes
                            </h3>
                            {recentNotes.map((note, index) => (
                                <div
                                    key={note.id}
                                    className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                                        index === selectedIndex 
                                            ? 'bg-blue-600 text-white' 
                                            : 'hover:bg-gray-700 text-gray-200'
                                    }`}
                                    onClick={() => handleSelectResult({...note, type: 'recent'})}
                                >
                                    <Clock className="w-5 h-5 flex-shrink-0 opacity-70" />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium truncate text-sm">
                                            {note.title}
                                        </h3>
                                        <p className="text-xs opacity-75 truncate mt-1">
                                            {new Date(note.updated_at).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 flex-shrink-0 opacity-50" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-700 p-3 bg-gray-750">
                    <div className="flex justify-between text-xs text-gray-400">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <Command className="w-3 h-3" />
                                <span>+O abrir</span>
                            </span>
                            <span>↑↓ navegar</span>
                            <span>Enter selecionar</span>
                            <span>Tab alternar tipo</span>
                        </div>
                        {results.length > 0 && (
                            <span>{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuickSwitcher;