#!/bin/bash
# Download Qdrant binary for the current platform
# Run: ./scripts/download-qdrant.sh

set -euo pipefail

QDRANT_VERSION="1.16.3"
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Map platform to Qdrant release asset names
case "$OS" in
  darwin)
    case "$ARCH" in
      arm64|aarch64) ASSET="qdrant-aarch64-apple-darwin.tar.gz" ;;
      x86_64)        ASSET="qdrant-x86_64-apple-darwin.tar.gz" ;;
      *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    ;;
  linux)
    case "$ARCH" in
      x86_64|amd64)  ASSET="qdrant-x86_64-unknown-linux-gnu.tar.gz" ;;
      aarch64|arm64) ASSET="qdrant-aarch64-unknown-linux-gnu.tar.gz" ;;
      *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    ;;
  *)
    echo "Unsupported OS: $OS (use Docker or manual install on Windows)"
    exit 1
    ;;
esac

# Target directory
BIN_DIR="bin/$OS/$ARCH"
mkdir -p "$BIN_DIR"

# Check if already exists
if [ -f "$BIN_DIR/qdrant" ]; then
  EXISTING=$("$BIN_DIR/qdrant" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
  if [ "$EXISTING" = "$QDRANT_VERSION" ]; then
    echo "Qdrant v$QDRANT_VERSION already installed at $BIN_DIR/qdrant"
    exit 0
  fi
  echo "Updating Qdrant from v$EXISTING to v$QDRANT_VERSION..."
fi

URL="https://github.com/qdrant/qdrant/releases/download/v${QDRANT_VERSION}/${ASSET}"
echo "Downloading Qdrant v$QDRANT_VERSION..."
echo "  URL: $URL"
echo "  Target: $BIN_DIR/qdrant"

# Download and extract
curl -L -o "/tmp/$ASSET" "$URL"
tar -xzf "/tmp/$ASSET" -C /tmp/
mv /tmp/qdrant "$BIN_DIR/qdrant"
chmod +x "$BIN_DIR/qdrant"
rm -f "/tmp/$ASSET"

# Verify
"$BIN_DIR/qdrant" --version 2>/dev/null || echo "Warning: Could not verify qdrant binary"
echo "Done! Qdrant installed at $BIN_DIR/qdrant"
