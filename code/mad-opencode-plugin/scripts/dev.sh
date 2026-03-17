#!/bin/bash
# MAD OpenCode Plugin - Development Mode Script

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

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  MAD OpenCode Plugin - Dev Mode${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# Check if node_modules exists
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    cd "$SCRIPT_DIR"
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    echo ""
fi

# Initial build
echo -e "${YELLOW}🔨 Initial build...${NC}"
cd "$SCRIPT_DIR"
npm run build
echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Start watch mode
echo -e "${CYAN}👀 Watching for file changes...${NC}"
echo -e "${CYAN}   Press Ctrl+C to stop${NC}"
echo ""

# Run tsc in watch mode
npx tsc --watch
