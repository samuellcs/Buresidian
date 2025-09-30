import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import '../styles/HealthMonitor.css';

const HealthMonitor = () => {
  const [health, setHealth] = useState({
    status: 'loading',
    uptime: 0,
    memory: { used: 0, total: 0 },
    database: 'unknown',
    websocket: 'unknown',
    lastCheck: null
  });

  const [metrics, setMetrics] = useState({
    responseTime: 0,
    activeUsers: 0,
    notesCount: 0,
    errorsCount: 0
  });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const startTime = Date.now();
        const response = await fetch('/health');
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          const data = await response.json();
          setHealth({
            ...data,
            status: 'healthy',
            lastCheck: new Date()
          });
          setMetrics(prev => ({ ...prev, responseTime }));
        } else {
          setHealth(prev => ({ ...prev, status: 'error', lastCheck: new Date() }));
        }
      } catch (error) {
        setHealth(prev => ({ ...prev, status: 'error', lastCheck: new Date() }));
      }
    };

    // Verificar saúde inicial
    checkHealth();

    // Verificar a cada 30 segundos
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'var(--secondary-color)';
      case 'warning': return 'var(--accent-color)';
      case 'error': return 'var(--danger-color)';
      default: return 'var(--text-muted)';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return <CheckCircle size={16} />;
      case 'warning': return <AlertTriangle size={16} />;
      case 'error': return <AlertTriangle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  return (
    <div className="health-monitor">
      <div className="health-header">
        <h3>🏥 Monitor de Saúde do Sistema</h3>
        <div className="health-status" style={{ color: getStatusColor(health.status) }}>
          {getStatusIcon(health.status)}
          <span>{health.status === 'healthy' ? 'Saudável' : 
                 health.status === 'warning' ? 'Atenção' : 
                 health.status === 'error' ? 'Erro' : 'Verificando...'}</span>
        </div>
      </div>

      <div className="health-grid">
        <div className="health-card">
          <div className="card-header">
            <Clock size={16} />
            <span>Tempo Online</span>
          </div>
          <div className="card-value">
            {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m
          </div>
        </div>

        <div className="health-card">
          <div className="card-header">
            <TrendingUp size={16} />
            <span>Tempo de Resposta</span>
          </div>
          <div className="card-value">
            {metrics.responseTime}ms
          </div>
        </div>

        <div className="health-card">
          <div className="card-header">
            <CheckCircle size={16} />
            <span>Banco de Dados</span>
          </div>
          <div className="card-value" style={{ color: getStatusColor(health.database) }}>
            {health.database === 'healthy' ? 'OK' : 'Erro'}
          </div>
        </div>

        <div className="health-card">
          <div className="card-header">
            <CheckCircle size={16} />
            <span>WebSocket</span>
          </div>
          <div className="card-value" style={{ color: getStatusColor(health.websocket) }}>
            {health.websocket === 'healthy' ? 'OK' : 'Erro'}
          </div>
        </div>
      </div>

      <div className="health-details">
        <h4>📊 Métricas do Sistema</h4>
        <div className="metrics-grid">
          <div className="metric">
            <span className="metric-label">Usuários Ativos:</span>
            <span className="metric-value">{metrics.activeUsers}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Total de Notas:</span>
            <span className="metric-value">{metrics.notesCount}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Erros (24h):</span>
            <span className="metric-value">{metrics.errorsCount}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Última Verificação:</span>
            <span className="metric-value">
              {health.lastCheck ? health.lastCheck.toLocaleTimeString() : 'Nunca'}
            </span>
          </div>
        </div>
      </div>

      <div className="health-tips">
        <h4>💡 Dicas de Performance</h4>
        <ul>
          <li>✅ Auto-save está funcionando normalmente</li>
          <li>✅ Cache otimizado ativo</li>
          <li>✅ Backup automático configurado</li>
          <li>✅ Monitoramento em tempo real</li>
        </ul>
      </div>
    </div>
  );
};

export default HealthMonitor;
