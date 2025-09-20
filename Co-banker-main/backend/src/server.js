require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const path = require('path');

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { logger } = require('./utils/logger');
const { authenticateToken } = require('./middleware/authMiddleware');
const { validateSystemHealth, healthCheck } = require('./config/validation');

// Import routes
const accountRoutes = require('./routes/accountRoutes');
const customerRoutes = require('./routes/customerRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const authRoutes = require('./routes/authRoutes');
const memberRoutes = require('./routes/memberRoutes');
const loanRoutes = require('./routes/loanRoutes');
const repaymentRoutes = require('./routes/repaymentRoutes');
const recurringDepositRoutes = require('./routes/recurringDepositRoutes');
const fixedDepositRoutes = require('./routes/fixedDepositRoutes');
const shareRoutes = require('./routes/shareRoutes');
const dividendRoutes = require('./routes/dividendRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes, then...
  delayMs: () => 500, // begin adding 500ms of delay per request above 50 (new recommended config)
});

// Middleware
app.use(compression());
app.use(limiter);
app.use(speedLimiter);
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://localhost:19006'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', async (req, res) => {
  try {
    const health = await healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// API Routes
app.use(`/api/${process.env.API_VERSION || 'v1'}/auth`, authRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/accounts`, authenticateToken, accountRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/customers`, authenticateToken, customerRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/transactions`, authenticateToken, transactionRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/members`, authenticateToken, memberRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/loans`, authenticateToken, loanRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/repayments`, authenticateToken, repaymentRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/recurring-deposits`, authenticateToken, recurringDepositRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/fixed-deposits`, authenticateToken, fixedDepositRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/shares`, authenticateToken, shareRoutes);
app.use(`/api/${process.env.API_VERSION || 'v1'}/dividends`, authenticateToken, dividendRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server with system validation
const startServer = async () => {
  try {
    // Validate system health before starting
    await validateSystemHealth();

    app.listen(PORT, () => {
      logger.info(`CoBanker Backend Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info('Server started successfully');
    });
  } catch (error) {
    logger.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = app; 