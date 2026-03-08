require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./src/config/database');

const app = express();

// Connect to MongoDB
connectDB();

// CORS
const allowedOrigins = [
  'https://app.doblive.co.uk',
  'https://doblive.co.uk',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'dob-live-api', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/entries', require('./src/routes/entries'));
app.use('/api/officers', require('./src/routes/officers'));
app.use('/api/sites', require('./src/routes/sites'));
app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/api/admin', require('./src/routes/admin'));

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DOB·LIVE API running on port ${PORT}`);
});
