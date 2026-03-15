const mongoose = require('mongoose');

const siteDocumentSchema = new mongoose.Schema({
  companyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  siteId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  folderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'SiteFolder', required: true },
  name:        { type: String, required: true, trim: true },
  originalName:{ type: String },
  mimeType:    { type: String },
  size:        { type: Number, default: 0 },
  r2Key:       { type: String, required: true },
  r2Url:       { type: String, required: true },
  uploadedBy:  { type: String },
}, { timestamps: true });

siteDocumentSchema.index({ folderId: 1 });
siteDocumentSchema.index({ companyId: 1, siteId: 1 });

module.exports = mongoose.models.SiteDocument || mongoose.model('SiteDocument', siteDocumentSchema);
