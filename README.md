# AX25 Utilities

A collection of tools for analyzing and visualizing AX.25 amateur packet radio networks from listen logs.

## Overview

This repository provides tools to:
- Parse AX.25 packet logs to extract network topology
- Identify hearable nodes and digipeater connections
- Generate static graphs using Graphviz
- Display interactive network visualizations in a web interface

## Tools

### ax25_graph.py

Command-line tool that builds a graph of AX.25 connections from a log file. This allows rebuilding the network topology of an AX25 packet network from a `listen` log.

**Examples:**

```bash
python3 ax25_graph.py -i listen-today.log > today-with-hearable.dot
dot -Tpng today-with-hearable.dot -o today-with-hearable.png
sfdp -Goverlap=prism -Gsplines=true -Tpng today-with-hearable.dot -o today-with-hearable.png 
```

### ax25-web

Interactive web application for real-time AX.25 network topology visualization and analysis.

**Features:**
- Real-time network topology visualization
- Interactive node selection and connection highlighting
- Multiple layout algorithms (Fruchterman-Reingold, SFDP, Straight-line)
- Node filtering (hearable nodes, leaf nodes, repeaters)
- WebSocket support for live updates
- Persistent layout saving/restoration
- Configurable backend log file monitoring

**Architecture:**
- **Backend**: Python FastAPI server with AX.25 log parser
- **Frontend**: React TypeScript application with ReactFlow visualization
- **Communication**: REST API + WebSocket for real-time updates

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

```bash
cd ax25-web/backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd ax25-web/frontend
npm install
npm start
```

### Configuration

1. **Backend Configuration**: Access http://localhost:3000 and configure:
   - Log file path (e.g., `/path/to/listen-today.log`)
   - SSID handling preferences
   - File watching options

2. **Port Configuration**:
   - Backend: Create `.env` file in `ax25-web/backend/`:
     ```bash
     # Backend server configuration
     AX25_BACKEND_PORT=8000
     AX25_BACKEND_HOST=0.0.0.0
     ```
   - Frontend: Create `.env` file in `ax25-web/frontend/`:
     ```bash
     # Must match backend port and IP
     REACT_APP_API_BASE_URL=http://localhost:8000
     ```

3. **Multi-machine Deployment**: 
   - Backend: CORS is configured to accept requests from any origin
   - Frontend: Set `REACT_APP_API_BASE_URL` in `.env` file:
     ```bash
     # For local development
     REACT_APP_API_BASE_URL=http://localhost:8000
     
     # For remote backend with custom port
     REACT_APP_API_BASE_URL=http://192.168.1.100:8080
     ```

## AX.25 Protocol Understanding

### Hearable Node Detection

The parser identifies "hearable" nodes using AX.25 protocol rules:

1. **Direct transmissions**: Nodes transmitting without via paths
2. **Undigipeated paths**: Source nodes with at least one path containing no asterisks
3. **Last starred digipeater**: The rightmost digipeater with an asterisk is directly hearable

### Example Log Analysis

```
ax0: fm K6FB to BEACON ctl UI pid=F0(Text) len 48
```
→ K6FB is hearable (direct transmission)

```
ax0: fm AB6BR to TONY via WOODY KJOHN KBERR ctl UI pid=F0(Text) len 4
```
→ AB6BR is hearable (undigipeated path)

```
ax0: fm K7BBS to BEACON via HMKR* KRDG* KBANN* KBETH* WOODY* KJOHN* KROCK ctl UI
```
→ KJOHN is hearable (last starred digipeater)

### Network Topology

- **Gold nodes**: Stations you can hear directly
- **Blue nodes**: Relay/digipeater nodes (not directly hearable)
- **Light blue with orange border**: Leaf nodes (single connections)
- **Edges**: Digipeater hop relationships with packet counts

## Recent Improvements

### Parser Fixes
- ✅ Fixed spurious node creation from packet payload content
- ✅ Implemented correct "last starred digipeater" hearable detection
- ✅ Added packet content filtering (hex dump lines)

### Frontend Enhancements
- ✅ Configurable backend API URLs via environment variables
- ✅ Centralized API configuration module
- ✅ Support for multi-machine deployments

### Backend Improvements
- ✅ CORS configuration for cross-origin requests
- ✅ WebSocket support for real-time updates
- ✅ Layout persistence and restoration

## File Structure

```
hamutils/
├── ax25_graph.py           # Command-line graph generator
├── AX25.md                 # Protocol documentation
├── listen-today.log        # Example log file
├── README.md               # This file
└── ax25-web/
    ├── backend/
    │   ├── ax25_parser.py  # Core parsing logic
    │   ├── main.py         # FastAPI server
    │   └── requirements.txt
    └── frontend/
        ├── src/
        │   ├── components/ # React components
        │   └── config/     # API configuration
        ├── package.json
        └── .env.example    # Environment template
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## References

- [AX.25 Link Access Protocol v2.2](http://www.tapr.org/pdf/AX25.2.2.pdf) - TAPR
- [APRS Official Website](http://www.aprs.org/) - Bob Bruninga, WB4APR
- [Amateur Packet Radio Overview](https://en.wikipedia.org/wiki/AX.25)
