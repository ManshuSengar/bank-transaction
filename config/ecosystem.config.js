module.exports = {
    apps: [{
      name: 'fonexpay',
      script: 'bundle.js',
      instances: '1',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }]
  };