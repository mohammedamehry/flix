# Full EC2 Deployment Guide (Frontend + Backend)

This guide explains how to host **everything** (HTML/CSS/JS + Node.js Backend) on a single AWS EC2 instance. This is the simplest and most robust setup.

## Architecture
-   **Everything**: `http://ec2-xx-xx-xx-xx.compute-1.amazonaws.com:3000`
-   **Server**: Node.js (Express) serves both the API and the Static Files.

---

## Part 1: Server Setup (AWS EC2)

1.  **Launch an Instance**:
    -   Go to AWS Console -> EC2 -> Launch Instance.
    -   Choose **Ubuntu Server 24.04 LTS**.
    -   Instance Type: **t2.micro** (Free tier eligible).
    -   **Security Group**: Allow **SSH (22)** and **Custom TCP (3000)**.

2.  **Connect to Instance**:
    ```bash
    chmod 400 your-key.pem
    ssh -i your-key.pem ubuntu@your-ec2-public-ip
    ```

3.  **Install Node.js**:
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    sudo npm install -g pm2
    ```

---

## Part 2: Deploy Code

1.  **Prepare Files Locally**:
    -   Ensure your project folder contains everything (`server.js`, `package.json`, `index.html`, `js/`, `css/`, etc.).
    -   **Important**: `config.js` is already configured to use `window.location.origin`, so **no manual IP changes are needed!**

2.  **Upload to EC2**:
    *Option A: Git Clone (Fastest)*
    -   `git clone https://github.com/yourusername/your-repo.git`
    -   `cd your-repo`
    
    *Option B: SCP / FileZilla*
    -   Upload the entire project folder to `/home/ubuntu/anti_netflix`.

3.  **Start Server**:
    ```bash
    cd your-project-folder
    npm install
    
    # Start with PM2 (Process Manager)
    pm2 start server.js --name "myflix"
    
    # Save to auto-start on reboot
    pm2 save
    pm2 startup
    ```

---

## Part 3: Access Your Site

1.  Open your browser.
2.  Go to: `http://your-ec2-ip:3000`
3.  That's it! Your site is live.

---

## Optional: Setup Domain & HTTPS (Production)

If you want a real domain (`myflix.com`) instead of an IP:
1.  **Point Domain**: Add an 'A Record' in your DNS pointing to your EC2 Public IP.
2.  **Install Nginx**:
    ```bash
    sudo apt install nginx -y
    ```
3.  **Configure Nginx proxy**:
    Edit `/etc/nginx/sites-available/default`:
    ```nginx
    server {
        listen 80;
        server_name myflix.com www.myflix.com;

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
    Restart: `sudo systemctl restart nginx`
4.  **SSL (HTTPS)**:
    ```bash
    sudo apt install certbot python3-certbot-nginx
    sudo certbot --nginx -d myflix.com
    ```
