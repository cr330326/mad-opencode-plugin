.PHONY: all build dev test clean install help

# Default target
all: build

# Build the plugin
build:
	@echo "🔨 Building plugin..."
	@npm run build
	@echo "✅ Build complete"
	@echo ""
	@echo "📦 Build output:"
	@ls -lh dist/*.js 2>/dev/null | awk '{printf "  • %s (%s)\n", $$9, $$5}'

# Development mode (watch)
dev:
	@echo "👀 Starting development mode..."
	@npm run dev

# Run tests
test: build
	@echo "🧪 Running tests..."
	@node test-plugin.mjs

# Clean build artifacts
clean:
	@echo "🧹 Cleaning..."
	@npm run clean
	@echo "✅ Clean complete"

# Deep clean (including node_modules)
clean-deep: clean
	@echo "🧹 Removing node_modules..."
	@rm -rf node_modules
	@echo "✅ Deep clean complete"

# Install dependencies
install-deps:
	@echo "📦 Installing dependencies..."
	@npm install

# Run all checks (build + test)
check: build test
	@echo ""
	@echo "✨ All checks passed!"

# Watch mode for development
watch:
	@echo "👀 Watching for changes..."
	@npx tsc --watch

# Setup for local development
setup:
	@echo "🔧 Setting up local development environment..."
	@./scripts/setup.sh

# Show help
help:
	@echo "MAD OpenCode Plugin - Available Commands"
	@echo ""
	@echo "  make build      - Build the plugin"
	@echo "  make dev        - Start development mode (watch)"
	@echo "  make test       - Run tests"
	@echo "  make clean      - Clean build artifacts"
	@echo "  make clean-deep - Deep clean (including node_modules)"
	@echo "  make check      - Run all checks (build + test)"
	@echo "  make watch      - Watch for file changes"
	@echo "  make setup      - Setup for local development"
	@echo "  make help       - Show this help message"
	@echo ""
	@echo "Or use scripts directly:"
	@echo "  ./scripts/build.sh  - Build"
	@echo "  ./scripts/dev.sh    - Development mode"
	@echo "  ./scripts/test.sh   - Run tests"
	@echo "  ./scripts/clean.sh  - Clean"
	@echo "  ./scripts/all.sh    - Build & test"
	@echo "  ./scripts/setup.sh  - Local setup"
