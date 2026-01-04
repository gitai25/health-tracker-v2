module.exports = {
  apps: [
    {
      name: "health-tracker",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "./",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
