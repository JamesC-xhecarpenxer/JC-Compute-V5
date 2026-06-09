#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# UniStack — Apple M1 / Apple Silicon Setup Script
# ─────────────────────────────────────────────────────────────────────────────
# Run once: bash setup-m1.sh
# Then start the server: npm start
# ─────────────────────────────────────────────────────────────────────────────

set -e

BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

info()  { echo -e "${CYAN}▸ $*${RESET}"; }
ok()    { echo -e "${GREEN}✓ $*${RESET}"; }
warn()  { echo -e "${YELLOW}⚠ $*${RESET}"; }
err()   { echo -e "${RED}✗ $*${RESET}"; exit 1; }
header(){ echo -e "\n${BOLD}${CYAN}── $* ──${RESET}\n"; }

header "UniStack M1 Setup"

# ── 1. Architecture check ─────────────────────────────────────────────────────
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]]; then
  ok "Apple Silicon detected (arm64)"
elif [[ "$ARCH" == "x86_64" ]]; then
  warn "Intel Mac detected — script works but Metal GPU acceleration won't apply"
else
  warn "Unknown arch: $ARCH — proceeding anyway"
fi

# ── 2. Node.js check ──────────────────────────────────────────────────────────
info "Checking Node.js..."
if ! command -v node &>/dev/null; then
  err "Node.js not found. Install via: brew install node  or  https://nodejs.org"
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
MAJOR="${NODE_VER%%.*}"
if [[ "$MAJOR" -lt 18 ]]; then
  err "Node.js 18+ required (found $NODE_VER). Run: brew upgrade node"
fi
ok "Node.js $NODE_VER"

# ── 3. npm install ────────────────────────────────────────────────────────────
info "Installing npm dependencies..."
npm install --prefer-offline 2>&1 | tail -3
ok "Dependencies installed"

# ── 4. Ollama check ───────────────────────────────────────────────────────────
info "Checking Ollama..."
if ! command -v ollama &>/dev/null; then
  warn "Ollama not found."
  echo "  Install with:  brew install ollama"
  echo "  Or download:   https://ollama.com/download/mac"
  echo ""
  read -r -p "  Open ollama.com/download now? [y/N] " choice
  if [[ "$choice" =~ ^[Yy]$ ]]; then
    open "https://ollama.com/download/mac"
  fi
  echo ""
  warn "Re-run this script after installing Ollama."
  exit 0
fi
ok "Ollama found: $(ollama --version 2>/dev/null || echo 'version unknown')"

# ── 5. Start Ollama serve in background (if not already running) ──────────────
info "Checking Ollama server..."
if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  ok "Ollama is already running"
else
  info "Starting Ollama server in background..."
  nohup ollama serve > /tmp/ollama.log 2>&1 &
  sleep 2
  if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
    ok "Ollama server started (PID $!)"
  else
    warn "Ollama server may not have started. Check: tail /tmp/ollama.log"
  fi
fi

# ── 6. Pull models ────────────────────────────────────────────────────────────
header "Pulling models (Apple Silicon runs these natively via Metal)"

pull_model() {
  local model="$1"
  if ollama list 2>/dev/null | grep -q "^${model}"; then
    ok "$model already pulled"
  else
    info "Pulling $model... (this may take a few minutes)"
    ollama pull "$model"
    ok "$model pulled"
  fi
}

pull_model "mistral"
pull_model "llama3.2"

# ── 7. Write .env if missing ──────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  info "Creating .env..."
  cat > .env <<'EOF'
# UniStack local config
OLLAMA_HOST=http://localhost:11434
CHAT_MODEL=mistral
CHAT_MODEL_2=llama3.2
PORT=3000
EOF
  ok ".env created"
else
  ok ".env already exists"
fi

# ── 8. Done ───────────────────────────────────────────────────────────────────
header "Setup Complete"
echo -e "  ${BOLD}Start the server:${RESET}   npm start"
echo -e "  ${BOLD}Use the CLI:${RESET}        node src/cli.js domains"
echo -e "  ${BOLD}Run a pipeline:${RESET}     node src/cli.js run --domain distributed-robotics"
echo -e "  ${BOLD}Check Ollama:${RESET}       curl http://localhost:11434/api/tags"
echo -e "  ${BOLD}API chat test:${RESET}      curl -X POST http://localhost:3000/api/chat \\"
echo -e "                          -H 'Content-Type: application/json' \\"
echo -e "                          -d '{\"messages\":[{\"role\":\"user\",\"content\":\"What is the fixed-point operator?\"}]}'"
echo ""
