const mongoose = require('mongoose');

const checkpointSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  order:       { type: Number, default: 0 },
  riskCount:   { type: Number, default: 0 },
  lastFlagged: { type: Date, default: null },
});

const patrolChecklistSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  siteId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Site',    required: true },
  checkpoints: [checkpointSchema],
}, { timestamps: true });

patrolChecklistSchema.index({ companyId: 1, siteId: 1 }, { unique: true });

module.exports = mongoose.model('PatrolChecklist', patrolChecklistSchema);
