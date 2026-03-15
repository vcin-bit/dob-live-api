const mongoose = require('mongoose');

const siteFolderSchema = new mongoose.Schema({
  companyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  siteId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  name:        { type: String, required: true, trim: true },
  createdBy:   { type: String },
  description: { type: String, default: '' },
}, { timestamps: true });

siteFolderSchema.index({ companyId: 1, siteId: 1 });

module.exports = mongoose.models.SiteFolder || mongoose.model('SiteFolder', siteFolderSchema);
