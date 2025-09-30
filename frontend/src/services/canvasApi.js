const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Função para obter headers com token
const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// Canvas Boards API
export const canvasApi = {
  // Listar boards
  getBoards: async () => {
    const response = await fetch(`${API_URL}/canvas/boards`, {
      headers: getHeaders()
    });
    if (!response.ok) {
      throw new Error('Erro ao buscar boards');
    }
    return response.json();
  },

  // Criar board
  createBoard: async (name) => {
    const response = await fetch(`${API_URL}/canvas/boards`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name })
    });
    if (!response.ok) {
      throw new Error('Erro ao criar board');
    }
    return response.json();
  },

  // Atualizar board
  updateBoard: async (boardId, name) => {
    const response = await fetch(`${API_URL}/canvas/boards/${boardId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name })
    });
    if (!response.ok) {
      throw new Error('Erro ao atualizar board');
    }
    return response.json();
  },

  // Deletar board
  deleteBoard: async (boardId) => {
    const response = await fetch(`${API_URL}/canvas/boards/${boardId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) {
      throw new Error('Erro ao deletar board');
    }
    return response.json();
  },

  // Obter estado do board
  getBoardState: async (boardId) => {
    const response = await fetch(`${API_URL}/canvas/boards/${boardId}/state`, {
      headers: getHeaders()
    });
    if (!response.ok) {
      throw new Error('Erro ao buscar estado do board');
    }
    return response.json();
  },

  // Salvar estado do board
  saveBoardState: async (boardId, state) => {
    const response = await fetch(`${API_URL}/canvas/boards/${boardId}/state`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(state)
    });
    if (!response.ok) {
      throw new Error('Erro ao salvar estado do board');
    }
    return response.json();
  }
};

// WebSocket para tempo real
export class CanvasWebSocket {
  constructor(boardId, onMessage) {
    this.boardId = boardId;
    this.onMessage = onMessage;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    const token = localStorage.getItem('token');
    const wsUrl = `ws://localhost:8000/ws/canvas/${this.boardId}?token=${token}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('Canvas WebSocket conectado');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.onMessage(message);
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('Canvas WebSocket desconectado');
      this.attemptReconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('Erro WebSocket:', error);
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Tentativa de reconexão ${this.reconnectAttempts}...`);
        this.connect();
      }, 2000 * this.reconnectAttempts);
    }
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // Enviar operação de mudança
  sendOperation(op, data) {
    this.sendMessage({
      type: 'op',
      op: op,
      data: data
    });
  }

  // Solicitar sincronização
  requestSync() {
    this.sendMessage({ type: 'sync' });
  }

  // Enviar presença (cursor, seleção)
  sendPresence(presence) {
    this.sendMessage({
      type: 'presence',
      ...presence
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
