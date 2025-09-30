import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useWebSocket = (noteId) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user } = useAuth();
  const reconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!noteId || !user) return;

    const wsUrl = `ws://localhost:8000/ws/notes/${noteId}?user_id=${user.id}&username=${encodeURIComponent(user.username)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket conectado para nota:', noteId);
      setIsConnected(true);
      setSocket(ws);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
        
        // Disparar evento customizado para o NoteEditor
        window.dispatchEvent(new CustomEvent('websocket-message', { 
          detail: message 
        }));
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket desconectado');
      setIsConnected(false);
      setSocket(null);
      setOnlineUsers([]);
      
      // Tentar reconectar
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        
        reconnectTimeout.current = setTimeout(() => {
          console.log(`Tentativa de reconexão ${reconnectAttempts.current}/${maxReconnectAttempts}`);
          connect();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('Erro WebSocket:', error);
    };

    return ws;
  }, [noteId, user]);

  const handleMessage = useCallback((message) => {
    switch (message.type) {
      case 'content_change':
        // Será tratado pelo componente NoteEditor
        break;
      case 'user_joined':
        setOnlineUsers(prev => {
          const exists = prev.find(u => u.user_id === message.user_id);
          if (!exists) {
            return [...prev, { user_id: message.user_id, username: message.username }];
          }
          return prev;
        });
        break;
      case 'user_left':
        setOnlineUsers(prev => prev.filter(u => u.user_id !== message.user_id));
        break;
      case 'users_online':
        setOnlineUsers(message.users || []);
        break;
      case 'version_created':
        // Notificação de nova versão criada
        console.log(`${message.username} criou uma nova versão (${message.version_number})`);
        break;
      case 'version_restored':
        // Notificação de versão restaurada
        console.log(`${message.username} restaurou a versão ${message.version_number}`);
        break;
      default:
        break;
    }
  }, []);

  const sendMessage = useCallback((message) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, [socket]);

  const sendContentChange = useCallback((content) => {
    sendMessage({
      type: 'content_change',
      content,
      user_id: user?.id,
      username: user?.username
    });
  }, [sendMessage, user]);

  const sendCursorPosition = useCallback((position) => {
    sendMessage({
      type: 'cursor_position',
      position,
      user_id: user?.id,
      username: user?.username
    });
  }, [sendMessage, user]);

  useEffect(() => {
    if (noteId && user) {
      const ws = connect();
      return () => {
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
        }
        if (ws) {
          ws.close();
        }
      };
    }
  }, [noteId, user, connect]);

  useEffect(() => {
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (socket) {
        socket.close();
      }
    };
  }, [socket]);

  return {
    socket,
    isConnected,
    onlineUsers,
    sendMessage,
    sendContentChange,
    sendCursorPosition
  };
};
