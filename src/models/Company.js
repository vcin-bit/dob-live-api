const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  tier: { type: String, enum: ['starter', 'professional', 'enterprise'], default: 'starter' },
  status: { type: String, enum: ['active', 'suspended', 'trial'], default: 'trial' },
  trialDays: { type: Number, default: 60 },
  billingStart: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Company', companySchema);
