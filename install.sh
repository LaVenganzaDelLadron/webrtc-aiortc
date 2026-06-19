#!/usr/bin/env bash
set -euo pipefail

echo "Setting up the WebRTC screen-sharing project..."

echo "Creating virtual environment..."
python3 -m venv .venv

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Upgrading pip..."
pip install --upgrade pip

echo "Installing dependencies..."
pip install -r requirements.txt

echo

echo "Setup complete."
echo "Run the following commands in separate terminals:"
echo "  source .venv/bin/activate"
echo "  python main.py"
echo "  python server.py"
echo "  python client.py"
