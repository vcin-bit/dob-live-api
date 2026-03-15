const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  from:      { type: String }, // 'officer', 'manager', 'client'
  name:      { type: String },
  text:      { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const clientTaskSchema = new mongoose.Schema({
  companyId:    { type: mongoose.Schema.Types.ObjectId, index: true },  // NOT required — client tasks may lack it
  siteId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  siteName:     { type: String },

  createdByClient: { type: Boolean, default: true },
  clientName:      { type: String },

  title:        { type: String, required: true },
  description:  { type: String, default: '' },
  priority:     { type: String, enum: ['red', 'amber'], default: 'amber' },

  status:       { type: String, enum: ['open', 'acknowledged', 'completed'], default: 'open' },

  acknowledgedBy:   { type: String, default: null },
  acknowledgedAt:   { type: Date,   default: null },
  completedBy:      { type: String, default: null },
  completedAt:      { type: Date,   default: null },
  completionNotes:  { type: String, default: '' },

  comments:     [commentSchema],
}, { timestamps: true });

clientTaskSchema.index({ siteId: 1, status: 1 });
clientTaskSchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.model('ClientTask', clientTaskSchema);
