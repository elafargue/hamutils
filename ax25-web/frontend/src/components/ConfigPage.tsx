import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, FolderOpen, AlertCircle, CheckCircle } from 'lucide-react';

interface Config {
  log_file_path: string;
  watch_directory: string;
  keep_ssid: boolean;
}

const ConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<Config>({
    log_file_path: '',
    watch_directory: '',
    keep_ssid: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load current configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('http://localhost:8000/config');
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
        }
      } catch (error) {
        console.error('Error loading configuration:', error);
      }
    };
    loadConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('http://localhost:8000/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Configuration saved successfully!' });
        setTimeout(() => {
          navigate('/topology');
        }, 2000);
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.detail || 'Failed to save configuration' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please check if the backend is running.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof Config, value: string | boolean) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="config-panel">
      <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: '#1e40af' }}>
        AX25 System Configuration
      </h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="log_file_path">
            <FolderOpen size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Log File Path *
          </label>
          <input
            type="text"
            id="log_file_path"
            value={config.log_file_path}
            onChange={(e) => handleInputChange('log_file_path', e.target.value)}
            placeholder="/path/to/your/listen.log"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="watch_directory">
            Watch Directory (Optional)
          </label>
          <input
            type="text"
            id="watch_directory"
            value={config.watch_directory}
            onChange={(e) => handleInputChange('watch_directory', e.target.value)}
            placeholder="/path/to/watch/directory (defaults to log file directory)"
          />
        </div>

        <div className="form-group">
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="keep_ssid"
              checked={config.keep_ssid}
              onChange={(e) => handleInputChange('keep_ssid', e.target.checked)}
            />
            <label htmlFor="keep_ssid">
              Keep SSID in callsigns
            </label>
          </div>
        </div>

        {message && (
          <div style={{
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: message.type === 'success' ? '#166534' : '#dc2626',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`
          }}>
            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {message.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/')}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn"
            disabled={isLoading || !config.log_file_path}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Save size={16} />
            {isLoading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConfigPage;