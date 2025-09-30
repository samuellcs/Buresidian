import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { canvasApi, CanvasWebSocket } from '../../services/canvasApi';
import { useNotifications } from '../../contexts/NotificationContext';
import CanvasToolbar from './CanvasToolbar';
import CanvasNodeTypes from './nodes/CanvasNodeTypes';

const CanvasBoard = () => {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [onlineUsers, setOnlineUsers] = useState(0);
  
  const wsRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const hasUnsavedChanges = useRef(false);

  // Tipos de nós personalizados
  const nodeTypes = CanvasNodeTypes;

  // Carregar board inicial
  const loadBoard = useCallback(async () => {
    try {
      const boardData = await canvasApi.getBoardState(boardId);
      
      // Converter dados para formato ReactFlow
      const flowNodes = boardData.nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: { x: node.x, y: node.y },
        data: {
          ...node,
          onUpdate: (updates) => handleNodeUpdate(node.id, updates)
        },
        style: {
          width: node.width || 200,
          height: node.height || 100,
        }
      }));

      const flowEdges = boardData.edges.map(edge => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        label: edge.label,
        style: edge.style ? JSON.parse(edge.style) : {},
        animated: false
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
      
    } catch (error) {
      console.error('Erro ao carregar board:', error);
      showNotification('Erro ao carregar board', 'error');
    } finally {
      setLoading(false);
    }
  }, [boardId, showNotification, setNodes, setEdges]);

  // WebSocket para tempo real
  const setupWebSocket = useCallback(() => {
    wsRef.current = new CanvasWebSocket(boardId, (message) => {
      switch (message.type) {
        case 'state':
          // Estado inicial ou sincronização
          const flowNodes = message.nodes.map(node => ({
            id: node.id,
            type: node.type,
            position: { x: node.x, y: node.y },
            data: {
              ...node,
              onUpdate: (updates) => handleNodeUpdate(node.id, updates)
            },
            style: {
              width: node.width || 200,
              height: node.height || 100,
            }
          }));

          const flowEdges = message.edges.map(edge => ({
            id: edge.id,
            source: edge.source_node_id,
            target: edge.target_node_id,
            label: edge.label,
            style: edge.style ? JSON.parse(edge.style) : {},
          }));

          setNodes(flowNodes);
          setEdges(flowEdges);
          setOnlineUsers(message.online || 0);
          break;

        case 'op':
          // Aplicar operação de outro usuário
          applyRemoteOperation(message.op, message.data);
          break;

        case 'user_joined':
        case 'user_left':
          setOnlineUsers(message.online || 0);
          break;

        default:
          break;
      }
    });

    wsRef.current.connect();
  }, [boardId, setNodes, setEdges]);

  // Aplicar operação remota
  const applyRemoteOperation = (op, data) => {
    switch (op) {
      case 'add_node':
        const newNode = {
          id: data.id,
          type: data.type,
          position: { x: data.x, y: data.y },
          data: {
            ...data,
            onUpdate: (updates) => handleNodeUpdate(data.id, updates)
          },
          style: {
            width: data.width || 200,
            height: data.height || 100,
          }
        };
        setNodes(nodes => [...nodes, newNode]);
        break;

      case 'update_node':
        setNodes(nodes => 
          nodes.map(node => 
            node.id === data.id 
              ? {
                  ...node,
                  position: { x: data.x, y: data.y },
                  data: { ...node.data, ...data },
                  style: {
                    width: data.width || node.style?.width || 200,
                    height: data.height || node.style?.height || 100,
                  }
                }
              : node
          )
        );
        break;

      case 'delete_node':
        setNodes(nodes => nodes.filter(node => node.id !== data.id));
        setEdges(edges => edges.filter(edge => 
          edge.source !== data.id && edge.target !== data.id
        ));
        break;

      case 'add_edge':
        const newEdge = {
          id: data.id,
          source: data.source_node_id,
          target: data.target_node_id,
          label: data.label,
          style: data.style ? JSON.parse(data.style) : {},
        };
        setEdges(edges => [...edges, newEdge]);
        break;

      case 'delete_edge':
        setEdges(edges => edges.filter(edge => edge.id !== data.id));
        break;

      default:
        break;
    }
  };

  // Salvar automático com debounce
  const scheduleAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (hasUnsavedChanges.current) {
        try {
          const state = {
            nodes: nodes.map(node => ({
              id: node.id,
              type: node.type,
              x: node.position.x,
              y: node.position.y,
              width: node.style?.width || 200,
              height: node.style?.height || 100,
              ...node.data
            })),
            edges: edges.map(edge => ({
              id: edge.id,
              source_node_id: edge.source,
              target_node_id: edge.target,
              label: edge.label || '',
              style: JSON.stringify(edge.style || {})
            }))
          };

          await canvasApi.saveBoardState(boardId, state);
          hasUnsavedChanges.current = false;
        } catch (error) {
          console.error('Erro ao salvar:', error);
          showNotification('Erro ao salvar automaticamente', 'error');
        }
      }
    }, 800);
  }, [boardId, nodes, edges, showNotification]);

  // Handlers para mudanças locais
  const handleNodeUpdate = (nodeId, updates) => {
    setNodes(nodes => 
      nodes.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    );
    
    // Enviar via WebSocket
    if (wsRef.current) {
      wsRef.current.sendOperation('update_node', {
        id: nodeId,
        ...updates
      });
    }
    
    hasUnsavedChanges.current = true;
    scheduleAutoSave();
  };

  const onConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      id: `edge-${Date.now()}`,
      animated: false
    };
    
    setEdges(eds => addEdge(newEdge, eds));
    
    // Enviar via WebSocket
    if (wsRef.current) {
      wsRef.current.sendOperation('add_edge', {
        id: newEdge.id,
        source_node_id: newEdge.source,
        target_node_id: newEdge.target,
        label: '',
        style: '{}'
      });
    }
    
    hasUnsavedChanges.current = true;
    scheduleAutoSave();
  }, [setEdges, scheduleAutoSave]);

  // Adicionar novo nó
  const handleAddNode = (type, data = {}) => {
    const newNode = {
      id: `${type}-${Date.now()}`,
      type: type,
      position: { x: 400, y: 300 }, // Centro aproximado
      data: {
        ...data,
        onUpdate: (updates) => handleNodeUpdate(`${type}-${Date.now()}`, updates)
      },
      style: {
        width: 200,
        height: 100,
      }
    };

    setNodes(nodes => [...nodes, newNode]);
    
    // Enviar via WebSocket
    if (wsRef.current) {
      wsRef.current.sendOperation('add_node', {
        id: newNode.id,
        type: newNode.type,
        x: newNode.position.x,
        y: newNode.position.y,
        width: 200,
        height: 100,
        ...data
      });
    }
    
    hasUnsavedChanges.current = true;
    scheduleAutoSave();
  };

  // Effects
  useEffect(() => {
    loadBoard();
    setupWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [loadBoard, setupWebSocket]);

  // Tracking de mudanças para auto-save
  useEffect(() => {
    hasUnsavedChanges.current = true;
    scheduleAutoSave();
  }, [nodes, edges, scheduleAutoSave]);

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purpleAccent mx-auto mb-4"></div>
          <p>Carregando board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-obsidian text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link 
              to="/canvas" 
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Voltar para Boards
            </Link>
            <h1 className="text-2xl font-semibold">Canvas Board {boardId}</h1>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <span>👥 {onlineUsers} online</span>
            <span className={hasUnsavedChanges.current ? 'text-yellow-400' : 'text-green-400'}>
              {hasUnsavedChanges.current ? '● Salvando...' : '✓ Salvo'}
            </span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-obsidian"
          >
            <Background color="#4a5568" gap={20} />
            <Controls className="bg-gray-800 border-gray-700" />
            <MiniMap 
              className="bg-gray-800 border-gray-700"
              nodeColor="#8b5cf6"
              maskColor="rgba(0,0,0,0.8)"
            />
            
            {/* Toolbar */}
            <Panel position="top-left">
              <CanvasToolbar onAddNode={handleAddNode} />
            </Panel>
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default CanvasBoard;
