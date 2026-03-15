const mongoose = require('mongoose');

const siteInstructionsSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  siteId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true, unique: true },
  siteName:  { type: String },
  sections:  [{
    title:   { type: String, required: true },
    content: { type: String, required: true },
  }],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('SiteInstructions', siteInstructionsSchema);
