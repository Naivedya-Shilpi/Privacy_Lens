const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const healthRoutes = require('./routes/health.routes');
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

// API Routes
app.use('/api', healthRoutes);

// 404 & Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
