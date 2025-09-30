import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from './ThemeToggle';
import CanvasBoard from './canvas/CanvasBoard';
import EnhancedHome from './EnhancedHome';
import ObsidianSidebar from './ObsidianSidebar';
import ObsidianTopBar from './ObsidianTopBar';
import ObsidianFooter from './ObsidianFooter';
import tagService from '../services/tagService';
import { TagList } from './tags/Tag';
import TagInput from './tags/TagInput';
import BacklinkPanel from './backlinks/BacklinkPanel';
import LinkSuggestionWidget from './backlinks/LinkSuggestionWidget';
import backlinkService from '../services/backlinkService';
import axios from 'axios';
import '../styles/Dashboard.css';
import '../styles/Sidebar.css';
import '../styles/ObsidianDashboard.css';

// Simple fallback components to avoid import issues
const SimpleSidebar = ({ folders, selectedFolder, onFolderSelect }) => (
  <aside className="sidebar">
    <div className="sidebar-section">
      <h3 className="sidebar-title">📁 Pastas</h3>
      <div className="folders-list">
        <button 
          className={`folder-item ${!selectedFolder ? 'active' : ''}`}
          onClick={() => onFolderSelect(null)}
        >
          📄 Todas as notas
        </button>
        {folders.map(folder => (
          <button 
            key={folder.id}
            className={`folder-item ${selectedFolder === folder.id ? 'active' : ''}`}
            onClick={() => onFolderSelect(folder.id)}
          >
            📁 {folder.name}
          </button>
        ))}
      </div>
    </div>
  </aside>
);

const SimpleHomePage = ({ folders, notes, onCreateFolder, onCreateNote, onNoteSelect, onNoteDelete, onOpenCanvas }) => (
  <div className="home-page">
    <h2>🏠 Bem-vindo ao Buresidian</h2>
    <div className="stats">
      <div className="stat-card">
        <h3>📁 {folders.length}</h3>
        <p>Pastas</p>
      </div>
      <div className="stat-card">
        <h3>📝 {notes.length}</h3>
        <p>Notas</p>
      </div>
    </div>
    <div className="quick-actions">
      <button onClick={onCreateFolder} className="quick-action-btn">
        ➕ Nova Pasta
      </button>
      <button onClick={onCreateNote} className="quick-action-btn">
        📝 Nova Nota
      </button>
      <button onClick={onOpenCanvas} className="quick-action-btn canvas-btn">
        🎨 Abrir Canvas
      </button>
    </div>
    <div className="recent-notes">
      <h3>📄 Notas Recentes</h3>
      {notes.slice(0, 5).map(note => (
        <div key={note.id} className="recent-note" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '10px', border: '1px solid #333', borderRadius: '4px' }}>
          <div onClick={() => onNoteSelect && onNoteSelect(note)} style={{ cursor: 'pointer', flex: 1 }}>
            <h4>{note.title}</h4>
            <p>{new Date(note.updated_at).toLocaleDateString('pt-BR')}</p>
          </div>
          {onNoteDelete && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Tem certeza que deseja excluir a nota "${note.title}"?`)) {
                  onNoteDelete(note.id);
                }
              }}
              style={{
                background: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '5px 8px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🗑️
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
);

const SimpleNotesList = ({ notes, onNoteSelect, onNoteDelete }) => (
  <div className="notes-list">
    <h2>📝 Suas Notas</h2>
    <div className="notes-grid">
      {notes.map(note => (
        <div key={note.id} className="note-card">
          <div onClick={() => onNoteSelect(note)} style={{ cursor: 'pointer', flex: 1 }}>
            <h3>{note.title}</h3>
            <p>{note.content.substring(0, 100)}...</p>
            <small>{new Date(note.updated_at).toLocaleDateString('pt-BR')}</small>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Tem certeza que deseja excluir a nota "${note.title}"?`)) {
                onNoteDelete(note.id);
              }
            }}
            className="delete-note-btn"
            title="Excluir nota"
            style={{
              background: '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '5px 8px',
              cursor: 'pointer',
              fontSize: '12px',
              marginTop: '10px'
            }}
          >
            🗑️ Excluir
          </button>
        </div>
      ))}
    </div>
  </div>
);

