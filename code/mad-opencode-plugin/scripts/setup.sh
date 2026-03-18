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
cd "$SCRIPT_DIR/.."
npm run build
echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Step 2: Create plugin package
echo -e "${CYAN}📦 Step 2: Create plugin package${NC}"
echo -e "${CYAN}─────────────────────────────────────────${NC}"
cd "$SCRIPT_DIR/.."
npm pack >/dev/null 2>&1
TARBALL=$(ls mad-opencode-plugin-*.tgz 2>/dev/null | head -1)
echo -e "${GREEN}✅ Created package: $TARBALL${NC}"
echo ""

# Step 3: Install to OpenCode cache directory
echo -e "${CYAN}📂 Step 3: Install to OpenCode cache${NC}"
echo -e "${CYAN}─────────────────────────────────────────${NC}"

PLUGIN_CACHE_DIR="$HOME/.cache/opencode/node_modules/@mad"
mkdir -p "$PLUGIN_CACHE_DIR"

# Remove old installation if exists
if [ -d "$PLUGIN_CACHE_DIR/opencode-plugin" ]; then
    echo -e "${YELLOW}🧹 Removing old installation...${NC}"
    rm -rf "$PLUGIN_CACHE_DIR/opencode-plugin"
fi

# Extract tarball
tar -xzf "$TARBALL" -C "$PLUGIN_CACHE_DIR"
mv "$PLUGIN_CACHE_DIR/package" "$PLUGIN_CACHE_DIR/opencode-plugin"

# Install dependencies
cd "$PLUGIN_CACHE_DIR/opencode-plugin"
npm install >/dev/null 2>&1

echo -e "${GREEN}✅ Plugin installed to: $PLUGIN_CACHE_DIR/opencode-plugin${NC}"
echo ""

# Step 4: Configure OpenCode
echo -e "${CYAN}⚙️  Step 4: Configure OpenCode${NC}"
echo -e "${CYAN}─────────────────────────────────────────${NC}"

# Use opencode.json (not config.json)
OPENCODE_CONFIG="$HOME/.config/opencode/opencode.json"
PLUGIN_PATH="file://$PLUGIN_CACHE_DIR/opencode-plugin"

if [ ! -f "$OPENCODE_CONFIG" ]; then
    echo -e "${YELLOW}⚠️  OpenCode config not found${NC}"
    echo ""
    echo -e "${YELLOW}Creating config at: $OPENCODE_CONFIG${NC}"
    mkdir -p "$(dirname "$OPENCODE_CONFIG")"
    cat > "$OPENCODE_CONFIG" << EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "plugin": ["$PLUGIN_PATH"]
}
EOF
    echo -e "${GREEN}✅ Config created${NC}"
else
    echo -e "${GREEN}✅ Found OpenCode config at: $OPENCODE_CONFIG${NC}"

    # Check if plugin is already configured with local path
    if grep -q "file://.*opencode-plugin" "$OPENCODE_CONFIG" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Plugin already configured with local path${NC}"
    else
        echo ""
        echo -e "${YELLOW}📝 Updating plugin configuration to use local path...${NC}"
        # Backup original config
        cp "$OPENCODE_CONFIG" "$OPENCODE_CONFIG.backup.$(date +%s)"

        # Update plugin path using python for proper JSON handling
        python3 << PYTHON
import json

with open('$OPENCODE_CONFIG', 'r') as f:
    config = json.load(f)

# Update or add plugin array with local path
plugins = config.get('plugin', [])
# Remove any existing @mad/opencode-plugin entries
plugins = [p for p in plugins if '@mad/opencode-plugin' not in str(p)]
# Add local path
plugins.append('$PLUGIN_PATH')
config['plugin'] = plugins

with open('$OPENCODE_CONFIG', 'w') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

print("✅ Plugin configuration updated")
PYTHON
        echo -e "${GREEN}✅ Plugin config updated${NC}"
        echo -e "${YELLOW}   (Backup saved)${NC}"
    fi
fi

echo ""

# Step 5: Environment variables
echo -e "${CYAN}🔧 Step 5: Environment Variables${NC}"
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
echo "  3. Check plugin logs: cat /tmp/mad-plugin.log"
echo ""
echo -e "${BLUE}To uninstall:${NC}"
echo "  rm -rf ~/.cache/opencode/node_modules/@mad"
echo "  Remove plugin from OpenCode config"
echo ""
