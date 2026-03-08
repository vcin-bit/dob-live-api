const mongoose = require('mongoose');

/**
 * ClientAlert
 * Created automatically whenever an Entry is saved with clientNotify: true.
 * Powers the client portal alerts feed.
 */
const ClientAlertSchema = new mongoose.Schema({

  // Links back to the original entry
  entryId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Entry', required: true },

  // Denormalised for fast portal reads (no joins needed)
  companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  siteId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
  siteName:     { type: String },

  entryType:    { type: String },   // e.g. 'incident', 'health_safety'
  officerName:  { type: String },
  officerSia:   { type: String },

  // Headline summary shown in the client portal card
  headline:     { type: String },   // e.g. "Incident — Theft / Shoplifting (High)"
  notes:        { type: String },   // the entry notes / narrative

  // Extra structured data for the alert card
  alertData: {
    category:    String,   // incident category
    priority:    String,   // High / Medium / Low
    hazardType:  String,   // H&S
    issueType:   String,   // Maintenance
    nature:      String,   // Medical nature of emergency
    vrm:         String,   // Vehicle reg
  },

  timestamp:    { type: Date, default: Date.now },

  // Portal read-state
  read:         { type: Boolean, default: false },
  readAt:       { type: Date },

}, {
  timestamps: true,
});

ClientAlertSchema.index({ companyId: 1, timestamp: -1 });
ClientAlertSchema.index({ siteId: 1, timestamp: -1 });
ClientAlertSchema.index({ read: 1, companyId: 1 });

module.exports = mongoose.model('ClientAlert', ClientAlertSchema);
