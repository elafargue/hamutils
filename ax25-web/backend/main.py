#!/usr/bin/env python3
"""
FastAPI backend for AX25 network visualization
Provides REST API and WebSocket endpoints for real-time network monitoring
"""

import os
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ax25_parser import AX25Parser, NetworkTopology

class LogFileWatcher(FileSystemEventHandler):
    """Watches for changes to log files and notifies connected clients"""
    
    def __init__(self, app_instance):
        self.app = app_instance
        self.parser = AX25Parser()
    
    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith('.log'):
            # File was modified, parse it and notify clients
            asyncio.create_task(self.app.notify_clients_of_update(event.src_path))

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # Remove disconnected clients
                self.active_connections.remove(connection)

class ConfigModel(BaseModel):
    log_file_path: str
    watch_directory: Optional[str] = None
    keep_ssid: bool = False

class AX25WebApp:
    def __init__(self):
        self.app = FastAPI(title="AX25 Network Visualizer", version="1.0.0")
        self.parser = AX25Parser()
        self.connection_manager = ConnectionManager()
        self.config = {
            "log_file_path": None,
            "watch_directory": None,
            "keep_ssid": False
        }
        self.observer = None
        self.current_topology = None
        
        self.setup_cors()
        self.setup_routes()
    
    def setup_cors(self):
        """Configure CORS for React frontend"""
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # Allow all origins for development
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    
    def setup_routes(self):
        """Setup API routes"""
        
        @self.app.get("/")
        async def root():
            return {"message": "AX25 Network Visualizer API", "version": "1.0.0"}
        
        @self.app.get("/health")
        async def health_check():
            return {"status": "healthy", "timestamp": datetime.now().isoformat()}
        
        @self.app.post("/config")
        async def update_config(config: ConfigModel):
            """Update configuration and start watching log file"""
            self.config.update(config.dict())
            
            # Validate log file exists
            if not os.path.exists(config.log_file_path):
                raise HTTPException(status_code=404, detail="Log file not found")
            
            # Start watching for file changes
            await self.start_watching()
            
            # Parse initial topology
            await self.update_topology()
            
            return {"message": "Configuration updated successfully", "config": self.config}
        
        @self.app.get("/config")
        async def get_config():
            """Get current configuration"""
            return self.config
        
        @self.app.get("/topology")
        async def get_topology():
            """Get current network topology"""
            if not self.config["log_file_path"]:
                raise HTTPException(status_code=400, detail="No log file configured")
            
            if not self.current_topology:
                await self.update_topology()
            
            return self.serialize_topology(self.current_topology) if self.current_topology else {
                "nodes": [], "edges": [], "hearable_nodes": [], 
                "stats": {"total_nodes": 0, "total_edges": 0, "hearable_count": 0}
            }
        
        @self.app.get("/topology/refresh")
        async def refresh_topology():
            """Force refresh of network topology"""
            if not self.config["log_file_path"]:
                raise HTTPException(status_code=400, detail="No log file configured")
            
            await self.update_topology()
            await self.notify_clients_of_update()
            
            return self.serialize_topology(self.current_topology) if self.current_topology else {
                "nodes": [], "edges": [], "hearable_nodes": [], 
                "stats": {"total_nodes": 0, "total_edges": 0, "hearable_count": 0}
            }
        
        @self.app.post("/layout/save")
        async def save_layout_positions(request_data: dict):
            """Save node positions for a specific layout algorithm"""
            try:
                layout_algorithm = request_data.get("layout_algorithm", "fruchterman")
                positions = request_data.get("positions", {})
                
                if not positions:
                    raise HTTPException(status_code=400, detail="No positions provided")
                
                # Create layouts directory if it doesn't exist
                layouts_dir = Path("saved_layouts")
                layouts_dir.mkdir(exist_ok=True)
                
                # Save positions to JSON file per algorithm
                layout_file = layouts_dir / f"{layout_algorithm}_positions.json"
                with open(layout_file, 'w') as f:
                    json.dump({
                        "layout_algorithm": layout_algorithm,
                        "positions": positions,
                        "saved_at": datetime.now().isoformat(),
                        "node_count": len(positions)
                    }, f, indent=2)
                
                return {
                    "message": f"Layout positions saved for {layout_algorithm}",
                    "algorithm": layout_algorithm,
                    "node_count": len(positions),
                    "saved_at": datetime.now().isoformat()
                }
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to save layout: {str(e)}")
        
        @self.app.get("/layout/restore/{layout_algorithm}")
        async def restore_layout_positions(layout_algorithm: str):
            """Restore saved node positions for a specific layout algorithm"""
            try:
                layouts_dir = Path("saved_layouts")
                layout_file = layouts_dir / f"{layout_algorithm}_positions.json"
                
                if not layout_file.exists():
                    raise HTTPException(
                        status_code=404, 
                        detail=f"No saved layout found for algorithm '{layout_algorithm}'"
                    )
                
                with open(layout_file, 'r') as f:
                    saved_data = json.load(f)
                
                return {
                    "layout_algorithm": saved_data.get("layout_algorithm"),
                    "positions": saved_data.get("positions", {}),
                    "saved_at": saved_data.get("saved_at"),
                    "node_count": saved_data.get("node_count", 0)
                }
            except FileNotFoundError:
                raise HTTPException(
                    status_code=404, 
                    detail=f"No saved layout found for algorithm '{layout_algorithm}'"
                )
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to restore layout: {str(e)}")
        
        @self.app.get("/layout/list")
        async def list_saved_layouts():
            """List all saved layout algorithms and their metadata"""
            try:
                layouts_dir = Path("saved_layouts")
                if not layouts_dir.exists():
                    return {"saved_layouts": []}
                
                saved_layouts = []
                for layout_file in layouts_dir.glob("*_positions.json"):
                    try:
                        with open(layout_file, 'r') as f:
                            data = json.load(f)
                        saved_layouts.append({
                            "algorithm": data.get("layout_algorithm"),
                            "saved_at": data.get("saved_at"),
                            "node_count": data.get("node_count", 0)
                        })
                    except Exception:
                        continue  # Skip corrupted files
                
                return {"saved_layouts": saved_layouts}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to list layouts: {str(e)}")
        
        @self.app.websocket("/ws")
        async def websocket_endpoint(websocket: WebSocket):
            """WebSocket endpoint for real-time updates"""
            await self.connection_manager.connect(websocket)
            try:
                while True:
                    # Keep connection alive
                    await websocket.receive_text()
            except WebSocketDisconnect:
                self.connection_manager.disconnect(websocket)
    
    def serialize_topology(self, topology: NetworkTopology) -> Dict:
        """Convert NetworkTopology to JSON-serializable format"""
        if not topology:
            return {
                "nodes": [],
                "edges": [],
                "hearable_nodes": [],
                "stats": {"total_nodes": 0, "total_edges": 0, "hearable_count": 0}
            }
        
        # Create nodes list with metadata
        nodes = []
        for node in topology.nodes:
            nodes.append({
                "id": node,
                "label": node,
                "is_hearable": node in topology.hearable_nodes,
                "packet_count": topology.node_counts.get(node, 0),
                "type": "hearable" if node in topology.hearable_nodes else "relay"
            })
        
        return {
            "nodes": nodes,
            "edges": topology.edges,
            "hearable_nodes": list(topology.hearable_nodes),
            "stats": {
                "total_nodes": len(topology.nodes),
                "total_edges": len(topology.edges),
                "hearable_count": len(topology.hearable_nodes),
                "last_updated": datetime.now().isoformat()
            }
        }
    
    async def update_topology(self):
        """Parse log file and update current topology"""
        if not self.config["log_file_path"]:
            return
        
        try:
            self.current_topology = self.parser.parse_file(
                self.config["log_file_path"],
                keep_ssid=self.config["keep_ssid"]
            )
        except Exception as e:
            print(f"Error updating topology: {e}")
    
    async def start_watching(self):
        """Start watching log file for changes"""
        if self.observer:
            self.observer.stop()
            self.observer.join()
        
        log_path = Path(self.config["log_file_path"])
        watch_dir = self.config["watch_directory"] or str(log_path.parent)
        
        event_handler = LogFileWatcher(self)
        self.observer = Observer()
        self.observer.schedule(event_handler, watch_dir, recursive=False)
        self.observer.start()
    
    async def notify_clients_of_update(self, file_path: str = ""):
        """Notify all connected WebSocket clients of topology update"""
        await self.update_topology()
        
        if self.current_topology and self.connection_manager.active_connections:
            message = {
                "type": "topology_update",
                "data": self.serialize_topology(self.current_topology),
                "timestamp": datetime.now().isoformat()
            }
            await self.connection_manager.broadcast(json.dumps(message))

# Create app instance
ax25_app = AX25WebApp()
app = ax25_app.app

if __name__ == "__main__":
    import uvicorn
    
    # Get port from environment variable or default to 8000
    port = int(os.getenv("AX25_BACKEND_PORT", "8000"))
    host = os.getenv("AX25_BACKEND_HOST", "0.0.0.0")
    
    print("🚀 Starting AX25 Network Visualizer Backend...")
    print(f"📍 Server will be running at: http://{host}:{port}")
    print(f"📖 API Documentation at: http://{host}:{port}/docs")
    print("⏹️  Press Ctrl+C to stop the server\n")
    uvicorn.run("main:app", host=host, port=port, reload=True)