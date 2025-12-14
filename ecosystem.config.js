module.exports = {
    apps: [{
        name: "anti-netflix",
        script: "./server.js",
        env_production: {
            NODE_ENV: "production",
            PORT: 3000
        }
    }]
};
