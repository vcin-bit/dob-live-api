const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  from:      { type: String, required: true },  // 'client' or 'officer' or 'manager'
  name:      { type: String, required: true },
  text:      { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const clientAlertSchema = new mongoose.Schema(
  {
    company:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    site:      { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
    entry:     { type: mongoose.Schema.Types.ObjectId, ref: 'Entry', required: true },
    entryType: { type: String, required: true },
    priority:  { type: String },
    summary:   { type: String },

    // Status lifecycle: open → acknowledged → completed
    status:          { type: String, enum: ['open','acknowledged','completed'], default: 'open' },
  portalEnabled:   { type: Boolean, default: false },
    acknowledgedAt:  { type: Date },
    acknowledgedBy:  { type: String },  // client name/label
    completedAt:     { type: Date },
    completedBy:     { type: String },  // officer/manager name
    completionNote:  { type: String },

    // Comment thread between client, officer, manager
    comments: [commentSchema],

    // Legacy read fields kept for compatibility
    read:   { type: Boolean, default: false },
    readAt: { type: Date },
    readBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

clientAlertSchema.index({ company: 1, status: 1, createdAt: -1 });
clientAlertSchema.index({ site: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('ClientAlert', clientAlertSchema);
