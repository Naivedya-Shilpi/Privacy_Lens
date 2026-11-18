const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const healthRoutes = require('./routes/health.routes');
const analyzeRoutes = require('./routes/analyze.routes');
const { notFoundHandler, errorHandler } = require('./middleware/error-handler');

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration permitting local development and Chrome Extension popup requests
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, PowerShell Invoke-RestMethod)
      // as well as localhost and chrome-extension:// origins
      if (
        !origin ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('chrome-extension://')
      ) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by PrivacyLens CORS policy'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept']
  })
);

// Parse incoming JSON payloads
app.use(express.json({ limit: '1mb' }));

// Normalize body-parser syntax and payload-size errors before global error handler
app.use((err, _req, _res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    err.statusCode = 400;
    err.code = 'INVALID_JSON_BODY';
    err.message = 'Malformed JSON in request body.';
  } else if (err && err.type === 'entity.too.large') {
    err.statusCode = 413;
    err.code = 'PAYLOAD_TOO_LARGE';
    err.message = 'Request payload exceeds the maximum allowed size limit (1MB).';
  }
  next(err);
});

// API Routes
app.use('/api', healthRoutes);
app.use('/api', analyzeRoutes);

// 404 & Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
