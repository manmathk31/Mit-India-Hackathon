#!/bin/bash

# Default port for Orchestrator if Render doesn't inject it
PORT="${PORT:-10000}"
export PYTHONPATH="/app"

echo "Starting Java Cost Agent on port 8082..."
cd /app
java -jar cost-agent-spring-ai/target/*.jar --server.port=8082 &
JAVA_PID=$!

echo "Starting Python Document Agent on port 8001..."
uvicorn document_agent.main:app --host 0.0.0.0 --port 8001 &
DOC_PID=$!

echo "Starting Python Image Agent on port 8002..."
uvicorn image_agent.main:app --host 0.0.0.0 --port 8002 &
IMG_PID=$!

echo "Starting Python Orchestrator on port $PORT..."
uvicorn orchestrator.main:app --host 0.0.0.0 --port $PORT

# If the orchestrator dies, kill the background processes
kill $JAVA_PID $DOC_PID $IMG_PID
