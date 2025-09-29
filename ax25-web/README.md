# AX25 Network Visualizer

A modern web application for visualizing AX25 packet radio networks in real-time. This application parses AX25 log files and provides an interactive network topology visualization with the ability to distinguish between nodes you can directly hear versus nodes that are only reachable through digipeaters.

## Features

- 🌐 **Real-time Network Visualization**: Interactive graph showing all nodes and connections
- 📡 **Hearable Node Detection**: Automatically identifies nodes you can directly hear (marked with asterisk in digipeater path)
- 🔄 **Live Updates**: WebSocket connection for real-time topology updates as new packets arrive
- ⚙️ **Configurable**: Web-based configuration for log file paths and settings
- 📊 **Statistics**: Network statistics including total nodes, edges, and hearable nodes
- 🎨 **Modern UI**: Clean, responsive React interface with React Flow for graph visualization

## Quick Start

### Prerequisites

- Python 3.8-3.12 (Python 3.13 may have compatibility issues)
- Node.js 16+ 
- npm

### Installation & Setup

1. **Clone and navigate to the project**:
   ```bash
   cd ax25-web
   ```

2. **Run the setup script**:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```
   
   The setup script will:
   - Check Python and Node.js versions
   - Create a Python virtual environment
   - Install backend dependencies (FastAPI, uvicorn, websockets, etc.)
   - Install frontend dependencies (React, React Flow, etc.)
   - Test the backend parser with available log files

### Running the Application

1. **Start the backend** (in one terminal):
   ```bash
   cd backend
   source venv/bin/activate
   python main.py
   ```
   
   The backend will start at: http://localhost:8000

2. **Start the frontend** (in another terminal):
   ```bash
   cd frontend
   npm start
   ```
   
   The frontend will start at: http://localhost:3000

### Configuration

1. Open http://localhost:3000 in your browser
2. Navigate to the "Configuration" page
3. Set your AX25 log file path (e.g., `/var/log/ax25/listen.log`)
4. Save the configuration
5. Go to "Network Topology" to view your network

## API Documentation

With the backend running, visit http://localhost:8000/docs for interactive API documentation.

### Key Endpoints

- `GET /` - API health check
- `POST /config` - Update configuration with log file path
- `GET /config` - Get current configuration  
- `GET /topology` - Get current network topology
- `GET /topology/refresh` - Force refresh topology from log file
- `WebSocket /ws` - Real-time topology updates

## How It Works

### AX25 Packet Parsing

The application parses AX25 packet logs looking for digipeater paths. A typical AX25 packet might look like:

```
fm KI6ZHD to CQ via WOODY*,KJOHN*,KBERR*,KBETH* UI pid=F0
```

### Hearable Node Detection

A node is considered "hearable" (directly reachable) if it's the **last node with an asterisk** in the digipeater path. The asterisk indicates the digipeater was actually used to relay the packet.

In the example above:
- `KBETH` is hearable (last node with `*`)
- `WOODY`, `KJOHN`, and `KBERR` were also used but `KBETH` is the final relay

### Network Topology

The application builds a directed graph where:
- **Nodes** represent callsigns (stations)
- **Edges** represent packet flows between stations
- **Hearable nodes** are highlighted in a different color
- **Edge weights** show packet counts between stations

## Project Structure

```
ax25-web/
├── backend/                 # FastAPI backend
│   ├── main.py             # Main FastAPI application
│   ├── ax25_parser.py      # AX25 log parsing logic
│   ├── requirements.txt    # Python dependencies
│   └── venv/              # Python virtual environment
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── LandingPage.tsx
│   │   │   ├── TopologyViewer.tsx
│   │   │   ├── ConfigPage.tsx
│   │   │   └── Header.tsx
│   │   ├── App.tsx        # Main React app
│   │   └── index.tsx      # React entry point
│   ├── public/
│   └── package.json       # Node.js dependencies
├── docker-compose.yml      # Docker deployment config
├── setup.sh               # Development setup script
└── README.md              # This file
```

## Development

### Backend Development

The backend uses:
- **FastAPI** for the REST API
- **WebSockets** for real-time updates  
- **Watchdog** for file system monitoring
- **Pydantic** for data validation

### Frontend Development

The frontend uses:
- **React** with TypeScript
- **React Flow** for interactive graph visualization
- **React Router** for navigation
- **WebSocket API** for real-time updates

### Testing

Test the backend parser:
```bash
cd backend
source venv/bin/activate
python -c "
from ax25_parser import AX25Parser
parser = AX25Parser()
topology = parser.parse_file('../../listen-today.log')
print(f'Parsed: {len(topology.nodes)} nodes, {len(topology.hearable_nodes)} hearable')
"
```

## Docker Deployment

For production deployment:

```bash
docker-compose up -d --build
```

This will:
- Build and start both backend and frontend containers
- Expose the frontend on port 3000
- Expose the backend API on port 8000

## Troubleshooting

### Python Version Issues

If you encounter dependency issues:
1. Use Python 3.8-3.12 (avoid 3.13)
2. Try: `pip install "pydantic>=2.6.0,<3.0"`

### Frontend Build Issues

If components aren't found:
1. Ensure all `.tsx` files are in the correct locations
2. Check that imports include `.tsx` extensions if needed

### Log File Access

Ensure the application has read access to your AX25 log file and the directory containing it.

## License

This project builds upon AX25 network analysis tools for amateur radio operators.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request