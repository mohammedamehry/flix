const CONFIG = {
    // 1. FOR DEVELOPMENT: Use 'http://localhost:3000'
    // 2. FOR PRODUCTION (GitHub Pages): Replace 'https://api.yourdomain.com' with your EC2 Public IP or Domain
    //    Example: 'http://54.123.45.67:3000' (if using HTTP) or 'https://api.myapp.com' (if using HTTPS)
    BACKEND_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3000'
        : 'https://api.yourdomain.com'
};
