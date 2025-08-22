import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Sidebar from './Sidebar';
import HomePageSafe from './HomePageSafe';
import NotesList from './NotesList';
import NoteEditor from './NoteEditor';
import SearchComponent from './SearchComponent';
import axios from 'axios';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [folders, setFolders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState([]);

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

  const handleSearchResults = (results) => {
    setSearchResults(results);
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

  const createNote = async () => {
    const title = prompt('Título da nota:');
    if (title) {
      try {
        const noteData = {
          title,
          content: '',
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
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="dashboard-title">Buresidian</h1>
          <SearchComponent 
            onResultsUpdate={handleSearchResults}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            folders={folders}
          />
        </div>
        
        <div className="header-actions">
          <button onClick={createFolder} className="action-button" title="Nova Pasta">
            📁
          </button>
          <button onClick={createNote} className="action-button" title="Nova Nota">
            ➕
          </button>
          <button onClick={toggleTheme} className="theme-toggle" title={`Alternar para tema ${isDark ? 'claro' : 'escuro'}`}>
            {isDark ? '☀️' : '🌙'}
          </button>
          <div className="user-menu">
            <span className="username">@{user.username}</span>
            <button onClick={handleLogout} className="logout-button" title="Sair">
              🚪
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-body">
        <Sidebar 
          folders={folders}
          selectedFolder={selectedFolder}
          onFolderSelect={setSelectedFolder}
        />
        
        <main className="dashboard-main">
          <Routes>
            <Route 
              path="/" 
              element={
                searchTerm ? (
                  <div>Resultados da busca: {searchResults.length}</div>
                ) : (
                  <HomePageSafe 
                    folders={folders}
                    notes={notes}
                    onCreateFolder={createFolder}
                    onCreateNote={createNote}
                    onSelectFolder={(folderId) => {
                      setSelectedFolder(folderId);
                      navigate('/dashboard/notes');
                    }}
                    onSelectNote={(note) => {
                      setSelectedNote(note);
                      navigate('/dashboard/editor');
                    }}
                  />
                )
              } 
            />
            <Route 
              path="/notes" 
              element={
                <NotesList 
                  notes={selectedFolder ? notes.filter(note => note.folder_id === selectedFolder) : notes}
                  selectedFolder={selectedFolder}
                  searchTerm={searchTerm}
                  onNoteSelect={(note) => {
                    setSelectedNote(note);
                    navigate('/dashboard/editor');
                  }}
                />
              } 
            />
            <Route 
              path="/editor" 
              element={
                <NoteEditor 
                  note={selectedNote}
                  onNoteUpdate={loadData}
                />
              } 
            />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