const SimpleNoteEditor = ({ note, onNoteUpdate, onNoteDelete, onBackToHome }) => {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [tags, setTags] = useState([]);
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [showBacklinks, setShowBacklinks] = useState(true);
  const [showLinkSuggestion, setShowLinkSuggestion] = useState(false);
  const [linkSuggestionPosition, setLinkSuggestionPosition] = useState({ x: 0, y: 0 });
  const [linkSuggestionQuery, setLinkSuggestionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const textareaRef = React.useRef(null);

  // Extrair tags do conteúdo quando a nota carregar
  useEffect(() => {
    if (note?.content) {
      const extractedTags = tagService.extractTagsFromText(note.content);
      setTags(extractedTags.map(tag => tag.tag));
    }
  }, [note]);

  const saveNote = async () => {
    if (!note) return;
    
    try {
      await axios.put(`/notes/${note.id}`, { title, content });
      onNoteUpdate();
      alert('Nota salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar nota:', error);
      alert('Erro ao salvar nota');
    }
  };

  const deleteNote = async () => {
    if (!note) return;
    
    if (window.confirm(`Tem certeza que deseja excluir a nota "${note.title}"?`)) {
      try {
        await axios.delete(`/notes/${note.id}`);
        alert('Nota excluída com sucesso!');
        onNoteDelete(note.id);
        onBackToHome();
      } catch (error) {
        console.error('Erro ao excluir nota:', error);
        alert('Erro ao excluir nota');
      }
    }
  };

  const uploadImage = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const imageUrl = `http://localhost:8000${response.data.url}`;
      const markdownImage = `![${file.name}](${imageUrl})`;
      setContent(prev => prev + '\n\n' + markdownImage);
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      alert('Erro ao fazer upload da imagem');
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      uploadImage(file);
    } else {
      alert('Por favor, selecione apenas arquivos de imagem');
    }
    event.target.value = ''; // Limpar input
  };

  const addTagToContent = (tag) => {
    const tagText = `#${tag}`;
    if (!content.includes(tagText)) {
      setContent(prev => prev + (prev ? ' ' : '') + tagText);
      // Atualizar lista de tags
      const updatedTags = tagService.extractTagsFromText(content + ' ' + tagText);
      setTags(updatedTags.map(t => t.tag));
    }
  };

  const removeTagFromContent = (tagToRemove) => {
    const updatedContent = content.replace(new RegExp(`#${tagToRemove}\\b`, 'g'), '').trim();
    setContent(updatedContent);
    // Atualizar lista de tags
    const updatedTags = tagService.extractTagsFromText(updatedContent);
    setTags(updatedTags.map(t => t.tag));
  };

  const handleTagClick = (tag) => {
    // Navegar para o Tag Explorer com a tag selecionada
    window.open(`/tags?selected=${encodeURIComponent(tag)}`, '_blank');
  };

  // Atualizar tags quando o conteúdo mudar
  const handleContentChange = (newContent) => {
    setContent(newContent);
    const extractedTags = tagService.extractTagsFromText(newContent);
    setTags(extractedTags.map(tag => tag.tag));
  };

  // Funções para gerenciar links
  const handleKeyDown = (event) => {
    // Detectar Ctrl+K para inserir link
    if (event.ctrlKey && event.key === 'k') {
      event.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const rect = textarea.getBoundingClientRect();
        setLinkSuggestionPosition({
          x: rect.left + 200,
          y: rect.top + 100
        });
        setLinkSuggestionQuery('');
        setShowLinkSuggestion(true);
      }
    }
    
    // Detectar [[ para auto-sugestão
    if (event.key === '[' && content.charAt(cursorPosition - 1) === '[') {
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          const rect = textarea.getBoundingClientRect();
          setLinkSuggestionPosition({
            x: rect.left + 200,
            y: rect.top + 100
          });
          setLinkSuggestionQuery('');
          setShowLinkSuggestion(true);
        }
      }, 100);
    }
  };

  const handleInsertLink = (wikiLink) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + wikiLink + content.substring(end);
    
    handleContentChange(newContent);
    
    // Posicionar cursor após o link
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + wikiLink.length, start + wikiLink.length);
    }, 100);
  };

  const handleTextareaChange = (e) => {
    const newContent = e.target.value;
    const newCursorPosition = e.target.selectionStart;
    
    setCursorPosition(newCursorPosition);
    handleContentChange(newContent);
  };

  if (!note) {
    return (
      <div className="note-editor">
        <h2>Selecione uma nota para editar</h2>
      </div>
    );
  }

  return (
    <div className="note-editor" style={{ display: 'flex', gap: '16px', height: '100vh' }}>
      {/* Editor Principal */}
      <div style={{ flex: 2 }}>
        <div className="editor-header">
          <input 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da nota..."
            className="note-title-input"
          />
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => setShowTagPanel(!showTagPanel)}
              style={{
                background: showTagPanel ? '#f59e0b' : '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 12px',
                cursor: 'pointer'
              }}
              title="Gerenciar Tags"
            >
              #️⃣ Tags
            </button>
            <button
              onClick={() => setShowBacklinks(!showBacklinks)}
              style={{
                background: showBacklinks ? '#3b82f6' : '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 12px',
                cursor: 'pointer'
              }}
              title="Mostrar/Ocultar Backlinks"
            >
              🔗 Links
            </button>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'inline-block'
              }}
            >
              📷 Imagem
            </label>
            <button onClick={saveNote} className="save-btn">💾 Salvar</button>
          <button 
            onClick={deleteNote} 
            className="delete-btn"
            style={{
              background: '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer'
            }}
          >
            🗑️ Excluir
          </button>
          <button 
            onClick={onBackToHome} 
            style={{
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer'
            }}
            title="Voltar à página inicial"
          >
            🏠 Home
          </button>
        </div>
      </div>
      
      {/* Painel de Tags */}
      {showTagPanel && (
        <div style={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#f3f4f6', fontSize: '16px' }}>
            🏷️ Gerenciar Tags
          </h3>
          
          {/* Input para adicionar nova tag */}
          <div style={{ marginBottom: '12px' }}>
            <TagInput
              placeholder="Digite uma nova tag..."
              onTagSelect={addTagToContent}
              className="w-full"
            />
          </div>
          
          {/* Lista de tags atuais */}
          {tags.length > 0 && (
            <div>
              <p style={{ margin: '0 0 8px 0', color: '#9ca3af', fontSize: '14px' }}>
                Tags nesta nota:
              </p>
              <TagList
                tags={tags}
                onTagClick={handleTagClick}
                onTagRemove={removeTagFromContent}
                variant="colored"
                showHierarchy={true}
              />
            </div>
          )}
          
          {tags.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: '14px', fontStyle: 'italic' }}>
              Nenhuma tag encontrada. Adicione tags digitando #nomedatag no conteúdo ou use o campo acima.
            </p>
          )}
        </div>
      )}
      
      <div style={{ display: 'flex', gap: '16px', height: '400px' }}>
        {/* Editor de Conteúdo */}
        <div style={{ flex: 1 }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Escreva sua nota aqui... Use #tag para tags e [[link]] para links!"
            className="note-content-textarea"
            style={{ 
              height: '100%', 
              fontFamily: 'monospace',
              resize: 'none',
              width: '100%',
              backgroundColor: '#1f2937',
              color: '#f3f4f6',
              border: '1px solid #374151',
              borderRadius: '8px',
              padding: '12px'
            }}
          />
        </div>
        
        {/* Preview de Markdown (se houver conteúdo) */}
        {content && (
          <div style={{ 
            flex: 1, 
            backgroundColor: '#1f2937', 
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '12px',
            overflow: 'auto'
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#f3f4f6' }}>Preview:</h4>
            <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.5' }}>
              {content.split('\n').map((line, index) => (
                <div key={index} style={{ marginBottom: '4px' }}>
                  {line.startsWith('#') ? (
                    <strong style={{ color: '#60a5fa' }}>{line}</strong>
                  ) : line.includes('#') ? (
                    <span>
                      {line.split(/(\#[a-zA-Z0-9_/-]+)/g).map((part, i) => 
                        part.startsWith('#') ? (
                          <span key={i} style={{ 
                            backgroundColor: tagService.getTagColor(part.slice(1)),
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            margin: '0 2px'
                          }}>
                            {part}
                          </span>
                        ) : part
                      )}
                    </span>
                  ) : (
                    line || <br />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#9ca3af' }}>
        💡 Dica: Use #tag para tags, [[link]] para links, Ctrl+K para sugerir links
      </div>
        </div>

        {/* Painel Lateral de Backlinks */}
        {showBacklinks && note && (
          <div style={{ flex: 1, minWidth: '300px', maxWidth: '400px' }}>
            <BacklinkPanel
              noteId={note.id}
              noteTitle={note.title}
              className="h-full"
            />
          </div>
        )}

        {/* Widget de Sugestão de Links */}
        <LinkSuggestionWidget
          content={content}
          onInsertLink={handleInsertLink}
          currentNoteId={note?.id}
          position={linkSuggestionPosition}
          isVisible={showLinkSuggestion}
          onClose={() => setShowLinkSuggestion(false)}
          searchQuery={linkSuggestionQuery}
        />
    </div>
  );
};

// Modal de seleção de templates
const TemplateModal = ({ isOpen, onClose, onSelectTemplate }) => {
  if (!isOpen) return null;

  const templates = [
    { key: 'blank', icon: '📄', name: 'Nota em Branco', desc: 'Comece do zero' },
    { key: 'roadmap', icon: '🗺️', name: 'Roadmap de Projeto', desc: 'Planeje fases e cronograma' },
    { key: 'checklist', icon: '✅', name: 'Lista de Tarefas', desc: 'Organize tarefas por prioridade' },
    { key: 'meeting', icon: '📝', name: 'Notas de Reunião', desc: 'Estrutura para atas de reunião' },
    { key: 'bugReport', icon: '🐛', name: 'Relatório de Bug', desc: 'Documente problemas técnicos' }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#2a2a2a',
        padding: '24px',
        borderRadius: '12px',
        width: '500px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <h2 style={{ color: 'white', margin: 0 }}>📝 Escolha um Template</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              fontSize: '24px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
        
        <div style={{ display: 'grid', gap: '12px' }}>
          {templates.map(template => (
            <div
              key={template.key}
              onClick={() => onSelectTemplate(template.key)}
              style={{
                padding: '16px',
                border: '1px solid #444',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: '#333',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#444'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#333'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>{template.icon}</span>
                <div>
                  <h3 style={{ color: 'white', margin: '0 0 4px 0', fontSize: '16px' }}>
                    {template.name}
                  </h3>
                  <p style={{ color: '#999', margin: 0, fontSize: '14px' }}>
                    {template.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DashboardClean = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [folders, setFolders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [canvasBoard, setCanvasBoard] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);

  // Templates predefinidos
  const noteTemplates = {
    blank: {
      title: "Nova Nota",
      content: ""
    },
    roadmap: {
      title: "Roadmap do Projeto",
      content: `# 🗺️ Roadmap do Projeto

## 🎯 Objetivo
[Descreva o objetivo principal do projeto]

## 📋 Fases

### ✅ Fase 1: Planejamento
- [ ] Definir requisitos
- [ ] Criar cronograma
- [ ] Alocar recursos

### 🔄 Fase 2: Desenvolvimento
- [ ] Setup do ambiente
- [ ] Implementar funcionalidades core
- [ ] Testes unitários

### ⏳ Fase 3: Deploy
- [ ] Configurar CI/CD
- [ ] Deploy em produção
- [ ] Monitoramento

## 📅 Timeline
- **Início**: [Data]
- **Fase 1**: [Data]
- **Fase 2**: [Data]
- **Entrega**: [Data]

## 👥 Equipe
- **PM**: [Nome]
- **Dev**: [Nome]
- **QA**: [Nome]`
    },
    checklist: {
      title: "Lista de Tarefas",
      content: `# ✅ Lista de Tarefas

## 🔴 Alta Prioridade
- [ ] [Tarefa urgente 1]
- [ ] [Tarefa urgente 2]

## 🟡 Média Prioridade
- [ ] [Tarefa importante 1]
- [ ] [Tarefa importante 2]

## 🟢 Baixa Prioridade
- [ ] [Tarefa quando possível 1]
- [ ] [Tarefa quando possível 2]

## ✅ Concluídas
- [x] [Tarefa finalizada]

---
**Criado em**: ${new Date().toLocaleDateString('pt-BR')}
**Atualizado em**: ${new Date().toLocaleDateString('pt-BR')}`
    },
    meeting: {
      title: "Notas da Reunião",
      content: `# 📝 Notas da Reunião

**Data**: ${new Date().toLocaleDateString('pt-BR')}
**Hora**: ${new Date().toLocaleTimeString('pt-BR')}

## 👥 Participantes
- [Nome 1]
- [Nome 2]
- [Nome 3]

## 📋 Agenda
1. [Tópico 1]
2. [Tópico 2]
3. [Tópico 3]

## 💬 Discussões
### [Tópico 1]
- [Ponto discutido]
- [Decisão tomada]

### [Tópico 2]
- [Ponto discutido]
- [Decisão tomada]

## ✅ Action Items
- [ ] [Tarefa] - Responsável: [Nome] - Prazo: [Data]
- [ ] [Tarefa] - Responsável: [Nome] - Prazo: [Data]

## 📌 Próximos Passos
- [Próximo passo 1]
- [Próximo passo 2]

---
**Próxima reunião**: [Data e hora]`
    },
    bugReport: {
      title: "Relatório de Bug",
      content: `# 🐛 Relatório de Bug

## 📋 Informações Básicas
- **ID**: #[número]
- **Data**: ${new Date().toLocaleDateString('pt-BR')}
- **Reporter**: [Nome]
- **Severidade**: [ ] Crítica [ ] Alta [ ] Média [ ] Baixa

## 🎯 Resumo
[Descrição breve do problema]

## 🔍 Descrição Detalhada
[Descrição completa do bug encontrado]

## 🚶 Passos para Reproduzir
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]

## ✅ Resultado Esperado
[O que deveria acontecer]

## ❌ Resultado Atual
[O que está acontecendo]

## 🌍 Ambiente
- **SO**: [Windows/Mac/Linux]
- **Browser**: [Chrome/Firefox/Safari]
- **Versão**: [versão do sistema]

## 📎 Anexos
[Screenshots, logs, etc.]

## 🔧 Status
- [ ] Aberto
- [ ] Em investigação
- [ ] Em desenvolvimento
- [ ] Teste
- [ ] Resolvido
- [ ] Fechado`
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [foldersResponse, notesResponse] = await Promise.all([
        axios.get('/folders'),
        axios.get('/notes')
      ]);
      setFolders(foldersResponse.data);
      setNotes(notesResponse.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createFolder = async () => {
    const name = prompt('Nome da pasta:');
    if (name) {
      try {
        const response = await axios.post('/folders', { name });
        setFolders([...folders, response.data]);
      } catch (error) {
        console.error('Error creating folder:', error);
      }
    }
  };

  const createNote = async (templateKey = 'blank') => {
    const template = noteTemplates[templateKey];
    const title = prompt('Título da nota:', template.title);
    if (title) {
      try {
        const noteData = {
          title,
          content: template.content,
          folder_id: selectedFolder
        };
        const response = await axios.post('/notes', noteData);
        setNotes([response.data, ...notes]);
        setSelectedNote(response.data);
        navigate('/dashboard/editor');
      } catch (error) {
        console.error('Error creating note:', error);
      }
    }
    setShowTemplates(false);
  };

  const handleSelectTemplate = (templateKey) => {
    createNote(templateKey);
  };

  const openTemplateModal = () => {
    setShowTemplates(true);
  };

  const openCanvas = async () => {
    try {
      // Verificar se já existe um board padrão ou criar um novo
      const response = await axios.get('/api/canvas/boards');
      let board = response.data.find(b => b.name === 'Board Principal');
      
      if (!board) {
        // Criar board padrão se não existir
        const createResponse = await axios.post('/api/canvas/boards', {
          name: 'Board Principal',
          description: 'Canvas principal do Buresidian'
        });
        board = createResponse.data;
      }
      
      setCanvasBoard(board);
      setShowCanvas(true);
    } catch (error) {
      console.error('Erro ao abrir canvas:', error);
      alert('Erro ao abrir canvas');
    }
  };

  const closeCanvas = () => {
    setShowCanvas(false);
    setCanvasBoard(null);
  };

  const deleteNote = async (noteId) => {
    try {
      await axios.delete(`/notes/${noteId}`);
      setNotes(notes.filter(note => note.id !== noteId));
      if (selectedNote && selectedNote.id === noteId) {
        setSelectedNote(null);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Erro ao excluir nota');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const openNoteInTab = (note) => {
    const existingTab = openTabs.find(tab => tab.id === note.id);
    if (existingTab) {
      setActiveTabId(note.id);
    } else {
      const newTab = {
        id: note.id,
        title: note.title,
        type: 'note',
        data: note
      };
      setOpenTabs([...openTabs, newTab]);
      setActiveTabId(note.id);
    }
    setSelectedNote(note);
    navigate('/dashboard/editor');
  };

  const closeTab = (tabId) => {
    const updatedTabs = openTabs.filter(tab => tab.id !== tabId);
    setOpenTabs(updatedTabs);
    
    if (activeTabId === tabId) {
      if (updatedTabs.length > 0) {
        const newActiveTab = updatedTabs[updatedTabs.length - 1];
        setActiveTabId(newActiveTab.id);
        if (newActiveTab.type === 'note') {
          setSelectedNote(newActiveTab.data);
          navigate('/dashboard/editor');
        }
      } else {
        setActiveTabId(null);
        setSelectedNote(null);
        navigate('/dashboard');
      }
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Carregando...</p>
      </div>
    );
  }

  // Se o canvas está aberto, renderizar apenas o canvas
  if (showCanvas && canvasBoard) {
    return (
      <CanvasBoard 
        boardId={canvasBoard.id}
        currentUser={user}
        onClose={closeCanvas}
      />
    );
  }

  return (
    <div className="dashboard obsidian-style">
      <ObsidianTopBar 
        currentNote={selectedNote}
        onCreateNote={openTemplateModal}
        onToggleSidebar={toggleSidebar}
        sidebarCollapsed={sidebarCollapsed}
      />

      <div className="dashboard-body">
        <ObsidianSidebar 
          folders={folders}
          notes={notes}
          selectedFolder={selectedFolder}
          onFolderSelect={setSelectedFolder}
          onCreateFolder={createFolder}
          onCreateNote={openTemplateModal}
          onNoteSelect={openNoteInTab}
          currentNote={selectedNote}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        
        <main className="dashboard-main">
          {/* Tab Bar */}
          {openTabs.length > 0 && (
            <div className="tab-bar">
              {openTabs.map(tab => (
                <div 
                  key={tab.id}
                  className={`tab ${activeTabId === tab.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTabId(tab.id);
                    if (tab.type === 'note') {
                      setSelectedNote(tab.data);
                      navigate('/dashboard/editor');
                    }
                  }}
                >
                  <span className="tab-icon">📝</span>
                  <span className="tab-title">{tab.title}</span>
                  <button 
                    className="tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <Routes>
            <Route 
              path="/" 
              element={
                <EnhancedHome 
                  folders={folders}
                  notes={notes}
                  onCreateFolder={createFolder}
                  onCreateNote={openTemplateModal}
                  onOpenCanvas={openCanvas}
                  onNoteSelect={openNoteInTab}
                  onFolderSelect={setSelectedFolder}
                />
              } 
            />
            <Route 
              path="/notes" 
              element={
                <SimpleNotesList 
                  notes={selectedFolder ? notes.filter(note => note.folder_id === selectedFolder) : notes}
                  onNoteSelect={openNoteInTab}
                  onNoteDelete={deleteNote}
                />
              } 
            />
            <Route 
              path="/editor" 
              element={
                <SimpleNoteEditor 
                  note={selectedNote}
                  onNoteUpdate={loadData}
                  onNoteDelete={deleteNote}
                  onBackToHome={() => {
                    setSelectedNote(null);
                    navigate('/dashboard');
                  }}
                />
              } 
            />
          </Routes>
        </main>
      </div>

      <ObsidianFooter 
        workspace="Buresidian"
        noteCount={notes.length}
      />

      <TemplateModal 
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
};

export default DashboardClean;
