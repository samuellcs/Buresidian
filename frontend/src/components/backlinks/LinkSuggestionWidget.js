import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Link as LinkIcon, X, ArrowRight } from 'lucide-react';
import backlinkService from '../../services/backlinkService';

const LinkSuggestionWidget = ({ 
    content, 
    onInsertLink, 
    currentNoteId,
    position = { x: 0, y: 0 },
    isVisible = false,
    onClose,
    searchQuery = ''
}) => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState(searchQuery);
    const [selectedIndex, setSelectedIndex] = useState(0);
    
    const inputRef = useRef(null);
    const widgetRef = useRef(null);

    useEffect(() => {
        if (isVisible) {
            setQuery(searchQuery);
            if (searchQuery) {
                searchSuggestions(searchQuery);
            }
            // Focus no input quando o widget aparecer
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [isVisible, searchQuery]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (query.trim()) {
                searchSuggestions(query);
            } else {
                setSuggestions([]);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [query]);

    // Fechar ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (widgetRef.current && !widgetRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isVisible) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isVisible, onClose]);

    // Navegação por teclado
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!isVisible || suggestions.length === 0) return;

            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    setSelectedIndex(prev => 
                        prev < suggestions.length - 1 ? prev + 1 : 0
                    );
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    setSelectedIndex(prev => 
                        prev > 0 ? prev - 1 : suggestions.length - 1
                    );
                    break;
                case 'Enter':
                    event.preventDefault();
                    if (suggestions[selectedIndex]) {
                        handleSelectSuggestion(suggestions[selectedIndex]);
                    } else if (query.trim()) {
                        handleCreateNewNote(query.trim());
                    }
                    break;
                case 'Escape':
                    onClose();
                    break;
            }
        };

        if (isVisible) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isVisible, suggestions, selectedIndex, query]);

    const searchSuggestions = async (searchQuery) => {
        try {
            setLoading(true);
            const result = await backlinkService.getLinkSuggestions(searchQuery);
            
            // Filtrar nota atual
            const filteredSuggestions = result.suggestions.filter(
                note => note.note_id !== currentNoteId
            );
            
            setSuggestions(filteredSuggestions);
            setSelectedIndex(0);
        } catch (error) {
            console.error('Erro ao buscar sugestões:', error);
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectSuggestion = (suggestion) => {
        const wikiLink = backlinkService.createWikiLink(suggestion.title);
        onInsertLink(wikiLink);
        onClose();
    };

    const handleCreateNewNote = (title) => {
        const wikiLink = backlinkService.createWikiLink(title);
        onInsertLink(wikiLink);
        onClose();
    };

    if (!isVisible) return null;

    return (
        <div
            ref={widgetRef}
            className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg min-w-80 max-w-96"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                maxHeight: '300px'
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-700">
                <div className="flex items-center">
                    <LinkIcon className="w-4 h-4 text-blue-500 mr-2" />
                    <span className="text-white font-medium text-sm">Inserir Link</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-gray-700 rounded"
                >
                    <X className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-gray-700">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar ou criar nota..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Suggestions List */}
            <div className="max-h-48 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center p-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                    </div>
                ) : suggestions.length > 0 ? (
                    <div className="py-2">
                        {suggestions.map((suggestion, index) => (
                            <div
                                key={suggestion.note_id}
                                className={`px-3 py-2 cursor-pointer transition-colors ${
                                    index === selectedIndex 
                                        ? 'bg-blue-600 text-white' 
                                        : 'hover:bg-gray-700 text-gray-200'
                                }`}
                                onClick={() => handleSelectSuggestion(suggestion)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-sm truncate">
                                            {suggestion.title}
                                        </h4>
                                        <p className="text-xs opacity-75 mt-1 line-clamp-2">
                                            {suggestion.snippet}
                                        </p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 ml-2 flex-shrink-0 opacity-60" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : query.trim() ? (
                    <div className="p-3">
                        <div
                            className={`px-3 py-2 cursor-pointer rounded transition-colors ${
                                selectedIndex === 0 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-green-600 bg-opacity-20 text-green-300 hover:bg-opacity-30'
                            }`}
                            onClick={() => handleCreateNewNote(query.trim())}
                        >
                            <div className="flex items-center">
                                <Plus className="w-4 h-4 mr-2" />
                                <span className="text-sm">
                                    Criar nota: "{query.trim()}"
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 text-center">
                        <p className="text-gray-400 text-sm">
                            Digite para buscar notas existentes ou criar uma nova
                        </p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-700 p-2 bg-gray-750">
                <div className="text-xs text-gray-400 flex items-center justify-between">
                    <span>↑↓ navegar • Enter selecionar • Esc fechar</span>
                    {suggestions.length > 0 && (
                        <span>{suggestions.length} resultado{suggestions.length !== 1 ? 's' : ''}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LinkSuggestionWidget;