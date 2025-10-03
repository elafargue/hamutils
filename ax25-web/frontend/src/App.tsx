import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import TopologyViewer from './components/TopologyViewer';
import ConfigPage from './components/ConfigPage';
import NodesPage from './components/NodesPage';
import Header from './components/Header';
import './App.css';

function App() {
  return (
    <div className="app">
      <Router>
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/topology" element={<TopologyViewer />} />
            <Route path="/config" element={<ConfigPage />} />
            <Route path="/nodes" element={<NodesPage />} />
          </Routes>
        </main>
      </Router>
    </div>
  );
}

export default App;