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
