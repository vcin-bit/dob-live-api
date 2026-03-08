require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Company = require('./models/Company');
const User = require('./models/User');
const Officer = require('./models/Officer');
const Site = require('./models/Site');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'dob_live' });
  console.log('MongoDB connected');
};

const seed = async () => {
  await connectDB();

  // Clear existing seed data
  await Company.deleteMany({ slug: 'risksecured' });
  await User.deleteMany({ email: { $in: [
    'fletcher@risksecured.co.uk',
    'j.harris@risksecured.co.uk',
    't.dawson@risksecured.co.uk',
    'l.webb@risksecured.co.uk',
    'admin@psingroup.co.uk'
  ]}});

  console.log('Cleared existing seed data');

  // Create company
  const company = await Company.create({
    name: 'Risk Secured Ltd',
    slug: 'risksecured',
    tier: 'professional',
    status: 'active',
    trialDays: 60,
    billingStart: '2026-03-08'
  });
  console.log('Created company:', company.name);

  // Create ops manager
  const managerHash = await bcrypt.hash('fletcher123', 12);
  const manager = await User.create({
    companyId: company._id,
    email: 'fletcher@risksecured.co.uk',
    passwordHash: managerHash,
    role: 'COMPANY',
    name: 'David Fletcher'
  });
  console.log('Created manager:', manager.email);

  // Create super admin
  const adminHash = await bcrypt.hash('psin-admin-2026', 12);
  await User.create({
    companyId: null,
    email: 'admin@psingroup.co.uk',
    passwordHash: adminHash,
    role: 'SUPER_ADMIN',
    name: 'PSIN Admin'
  });
  console.log('Created super admin');

  // Create officers with user accounts
  const officerData = [
    {
      firstName: 'James', lastName: 'Harris',
      siaNumber: '7741000000000001', siaType: 'Door Supervisor', siaExpiry: '2026-08-14',
      mobile: '07800100001', email: 'j.harris@risksecured.co.uk',
      password: 'harris123'
    },
    {
      firstName: 'Terry', lastName: 'Dawson',
      siaNumber: '7741000000000002', siaType: 'Door Supervisor', siaExpiry: '2027-01-20',
      mobile: '07800100002', email: 't.dawson@risksecured.co.uk',
      password: 'dawson123'
    },
    {
      firstName: 'Louise', lastName: 'Webb',
      siaNumber: '7741000000000003', siaType: 'Security Guard', siaExpiry: '2027-03-11',
      mobile: '07800100003', email: 'l.webb@risksecured.co.uk',
      password: 'webb123'
    }
  ];

  const officers = [];
  for (const o of officerData) {
    const hash = await bcrypt.hash(o.password, 12);
    const user = await User.create({
      companyId: company._id,
      email: o.email,
      passwordHash: hash,
      role: 'OFFICER',
      name: `${o.firstName} ${o.lastName}`
    });

    const officer = await Officer.create({
      companyId: company._id,
      userId: user._id,
      firstName: o.firstName,
      lastName: o.lastName,
      siaNumber: o.siaNumber,
      siaType: o.siaType,
      siaExpiry: o.siaExpiry,
      mobile: o.mobile,
      email: o.email,
      position: 'Security Officer'
    });

    officers.push(officer);
    console.log(`Created officer: ${o.firstName} ${o.lastName}`);
  }

  const [harris, dawson, webb] = officers;

  // Create sites
  await Site.create({
    companyId: company._id,
    name: 'Brindleyplace',
    siteNumber: 'RS-001',
    address: 'Brindleyplace, Birmingham, B1 2JB',
    city: 'Birmingham',
    client: 'Brindleyplace BID',
    geofenceLat: 52.4751,
    geofenceLng: -1.9054,
    geofenceRadius: 200,
    escalationContact1Name: 'Tom Briggs',
    escalationContact1Mobile: '07700900001',
    status: 'active',
    officerIds: [harris._id, webb._id]
  });
  console.log('Created site: Brindleyplace');

  await Site.create({
    companyId: company._id,
    name: 'Merry Hill Centre',
    siteNumber: 'RS-002',
    address: 'Merry Hill, Brierley Hill, DY5 1SY',
    city: 'Dudley',
    client: 'Merry Hill Management',
    geofenceLat: 52.4784,
    geofenceLng: -2.1085,
    geofenceRadius: 300,
    escalationContact1Name: 'Site Security',
    escalationContact1Mobile: '07700900002',
    status: 'active',
    officerIds: [dawson._id]
  });
  console.log('Created site: Merry Hill Centre');

  console.log('\n✅ Seed complete');
  console.log('─────────────────────────────────');
  console.log('Ops Manager:  fletcher@risksecured.co.uk / fletcher123');
  console.log('Officer:      j.harris@risksecured.co.uk / harris123');
  console.log('Officer:      t.dawson@risksecured.co.uk / dawson123');
  console.log('Officer:      l.webb@risksecured.co.uk / webb123');
  console.log('Super Admin:  admin@psingroup.co.uk / psin-admin-2026');
  console.log('─────────────────────────────────');

  await mongoose.disconnect();
};

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
