#!/bin/bash
# MAD OpenCode Plugin - Build & Test Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  MAD OpenCode Plugin - Build & Test${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Get the script directory path
SCRIPTS_DIR="$SCRIPT_DIR"

# Run build
echo -e "${CYAN}📦 Step 1: Build${NC}"
echo -e "${CYAN}─────────────────────────────────${NC}"
bash "$SCRIPTS_DIR/build.sh"
echo ""

# Run tests
echo -e "${CYAN}🧪 Step 2: Test${NC}"
echo -e "${CYAN}─────────────────────────────────${NC}"
bash "$SCRIPTS_DIR/test.sh"
echo ""

echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  ✨ Build & Test Complete! ✨${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
