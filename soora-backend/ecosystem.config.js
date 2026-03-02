module.exports = {
  apps: [{
    name: 'soora-backend',
    script: 'dist/index.js',
    cwd: __dirname,
    instances: 1,
    env: {
      PORT: 4000,
      CONSUMET_URL: 'http://localhost:8000',
      TMDB_KEY: '13e53ff644a8bd4ba37b3e1044ad24f3',
      CORS_ORIGIN: 'https://soora.fun,https://stream.soora.fun',
      NODE_ENV: 'production',
    },
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
    watch: false,
    // Restart daily at 4am to clear memory/cache
    cron_restart: '0 4 * * *',
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 10000,
  }],
};
