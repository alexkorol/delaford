const config = {
  apps: [{
    name: 'server',
    script: './server/index.js',
    instances: 1,
    env: {
      NODE_ENV: 'development',
    },
    env_production: {
      NODE_ENV: 'production',
    },
  }],
};

export default config;
