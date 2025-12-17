
# VPS Deployment Guide - Wordlist Trainer

## 📋 Information
- **App**: Wordlist Trainer (Node.js + React)
- **Domain**: `wordlist.magiostudios.com`
- **Port**: `5010` (Production)
- **Repo**: `git@github.com:DrokRhys/wordlist-trainer.git`
- **Path**: `/var/www/wordlist-trainer`

## 🚀 Deployment Steps (Assistant)

### 1. Prepare Directory & Clone
SSH into the VPS (`drok-webhost-prod`) and prepare the directory:

```bash
# Go to web root
cd /var/www

# Clone repository
git clone git@github.com:DrokRhys/wordlist-trainer.git wordlist-trainer

# Enter directory
cd wordlist-trainer
```

### 2. Install & Build
Install dependencies for both root, server, and client, then build the application.

```bash
# Install all dependencies (recursive)
npm install
cd client && npm install
cd ../server && npm install
cd ..

# Build application (Server TS -> JS, Client React -> Static dist)
npm run build
```

### 3. Setup PM2
Start the application using the process manager.

```bash
# Start/Restart process
pm2 start ecosystem.config.js

# Save PM2 list to survive reboot
pm2 save
```

### 4. Setup Nginx Reverse Proxy
Create the Nginx configuration file.

**File:** `/etc/nginx/sites-available/wordlist`

```nginx
server {
    server_name wordlist.magiostudios.com;

    location / {
        proxy_pass http://localhost:5010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and test configuration:

```bash
ln -s /etc/nginx/sites-available/wordlist /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 5. Setup SSL (HTTPS)
Generate the SSL certificate using Certbot.

```bash
certbot --nginx -d wordlist.magiostudios.com --non-interactive --agree-tos --email magiostudios.team@gmail.com
```

### 6. Setup Cloudflare DNS
Go to the Cloudflare Dashboard for `magiostudios.com` and add a new record:

- **Type**: `A`
- **Name**: `wordlist`
- **IPv4 address**: `91.99.234.71`
- **Proxy status**: `Proxied (Orange Cloud)`

## ✅ Verification
- Visit: https://wordlist.magiostudios.com
- Check logs: `pm2 logs wordlist-trainer-production`
