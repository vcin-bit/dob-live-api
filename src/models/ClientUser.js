const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const clientUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  siteIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  }],
  accessLevel: {
    type: String,
    enum: ['client', 'clientAdmin'],
    default: 'client'
  },
  name: {
    type: String,
    trim: true
  },
  resetToken: {
    type: String,
    default: null
  },
  resetTokenExpiry: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Hash password before saving
clientUserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
clientUserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('ClientUser', clientUserSchema);
