const mongoose = require('mongoose');

const EntrySchema = new mongoose.Schema({

  // ── Core ──────────────────────────────────────────────────────────
  type: {
    type: String,
    required: true,
    enum: [
      'on_duty','off_duty','patrol_start','patrol_end',
      'incident','observation','vehicle','handover',
      'cctv_patrol','health_safety','maintenance','medical'
    ],
  },

  // ── People & Site ─────────────────────────────────────────────────
  officerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Officer' },
  officerName:  { type: String },
  officerEmail: { type: String },
  officerSia:   { type: String },
  siteId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
  companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },

  // ── Content ───────────────────────────────────────────────────────
  notes:        { type: String, default: '' },

  // Structured per-type data (stored alongside free-text notes)
  entryData: {
    // Incident
    category:   String,
    priority:   { type: String, enum: ['Low','Medium','High'] },
    policeRef:  String,
    policeCalled: Boolean,

    // Vehicle
    vrm:        String,
    make:       String,
    colour:     String,
    vehReason:  String,

    // Medical
    nature:         String,
    patientName:    String,
    patientAge:     String,
    patientGender:  String,
    conscious:      String,
    patientConditions: String,
    firstAider:     String,
    firstAidQual:   String,
    treatment:      [String],
    treatmentNotes: String,
    ambulanceCalled: String,
    callTime:       String,
    amboArrived:    String,
    patientDeparted: String,
    amboReg:        String,
    amboRun:        String,
    hospital:       String,
    medLocation:    String,

    // H&S
    hazardType:  String,
    actionTaken: String,

    // Maintenance
    issueType:   String,
    urgency:     String,

    // Patrol
    patrolType:  String,
    duration:    String,
    distance:    String,

    // Shift
    shiftStart:  String,
    shiftEnd:    String,
  },

  // ── Client notification flag ──────────────────────────────────────
  clientNotify: { type: Boolean, default: false },

  // ── Location ──────────────────────────────────────────────────────
  location: {
    lat: Number,
    lng: Number,
    w3w: String,
  },

  // ── Timestamps ───────────────────────────────────────────────────
  timestamp:  { type: Date, default: Date.now },
  shiftDate:  { type: String },          // YYYY-MM-DD local date

}, {
  timestamps: true,   // adds createdAt / updatedAt
});

// Indexes for common queries
EntrySchema.index({ officerId: 1, shiftDate: 1 });
EntrySchema.index({ siteId: 1, shiftDate: 1 });
EntrySchema.index({ companyId: 1, clientNotify: 1, timestamp: -1 });

module.exports = mongoose.model('Entry', EntrySchema);
