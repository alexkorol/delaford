// pm2 process definition for running the game server 24/7.
// Usage: npm run build && pm2 start ecosystem.config.cjs
// See docs/deployment.md for the full setup guide.
module.exports = {
  apps: [
    {
      name: 'delaford',
      script: 'server/index.js',
      node_args: '--enable-source-maps',
      env: {
        NODE_ENV: 'production',
        PORT: 6500,
      },
      // Restart on crash, but back off if it crashloops
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 2000,
      // The world lives in memory; cap leaks rather than letting the box swap
      max_memory_restart: '768M',
      kill_timeout: 8000,
      out_file: 'logs/delaford.out.log',
      error_file: 'logs/delaford.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
