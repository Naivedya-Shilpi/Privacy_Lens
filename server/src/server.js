const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, env.host, () => {
  console.log(
    `[PrivacyLens] Backend server running in ${env.nodeEnv} mode at http://${env.host}:${env.port}`
  );
  console.log(`[PrivacyLens] Health endpoint: http://${env.host}:${env.port}/api/health`);
});

process.on('SIGINT', () => {
  console.log('\n[PrivacyLens] Shutting down server gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
