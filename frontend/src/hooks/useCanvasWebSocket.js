import { useState, useEffect, useRef } from 'react';

const useCanvasWebSocket = (boardId, userId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [lastMessage, setLastMessage] = useState(null);
  const ws = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    if (!boardId || !userId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/canvas/ws/${boardId}/${userId}`;

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('Canvas WebSocket conectado');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
          
          switch (message.type) {
            case 'collaborator_joined':
              setCollaborators(prev => {
                const exists = prev.find(c => c.id === message.collaborator.id);
                if (!exists) {
                  return [...prev, message.collaborator];
                }
                return prev;
              });
              break;
              
            case 'collaborator_left':
              setCollaborators(prev => 
                prev.filter(c => c.id !== message.collaborator_id)
              );
              break;
              
            case 'collaborators_list':
              setCollaborators(message.collaborators || []);
              break;
              
            default:
              // Outros tipos de mensagem (node_created, node_updated, etc.)
              break;
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      };

      ws.current.onclose = (event) => {
        console.log('Canvas WebSocket desconectado:', event.code, event.reason);
        setIsConnected(false);
        
        // Tentar reconectar se não foi fechamento intencional
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            console.log(`Tentativa de reconexão ${reconnectAttempts.current}/${maxReconnectAttempts}`);
            connect();
          }, timeout);
        }
      };

      ws.current.onerror = (error) => {
        console.error('Erro no Canvas WebSocket:', error);
      };

    } catch (error) {
      console.error('Erro ao conectar Canvas WebSocket:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (ws.current) {
      ws.current.close(1000, 'Desconexão intencional');
      ws.current = null;
    }
    
    setIsConnected(false);
    setCollaborators([]);
  };

  const sendMessage = (message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify(message));
      } catch (error) {
        console.error('Erro ao enviar mensagem Canvas WebSocket:', error);
      }
    } else {
      console.warn('Canvas WebSocket não está conectado');
    }
  };

  // Métodos específicos para Canvas
  const broadcastNodeCreated = (node) => {
    sendMessage({
      type: 'node_created',
      node
    });
  };

  const broadcastNodeUpdated = (node) => {
    sendMessage({
      type: 'node_updated',
      node
    });
  };

  const broadcastNodeDeleted = (nodeId) => {
    sendMessage({
      type: 'node_deleted',
      node_id: nodeId
    });
  };

  const broadcastEdgeCreated = (edge) => {
    sendMessage({
      type: 'edge_created',
      edge
    });
  };

  const broadcastEdgeUpdated = (edge) => {
    sendMessage({
      type: 'edge_updated',
      edge
    });
  };

  const broadcastEdgeDeleted = (edgeId) => {
    sendMessage({
      type: 'edge_deleted',
      edge_id: edgeId
    });
  };

  const broadcastViewportChanged = (viewport) => {
    sendMessage({
      type: 'viewport_changed',
      viewport
    });
  };

  const broadcastCursorMoved = (position) => {
    sendMessage({
      type: 'cursor_moved',
      position
    });
  };

  // Conectar automaticamente quando boardId e userId estão disponíveis
  useEffect(() => {
    if (boardId && userId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [boardId, userId]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    collaborators,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
    // Métodos específicos do Canvas
    broadcastNodeCreated,
    broadcastNodeUpdated,
    broadcastNodeDeleted,
    broadcastEdgeCreated,
    broadcastEdgeUpdated,
    broadcastEdgeDeleted,
    broadcastViewportChanged,
    broadcastCursorMoved
  };
};

export default useCanvasWebSocket;
