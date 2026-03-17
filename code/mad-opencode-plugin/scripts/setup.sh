#!/bin/bash
# MAD OpenCode Plugin - Local Setup Script

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

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  MAD OpenCode Plugin - Local Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Build the plugin
echo -e "${CYAN}📦 Step 1: Build the plugin${NC}"
echo -e "${CYAN}─────────────────────────────────────────${NC}"
cd "$SCRIPT_DIR"
npm run build
echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Step 2: Create global symlink
echo -e "${CYAN}🔗 Step 2: Create global npm link${NC}"
echo -e "${CYAN}─────────────────────────────────────────${NC}"
cd "$SCRIPT_DIR"
npm link
echo -e "${GREEN}✅ Plugin linked globally as @mad/opencode-plugin${NC}"
echo ""

# Step 3: Check OpenCode config location
echo -e "${CYAN}📂 Step 3: Check OpenCode configuration${NC}"
echo -e "${CYAN}─────────────────────────────────────────${NC}"

# Possible OpenCode config locations
CONFIG_LOCATIONS=(
    "$HOME/.config/opencode/opencode.json"
    "$HOME/.config/opencode/config.json"
    "$HOME/.opencode/config.json"
)

OPENCODE_CONFIG=""
for loc in "${CONFIG_LOCATIONS[@]}"; do
    if [ -f "$loc" ]; then
        OPENCODE_CONFIG="$loc"
        break
    fi
done

if [ -z "$OPENCODE_CONFIG" ]; then
    echo -e "${YELLOW}⚠️  OpenCode config not found in standard locations${NC}"
    echo ""
    echo -e "${YELLOW}Creating config at: $HOME/.config/opencode/opencode.json${NC}"
    mkdir -p "$HOME/.config/opencode"
    cat > "$HOME/.config/opencode/opencode.json" << 'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@mad/opencode-plugin"],
  "agent": {
    "explore": { "tools": { "task": true } },
    "general": { "tools": { "task": true } }
  }
}
EOF
    OPENCODE_CONFIG="$HOME/.config/opencode/opencode.json"
    echo -e "${GREEN}✅ Config created${NC}"
else
    echo -e "${GREEN}✅ Found OpenCode config at: $OPENCODE_CONFIG${NC}"

    # Check if plugin is already configured
    if grep -q "@mad/opencode-plugin" "$OPENCODE_CONFIG" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Plugin already configured in OpenCode${NC}"
    else
        echo ""
        echo -e "${YELLOW}📝 Adding plugin to OpenCode config...${NC}"
        # Backup original config
        cp "$OPENCODE_CONFIG" "$OPENCODE_CONFIG.backup"
        # Add plugin to config (simple approach)
        if grep -q '"plugin"' "$OPENCODE_CONFIG"; then
            # Plugin array exists, append to it
            sed -i '' 's/"plugin": \[\([^]]*\)\]/"plugin": [\1, "@mad\/opencode-plugin"]/' "$OPENCODE_CONFIG"
        else
            # No plugin array, add it
            sed -i '' 's/}$/,\n  "plugin": ["@mad\/opencode-plugin"]\n}/' "$OPENCODE_CONFIG"
        fi
        echo -e "${GREEN}✅ Plugin added to config${NC}"
        echo -e "${YELLOW}   (Backup saved to $OPENCODE_CONFIG.backup)${NC}"
    fi
fi

echo ""

# Step 4: Environment variables
echo -e "${CYAN}🔧 Step 4: Environment Variables${NC}"
echo -e "${CYAN}─────────────────────────────────────────${NC}"
echo ""
echo -e "${YELLOW}You need to set these environment variables:${NC}"
echo ""
echo -e "  ${BLUE}export MAD_SERVER_URL=http://localhost:3000${NC}"
echo -e "  ${BLUE}export MAD_API_KEY=dev-key${NC}"
echo -e "  ${BLUE}export MAD_DEBUG=1${NC}  # Optional, for debug logging"
echo ""

# Check if MAD_SERVER_URL is already set
if [ -z "$MAD_SERVER_URL" ]; then
    echo -e "${YELLOW}💡 Tip: Add these to your ~/.zshrc or ~/.bashrc:${NC}"
    echo ""
    echo '  # MAD OpenCode Plugin'
    echo '  export MAD_SERVER_URL=http://localhost:3000'
    echo '  export MAD_API_KEY=dev-key'
    echo '  export MAD_DEBUG=1  # Optional'
else
    echo -e "${GREEN}✅ MAD_SERVER_URL is already set${NC}"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✨ Setup Complete! ✨${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Make sure MAD Server is running (or skip for testing)"
echo "  2. Start OpenCode in a new terminal session"
echo "  3. The plugin will automatically load and start syncing"
echo ""
echo -e "${BLUE}To uninstall:${NC}"
echo "  npm unlink -g @mad/opencode-plugin"
echo "  Remove plugin from OpenCode config"
echo ""
