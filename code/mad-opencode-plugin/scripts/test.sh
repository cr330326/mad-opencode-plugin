#!/bin/bash
# MAD OpenCode Plugin - Test Script

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
echo -e "${BLUE}  MAD OpenCode Plugin - Tests${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# Check if dist exists
if [ ! -d "$SCRIPT_DIR/dist" ]; then
    echo -e "${YELLOW}🔨 Building first...${NC}"
    cd "$SCRIPT_DIR"
    npm run build
    echo ""
fi

# Set test environment variables
export MAD_SERVER_URL="http://localhost:3000"
export MAD_API_KEY="test-key"
export MAD_CLIENT_NAME="test-client"
export MAD_DEBUG="1"

echo -e "${CYAN}🧪 Running plugin tests...${NC}"
echo ""

# Run the verification
cd "$SCRIPT_DIR"
node test-plugin.mjs 2>&1

echo ""
echo -e "${GREEN}✨ All tests passed!${NC}"
