const mongoose = require('mongoose');

const instructionsAckSchema = new mongoose.Schema({
  companyId:   { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  siteId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  officerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
  officerName: { type: String, required: true },
  instructionsVersion: { type: Date, required: true },
  ackedAt:     { type: Date, default: Date.now },
}, { timestamps: true });

instructionsAckSchema.index({ companyId: 1, siteId: 1, officerId: 1, instructionsVersion: 1 }, { unique: true });

module.exports = mongoose.model('InstructionsAck', instructionsAckSchema);
