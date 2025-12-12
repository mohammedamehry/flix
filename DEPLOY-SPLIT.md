# Split Deployment Guide: GitHub Pages + AWS EC2

This guide explains how to host your **Frontend (HTML/CSS/JS)** on GitHub Pages and your **Backend (Node.js Proxy)** on an AWS EC2 instance (Ubuntu).

## Architecture
-   **Frontend**: `https://yourusername.github.io/repo-name` (Static Files)
-   **Backend**: `http://ec2-xx-xx-xx-xx.compute-1.amazonaws.com:3000` (Node.js API)
-   **Communication**: Frontend makes fetch requests to Backend.

---

## Part 1: Backend Setup (AWS EC2)

1.  **Launch an Instance**:
    -   Go to AWS Console -> EC2 -> Launch Instance.
    -   Choose **Ubuntu Server 24.04 LTS**.
    -   Instance Type: **t2.micro** (Free tier eligible).
    -   Key Pair: Create new (download `.pem` file) or use existing.
    -   **Security Group**: Allow **SSH (22)** and **Custom TCP (3000)** (for your API).

2.  **Connect to Instance**:
    ```bash
    chmod 400 your-key.pem
    ssh -i your-key.pem ubuntu@your-ec2-public-ip
    ```

3.  **Install Node.js & Dependencies**:
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    sudo npm install -g pm2
    ```

4.  **Deploy Code**:
    *Option A: Git Clone (Recommended)*
    -   Upload your code to a GitHub repo (separate from frontend if desired, or same).
    -   `git clone https://github.com/yourusername/your-repo.git`
    -   `cd your-repo`
    
    *Option B: SCP / SFTP*
    -   Copy `server.js`, `package.json` to the instance using FileZilla or `scp`.

5.  **Start Server**:
    ```bash
    cd your-project-folder
    npm install
    pm2 start server.js --name "proxy-api"
    pm2 save
    pm2 startup
    ```
    Your backend is now running at `http://your-ec2-ip:3000`.

---

## Part 2: Connect Frontend to Backend

1.  **Update Config**:
    Open `js/config.js` in your local project.
    Change `https://api.yourdomain.com` to your **EC2 Public IP and Port**.

    ```javascript
    const CONFIG = {
        BACKEND_URL: (window.location.hostname === 'localhost')
            ? 'http://localhost:3000'
            : 'http://12.34.56.78:3000' // REPLACE THIS with your EC2 IP
    };
    ```
    > **Note**: If your frontend is HTTPS (GitHub Pages defaults to HTTPS), and your backend is HTTP (EC2 default), you might face **Mixed Content Errors**.
    > **Solution**: You usually need to set up SSL (HTTPS) for your EC2 backend using a domain name and Nginx + Certbot, OR use Cloudflare Flexible SSL.
    > **Quick Test**: Requests might fail on strict browsers. For a quick test, you can try allowing mixed content in site settings, but for production, you need a domain for the backend to get HTTPS.

---

## Part 3: Frontend Setup (GitHub Pages)

1.  **Prepare Repository**:
    -   Ensure `index.html` is in the root folder.
    -   Create a `.gitignore` allowing `node_modules` to be ignored (GitHub Pages doesn't need them, only static files).

2.  **Push to GitHub**:
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/yourusername/your-repo-name.git
    git push -u origin main
    ```

3.  **Enable Pages**:
    -   Go to GitHub Repo -> **Settings** -> **Pages**.
    -   Source: **Deploy from a branch**.
    -   Branch: **main** / **root**.
    -   Save.

4.  **Visit Site**:
    -   Your site will be live at `https://yourusername.github.io/your-repo-name/`.

---

## Troubleshooting Mixed Content (HTTPS vs HTTP)
GitHub Pages forces HTTPS. Your raw EC2 IP is HTTP. Chrome blocks `fetch('http://...')` from an `https://` page.

**The Fix:**
1.  **Buy a cheap domain** (Namecheap/GoDaddy).
2.  Point the domain (e.g., `api.myflix.com`) to your EC2 IP (A Record).
3.  On EC2, install Nginx and Certbot to get free SSL.
    ```bash
    sudo apt install nginx
    sudo certbot --nginx -d api.myflix.com
    ```
4.  Configure Nginx to forward requests to localhost:3000.
