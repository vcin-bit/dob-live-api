const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema(
  {
    // Core
    type: {
      type: String,
      required: true,
      enum: [
        'on_duty',
        'off_duty',
        'patrol_start',
        'patrol_end',
        'incident',
        'observation',
        'vehicle_check',
        'post_handover',
        'cctv_patrol',
        'health_safety',
        'maintenance',
        'medical',
      ],
    },
    refNumber: { type: String },          // e.g. RS-0042-08/03/26
    company:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    site:      { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
    officer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },

    // Client notification
    clientNotify: { type: Boolean, default: false },

    // ── ON DUTY ──────────────────────────────────────────────────────────────
    onDuty: {
      shiftStart:      { type: String },
      shiftEnd:        { type: String },
      relievingOfficers: [{ type: String }],
      handoverNotes:   { type: String },
    },

    // ── OFF DUTY ─────────────────────────────────────────────────────────────
    offDuty: {
      handingOverTo: [{ type: String }],
      notes:         { type: String },
    },

    // ── PATROL START ─────────────────────────────────────────────────────────
    patrolStart: {
      patrolType: { type: String },       // foot / vehicle / cycle
      areas:      [{ type: String }],
      gpsNote:    { type: String },
    },

    // ── PATROL END ───────────────────────────────────────────────────────────
    patrolEnd: {
      durationMinutes: { type: Number },
      distanceKm:      { type: Number },
      notes:           { type: String },
    },

    // ── INCIDENT ─────────────────────────────────────────────────────────────
    incident: {
      category:    { type: String },
      priority:    { type: String },      // low / medium / high / critical
      description: { type: String },
      policeCalled: { type: Boolean, default: false },
      policeRef:   { type: String },
    },

    // ── OBSERVATION ──────────────────────────────────────────────────────────
    observation: {
      observationType: { type: String },
      notes:           { type: String },
    },

    // ── VEHICLE CHECK ────────────────────────────────────────────────────────
    vehicleCheck: {
      registration: { type: String },
      makeModel:    { type: String },
      colour:       { type: String },
      reason:       { type: String },
      notes:        { type: String },
    },

    // ── POST HANDOVER ────────────────────────────────────────────────────────
    postHandover: {
      officers:         [{ type: String }],
      keysConfirmed:    { type: Boolean, default: false },
      equipmentConfirmed: { type: Boolean, default: false },
      notes:            { type: String },
    },

    // ── CCTV PATROL ──────────────────────────────────────────────────────────
    cctvPatrol: {
      camerasChecked: { type: Number },
      status:         [{ type: String }],  // chips: all-clear / faults / offline
      notes:          { type: String },
    },

    // ── HEALTH & SAFETY ──────────────────────────────────────────────────────
    healthSafety: {
      hazardType:  { type: String },
      description: { type: String },
      actionTaken: { type: String },
    },

    // ── MAINTENANCE ──────────────────────────────────────────────────────────
    maintenance: {
      issueType:   { type: String },
      description: { type: String },
      urgency:     { type: String },      // low / medium / high / urgent
    },

    // ── MEDICAL / FIRST AID ──────────────────────────────────────────────────
    medical: {
      natureOfEmergency:  { type: String },
      siteLocation:       { type: String },
      patientName:        { type: String },
      patientAge:         { type: String },
      patientGender:      { type: String },
      conscious:          { type: Boolean },
      knownConditions:    { type: String },
      firstAiders:        [{ type: String }],
      qualifications:     [{ type: String }],
      treatments:         [{ type: String }],  // CPR / AED / recovery position / etc.
      freeText:           { type: String },
      ambulanceCalled:    { type: String },    // 999 / 111 / No
      callTime999:        { type: String },
      ambulanceArrived:   { type: String },
      patientDeparted:    { type: String },
      ambulanceReg:       { type: String },
      crewRunNumber:      { type: String },
      receivingHospital:  { type: String },
      policeAttended:     { type: Boolean, default: false },
      policeRef:          { type: String },
      narrative:          { type: String },    // AI Assist or manual
    },
  },
  { timestamps: true }
);

// Index for fast alert queries
entrySchema.index({ company: 1, clientNotify: 1, createdAt: -1 });
entrySchema.index({ company: 1, site: 1, createdAt: -1 });

module.exports = mongoose.model('Entry', entrySchema);
