#!/bin/bash

echo "🚀 Setting up HeyJarvis server..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 18+
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2 for process management
echo "📦 Installing PM2..."
npm install -g pm2

# Install Nginx
echo "📦 Installing Nginx..."
apt install nginx -y

# Install Certbot for SSL
echo "📦 Installing Certbot..."
apt install certbot python3-certbot-nginx -y

# Install Git
echo "📦 Installing Git..."
apt install git -y

# Create directory for app
echo "📁 Creating app directory..."
mkdir -p /var/www/heyjarvis
cd /var/www/heyjarvis

echo "✅ Server setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Clone your HeyJarvis repository"
echo "2. Install dependencies with 'npm install'"
echo "3. Set up environment variables"
echo "4. Configure Nginx"
echo "5. Start with PM2"
echo ""
echo "📍 Current directory: $(pwd)"
echo "📍 Node.js version: $(node --version)"
echo "📍 NPM version: $(npm --version)"
