#!/bin/bash
# =============================================================================
# Docmind Desktop: Thin Python Venv Setup
# =============================================================================
# Creates a minimal Python venv for the RAG-Wissen API sidecar.
# Uses requirements-api.txt (~100 MB) instead of full requirements.txt (~4+ GB).
# Embeddings are handled via Ollama HTTP API (EMBEDDING_PROVIDER=ollama).
#
# Usage:
#   ./scripts/setup-python-venv.sh
#   RAG_WISSEN_PATH=/path/to/rag-wissen ./scripts/setup-python-venv.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="${PROJECT_DIR}/python-venv"
RAG_WISSEN_DIR="${RAG_WISSEN_PATH:-${HOME}/projects/rag-wissen}"
REQUIREMENTS="${RAG_WISSEN_DIR}/requirements-api.txt"

echo "=== Docmind Desktop: Python Venv Setup ==="
echo "Venv:         ${VENV_DIR}"
echo "RAG-Wissen:   ${RAG_WISSEN_DIR}"
echo "Requirements: ${REQUIREMENTS}"
echo ""

# Validate
if [ ! -f "${REQUIREMENTS}" ]; then
  echo "ERROR: ${REQUIREMENTS} not found."
  echo "Make sure RAG_WISSEN_PATH points to the rag-wissen repository."
  exit 1
fi

# Remove existing venv if present
if [ -d "${VENV_DIR}" ]; then
  echo "Removing existing venv..."
  rm -rf "${VENV_DIR}"
fi

# Create fresh venv
echo "Creating Python venv..."
python3 -m venv "${VENV_DIR}"

# Activate and install
echo "Installing thin API dependencies..."
# shellcheck disable=SC1091
source "${VENV_DIR}/bin/activate"
pip install --upgrade pip --quiet
pip install -r "${REQUIREMENTS}" --quiet

echo ""
echo "=== Venv ready ==="
echo "Size:     $(du -sh "${VENV_DIR}" | cut -f1)"
echo "Packages: $(pip list --format=columns 2>/dev/null | tail -n +3 | wc -l | tr -d ' ')"
echo "Python:   $(python3 --version)"
echo ""
echo "To use: ${VENV_DIR}/bin/python3 -m uvicorn src.api_server:app --port 8001"
