import React from 'react';
import { Users, Wifi, WifiOff } from 'lucide-react';
import '../styles/OnlineUsers.css';

const OnlineUsers = ({ users, isConnected }) => {
  if (!isConnected) {
    return (
      <div className="online-users offline">
        <WifiOff size={16} />
        <span>Desconectado</span>
      </div>
    );
  }

  return (
    <div className="online-users">
      <div className="connection-status">
        <Wifi size={16} className="wifi-icon" />
        <span>Tempo Real</span>
      </div>
      
      {users.length > 0 && (
        <div className="users-list">
          <Users size={14} />
          <span className="users-count">{users.length}</span>
          <div className="users-tooltip">
            <div className="users-tooltip-content">
              <h4>Usuários Online:</h4>
              {users.map(user => (
                <div key={user.user_id} className="online-user">
                  <div className="user-avatar">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span>{user.username}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineUsers;
