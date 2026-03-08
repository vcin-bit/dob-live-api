const mongoose = require('mongoose');

const officerSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  siaNumber: { type: String, required: true },
  siaType: { type: String, default: 'Door Supervisor' },
  siaExpiry: { type: String },
  mobile: { type: String },
  email: { type: String, lowercase: true },
  position: { type: String, default: 'Security Officer' },
  status: { type: String, enum: ['on_duty', 'off_duty'], default: 'off_duty' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Officer', officerSchema);
