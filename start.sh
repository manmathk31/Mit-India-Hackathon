#!/bin/bash

# Default port for Orchestrator if Render doesn't inject it
PORT="${PORT:-10000}"

echo "Starting Java Cost Agent on port 8082..."
java -jar cost-agent-spring-ai/target/*.jar --server.port=8082 &
JAVA_PID=$!

echo "Starting Python Document Agent on port 8001..."
cd document_agent && uvicorn main:app --host 127.0.0.1 --port 8001 &
DOC_PID=$!
cd ..

echo "Starting Python Image Agent on port 8002..."
cd image_agent && uvicorn main:app --host 127.0.0.1 --port 8002 &
IMG_PID=$!
cd ..

echo "Starting Python Orchestrator on port $PORT..."
uvicorn orchestrator.main:app --host 0.0.0.0 --port $PORT

# If the orchestrator dies, kill the background processes
kill $JAVA_PID $DOC_PID $IMG_PID
