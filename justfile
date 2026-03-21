# DocMind Desktop — Desktop-Frontend fuer RAG-Wissen
# Electron + React + TS + Qdrant Sidecar

# === Standard Tasks ===
setup:
    npm install && ./scripts/download-qdrant.sh

dev:
    npx concurrently "npm run dev:vite" "npm run dev:electron"

dev-vite:
    npm run dev:vite

dev-electron:
    npm run build:preload && npx wait-on http://localhost:5173 && npx electron .

# === Quality Gate ===
tier1:
    npx tsc --noEmit
    npx tsc -p tsconfig.main.json --noEmit

tier2:
    npx vitest run

test: tier1 tier2

test-all: tier1 tier2

# === Build ===
build:
    npm run build

package:
    npm run build && npx electron-builder -m

# === Health ===
health:
    @echo "Desktop app — no health endpoint. Run 'just dev' to start."
