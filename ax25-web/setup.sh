#!/bin/bash

# AX25 Network Visualizer Setup Script

set -e  # Exit on any error

echo "🚀 Setting up AX25 Network Visualizer..."

# Function to check Python version
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
        echo "✅ Found Python $PYTHON_VERSION"
        
        # Check if Python version is compatible (3.8-3.12 recommended)
        PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
        PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
        
        if [[ $PYTHON_MAJOR -eq 3 ]] && [[ $PYTHON_MINOR -ge 8 ]] && [[ $PYTHON_MINOR -le 12 ]]; then
            echo "✅ Python version is compatible"
        else
            echo "⚠️  Warning: Python $PYTHON_VERSION may have compatibility issues. Python 3.8-3.12 recommended."
            read -p "Continue anyway? (y/N): " confirm
            if [[ ! $confirm =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    else
        echo "❌ Python 3 is not installed. Please install Python 3.8-3.12 first."
        exit 1
    fi
}

# Function to check Node.js
check_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        echo "✅ Found Node.js $NODE_VERSION"
    else
        echo "❌ Node.js is not installed. Please install Node.js 16+ first."
        echo "   Visit: https://nodejs.org/"
        exit 1
    fi
    
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        echo "✅ Found npm $NPM_VERSION"
    else
        echo "❌ npm is not installed. Please install npm first."
        exit 1
    fi
}

# Function to setup backend
setup_backend() {
    echo ""
    echo "🐍 Setting up backend..."
    cd backend
    
    # Create virtual environment if it doesn't exist
    if [[ ! -d "venv" ]]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install requirements with error handling
    echo "Installing Python dependencies..."
    if ! pip install -r requirements.txt; then
        echo "❌ Failed to install Python dependencies."
        echo "Trying with alternative versions..."
        
        # Try with more flexible versions
        pip install fastapi uvicorn websockets python-multipart watchdog "pydantic>=2.6.0,<3.0"
        
        if [[ $? -ne 0 ]]; then
            echo "❌ Still failed. Please check your Python version and try manually:"
            echo "   cd backend && source venv/bin/activate && pip install -r requirements.txt"
            exit 1
        fi
    fi
    
    echo "✅ Backend dependencies installed successfully"
    cd ..
}

# Function to setup frontend
setup_frontend() {
    echo ""
    echo "⚛️  Setting up frontend..."
    cd frontend
    
    # Install npm dependencies
    echo "Installing Node.js dependencies..."
    if ! npm install; then
        echo "❌ Failed to install Node.js dependencies. Trying npm ci..."
        if ! npm ci; then
            echo "❌ Still failed. Please check your Node.js version and network connection."
            exit 1
        fi
    fi
    
    echo "✅ Frontend dependencies installed successfully"
    cd ..
}

# Function to test backend
test_backend() {
    echo ""
    echo "🧪 Testing backend..."
    cd backend
    source venv/bin/activate
    
    # Test the AX25 parser
    python3 -c "
from ax25_parser import AX25Parser
parser = AX25Parser()
print('✅ AX25 parser imported successfully')

# Test with a sample log file if available
import os
test_files = ['../../listen-today.log', '../../short.log', '../../listen.log']
for test_file in test_files:
    if os.path.exists(test_file):
        topology = parser.parse_file(test_file)
        print(f'✅ Successfully parsed {test_file}: {len(topology.nodes)} nodes, {len(topology.hearable_nodes)} hearable')
        break
else:
    print('ℹ️  No test log files found, but parser works')
    "
    
    if [[ $? -eq 0 ]]; then
        echo "✅ Backend test passed"
    else
        echo "❌ Backend test failed"
        exit 1
    fi
    
    cd ..
}

# Function to show how to run the application
show_instructions() {
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "📋 To start the application:"
    echo ""
    echo "1️⃣  Start the backend (in one terminal):"
    echo "   cd backend"
    echo "   source venv/bin/activate"
    echo "   python main.py"
    echo ""
    echo "2️⃣  Start the frontend (in another terminal):"
    echo "   cd frontend"
    echo "   npm start"
    echo ""
    echo "🌐 The application will be available at:"
    echo "   • Frontend: http://localhost:3000"
    echo "   • Backend API: http://localhost:8000"
    echo "   • API Docs: http://localhost:8000/docs"
    echo ""
    echo "⚙️  Configuration:"
    echo "   1. Open http://localhost:3000"
    echo "   2. Go to Configuration"
    echo "   3. Set your AX25 log file path"
    echo "   4. Save and view your network!"
    echo ""
}

# Main setup flow
main() {
    echo "Welcome to the AX25 Network Visualizer setup!"
    echo "This script will set up the backend and frontend dependencies."
    echo ""
    
    # Check if we're in the right directory
    if [[ ! -f "docker-compose.yml" ]] || [[ ! -d "backend" ]] || [[ ! -d "frontend" ]]; then
        echo "❌ Please run this script from the ax25-web directory."
        echo "   Expected structure: ax25-web/backend, ax25-web/frontend"
        exit 1
    fi
    
    check_python
    check_nodejs
    setup_backend
    setup_frontend
    test_backend
    show_instructions
}

# Run main function
main

echo "🚀 Setup complete! Follow the instructions above to start the application."