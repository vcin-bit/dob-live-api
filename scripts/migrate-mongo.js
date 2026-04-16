/**
 * DOB Live — MongoDB → Supabase Full Migration Script (v2)
 * Run: export MONGODB_URI='...' && node scripts/migrate-mongo.js
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

const MONGODB_URI  = process.env.MONGODB_URI;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!MONGODB_URI)  { console.error('❌  MONGODB_URI not set');  process.exit(1); }
if (!SUPABASE_URL) { console.error('❌  SUPABASE_URL not set'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('❌  SUPABASE_SECRET_KEY not set'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
function str(id) { return id ? id.toString() : null; }

function mapRole(role) {
  if (!role) return 'OFFICER';
  const r = role.toString().toUpperCase();
  if (['ADMIN','COMPANY_ADMIN','COMPANY'].includes(r)) return 'COMPANY';
  if (['OPS_MANAGER','MANAGER','OPS'].includes(r)) return 'OPS_MANAGER';
  if (['FD','FIELD_DIRECTOR'].includes(r)) return 'FD';
  if (r === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  return 'OFFICER';
}

function mapLogType(type) {
  if (!type) return 'GENERAL';
  const t = type.toString().toUpperCase().replace(/_/g, '');
  if (t === 'PATROL' || t === 'PATROLCHECK') return 'PATROL';
  if (t === 'INCIDENT' || t === 'INCIDENTREPORT') return 'INCIDENT';
  if (t === 'ALARM' || t === 'ALARMACTIVATION') return 'ALARM';
  if (t === 'ACCESS' || t === 'ACCESSCONTROL') return 'ACCESS';
  if (t === 'VISITOR' || t === 'VISITORLOG') return 'VISITOR';
  if (t === 'HANDOVER') return 'HANDOVER';
  if (t === 'MAINTENANCE') return 'MAINTENANCE';
  if (t === 'VEHICLE' || t === 'VEHICLELOG') return 'VEHICLE';
  if (t === 'WELFARE' || t === 'WELFARECHECK') return 'WELFARE';
  if (t === 'KEYHOLDING' || t === 'KEYS') return 'KEYHOLDING';
  return 'GENERAL';
}

async function migrate() {
  const mongo = new MongoClient(MONGODB_URI);
  try {
    await mongo.connect();
    console.log('✅  Connected to MongoDB\n');
    const db = mongo.db('dob_live');

    const companyMap = new Map();
    const clientMap  = new Map();
    const userMap    = new Map();
    const siteMap    = new Map();
    const shiftMap   = new Map();

    // 0. Clean previous partial run
    console.log('🧹  Cleaning previous data...');
    for (const table of ['tasks','handover_briefs','messages','occurrence_logs','shifts','sites','clients']) {
      await supabase.from(table).delete().not('id', 'is', null);
    }
    console.log('  ✓ Cleared\n');

    // 1. Get or create operator company
    let { data: co } = await supabase.from('companies').select('id').single();
    if (!co) {
      const { data: newCo, error: coErr } = await supabase.from('companies').insert({ name: 'Risk Secured Ltd', active: true }).select('id').single();
      if (coErr) { console.error('Could not create company:', coErr.message); return; }
      co = newCo;
      console.log('🏢  Created Risk Secured Ltd -> ' + co.id + '\n');
    } else {
      console.log('🏢  Using company ' + co.id + '\n');
    }
    companyMap.set('default', co.id);
    const cid = co.id;

    // 2. Clients (from Mongo companies collection)
    const mongoCos = await db.collection('companies').find({}).toArray();
    console.log(`👥  Migrating ${mongoCos.length} clients...`);
    for (const c of mongoCos) {
      const { data, error } = await supabase.from('clients').insert({
        company_id: cid,
        client_company_name: c.name || c.companyName || 'Unknown',
        contact_name: c.contactName || c.contact_name || '',
        contact_email: c.email || null,
        contact_phone: c.phone || null,
        active: c.active !== false,
      }).select('id').single();
      if (error) { console.error(`  ⚠️  ${c.name}: ${error.message}`); continue; }
      clientMap.set(str(c._id), data.id);
      console.log(`  ✓ ${c.name || 'Unknown'}`);
    }
    console.log('');

    // 3. Users
    const mongoUsers = await db.collection('users').find({}).toArray();
    console.log(`👤  Migrating ${mongoUsers.length} users...`);
    for (const u of mongoUsers) {
      const email = (u.email || '').toLowerCase().trim();
      if (!email) continue;
      const { data: exists } = await supabase.from('users').select('id').eq('email', email).single();
      if (exists) { userMap.set(str(u._id), exists.id); console.log(`  ↩  ${email}`); continue; }
      const parts = (u.name || u.fullName || '').trim().split(' ');
      const { data, error } = await supabase.from('users').insert({
        company_id: cid, clerk_id: null,
        role: mapRole(u.role),
        first_name: u.firstName || parts[0] || email.split('@')[0],
        last_name: u.lastName || parts.slice(1).join(' ') || '',
        email, phone: u.phone || null,
        sia_licence_number: u.siaLicenceNumber || null,
        sia_expiry_date: u.siaExpiryDate || null,
        active: u.active !== false,
      }).select('id').single();
      if (error) { console.error(`  ⚠️  ${email}: ${error.message}`); continue; }
      userMap.set(str(u._id), data.id);
      console.log(`  ✓ ${email} [${mapRole(u.role)}]`);
    }

    // Also check officers collection
    const mongoOfficers = await db.collection('officers').find({}).toArray();
    for (const o of mongoOfficers) {
      const email = (o.email || '').toLowerCase().trim();
      if (!email) continue;
      const { data: exists } = await supabase.from('users').select('id').eq('email', email).single();
      if (exists) { userMap.set(str(o._id), exists.id); continue; }
      const parts = (o.name || '').trim().split(' ');
      const { data, error } = await supabase.from('users').insert({
        company_id: cid, clerk_id: null, role: 'OFFICER',
        first_name: o.firstName || parts[0] || email.split('@')[0],
        last_name: o.lastName || parts.slice(1).join(' ') || '',
        email, phone: o.phone || null,
        sia_licence_number: o.siaNumber || null,
        sia_expiry_date: o.siaExpiryDate || null,
        active: o.active !== false,
      }).select('id').single();
      if (error) continue;
      userMap.set(str(o._id), data.id);
      console.log(`  ✓ officer: ${email}`);
    }
    console.log('');

    // 4. Sites
    const mongoSites = await db.collection('sites').find({}).toArray();
    console.log(`📍  Migrating ${mongoSites.length} sites...`);
    for (const s of mongoSites) {
      const { data, error } = await supabase.from('sites').insert({
        company_id: cid,
        client_id: clientMap.get(str(s.clientId)) || null,
        name: s.name || 'Unknown Site',
        address: [s.address, s.city].filter(Boolean).join(', ') || null,
        geofence_lat: s.geofenceLat || null,
        geofence_lng: s.geofenceLng || null,
        geofence_radius_metres: s.geofenceRadius || null,
        active: s.status === 'active' || s.active !== false,
      }).select('id').single();
      if (error) { console.error(`  ⚠️  ${s.name}: ${error.message}`); continue; }
      siteMap.set(str(s._id), data.id);
      console.log(`  ✓ ${s.name}`);
    }
    console.log('');

    // 5. Shifts
    const mongoShifts = await db.collection('shiftinstances').find({}).toArray();
    console.log(`⏱️   Migrating ${mongoShifts.length} shifts...`);
    if (mongoShifts.length > 0) console.log('  Sample shift keys:', Object.keys(mongoShifts[0]).join(', '));
    let shiftOk = 0, shiftFail = 0;
    for (const s of mongoShifts) {
      const siteId    = siteMap.get(str(s.siteId || s.site));
      const officerId = userMap.get(str(s.assignedOfficerId || s.officerId || s.officer));
      if (!siteId || !officerId) { shiftFail++; continue; }
      // Combine date + time strings into ISO datetime
      const startDt = s.date && s.startTime ? new Date(s.date + 'T' + s.startTime + ':00').toISOString() : s.createdAt || new Date().toISOString();
      const endDt   = s.date && s.endTime   ? new Date(s.date + 'T' + s.endTime   + ':00').toISOString() : null;
      const { data, error } = await supabase.from('shifts').insert({
        company_id: cid, site_id: siteId, officer_id: officerId,
        start_time: startDt,
        end_time:   endDt,
        pay_rate:   s.payRate || null,
        charge_rate: s.chargeRate || null,
        notes: s.notes || null,
      }).select('id').single();
      if (error) { shiftFail++; continue; }
      shiftMap.set(str(s._id), data.id);
      shiftOk++;
    }
    console.log(`  ✓ ${shiftOk} inserted, ${shiftFail} skipped\n`);

    // 6. Entries → Occurrence Logs
    const mongoEntries = await db.collection('entries').find({}).toArray();
    console.log(`📝  Migrating ${mongoEntries.length} log entries...`);
    if (mongoEntries.length > 0) console.log('  Sample entry keys:', Object.keys(mongoEntries[0]).join(', '));
    let logOk = 0, logFail = 0;
    let logErrors = [];
    for (const e of mongoEntries) {
      const siteId    = siteMap.get(str(e.siteId || e.site));
      const officerId = userMap.get(str(e.officerId || e.officer || e.createdBy));
      const shiftId   = shiftMap.get(str(e.shiftId || e.shift)) || null;
      const { error } = await supabase.from('occurrence_logs').insert({
        company_id:  cid,
        site_id:     siteId || [...siteMap.values()][0] || null,
        officer_id:  officerId || null,
        shift_id:    shiftId,
        log_type:    mapLogType(e.type || e.logType || e.entryType),
        title:       e.title || e.summary || e.type || 'Log Entry',
        description: e.notes || e.description || e.details || e.body || null,
        latitude:    e.latitude || e.lat || null,
        longitude:   e.longitude || e.lng || null,
        what3words:  e.what3words || null,
        type_data:   e.typeData || e.type_data || e.data || {},
        occurred_at: e.timestamp || e.createdAt || e.occurredAt || new Date().toISOString(),
      });
      if (error) { logFail++; if (logErrors.length < 3) logErrors.push(error.message); } else { logOk++; }
    }
    if (logErrors.length) console.log('  First errors:', logErrors);
    console.log(`  ✓ ${logOk} inserted, ${logFail} failed\n`);

    // 7. Handovers
    const mongoHandovers = await db.collection('handoverbriefs').find({}).toArray();
    console.log(`📋  Migrating ${mongoHandovers.length} handover briefs...`);
    let hvOk = 0, hvFail = 0;
    for (const h of mongoHandovers) {
      const siteId   = siteMap.get(str(h.siteId || h.site));
      const authorId = userMap.get(str(h.outgoingOfficer || h.authorId || h.author || h.createdBy));
      const handedTo = userMap.get(str(h.acknowledgedBy || h.handedToId || h.handedTo)) || null;
      const shiftId  = shiftMap.get(str(h.shiftId || h.shift)) || null;
      const content  = [h.shiftSummary, h.notes].filter(Boolean).join('\n') || h.content || h.body || '';
      const { error } = await supabase.from('handover_briefs').insert({
        company_id: cid,
        site_id:    siteId || [...siteMap.values()][0] || null,
        authored_by: authorId || null,
        handed_to:  handedTo,
        shift_id:   shiftId,
        content,
      });
      if (error) { hvFail++; } else { hvOk++; }
    }
    console.log(`  ✓ ${hvOk} inserted, ${hvFail} failed\n`);

    // 8. Messages
    const mongoMessages = await db.collection('messages').find({}).toArray();
    console.log(`💬  Migrating ${mongoMessages.length} messages...`);
    let msgOk = 0, msgFail = 0;
    for (const m of mongoMessages) {
      const firstRecipient = Array.isArray(m.recipients) ? m.recipients[0] : null;
      const recipientId = firstRecipient ? userMap.get(str(firstRecipient.officerId)) || null : null;
      // Match sender by first name
      const firstName = (m.senderName || '').split(' ')[0];
      const { data: senderRows } = await supabase.from('users').select('id').ilike('first_name', firstName);
      const senderId = senderRows?.[0]?.id || recipientId || null;
      if (!senderId) { msgFail++; continue; }
      const { error } = await supabase.from('messages').insert({
        company_id: cid,
        sender_id: senderId,
        recipient_id: recipientId,
        body: m.body || m.content || m.text || '',
      });
      if (error) { msgFail++; } else { msgOk++; }
    }
    console.log(`  ✓ ${msgOk} inserted, ${msgFail} skipped\n`);

    // 9. Tasks
    const mongoTasks = await db.collection('clienttasks').find({}).toArray();
    console.log(`✅  Migrating ${mongoTasks.length} tasks...`);
    let taskOk = 0, taskFail = 0;
    for (const t of mongoTasks) {
      const { error } = await supabase.from('tasks').insert({
        company_id:  cid,
        site_id:     siteMap.get(str(t.siteId || t.site)) || null,
        assigned_to: userMap.get(str(t.assignedTo || t.officer)) || null,
        assigned_by: userMap.get(str(t.assignedBy || t.createdBy || t.manager)) || null,
        title:       t.title || t.name || 'Untitled Task',
        description: t.description || t.notes || null,
        due_date:    t.dueDate || t.due_date || null,
      });
      if (error) { taskFail++; } else { taskOk++; }
    }
    console.log(`  ✓ ${taskOk} inserted, ${taskFail} failed\n`);

    // Summary
    console.log('🎉  Migration complete!');
    console.log(`    Clients    : ${clientMap.size}`);
    console.log(`    Users      : ${userMap.size}`);
    console.log(`    Sites      : ${siteMap.size}`);
    console.log(`    Shifts     : ${shiftOk}`);
    console.log(`    Log entries: ${logOk}`);
    console.log(`    Handovers  : ${hvOk}`);
    console.log(`    Messages   : ${msgOk}`);
    console.log(`    Tasks      : ${taskOk}`);
    console.log('\nDone. Remove MONGODB_URI from Render env vars.');

  } catch (err) {
    console.error('❌  Migration failed:', err.message);
  } finally {
    await mongo.close();
  }
}

migrate();
