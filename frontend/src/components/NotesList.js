import React from 'react';
import { FileText, Calendar, Folder } from 'lucide-react';
import '../styles/NotesList.css';

const NotesList = ({ notes, selectedFolder, onNoteSelect, searchTerm }) => {
  const filteredNotes = searchTerm 
    ? notes // Se há busca, usar resultados da busca
    : selectedFolder 
      ? notes.filter(note => note.folder_id === selectedFolder)
      : notes;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const highlightText = (text, highlight) => {
    if (!highlight || !highlight.trim()) return text;
    
    const regex = new RegExp(`(${highlight})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  };

  if (filteredNotes.length === 0) {
    return (
      <div className="notes-list-empty">
        <FileText size={48} className="empty-icon" />
        <h3>
          {searchTerm 
            ? `Nenhuma nota encontrada para "${searchTerm}"`
            : 'Nenhuma nota encontrada'
          }
        </h3>
        <p>
          {searchTerm 
            ? 'Tente usar outros termos de busca'
            : 'Crie sua primeira nota clicando no botão "+" no cabeçalho'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="notes-list">
      <div className="notes-list-header">
        <h2>
          {searchTerm 
            ? `Resultados para "${searchTerm}"`
            : selectedFolder 
              ? 'Notas da Pasta' 
              : 'Todas as Notas'
          }
          <span className="notes-count">({filteredNotes.length})</span>
        </h2>
      </div>
      
      <div className="notes-grid">
        {filteredNotes.map(note => (
          <div
            key={note.id}
            className="note-card"
            onClick={() => onNoteSelect(note)}
          >
            <div className="note-header">
              <h3 
                className="note-title"
                dangerouslySetInnerHTML={{
                  __html: highlightText(note.title, searchTerm)
                }}
              />
              {note.folder_name && (
                <div className="note-folder">
                  <Folder size={12} />
                  {note.folder_name}
                </div>
              )}
            </div>
            
            <div 
              className="note-content-preview"
              dangerouslySetInnerHTML={{
                __html: highlightText(
                  note.content.length > 150 
                    ? note.content.substring(0, 150) + '...'
                    : note.content || 'Nota vazia...',
                  searchTerm
                )
              }}
            />
            
            <div className="note-footer">
              <div className="note-date">
                <Calendar size={12} />
                {formatDate(note.updated_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotesList;
