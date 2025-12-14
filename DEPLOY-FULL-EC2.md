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
    -   **Security Group**: You must allow the following **Inbound Rules**:
        -   **SSH** (Port 22) -> Source: Only My IP (Recommended)
        -   **HTTP** (Port 80) -> Source: Anywhere (0.0.0.0/0)
        -   **HTTPS** (Port 443) -> Source: Anywhere (0.0.0.0/0)
        -   **Custom TCP** (Port 3000) -> Source: Anywhere (0.0.0.0/0)

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
    -   `git clone https://github.com/mohammedamehry/flix.git`
    -   `cd flix`
    
    *Option B: SCP / FileZilla*
    -   Upload the entire project folder to `/home/ubuntu/anti_netflix`.

3.  **Start Server**:
    ```bash
    cd your-project-folder
    npm install
    
    # Start with PM2 (Process Manager)
    pm2 start server.js --name "flix"
    
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
    We need to tell Nginx to forward all traffic from port 80 (HTTP) to your Node.js app on port 3000.

    a. **Open the config file**:
    ```bash
    sudo nano /etc/nginx/sites-available/default
    ```

    b. **Delete existing content**:
    Use your arrow keys to scroll. You can hold `Ctrl + K` to cut/delete lines until the file is empty.

    c. **Paste the new configuration**:
    (Replace `myflix.com` with your actual domain, or use `_` if you don't have one yet)
    ```nginx
    server {
        listen 80;
        server_name flixmax.to www.flixmax.to;

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

    d. **Save and Exit**:
    -   Press `Ctrl + O`, then `Enter` (to save).
    -   Press `Ctrl + X` (to exit).

    e. **Test and Reload**:
    ```bash
    # Check for syntax errors
    sudo nginx -t
    
    # If it says "successful", reload Nginx
    sudo systemctl reload nginx
    ```
4.  **SSL (HTTPS)**:
    ```bash
    sudo apt install certbot python3-certbot-nginx
    sudo certbot --nginx -d flixmax.to
    ```

---

## Maintenance & Restarting

If you make changes to the code or if the server crashes, use these commands:

1.  **Restart the App (Node.js)**:
    ```bash
    pm2 restart flix
    ```

2.  **Restart the Web Server (Nginx)**:
    ```bash
    sudo systemctl restart nginx
    ```

3.  **Deploy New Changes (from GitHub)**:
    ```bash
    cd flix
    git pull
    pm2 restart flix
    ```