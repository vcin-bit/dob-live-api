const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, required: true },
  endpoint:  { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth:   { type: String, required: true },
  },
}, { timestamps: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
