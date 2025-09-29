import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, Settings, Activity, Radio } from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Network size={48} />,
      title: 'View AX25 Topology',
      description: 'Visualize your amateur radio packet network in real-time. See network connections, digipeater paths, and identify nodes you can hear directly.',
      action: () => navigate('/topology'),
      buttonText: 'Open Network View'
    },
    {
      icon: <Settings size={48} />,
      title: 'Configure Settings',
      description: 'Set up your log file path, configure monitoring options, and customize the visualization to match your station setup.',
      action: () => navigate('/config'),
      buttonText: 'Configure System'
    },
    {
      icon: <Activity size={48} />,
      title: 'Real-time Monitoring',
      description: 'Monitor your AX25 network activity as it happens. The system automatically updates when new packets are received.',
      action: () => navigate('/topology'),
      buttonText: 'Start Monitoring'
    }
  ];

  return (
    <div className="landing-page">
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <Radio size={64} color="#1e40af" />
        </div>
        <h2 style={{ fontSize: '2.5rem', margin: '0 0 1rem 0', color: '#1e40af' }}>
          AX25 Network Visualizer
        </h2>
        <p style={{ fontSize: '1.25rem', color: '#6b7280', maxWidth: '600px', margin: '0 auto' }}>
          Real-time visualization and monitoring of amateur radio packet networks.
          Analyze network topology, track digipeater paths, and identify your direct connections.
        </p>
      </div>

      <div className="feature-grid">
        {features.map((feature, index) => (
          <div key={index} className="feature-card" onClick={feature.action}>
            <div style={{ color: '#1e40af', marginBottom: '1rem' }}>
              {feature.icon}
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
            <button className="btn">
              {feature.buttonText}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '3rem', textAlign: 'center', padding: '2rem', background: 'white', borderRadius: '8px' }}>
        <h3 style={{ color: '#1e40af', marginBottom: '1rem' }}>About AX25 Protocol</h3>
        <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
          AX.25 is a data link layer protocol for amateur radio. This visualizer parses your listen logs
          to show network topology, with special highlighting for nodes you can hear directly (indicated by
          asterisks in the digipeater path). Orange nodes represent stations within your radio range.
        </p>
      </div>
    </div>
  );
};

export default LandingPage;