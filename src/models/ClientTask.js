const mongoose = require('mongoose');

const clientTaskSchema = new mongoose.Schema({
  companyId:    { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  siteId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  siteName:     { type: String },

  // Created by client
  createdByClient: { type: Boolean, default: true },
  clientName:   { type: String },

  title:        { type: String, required: true },
  description:  { type: String, default: '' },
  priority:     { type: String, enum: ['red', 'amber'], default: 'amber' },

  // Status flow: open → acknowledged → completed
  status:       { type: String, enum: ['open', 'acknowledged', 'completed'], default: 'open' },

  acknowledgedBy:   { type: String, default: null },
  acknowledgedAt:   { type: Date,   default: null },
  completedBy:      { type: String, default: null },
  completedAt:      { type: Date,   default: null },
  completionNotes:  { type: String, default: '' },
}, { timestamps: true });

clientTaskSchema.index({ companyId: 1, status: 1 });
clientTaskSchema.index({ companyId: 1, siteId: 1, status: 1 });

module.exports = mongoose.model('ClientTask', clientTaskSchema);
