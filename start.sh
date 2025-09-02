#!/bin/bash
# Startup script for ChatVisCode: launches both server and client with dependency checks

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 22+ first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.12+ first."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
fi

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ uv is not installed. Please install uv (https://github.com/astral-sh/uv) first."
    exit 1
fi

# Install backend dependencies
echo "Installing backend dependencies..."
cd server
if [ ! -d ".venv" ]; then
    uv sync
fi
cd ..

# Build Python runner image
echo "Building Python runner image..."
cd server/docker
if [ -z "$(docker images -q python-runner)" ]; then
    docker build -f PythonRunnerDockerfile -t python-runner .
fi
cd ..
cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd client
if [ ! -d "node_modules" ]; then
    pnpm install
fi
cd ..

# Start backend in background
echo "Starting backend server on http://localhost:8000..."
cd server
uv run uvicorn main:app --reload &
BACKEND_PID=$!
cd ..

# Start frontend
echo "Starting frontend server on http://localhost:3000..."
cd client
pnpm dev &
FRONTEND_PID=$!
cd ..

echo "Both server and client are running. Press Ctrl+C to stop."

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for background jobs
wait $SERVER_PID $CLIENT_PID
