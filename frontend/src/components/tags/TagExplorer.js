import React, { useState, useEffect } from 'react';
import { 
    Hash, 
    Search, 
    TrendingUp, 
    Folder, 
    FolderOpen, 
    ChevronRight, 
    ChevronDown,
    Filter,
    Star,
    BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import tagService from '../../services/tagService';
import { Tag, TagList } from './Tag';
import TagInput from './TagInput';
import { useNotifications } from '../../contexts/NotificationContext';

const TagExplorer = () => {
    const [tags, setTags] = useState({});
    const [popularTags, setPopularTags] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState(null);
    const [tagNotes, setTagNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('hierarchy'); // 'hierarchy', 'popular', 'search'
    const [expandedTags, setExpandedTags] = useState(new Set());
    
    const navigate = useNavigate();
    const { showSuccess, showError } = useNotifications();

    useEffect(() => {
        loadTags();
        loadPopularTags();
    }, []);

    const loadTags = async () => {
        try {
            setLoading(true);
            const result = await tagService.getTagsHierarchy();
            setTags(result.hierarchy || {});
        } catch (error) {
            console.error('Erro ao carregar tags:', error);
            showError('Erro ao carregar tags');
        } finally {
            setLoading(false);
        }
    };

    const loadPopularTags = async () => {
        try {
            const result = await tagService.getPopularTags(20);
            setPopularTags(result.popular_tags || []);
        } catch (error) {
            console.error('Erro ao carregar tags populares:', error);
        }
    };

    const handleTagClick = async (tagPath) => {
        try {
            setSelectedTag(tagPath);
            const result = await tagService.getNotesByTag(tagPath);
            setTagNotes(result.notes || []);
        } catch (error) {
            console.error('Erro ao carregar notas da tag:', error);
            showError('Erro ao carregar notas da tag');
        }
    };

    const handleNoteClick = (noteId) => {
        navigate(`/note/${noteId}`);
    };

    const toggleTagExpansion = (tagPath) => {
        const newExpanded = new Set(expandedTags);
        if (newExpanded.has(tagPath)) {
            newExpanded.delete(tagPath);
        } else {
            newExpanded.add(tagPath);
        }
        setExpandedTags(newExpanded);
    };

    const renderTagHierarchy = (tagNode, path = '', level = 0) => {
        const entries = Object.entries(tagNode);
        
        return entries.map(([key, value]) => {
            const currentPath = path ? `${path}/${key}` : key;
            const hasChildren = Object.keys(value.children).length > 0;
            const isExpanded = expandedTags.has(currentPath);

            return (
                <div key={currentPath} className="mb-1">
                    <div 
                        className={`flex items-center py-2 px-3 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors ${
                            selectedTag === currentPath ? 'bg-blue-600 bg-opacity-20 border-l-4 border-blue-500' : ''
                        }`}
                        style={{ paddingLeft: `${level * 20 + 12}px` }}
                        onClick={() => handleTagClick(currentPath)}
                    >
                        {hasChildren && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTagExpansion(currentPath);
                                }}
                                className="mr-2 p-1 hover:bg-gray-600 rounded"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-3 h-3" />
                                ) : (
                                    <ChevronRight className="w-3 h-3" />
                                )}
                            </button>
                        )}
                        
                        {!hasChildren && <div className="w-6" />}
                        
                        <Hash 
                            className="w-4 h-4 mr-2 flex-shrink-0" 
                            style={{ color: tagService.getTagColor(currentPath) }}
                        />
                        
                        <span className="text-sm text-white flex-1 truncate">
                            {key}
                        </span>
                        
                        {value.count && (
                            <span className="text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded-full ml-2">
                                {value.count}
                            </span>
                        )}
                    </div>

                    {hasChildren && isExpanded && (
                        <div className="ml-4">
                            {renderTagHierarchy(value.children, currentPath, level + 1)}
                        </div>
                    )}
                </div>
            );
        });
    };

    const filteredTags = () => {
        if (!searchQuery) return tags;
        
        const filtered = {};
        const query = searchQuery.toLowerCase();
        
        const filterRecursive = (node, path = '') => {
            const result = {};
            
            Object.entries(node).forEach(([key, value]) => {
                const currentPath = path ? `${path}/${key}` : key;
                
                if (currentPath.toLowerCase().includes(query)) {
                    result[key] = value;
                } else if (Object.keys(value.children).length > 0) {
                    const filteredChildren = filterRecursive(value.children, currentPath);
                    if (Object.keys(filteredChildren).length > 0) {
                        result[key] = {
                            ...value,
                            children: filteredChildren
                        };
                    }
                }
            });
            
            return result;
        };
        
        return filterRecursive(tags);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-4 flex items-center">
                        <Hash className="w-8 h-8 mr-3 text-blue-500" />
                        Tag Explorer
                    </h1>
                    
                    <div className="flex flex-wrap gap-4 mb-6">
                        <button
                            onClick={() => setView('hierarchy')}
                            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                                view === 'hierarchy' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                        >
                            <Folder className="w-4 h-4 mr-2" />
                            Hierarquia
                        </button>
                        
                        <button
                            onClick={() => setView('popular')}
                            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                                view === 'popular' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                        >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Populares
                        </button>
                        
                        <button
                            onClick={() => setView('search')}
                            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                                view === 'search' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                        >
                            <Search className="w-4 h-4 mr-2" />
                            Buscar
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar tags..."
                            className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Tags Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                            <h2 className="text-xl font-semibold mb-4 flex items-center">
                                {view === 'hierarchy' && <Folder className="w-5 h-5 mr-2" />}
                                {view === 'popular' && <TrendingUp className="w-5 h-5 mr-2" />}
                                {view === 'search' && <Search className="w-5 h-5 mr-2" />}
                                
                                {view === 'hierarchy' && 'Tags Hierárquicas'}
                                {view === 'popular' && 'Tags Populares'}
                                {view === 'search' && 'Resultados da Busca'}
                            </h2>

                            <div className="max-h-96 overflow-y-auto">
                                {view === 'hierarchy' && (
                                    <div>
                                        {Object.keys(filteredTags()).length === 0 ? (
                                            <p className="text-gray-400 text-center py-8">
                                                Nenhuma tag encontrada
                                            </p>
                                        ) : (
                                            renderTagHierarchy(filteredTags())
                                        )}
                                    </div>
                                )}

                                {view === 'popular' && (
                                    <div className="space-y-2">
                                        {popularTags.map((tag, index) => (
                                            <div
                                                key={tag.name}
                                                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors ${
                                                    selectedTag === tag.name ? 'bg-blue-600 bg-opacity-20 border-l-4 border-blue-500' : ''
                                                }`}
                                                onClick={() => handleTagClick(tag.name)}
                                            >
                                                <div className="flex items-center">
                                                    <span className="text-gray-400 text-sm w-6">
                                                        {index + 1}
                                                    </span>
                                                    <Hash 
                                                        className="w-4 h-4 mr-2" 
                                                        style={{ color: tagService.getTagColor(tag.name) }}
                                                    />
                                                    <span className="text-white truncate">
                                                        {tag.name}
                                                    </span>
                                                </div>
                                                <span className="text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded-full">
                                                    {tag.count}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Notes Panel */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                            {selectedTag ? (
                                <>
                                    <div className="mb-6">
                                        <h2 className="text-xl font-semibold mb-2 flex items-center">
                                            <Hash className="w-5 h-5 mr-2" style={{ color: tagService.getTagColor(selectedTag) }} />
                                            Notas com "{selectedTag}"
                                        </h2>
                                        <p className="text-gray-400">
                                            {tagNotes.length} nota{tagNotes.length !== 1 ? 's' : ''} encontrada{tagNotes.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>

                                    <div className="space-y-4 max-h-96 overflow-y-auto">
                                        {tagNotes.map((note) => (
                                            <div
                                                key={note.id}
                                                className="p-4 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors border border-gray-600"
                                                onClick={() => handleNoteClick(note.id)}
                                            >
                                                <h3 className="font-medium text-white mb-2 truncate">
                                                    {note.title}
                                                </h3>
                                                <p className="text-gray-300 text-sm mb-3 line-clamp-3">
                                                    {note.content}
                                                </p>
                                                <div className="flex items-center justify-between text-xs text-gray-400">
                                                    <span>
                                                        Atualizado: {new Date(note.updated_at).toLocaleDateString('pt-BR')}
                                                    </span>
                                                    <Tag 
                                                        tag={note.matched_tag} 
                                                        size="sm" 
                                                        variant="colored"
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        {tagNotes.length === 0 && (
                                            <div className="text-center py-12">
                                                <Hash className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                                <p className="text-gray-400">
                                                    Nenhuma nota encontrada com esta tag
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-12">
                                    <Hash className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                    <h3 className="text-xl font-medium text-gray-300 mb-2">
                                        Selecione uma tag
                                    </h3>
                                    <p className="text-gray-400">
                                        Escolha uma tag na lista ao lado para ver as notas relacionadas
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TagExplorer;