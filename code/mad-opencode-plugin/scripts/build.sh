#!/bin/bash
# MAD OpenCode Plugin - Build Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  MAD OpenCode Plugin Build${NC}"
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

# Clean previous build
echo -e "${YELLOW}🧹 Cleaning previous build...${NC}"
cd "$SCRIPT_DIR"
npm run clean
echo -e "${GREEN}✅ Clean complete${NC}"
echo ""

# Build
echo -e "${YELLOW}🔨 Building plugin...${NC}"
npm run build
echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Show output
echo -e "${BLUE}📦 Build output:${NC}"
ls -lh "$SCRIPT_DIR/dist/"/*.js 2>/dev/null | awk '{printf "  • %s (%s)\n", $9, $5}'
echo ""

echo -e "${GREEN}✨ Build successful!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  • Run tests:    ./scripts/test.sh"
echo "  • Dev mode:     ./scripts/dev.sh"
echo "  • Install:      npm install -g ."
