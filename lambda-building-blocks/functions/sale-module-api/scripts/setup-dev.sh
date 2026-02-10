#!/bin/bash
set -e

# Development Environment Setup Script
# This script helps set up the development environment quickly

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "=========================================="
echo "Sale Module API - Development Setup"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check Node.js
echo -e "${YELLOW}Checking Node.js installation...${NC}"
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js $NODE_VERSION installed${NC}"
else
    echo -e "${RED}✗ Node.js not found. Please install Node.js 18.x or higher${NC}"
    exit 1
fi

# Check npm
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm $NPM_VERSION installed${NC}"
else
    echo -e "${RED}✗ npm not found${NC}"
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_DIR"

# Install dependencies
echo ""
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Set up configuration files
echo ""
echo -e "${YELLOW}Setting up configuration files...${NC}"

if [ ! -d "config" ]; then
    mkdir -p config
fi

for env in dev staging production; do
    if [ ! -f "config/$env.env" ]; then
        cp "config/$env.env.example" "config/$env.env"
        echo -e "${GREEN}✓ Created config/$env.env from example${NC}"
        echo -e "${YELLOW}  → Please edit config/$env.env with your actual values${NC}"
    else
        echo -e "${GREEN}✓ config/$env.env already exists${NC}"
    fi
done

# Set up integration test config
if [ ! -f ".env.integration" ]; then
    cp ".env.integration.example" ".env.integration"
    echo -e "${GREEN}✓ Created .env.integration from example${NC}"
    echo -e "${YELLOW}  → Please edit .env.integration for integration tests${NC}"
else
    echo -e "${GREEN}✓ .env.integration already exists${NC}"
fi

# Set up SAM config
if [ ! -f "samconfig.toml" ]; then
    cp "samconfig.toml.example" "samconfig.toml"
    echo -e "${GREEN}✓ Created samconfig.toml from example${NC}"
    echo -e "${YELLOW}  → Please edit samconfig.toml with your AWS settings${NC}"
else
    echo -e "${GREEN}✓ samconfig.toml already exists${NC}"
fi

# Build project
echo ""
echo -e "${YELLOW}Building TypeScript project...${NC}"
npm run build
echo -e "${GREEN}✓ Build completed${NC}"

# Run tests
echo ""
echo -e "${YELLOW}Running tests...${NC}"
npm test
echo -e "${GREEN}✓ All tests passed${NC}"

# Check AWS CLI
echo ""
echo -e "${YELLOW}Checking AWS tools...${NC}"
if command -v aws >/dev/null 2>&1; then
    AWS_VERSION=$(aws --version)
    echo -e "${GREEN}✓ AWS CLI installed: $AWS_VERSION${NC}"
else
    echo -e "${YELLOW}⚠ AWS CLI not found. Install it for deployment: https://aws.amazon.com/cli/${NC}"
fi

# Check SAM CLI
if command -v sam >/dev/null 2>&1; then
    SAM_VERSION=$(sam --version)
    echo -e "${GREEN}✓ SAM CLI installed: $SAM_VERSION${NC}"
else
    echo -e "${YELLOW}⚠ SAM CLI not found. Install it for deployment: https://aws.amazon.com/serverless/sam/${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit configuration files in config/ directory"
echo "2. Configure AWS credentials: aws configure"
echo "3. Run tests: npm test"
echo "4. Start development: npm run watch"
echo "5. Deploy to dev: ./scripts/deploy.sh dev"
echo ""
echo "Documentation:"
echo "- Testing: see TESTING.md"
echo "- CI/CD: see CICD.md"
echo "- API: see README.md"
echo ""
