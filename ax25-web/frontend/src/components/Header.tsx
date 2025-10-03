import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Radio } from 'lucide-react';

const Header: React.FC = () => {
  const location = useLocation();

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Radio size={24} />
        <h1>AX25 Network Visualizer</h1>
      </div>
      <nav style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
        <Link 
          to="/" 
          style={{ 
            color: location.pathname === '/' ? '#60a5fa' : '#d1d5db',
            textDecoration: 'none'
          }}
        >
          Home
        </Link>
        <Link 
          to="/topology" 
          style={{ 
            color: location.pathname === '/topology' ? '#60a5fa' : '#d1d5db',
            textDecoration: 'none'
          }}
        >
          Network Topology
        </Link>
        <Link 
          to="/nodes" 
          style={{ 
            color: location.pathname === '/nodes' ? '#60a5fa' : '#d1d5db',
            textDecoration: 'none'
          }}
        >
          Nodes Database
        </Link>
        <Link 
          to="/config" 
          style={{ 
            color: location.pathname === '/config' ? '#60a5fa' : '#d1d5db',
            textDecoration: 'none'
          }}
        >
          Configuration
        </Link>
      </nav>
    </header>
  );
};

export default Header;