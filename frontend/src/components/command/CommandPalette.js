import React, { useState, useEffect, useRef } from 'react';
import { 
    Command, 
    Search, 
    FileText, 
    FolderPlus, 
    Plus, 
    Settings, 
    Download, 
    Upload, 
    Trash2,
    Copy,
    Eye,
    EyeOff,
    Moon,
    Sun,
    Archive,
    Hash,
    Link as LinkIcon,
    Globe,
    Palette,
    X,
    ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

const CommandPalette = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [filteredCommands, setFilteredCommands] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [category, setCategory] = useState('all');
    
    const inputRef = useRef(null);
    const resultsRef = useRef(null);
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const { user, logout } = useAuth();

    // Definir todos os comandos disponíveis
    const allCommands = [
        // Navegação
        {
            id: 'open-quick-switcher',
            name: 'Abrir Quick Switcher',
            description: 'Buscar e navegar rapidamente entre notas',
            category: 'navigation',
            icon: Search,
            shortcut: 'Ctrl+O',
            action: () => {
                onClose();
                // Simular Ctrl+O
                const event = new KeyboardEvent('keydown', {
                    key: 'o',
                    ctrlKey: true,
                    bubbles: true
                });
                document.dispatchEvent(event);
            }
        },
        {
            id: 'go-dashboard',
            name: 'Ir para Dashboard',
            description: 'Voltar à página principal',
            category: 'navigation',
            icon: FileText,
            action: () => navigate('/dashboard')
        },
        {
            id: 'go-graph-view',
            name: 'Abrir Graph View',
            description: 'Visualizar conexões entre notas',
            category: 'navigation',
            icon: Globe,
            action: () => navigate('/graph')
        },
        {
            id: 'go-tag-explorer',
            name: 'Abrir Tag Explorer',
            description: 'Explorar e gerenciar tags',
            category: 'navigation',
            icon: Hash,
            action: () => navigate('/tags')
        },
        {
            id: 'go-canvas',
            name: 'Abrir Canvas',
            description: 'Trabalhar em boards visuais',
            category: 'navigation',
            icon: Palette,
            action: () => navigate('/canvas')
        },

        // Criação
        {
            id: 'create-note',
            name: 'Nova Nota',
            description: 'Criar uma nova nota',
            category: 'create',
            icon: Plus,
            shortcut: 'Ctrl+N',
            action: () => {
                // Implementar criação de nota
                console.log('Criar nova nota');
                onClose();
            }
        },
        {
            id: 'create-folder',
            name: 'Nova Pasta',
            description: 'Criar uma nova pasta',
            category: 'create',
            icon: FolderPlus,
            action: () => {
                // Implementar criação de pasta
                console.log('Criar nova pasta');
                onClose();
            }
        },
        {
            id: 'create-canvas',
            name: 'Novo Canvas',
            description: 'Criar um novo board de canvas',
            category: 'create',
            icon: Palette,
            action: () => {
                navigate('/canvas');
                // Trigger criar novo canvas
                onClose();
            }
        },

        // Edição
        {
            id: 'copy-current-note',
            name: 'Copiar Nota Atual',
            description: 'Copiar conteúdo da nota atual',
            category: 'edit',
            icon: Copy,
            shortcut: 'Ctrl+Shift+C',
            action: () => {
                // Implementar cópia
                console.log('Copiar nota atual');
                onClose();
            }
        },
        {
            id: 'archive-note',
            name: 'Arquivar Nota',
            description: 'Mover nota para arquivo',
            category: 'edit',
            icon: Archive,
            action: () => {
                console.log('Arquivar nota');
                onClose();
            }
        },
        {
            id: 'delete-note',
            name: 'Excluir Nota',
            description: 'Excluir nota atual',
            category: 'edit',
            icon: Trash2,
            shortcut: 'Ctrl+Del',
            action: () => {
                console.log('Excluir nota');
                onClose();
            }
        },

        // Visualização
        {
            id: 'toggle-theme',
            name: 'Alternar Tema',
            description: `Mudar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`,
            category: 'view',
            icon: theme === 'dark' ? Sun : Moon,
            shortcut: 'Ctrl+Shift+T',
            action: () => {
                toggleTheme();
                onClose();
            }
        },
        {
            id: 'toggle-sidebar',
            name: 'Alternar Sidebar',
            description: 'Mostrar/ocultar barra lateral',
            category: 'view',
            icon: EyeOff,
            shortcut: 'Ctrl+B',
            action: () => {
                console.log('Toggle sidebar');
                onClose();
            }
        },
        {
            id: 'focus-mode',
            name: 'Modo Foco',
            description: 'Ativar modo de foco na escrita',
            category: 'view',
            icon: Eye,
            shortcut: 'F11',
            action: () => {
                console.log('Modo foco');
                onClose();
            }
        },

        // Ferramentas
        {
            id: 'export-vault',
            name: 'Exportar Dados',
            description: 'Exportar todas as notas',
            category: 'tools',
            icon: Download,
            action: () => {
                console.log('Exportar dados');
                onClose();
            }
        },
        {
            id: 'import-vault',
            name: 'Importar Dados',
            description: 'Importar notas de arquivo',
            category: 'tools',
            icon: Upload,
            action: () => {
                console.log('Importar dados');
                onClose();
            }
        },
        {
            id: 'backlink-analysis',
            name: 'Análise de Backlinks',
            description: 'Ver relatório de conexões',
            category: 'tools',
            icon: LinkIcon,
            action: () => {
                console.log('Análise de backlinks');
                onClose();
            }
        },

        // Sistema
        {
            id: 'logout',
            name: 'Sair',
            description: 'Fazer logout da conta',
            category: 'system',
            icon: X,
            action: () => {
                logout();
                onClose();
            }
        }
    ];

    // Focus no input quando abrir
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        } else {
            setQuery('');
            setSelectedIndex(0);
            setCategory('all');
        }
    }, [isOpen]);

    // Filtrar comandos baseado na query
    useEffect(() => {
        let filtered = allCommands;

        // Filtrar por categoria
        if (category !== 'all') {
            filtered = filtered.filter(cmd => cmd.category === category);
        }

        // Filtrar por query
        if (query.trim()) {
            const queryLower = query.toLowerCase();
            filtered = filtered.filter(cmd => 
                cmd.name.toLowerCase().includes(queryLower) ||
                cmd.description.toLowerCase().includes(queryLower) ||
                cmd.category.toLowerCase().includes(queryLower)
            );

            // Ordenar por relevância
            filtered.sort((a, b) => {
                const aNameMatch = a.name.toLowerCase().includes(queryLower);
                const bNameMatch = b.name.toLowerCase().includes(queryLower);
                
                if (aNameMatch && !bNameMatch) return -1;
                if (!aNameMatch && bNameMatch) return 1;
                
                return a.name.localeCompare(b.name);
            });
        }

        setFilteredCommands(filtered);
        setSelectedIndex(0);
    }, [query, category, allCommands]);

    // Navegação por teclado
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!isOpen) return;

            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    setSelectedIndex(prev => 
                        prev < filteredCommands.length - 1 ? prev + 1 : 0
                    );
                    break;
                
                case 'ArrowUp':
                    event.preventDefault();
                    setSelectedIndex(prev => 
                        prev > 0 ? prev - 1 : filteredCommands.length - 1
                    );
                    break;
                
                case 'Enter':
                    event.preventDefault();
                    if (filteredCommands[selectedIndex]) {
                        executeCommand(filteredCommands[selectedIndex]);
                    }
                    break;
                
                case 'Escape':
                    onClose();
                    break;
                
                case 'Tab':
                    event.preventDefault();
                    cycleCategory();
                    break;
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, filteredCommands, selectedIndex]);

    // Scroll para manter item selecionado visível
    useEffect(() => {
        if (resultsRef.current && filteredCommands.length > 0) {
            const selectedElement = resultsRef.current.children[selectedIndex];
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth'
                });
            }
        }
    }, [selectedIndex]);

    const executeCommand = (command) => {
        try {
            command.action();
        } catch (error) {
            console.error('Erro ao executar comando:', error);
        }
        onClose();
    };

    const cycleCategory = () => {
        const categories = ['all', 'navigation', 'create', 'edit', 'view', 'tools', 'system'];
        const currentIndex = categories.indexOf(category);
        const nextIndex = (currentIndex + 1) % categories.length;
        setCategory(categories[nextIndex]);
    };

    const getCategoryLabel = () => {
        switch (category) {
            case 'navigation': return 'Navegação';
            case 'create': return 'Criar';
            case 'edit': return 'Editar';
            case 'view': return 'Visualizar';
            case 'tools': return 'Ferramentas';
            case 'system': return 'Sistema';
            default: return 'Todos';
        }
    };

    const getCategoryIcon = () => {
        switch (category) {
            case 'navigation': return <Search className="w-3 h-3" />;
            case 'create': return <Plus className="w-3 h-3" />;
            case 'edit': return <FileText className="w-3 h-3" />;
            case 'view': return <Eye className="w-3 h-3" />;
            case 'tools': return <Settings className="w-3 h-3" />;
            case 'system': return <Command className="w-3 h-3" />;
            default: return <Command className="w-3 h-3" />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-20 z-50">
            <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl w-full max-w-2xl mx-4">
                {/* Header */}
                <div className="flex items-center p-4 border-b border-gray-700">
                    <div className="relative flex-1">
                        <Command className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Digite um comando... (Tab para alternar categoria)"
                            className="w-full pl-12 pr-32 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                            <div className="flex items-center gap-1 text-xs bg-gray-600 text-gray-300 px-2 py-1 rounded">
                                {getCategoryIcon()}
                                <span>{getCategoryLabel()}</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-gray-600 rounded"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Commands List */}
                <div 
                    ref={resultsRef}
                    className="max-h-96 overflow-y-auto"
                >
                    {filteredCommands.length > 0 ? (
                        <div className="py-2">
                            {filteredCommands.map((command, index) => {
                                const Icon = command.icon;
                                return (
                                    <div
                                        key={command.id}
                                        className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                                            index === selectedIndex 
                                                ? 'bg-purple-600 text-white' 
                                                : 'hover:bg-gray-700 text-gray-200'
                                        }`}
                                        onClick={() => executeCommand(command)}
                                    >
                                        <Icon className="w-5 h-5 flex-shrink-0 opacity-70" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-medium text-sm">
                                                    {command.name}
                                                </h3>
                                                {command.shortcut && (
                                                    <span className="text-xs bg-gray-600 bg-opacity-50 px-2 py-1 rounded font-mono">
                                                        {command.shortcut}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs opacity-75 truncate mt-1">
                                                {command.description}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-50" />
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Command className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400">
                                {query.trim() ? 'Nenhum comando encontrado' : 'Digite para buscar comandos'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-700 p-3 bg-gray-750">
                    <div className="flex justify-between text-xs text-gray-400">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <Command className="w-3 h-3" />
                                <span>+P comandos</span>
                            </span>
                            <span>↑↓ navegar</span>
                            <span>Enter executar</span>
                            <span>Tab alternar categoria</span>
                        </div>
                        {filteredCommands.length > 0 && (
                            <span>{filteredCommands.length} comando{filteredCommands.length !== 1 ? 's' : ''}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;