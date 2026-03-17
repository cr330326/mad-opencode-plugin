#!/bin/bash
# MAD OpenCode Plugin - Clean Script

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
echo -e "${BLUE}  MAD OpenCode Plugin - Clean${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# Clean dist directory
if [ -d "$SCRIPT_DIR/dist" ]; then
    echo -e "${YELLOW}🧹 Removing dist/ directory...${NC}"
    cd "$SCRIPT_DIR"
    rm -rf dist
    echo -e "${GREEN}✅ dist/ removed${NC}"
else
    echo -e "${YELLOW}⚠️  dist/ directory does not exist${NC}"
fi

# Clean node_modules if --deep flag is provided
if [ "$1" = "--deep" ]; then
    echo ""
    echo -e "${YELLOW}🧹 Removing node_modules/...${NC}"
    cd "$SCRIPT_DIR"
    rm -rf node_modules
    echo -e "${GREEN}✅ node_modules/ removed${NC}"
fi

echo ""
echo -e "${GREEN}✨ Clean complete!${NC}"
