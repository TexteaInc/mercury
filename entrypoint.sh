#!/bin/bash

# Script to launch Mercury app with secrets handling
echo "Starting Mercury app with secrets handling..."

# Check if running with Docker Compose
if [ -f "/run/secrets/secret_key" ]; then
  echo "Docker Compose detected, reading secrets from files..."
  export SECRET_KEY=$(cat /run/secrets/secret_key)
  
  if [ -f "/run/secrets/openai_api_key" ]; then
    export OPENAI_API_KEY=$(cat /run/secrets/openai_api_key)
    echo $OPENAI_API_KEY
    echo "OpenAI API key loaded from secrets"
  else
    echo "Warning: openai_api_key secret not found"
  fi
else
  # Local development mode, check if .env exists
  echo "Local environment detected"
  if [ -f ".env" ]; then
    echo "Loading variables from .env file"
    source .env
  else
    echo "Warning: .env file not found"
  fi
fi

# Launch the server
echo "Launching server..."
python server.py "$@"