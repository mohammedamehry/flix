# Production Deployment Guide

This guide describes how to deploy your Anti-Netflix app to an AWS EC2 instance (Ubuntu) and link it to your custom domain with SSL (HTTPS).

## 1. Prerequisites
- **AWS Account**: Launch an EC2 instance (Ubuntu 22.04 LTS recommended).
- **Domain Name**: Access to your domain's DNS settings (e.g., Namecheap, Cloudflare, Route53).
- **SSH Key**: To connect to your EC2 instance.

## 2. Infrastructure Setup (AWS)
1.  **Launch Instance**: Select `t3.micro` (free tier eligible) or `t3.small` if you expect heavy traffic.
2.  **Security Group**: Allow the following inbound traffic:
    -   SSH (22)
    -   HTTP (80)
    -   HTTPS (443)
    -   Node.js (3000) - *Optional, for testing only. Not needed if using Nginx.*

## 3. Server Configuration (SSH into EC2)
Connect to your instance:
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip-address
```

### Install Node.js (via NVM)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

### Install PM2 (Process Manager)
PM2 keeps your app running forever and restarts it on crashes/reboots.
```bash
npm install -g pm2
```

## 4. Application Setup
Clone your repository or upload your files to `/var/www/anti-netflix` (or `~/anti-netflix`).
For this example, we assume you copied the files to `~/anti-netflix`.

```bash
cd ~/anti-netflix
npm install --production
```

### Start the App with PM2
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
# Run the command displayed by 'pm2 startup' to freeze the process list on reboot
```

## 5. Reverse Proxy Setup (Nginx)
We use Nginx to forward port 80/443 traffic to your Node app running on port 3000.

### Install Nginx
```bash
sudo apt update
sudo apt install nginx -y
```

### Configure Nginx
Create a new configuration file for your site:
```bash
sudo nano /etc/nginx/sites-available/anti-netflix
```

Paste the following configuration (replace `yourdomain.com` with your actual domain):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/anti-netflix /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site
sudo nginx -t  # Test config
sudo systemctl restart nginx
```

## 6. DNS Setup
Go to your domain registrar (e.g., Namecheap, Cloudflare) and create **A Records**:
-   **Type**: A | **Name**: @ | **Value**: `YOUR_EC2_PUBLIC_IP`
-   **Type**: A | **Name**: www | **Value**: `YOUR_EC2_PUBLIC_IP`

Wait a few minutes for propagation. You should now be able to visit `http://yourdomain.com`.

## 7. SSL Setup (HTTPS)
Secure your site with a free Let's Encrypt certificate using Certbot.

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Follow the prompts (enter email, agree to TOS). Certbot will automatically update your Nginx config to force HTTPS.

**Success!** Your app is now live at `https://yourdomain.com`.
