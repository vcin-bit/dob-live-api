const mongoose = require('mongoose');

const clientAlertSchema = new mongoose.Schema(
  {
    company:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    site:       { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
    entry:      { type: mongoose.Schema.Types.ObjectId, ref: 'Entry', required: true },
    entryType:  { type: String, required: true },  // incident / health_safety / maintenance / medical
    priority:   { type: String },                  // from incident/maintenance urgency
    summary:    { type: String },                  // short human-readable description
    read:       { type: Boolean, default: false },
    readAt:     { type: Date },
    readBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

clientAlertSchema.index({ company: 1, read: 1, createdAt: -1 });
clientAlertSchema.index({ site: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('ClientAlert', clientAlertSchema);
