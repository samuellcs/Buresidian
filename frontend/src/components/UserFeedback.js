import React, { useState, useEffect } from 'react';
import { Star, Heart, MessageCircle, TrendingUp, Users } from 'lucide-react';
import '../styles/UserFeedback.css';

const UserFeedback = () => {
  const [feedback, setFeedback] = useState({
    rating: 0,
    comment: '',
    category: 'general'
  });

  const [submittedFeedbacks, setSubmittedFeedbacks] = useState([]);
  const [showThanks, setShowThanks] = useState(false);

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const loadFeedbacks = async () => {
    try {
      // Simular carregamento de feedbacks (em produção viria da API)
      const mockFeedbacks = [
        {
          id: 1,
          rating: 5,
          comment: "Excelente sistema de colaboração! A edição em tempo real funciona perfeitamente.",
          category: "functionality",
          user: "João Silva",
          date: new Date().toISOString()
        },
        {
          id: 2,
          rating: 4,
          comment: "Interface muito intuitiva, mas gostaria de mais opções de personalização.",
          category: "ui",
          user: "Maria Santos",
          date: new Date().toISOString()
        },
        {
          id: 3,
          rating: 5,
          comment: "O sistema de auto-save salvou meu trabalho várias vezes. Muito útil!",
          category: "functionality",
          user: "Pedro Costa",
          date: new Date().toISOString()
        }
      ];
      setSubmittedFeedbacks(mockFeedbacks);
    } catch (error) {
      console.error('Erro ao carregar feedbacks:', error);
    }
  };

  const submitFeedback = async () => {
    if (feedback.rating === 0 || feedback.comment.trim() === '') {
      alert('Por favor, forneça uma avaliação e comentário.');
      return;
    }

    try {
      // Em produção, enviaria para a API
      const newFeedback = {
        id: Date.now(),
        ...feedback,
        user: "Usuário Atual",
        date: new Date().toISOString()
      };

      setSubmittedFeedbacks(prev => [newFeedback, ...prev]);
      setFeedback({ rating: 0, comment: '', category: 'general' });
      setShowThanks(true);
      
      setTimeout(() => setShowThanks(false), 3000);
    } catch (error) {
      console.error('Erro ao enviar feedback:', error);
    }
  };

  const renderStars = (rating, interactive = false) => {
    return [...Array(5)].map((_, index) => (
      <Star
        key={index}
        size={20}
        className={`star ${index < rating ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
        onClick={interactive ? () => setFeedback(prev => ({ ...prev, rating: index + 1 })) : undefined}
      />
    ));
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'functionality': return <TrendingUp size={16} />;
      case 'ui': return <Heart size={16} />;
      case 'collaboration': return <Users size={16} />;
      default: return <MessageCircle size={16} />;
    }
  };

  const getCategoryName = (category) => {
    switch (category) {
      case 'functionality': return 'Funcionalidade';
      case 'ui': return 'Interface';
      case 'collaboration': return 'Colaboração';
      default: return 'Geral';
    }
  };

  const averageRating = submittedFeedbacks.length > 0 
    ? (submittedFeedbacks.reduce((sum, f) => sum + f.rating, 0) / submittedFeedbacks.length).toFixed(1)
    : 0;

  return (
    <div className="user-feedback">
      <div className="feedback-header">
        <h2>💬 Feedback dos Usuários</h2>
        <div className="feedback-stats">
          <div className="stat">
            <span className="stat-value">{averageRating}</span>
            <div className="stat-stars">{renderStars(Math.round(averageRating))}</div>
            <span className="stat-label">Avaliação Média</span>
          </div>
          <div className="stat">
            <span className="stat-value">{submittedFeedbacks.length}</span>
            <span className="stat-label">Avaliações</span>
          </div>
        </div>
      </div>

      {showThanks && (
        <div className="thanks-message animate-slide-up">
          <h3>🎉 Obrigado pelo seu feedback!</h3>
          <p>Sua opinião é muito importante para melhorarmos o Buresidian.</p>
        </div>
      )}

      <div className="feedback-form">
        <h3>Avalie sua experiência</h3>
        
        <div className="form-group">
          <label>Avaliação:</label>
          <div className="stars-container">
            {renderStars(feedback.rating, true)}
          </div>
        </div>

        <div className="form-group">
          <label>Categoria:</label>
          <select 
            value={feedback.category} 
            onChange={(e) => setFeedback(prev => ({ ...prev, category: e.target.value }))}
          >
            <option value="general">Geral</option>
            <option value="functionality">Funcionalidade</option>
            <option value="ui">Interface</option>
            <option value="collaboration">Colaboração</option>
          </select>
        </div>

        <div className="form-group">
          <label>Comentário:</label>
          <textarea
            value={feedback.comment}
            onChange={(e) => setFeedback(prev => ({ ...prev, comment: e.target.value }))}
            placeholder="Conte-nos sobre sua experiência com o Buresidian..."
            rows={4}
          />
        </div>

        <button className="submit-feedback-btn" onClick={submitFeedback}>
          Enviar Feedback
        </button>
      </div>

      <div className="feedback-list">
        <h3>📝 Feedbacks Recentes</h3>
        {submittedFeedbacks.slice(0, 5).map(fb => (
          <div key={fb.id} className="feedback-item">
            <div className="feedback-header-item">
              <div className="feedback-user">
                <strong>{fb.user}</strong>
                <span className="feedback-category">
                  {getCategoryIcon(fb.category)}
                  {getCategoryName(fb.category)}
                </span>
              </div>
              <div className="feedback-rating">
                {renderStars(fb.rating)}
              </div>
            </div>
            <p className="feedback-comment">{fb.comment}</p>
            <span className="feedback-date">
              {new Date(fb.date).toLocaleDateString('pt-BR')}
            </span>
          </div>
        ))}
      </div>

      <div className="feedback-insights">
        <h3>📊 Insights</h3>
        <div className="insights-grid">
          <div className="insight">
            <strong>Funcionalidade mais elogiada:</strong>
            <span>Edição colaborativa em tempo real</span>
          </div>
          <div className="insight">
            <strong>Sugestão mais comum:</strong>
            <span>Mais opções de personalização</span>
          </div>
          <div className="insight">
            <strong>Taxa de satisfação:</strong>
            <span>{averageRating >= 4 ? '🟢 Alta' : averageRating >= 3 ? '🟡 Média' : '🔴 Baixa'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserFeedback;
