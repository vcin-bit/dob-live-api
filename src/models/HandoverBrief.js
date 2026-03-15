const mongoose = require('mongoose');

const handoverBriefSchema = new mongoose.Schema({
  companyId:       { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  siteId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
  outgoingOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
  outgoingName:    { type: String, required: true },
  shiftSummary:    { type: String, default: '' },
  notes:           { type: String, default: '' },
  incidents:       { type: Number, default: 0 },
  patrols:         { type: Number, default: 0 },
  totalEntries:    { type: Number, default: 0 },
  acknowledgedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', default: null },
  acknowledgedAt:  { type: Date, default: null },
  acknowledgedName:{ type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('HandoverBrief', handoverBriefSchema);
