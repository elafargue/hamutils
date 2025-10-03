# AX25-Web Deployment Examples

## Example 1: Custom Port (Port 8080 for API, port 3001 for frontend)

### Backend Configuration
Edit `backend/.env`:
```bash
AX25_BACKEND_HOST=0.0.0.0
AX25_BACKEND_PORT=8080
```

### Frontend Configuration  

Edit `frontend/.env`:
```bash
REACT_APP_API_BASE_URL=http://localhost:8080
PORT=3001
```

### Running the Services
```bash
# Terminal 1: Backend
cd backend
python main.py

# Terminal 2: Frontend
cd frontend
npm start
```

## Example 2: Multi-Machine Deployment

### Scenario: Backend on 192.168.1.100:8000, Frontend on 192.168.1.101:3000

### Backend Configuration (192.168.1.100)
Edit `backend/.env`:
```bash
AX25_BACKEND_HOST=0.0.0.0
AX25_BACKEND_PORT=8000
```

### Frontend Configuration (192.168.1.101)
Edit `frontend/.env`:
```bash
REACT_APP_API_BASE_URL=http://192.168.1.100:8000
```

### Running the Services
```bash
# On 192.168.1.100 (Backend machine)
cd backend
python main.py

# On 192.168.1.101 (Frontend machine)  
cd frontend
npm start
```

## Example 3: Production with Custom Ports

### Backend Configuration
Edit `backend/.env`:
```bash
AX25_BACKEND_HOST=0.0.0.0
AX25_BACKEND_PORT=3001
```

### Frontend Configuration
Edit `frontend/.env`:
```bash
REACT_APP_API_BASE_URL=http://your-server.example.com:3001
```

## Quick Port Change Commands

To quickly change to port 8080:

```bash
# Update backend
echo "AX25_BACKEND_PORT=8080" > ax25-web/backend/.env
echo "AX25_BACKEND_HOST=0.0.0.0" >> ax25-web/backend/.env

# Update frontend
echo "REACT_APP_API_BASE_URL=http://localhost:8080" > ax25-web/frontend/.env
```

## Verifying Configuration

### Check Backend Port
```bash
cd backend
grep PORT .env
```

### Check Frontend API URL
```bash
cd frontend  
grep API_BASE_URL .env
```

### Test Backend is Running
```bash
curl http://localhost:8000/health
# or for custom port:
curl http://localhost:8080/health
```