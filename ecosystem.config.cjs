module.exports = {
  apps: [
    {
      name: 'istrac-sims-backend',
      cwd: './backend',
      script: 'dist/src/index.js',
      instances: 1, // Single instance or 'max' for cluster mode
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      error_file: '/var/log/istrac-sims/backend-error.log',
      out_file: '/var/log/istrac-sims/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      merge_logs: true,
    },
    {
      name: 'istrac-sims-worker',
      cwd: './backend',
      script: 'dist/src/worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      error_file: '/var/log/istrac-sims/worker-error.log',
      out_file: '/var/log/istrac-sims/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      merge_logs: true,
    },
  ],
}
