import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import '../styles/Login.css';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { user, login, register } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = isLogin 
      ? await login(username, password)
      : await register(username, password);

    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  const fillDemoCredentials = () => {
    setUsername('demo');
    setPassword('demo123');
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-card">
          <div className="login-header">
            <img 
              src="/images/Logo do Buresidian com Coruja.png" 
              alt="Buresidian Logo" 
              className="logo"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <h1 className="app-title">Buresidian</h1>
            <p className="app-subtitle">Sistema Colaborativo de Notas</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-tabs">
              <button
                type="button"
                className={`tab ${isLogin ? 'active' : ''}`}
                onClick={() => setIsLogin(true)}
              >
                <LogIn size={16} />
                Entrar
              </button>
              <button
                type="button"
                className={`tab ${!isLogin ? 'active' : ''}`}
                onClick={() => setIsLogin(false)}
              >
                <UserPlus size={16} />
                Registrar
              </button>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Usuário</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <div className="password-input">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                  className="form-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="submit-button"
            >
              {loading ? (
                <div className="spinner" />
              ) : (
                <>
                  {isLogin ? <LogIn size={16} /> : <UserPlus size={16} />}
                  {isLogin ? 'Entrar' : 'Registrar'}
                </>
              )}
            </button>

            {isLogin && (
              <button
                type="button"
                onClick={fillDemoCredentials}
                className="demo-button"
              >
                Usar Conta Demo
              </button>
            )}
          </form>

          <div className="login-footer">
            <p>Sistema para uso local apenas</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
