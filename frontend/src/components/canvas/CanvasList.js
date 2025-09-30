import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { canvasApi } from '../../services/canvasApi';
import { useNotifications } from '../../contexts/NotificationContext';

const CanvasList = () => {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [editingBoard, setEditingBoard] = useState(null);
  const navigate = useNavigate();
  const { showNotification } = useNotifications();

  const loadBoards = useCallback(async () => {
    try {
      const data = await canvasApi.getBoards();
      setBoards(data);
    } catch (error) {
      console.error('Erro ao carregar boards:', error);
      showNotification('Erro ao carregar boards', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    try {
      const newBoard = await canvasApi.createBoard(newBoardName.trim());
      setBoards([newBoard, ...boards]);
      setNewBoardName('');
      setShowCreateModal(false);
      showNotification('Board criado com sucesso!', 'success');
      navigate(`/canvas/${newBoard.id}`);
    } catch (error) {
      console.error('Erro ao criar board:', error);
      showNotification('Erro ao criar board', 'error');
    }
  };

  const handleEditBoard = async (boardId, newName) => {
    if (!newName.trim()) return;

    try {
      const updatedBoard = await canvasApi.updateBoard(boardId, newName.trim());
      setBoards(boards.map(board => 
        board.id === boardId ? updatedBoard : board
      ));
      setEditingBoard(null);
      showNotification('Board renomeado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao renomear board:', error);
      showNotification('Erro ao renomear board', 'error');
    }
  };

  const handleDeleteBoard = async (boardId) => {
    if (!window.confirm('Tem certeza que deseja deletar este board?')) return;

    try {
      await canvasApi.deleteBoard(boardId);
      setBoards(boards.filter(board => board.id !== boardId));
      showNotification('Board deletado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao deletar board:', error);
      showNotification('Erro ao deletar board', 'error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purpleAccent mx-auto mb-4"></div>
          <p>Carregando boards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian text-white">
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link 
              to="/dashboard" 
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Voltar
            </Link>
            <h1 className="text-2xl font-semibold">Canvas Boards</h1>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-purpleAccent hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
          >
            <span>+</span>
            <span>Novo Board</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {boards.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-gray-300 mb-2">Nenhum board encontrado</h3>
            <p className="text-gray-500 mb-6">Crie seu primeiro board para começar</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-purpleAccent hover:bg-purple-600 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Criar Primeiro Board
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {boards.map((board) => (
              <div
                key={board.id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-purpleAccent transition-colors group"
              >
                <div className="flex items-start justify-between mb-4">
                  {editingBoard === board.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        handleEditBoard(board.id, formData.get('name'));
                      }}
                      className="flex-1"
                    >
                      <input
                        name="name"
                        type="text"
                        defaultValue={board.name}
                        className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-white w-full focus:outline-none focus:border-purpleAccent"
                        autoFocus
                        onBlur={() => setEditingBoard(null)}
                      />
                    </form>
                  ) : (
                    <h3 
                      className="text-lg font-medium text-white group-hover:text-purpleAccent transition-colors cursor-pointer flex-1"
                      onClick={() => navigate(`/canvas/${board.id}`)}
                    >
                      {board.name}
                    </h3>
                  )}
                  
                  <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingBoard(board.id);
                      }}
                      className="text-gray-400 hover:text-white p-1 rounded"
                      title="Renomear"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBoard(board.id);
                      }}
                      className="text-gray-400 hover:text-red-400 p-1 rounded ml-1"
                      title="Deletar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="text-sm text-gray-400 space-y-1">
                  <p>Criado: {formatDate(board.created_at)}</p>
                  <p>Atualizado: {formatDate(board.updated_at)}</p>
                </div>
                
                <Link
                  to={`/canvas/${board.id}`}
                  className="block w-full mt-4 bg-gray-800 hover:bg-gray-700 text-center py-2 rounded transition-colors"
                >
                  Abrir Board
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Criar Board */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Criar Novo Board</h2>
            
            <form onSubmit={handleCreateBoard}>
              <div className="mb-4">
                <label className="block text-sm text-gray-300 mb-2">
                  Nome do Board
                </label>
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-purpleAccent"
                  placeholder="Ex: Projeto X, Ideias, etc..."
                  autoFocus
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewBoardName('');
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newBoardName.trim()}
                  className="bg-purpleAccent hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors"
                >
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasList;
