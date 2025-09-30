import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import NotificationProvider from './contexts/NotificationContext';
import Login from './components/Login';
import DashboardClean from './components/DashboardClean';
import CanvasList from './components/canvas/CanvasList';
import CanvasBoard from './components/canvas/CanvasBoard';
import GraphView from './components/graph/GraphView';
import TagExplorer from './components/tags/TagExplorer';
import QuickSwitcher from './components/quickswitcher/QuickSwitcher';
import CommandPalette from './components/command/CommandPalette';
import ThemeToggle from './components/ThemeToggle';
import './App.css';

function AppContent() {
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const { user } = useAuth();

  // Atalhos globais
  useEffect(() => {
    const handleGlobalKeydown = (event) => {
      if (!user) return;
      
      // Ctrl+O para abrir Quick Switcher
      if (event.ctrlKey && event.key === 'o') {
        event.preventDefault();
        setShowQuickSwitcher(true);
      }
      
      // Ctrl+P para abrir Command Palette
      if (event.ctrlKey && event.key === 'p') {
        event.preventDefault();
        setShowCommandPalette(true);
      }
      
      // Cmd+O e Cmd+P para Mac
      if (event.metaKey && event.key === 'o') {
        event.preventDefault();
        setShowQuickSwitcher(true);
      }
      
      if (event.metaKey && event.key === 'p') {
        event.preventDefault();
        setShowCommandPalette(true);
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
  }, [user]);

  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard/*" element={<ProtectedRoute><DashboardClean /></ProtectedRoute>} />
        <Route path="/canvas" element={<ProtectedRoute><CanvasList /></ProtectedRoute>} />
        <Route path="/canvas/:boardId" element={<ProtectedRoute><CanvasBoard /></ProtectedRoute>} />
        <Route path="/graph" element={<ProtectedRoute><GraphView /></ProtectedRoute>} />
        <Route path="/tags" element={<ProtectedRoute><TagExplorer /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      
      {/* Quick Switcher Global */}
      {user && (
        <QuickSwitcher
          isOpen={showQuickSwitcher}
          onClose={() => setShowQuickSwitcher(false)}
        />
      )}
      
      {/* Command Palette Global */}
      {user && (
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <AppContent />
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default App;
