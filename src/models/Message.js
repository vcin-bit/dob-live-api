const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  companyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName:  { type: String, required: true },
  subject:     { type: String, required: true },
  body:        { type: String, required: true },
  recipients:  [{
    officerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer' },
    name:      String,
    ackedAt:   { type: Date, default: null },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
