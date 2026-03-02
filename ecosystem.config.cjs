module.exports = {
  apps: [
    {
      name: 'serpbays-saas',
      script: 'node_modules/.bin/next',
      args: 'start -p 3006',
      cwd: '/var/www/ai-bot/serpbays-saas',
      max_memory_restart: '512M',
      node_args: '--max-old-space-size=512',
      env: {
        NODE_ENV: 'production',
        PORT: '3006',
        OPENCLAW_HOST: '127.0.0.1',
        OPENCLAW_PORT: '18789',
        OPENCLAW_TOKEN: '05efa16f424c984deadab663acb32433cf8dc3335a68b2ef',
        OPENCLAW_MODEL: 'google-antigravity/gemini-3-flash',
      },
      // Auto-restart on crash
      autorestart: true,
      // Wait 5s before considering it started
      min_uptime: '5s',
      // Max 10 restarts in 1 minute before stopping
      max_restarts: 10,
      restart_delay: 3000,
      // Log config
      error_file: '/root/.pm2/logs/serpbays-saas-error.log',
      out_file: '/root/.pm2/logs/serpbays-saas-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
