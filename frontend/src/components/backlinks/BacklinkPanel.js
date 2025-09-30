import React, { useState, useEffect } from 'react';
import { 
    ArrowLeft, 
    ArrowRight, 
    ExternalLink, 
    AlertTriangle, 
    Link as LinkIcon,
    Hash,
    Clock,
    Search,
    ChevronDown,
    ChevronRight,
    Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import backlinkService from '../../services/backlinkService';

const BacklinkPanel = ({ noteId, noteTitle, className = '' }) => {
    const [backlinks, setBacklinks] = useState([]);
    const [outlinks, setOutlinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('backlinks');
    const [expandedSections, setExpandedSections] = useState(new Set(['backlinks', 'outlinks']));
    
    const navigate = useNavigate();

    useEffect(() => {
        if (noteId) {
            loadLinks();
        }
    }, [noteId]);

    const loadLinks = async () => {
        try {
            setLoading(true);
            const [backlinksData, outlinksData] = await Promise.all([
                backlinkService.getNoteBacklinks(noteId),
                backlinkService.getNoteOutlinks(noteId)
            ]);
            
            setBacklinks(backlinksData.backlinks || []);
            setOutlinks(outlinksData.outlinks || []);
        } catch (error) {
            console.error('Erro ao carregar links:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSection = (section) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(section)) {
            newExpanded.delete(section);
        } else {
            newExpanded.add(section);
        }
        setExpandedSections(newExpanded);
    };

    const handleNoteClick = (noteId) => {
        navigate(`/note/${noteId}`);
    };

    const handleCreateNote = (title) => {
        // Implementar criação de nota com o título específico
        console.log('Criar nota:', title);
    };

    const brokenLinks = outlinks.filter(link => !link.exists);
    const validLinks = outlinks.filter(link => link.exists);

    if (loading) {
        return (
            <div className={`bg-gray-800 rounded-lg border border-gray-700 p-4 ${className}`}>
                <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
            {/* Header */}
            <div className="border-b border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                    <LinkIcon className="w-5 h-5 mr-2 text-blue-500" />
                    Conexões da Nota
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                    Links e referências de "{noteTitle}"
                </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700">
                <button
                    onClick={() => setActiveTab('backlinks')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                        activeTab === 'backlinks'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                    <ArrowLeft className="w-4 h-4 inline mr-2" />
                    Backlinks ({backlinks.length})
                </button>
                <button
                    onClick={() => setActiveTab('outlinks')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                        activeTab === 'outlinks'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                    <ArrowRight className="w-4 h-4 inline mr-2" />
                    Outlinks ({outlinks.length})
                </button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-64 overflow-y-auto">
                {activeTab === 'backlinks' && (
                    <div>
                        {backlinks.length === 0 ? (
                            <div className="text-center py-8">
                                <ArrowLeft className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-400">
                                    Nenhuma nota faz referência a esta nota
                                </p>
                                <p className="text-gray-500 text-sm mt-1">
                                    Crie links usando [[{noteTitle}]] em outras notas
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {backlinks.map((link, index) => (
                                    <div
                                        key={index}
                                        className="p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer border border-gray-600"
                                        onClick={() => handleNoteClick(link.note_id)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h4 className="text-white font-medium text-sm mb-1 truncate">
                                                    {link.title}
                                                </h4>
                                                <p className="text-gray-300 text-xs mb-2 line-clamp-2">
                                                    ...{link.context}...
                                                </p>
                                                <div className="flex items-center text-xs text-gray-400">
                                                    <Clock className="w-3 h-3 mr-1" />
                                                    {new Date(link.updated_at).toLocaleDateString('pt-BR')}
                                                    {link.is_mention && (
                                                        <span className="ml-2 px-2 py-1 bg-yellow-600 text-yellow-100 rounded text-xs">
                                                            Menção
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'outlinks' && (
                    <div>
                        {outlinks.length === 0 ? (
                            <div className="text-center py-8">
                                <ArrowRight className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-400">
                                    Esta nota não faz referência a outras notas
                                </p>
                                <p className="text-gray-500 text-sm mt-1">
                                    Adicione links usando [[título da nota]]
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Links Válidos */}
                                {validLinks.length > 0 && (
                                    <div>
                                        <button
                                            onClick={() => toggleSection('valid-links')}
                                            className="w-full flex items-center justify-between text-left mb-2"
                                        >
                                            <h4 className="text-green-400 font-medium text-sm flex items-center">
                                                <LinkIcon className="w-4 h-4 mr-2" />
                                                Links Válidos ({validLinks.length})
                                            </h4>
                                            {expandedSections.has('valid-links') ? (
                                                <ChevronDown className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            )}
                                        </button>
                                        
                                        {expandedSections.has('valid-links') && (
                                            <div className="space-y-2 ml-6">
                                                {validLinks.map((link, index) => (
                                                    <div
                                                        key={index}
                                                        className="p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors cursor-pointer border border-gray-600"
                                                        onClick={() => handleNoteClick(link.note_id)}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-white text-sm truncate">
                                                                {link.title}
                                                            </span>
                                                            <ExternalLink className="w-3 h-3 text-gray-400 ml-2 flex-shrink-0" />
                                                        </div>
                                                        {link.context && (
                                                            <p className="text-gray-400 text-xs mt-1 truncate">
                                                                ...{link.context}...
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Links Quebrados */}
                                {brokenLinks.length > 0 && (
                                    <div>
                                        <button
                                            onClick={() => toggleSection('broken-links')}
                                            className="w-full flex items-center justify-between text-left mb-2"
                                        >
                                            <h4 className="text-red-400 font-medium text-sm flex items-center">
                                                <AlertTriangle className="w-4 h-4 mr-2" />
                                                Links Quebrados ({brokenLinks.length})
                                            </h4>
                                            {expandedSections.has('broken-links') ? (
                                                <ChevronDown className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            )}
                                        </button>
                                        
                                        {expandedSections.has('broken-links') && (
                                            <div className="space-y-2 ml-6">
                                                {brokenLinks.map((link, index) => (
                                                    <div
                                                        key={index}
                                                        className="p-2 bg-red-900 bg-opacity-20 border border-red-700 rounded"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-red-300 text-sm truncate">
                                                                {link.title}
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCreateNote(link.title);
                                                                }}
                                                                className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 bg-blue-600 bg-opacity-20 rounded"
                                                            >
                                                                Criar
                                                            </button>
                                                        </div>
                                                        {link.context && (
                                                            <p className="text-red-400 text-xs mt-1 truncate">
                                                                ...{link.context}...
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer com estatísticas */}
            <div className="border-t border-gray-700 p-3 bg-gray-750">
                <div className="flex justify-between text-xs text-gray-400">
                    <span>{backlinks.length} referência{backlinks.length !== 1 ? 's' : ''} recebida{backlinks.length !== 1 ? 's' : ''}</span>
                    <span>{validLinks.length} link{validLinks.length !== 1 ? 's' : ''} válido{validLinks.length !== 1 ? 's' : ''}</span>
                    {brokenLinks.length > 0 && (
                        <span className="text-red-400">{brokenLinks.length} quebrado{brokenLinks.length !== 1 ? 's' : ''}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BacklinkPanel;