# 🚀 Deploy HeyJarvis on heyjarvis.ai Domain

## Why Deploy on Your Own Domain?

**Vercel Limits You're Avoiding:**
- ❌ Function execution time limits (10s Hobby, 60s Pro)
- ❌ Function invocation limits (100K/month Hobby)
- ❌ Bandwidth limits (100GB Hobby)
- ❌ Build time limits
- ❌ Cold start delays

**Benefits of Own Domain:**
- ✅ Unlimited API calls and processing time
- ✅ Always-on background processes
- ✅ Full database control
- ✅ Custom SSL and domain control
- ✅ Better performance (no cold starts)

## 🎯 Recommended: DigitalOcean Droplet Setup

### Step 1: Create Server
```bash
# Create a $6/month droplet with:
# - Ubuntu 24.04 (LTS) x64  ← Choose this version
# - 1GB RAM, 1 vCPU
# - 25GB SSD
```

### Step 2: Initial Server Setup
```bash
# Connect via SSH
ssh root@your_server_ip

# Update system
apt update && apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install Nginx for reverse proxy
apt install nginx -y

# Install Certbot for SSL
apt install certbot python3-certbot-nginx -y
```

### Step 3: Deploy Your Application
```bash
# Clone your repository
git clone https://github.com/yourusername/HeyJarvis.git
cd HeyJarvis

# Install dependencies
npm install

# Build the application
npm run build

# Set up environment variables
nano .env
```

### Step 4: Environment Variables
Create `.env` file with:
```env
NODE_ENV=production
PORT=3000
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_BOT_TOKEN=your_bot_token
SLACK_SIGNING_SECRET=your_signing_secret
SLACK_REDIRECT_URI=https://heyjarvis.ai/api/auth/slack/callback
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### Step 5: Configure Nginx
```bash
# Create Nginx config
nano /etc/nginx/sites-available/heyjarvis.ai
```

```nginx
server {
    listen 80;
    server_name heyjarvis.ai www.heyjarvis.ai;

    # Serve static files
    location / {
        root /root/HeyJarvis/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Node.js
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
ln -s /etc/nginx/sites-available/heyjarvis.ai /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```


#### If using GoDaddy domain with external hosting:
1. **Log into GoDaddy Domain Manager**
2. **Go to**: DNS Management for heyjarvis.ai
3. **Update A Records**:
   ```
   Type: A, Name: @, Value: your_server_ip, TTL: 1 Hour
   Type: A, Name: www, Value: your_server_ip, TTL: 1 Hour
   ```
4. **Save changes** (propagation takes 1-24 hours)

#### If using other domain provider:
Point your domain to the server:
```
A Record: heyjarvis.ai → your_server_ip
A Record: www.heyjarvis.ai → your_server_ip
```

### Step 7: SSL Certificate
```bash
# Get free SSL certificate
certbot --nginx -d heyjarvis.ai -d www.heyjarvis.ai
```

### Step 8: Start Application with PM2
```bash
# Create ecosystem file
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'heyjarvis-api',
    script: 'api/auth/slack/index.js',
    cwd: '/root/HeyJarvis',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

```bash
# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔄 Alternative: Railway Deployment

Railway is a modern alternative to Vercel with better limits:

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
railway login
```

### 2. Deploy
```bash
railway init
railway up
```

### 3. Configure Domain
```bash
railway domain add heyjarvis.ai
```

**Railway Benefits:**
- ✅ $5/month for hobby projects
- ✅ No function time limits
- ✅ Built-in database support
- ✅ Easy custom domain setup
- ✅ Automatic SSL

## 🔧 Update Slack App Configuration

After deploying to heyjarvis.ai, update your Slack app:

1. **Go to**: [api.slack.com/apps](https://api.slack.com/apps)
2. **Select**: Your HeyJarvis app
3. **OAuth & Permissions** → Redirect URLs:
   ```
   https://heyjarvis.ai/api/auth/slack/callback
   ```
4. **Save Changes**

## 🎯 Cost Comparison

| Platform | Cost/Month | Limits | Notes |
|----------|------------|--------|-------|
| Vercel Hobby | $0 | 100K invocations, 10s timeout | Current limits |
| Vercel Pro | $20 | 1M invocations, 60s timeout | Still limited |
| **GoDaddy VPS** | **$15-30** | **Unlimited** | **Can use existing domain** |
| **DigitalOcean** | **$6** | **Unlimited** | **Best value** |
| **GoDaddy Domain + DO** | **$6** | **Unlimited** | **Keep heyjarvis.ai domain** |
| Railway | $5 | Much higher limits | Easy deployment |
| AWS EC2 t3.micro | $8-10 | Unlimited | More complex setup |

## 🚀 Next Steps

1. **Choose Platform**: DigitalOcean recommended for full control
2. **Set up Server**: Follow the setup guide above
3. **Configure DNS**: Point heyjarvis.ai to your server
4. **Deploy Code**: Upload and configure your application
5. **Update Slack**: Change OAuth redirect URLs
6. **Test Everything**: Ensure all functionality works

Your HeyJarvis platform will have unlimited processing power and no function timeouts on your own domain! 🎉
