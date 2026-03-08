const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  officerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
  officerName: { type: String },
  officerSia: { type: String },
  type: {
    type: String,
    enum: [
      'on_duty', 'off_duty', 'patrol_start', 'patrol_end',
      'incident', 'observation', 'vehicle', 'handover',
      'cctv_patrol', 'health_safety', 'maintenance'
    ],
    required: true
  },
  notes: { type: String, default: '' },
  locationLat: { type: Number },
  locationLng: { type: Number },
  locationW3W: { type: String },
  photos: [{ type: String }],
  timestamp: { type: Date, default: Date.now },
  shiftDate: { type: String } // YYYY-MM-DD
});

// Auto-set shiftDate from timestamp if not provided
entrySchema.pre('save', function (next) {
  if (!this.shiftDate) {
    const d = new Date(this.timestamp);
    this.shiftDate = d.toISOString().split('T')[0];
  }
  next();
});

module.exports = mongoose.model('Entry', entrySchema);
