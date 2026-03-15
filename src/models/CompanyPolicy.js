const mongoose = require('mongoose');

const companyPolicySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, unique: true },
  sections:  [{
    title:   { type: String, required: true },
    content: { type: String, required: true },
  }],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('CompanyPolicy', companyPolicySchema);
