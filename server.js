require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { clerkMiddleware } = require('@clerk/express');

const app = express();

// ── Security middleware ──────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    'https://app.doblive.co.uk',
    'https://portal.doblive.co.uk',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true
}));

// ── Rate limiting ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later' }
});

app.use(limiter);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check (public — before auth middleware) ───────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

// ── Clerk auth middleware ────────────────────────────────────
app.use(clerkMiddleware());

// ── Routes ───────────────────────────────────────────────────
app.use('/api/users',      require('./routes/users'));
app.use('/api/companies',  require('./routes/companies'));
app.use('/api/sites',      require('./routes/sites'));
app.use('/api/shifts',     require('./routes/shifts'));
app.use('/api/logs',       require('./routes/logs'));
app.use('/api/tasks',      require('./routes/tasks'));
app.use('/api/messages',   require('./routes/messages'));
app.use('/api/documents',  require('./routes/documents'));
app.use('/api/handovers',  require('./routes/handovers'));
app.use('/api/clients',    require('./routes/clients'));

// ── 404 handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DOB Live API running on port ${PORT}`));
