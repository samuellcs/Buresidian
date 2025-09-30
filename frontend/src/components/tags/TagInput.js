import React, { useState, useEffect, useRef } from 'react';
import { Hash, X, ChevronDown } from 'lucide-react';
import tagService from '../../services/tagService';

const TagInput = ({ 
    value = '', 
    onChange, 
    onTagSelect,
    placeholder = 'Digite uma tag...',
    className = '',
    showSuggestions = true,
    allowCreation = true 
}) => {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestionsList, setShowSuggestionsList] = useState(false);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const [loading, setLoading] = useState(false);
    
    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);

    // Debounce para autocomplete
    useEffect(() => {
        if (!inputValue.trim() || !showSuggestions) {
            setSuggestions([]);
            setShowSuggestionsList(false);
            return;
        }

        const timeoutId = setTimeout(async () => {
            try {
                setLoading(true);
                const result = await tagService.getTagsAutocomplete(inputValue);
                setSuggestions(result.suggestions || []);
                setShowSuggestionsList(true);
                setSelectedSuggestionIndex(-1);
            } catch (error) {
                console.error('Erro no autocomplete:', error);
                setSuggestions([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [inputValue, showSuggestions]);

    // Fechar sugestões ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                suggestionsRef.current && 
                !suggestionsRef.current.contains(event.target) &&
                !inputRef.current.contains(event.target)
            ) {
                setShowSuggestionsList(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        onChange && onChange(newValue);
    };

    const handleKeyDown = (e) => {
        if (!showSuggestionsList || suggestions.length === 0) {
            if (e.key === 'Enter' && allowCreation && inputValue.trim()) {
                e.preventDefault();
                handleTagSelect(inputValue.trim());
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedSuggestionIndex(prev => 
                    prev < suggestions.length - 1 ? prev + 1 : 0
                );
                break;
            
            case 'ArrowUp':
                e.preventDefault();
                setSelectedSuggestionIndex(prev => 
                    prev > 0 ? prev - 1 : suggestions.length - 1
                );
                break;
            
            case 'Enter':
                e.preventDefault();
                if (selectedSuggestionIndex >= 0) {
                    handleTagSelect(suggestions[selectedSuggestionIndex]);
                } else if (allowCreation && inputValue.trim()) {
                    handleTagSelect(inputValue.trim());
                }
                break;
            
            case 'Escape':
                setShowSuggestionsList(false);
                setSelectedSuggestionIndex(-1);
                break;
        }
    };

    const handleTagSelect = (tag) => {
        setInputValue('');
        setShowSuggestionsList(false);
        setSelectedSuggestionIndex(-1);
        onTagSelect && onTagSelect(tag);
    };

    const handleSuggestionClick = (tag) => {
        handleTagSelect(tag);
    };

    return (
        <div className={`relative ${className}`}>
            <div className="relative">
                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (suggestions.length > 0) {
                            setShowSuggestionsList(true);
                        }
                    }}
                    placeholder={placeholder}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {loading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                    </div>
                )}
            </div>

            {/* Lista de Sugestões */}
            {showSuggestionsList && suggestions.length > 0 && (
                <div
                    ref={suggestionsRef}
                    className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                >
                    {suggestions.map((suggestion, index) => (
                        <div
                            key={suggestion}
                            className={`px-4 py-2 cursor-pointer flex items-center justify-between hover:bg-gray-700 ${
                                index === selectedSuggestionIndex ? 'bg-gray-700' : ''
                            }`}
                            onClick={() => handleSuggestionClick(suggestion)}
                        >
                            <div className="flex items-center">
                                <Hash className="w-3 h-3 text-gray-400 mr-2" />
                                <span className="text-white">
                                    {tagService.formatTagForDisplay(suggestion)}
                                </span>
                            </div>
                            <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tagService.getTagColor(suggestion) }}
                            />
                        </div>
                    ))}
                    
                    {allowCreation && inputValue.trim() && !suggestions.includes(inputValue.trim()) && (
                        <div
                            className={`px-4 py-2 cursor-pointer border-t border-gray-600 hover:bg-gray-700 ${
                                selectedSuggestionIndex === suggestions.length ? 'bg-gray-700' : ''
                            }`}
                            onClick={() => handleTagSelect(inputValue.trim())}
                        >
                            <div className="flex items-center text-blue-400">
                                <Hash className="w-3 h-3 mr-2" />
                                <span>Criar "{inputValue.trim()}"</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TagInput;