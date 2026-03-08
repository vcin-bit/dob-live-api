const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { type: String, required: true },
  siteNumber: { type: String },
  address: { type: String },
  city: { type: String },
  client: { type: String },
  geofenceLat: { type: Number },
  geofenceLng: { type: Number },
  geofenceRadius: { type: Number, default: 200 },
  escalationContact1Name: { type: String },
  escalationContact1Mobile: { type: String },
  escalationContact2Name: { type: String },
  escalationContact2Mobile: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  officerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Officer' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Site', siteSchema);
