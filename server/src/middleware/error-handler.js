/**
 * Centralized Express Error Handling Middleware
 * Ensures consistent JSON error responses without leaking internal stack traces
 * or sensitive environment details in production.
 */

function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    application: 'PrivacyLens',
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} does not exist on this server.`
    },
    timestamp: new Date().toISOString()
  });
}

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'An unexpected server error occurred.';

  console.error(`[PrivacyLens Error] ${statusCode} - ${message}`);

  res.status(statusCode).json({
    success: false,
    application: 'PrivacyLens',
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message
    },
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
