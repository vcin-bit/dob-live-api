/**
 * DOB Live — MongoDB → Supabase Migration Script
 * 
 * Run once on Render (or locally with both env vars set):
 *   node scripts/migrate-mongo.js
 * 
 * Requires env vars:
 *   MONGODB_URI     — MongoDB SRV connection string
 *   SUPABASE_URL    — Supabase project URL
 *   SUPABASE_KEY    — Supabase service role key (not anon key)
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

const MONGODB_URI  = process.env.MONGODB_URI;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!MONGODB_URI)  { console.error('❌  MONGODB_URI not set');  process.exit(1); }
if (!SUPABASE_URL) { console.error('❌  SUPABASE_URL not set'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('❌  SUPABASE_KEY not set'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ──────────────────────────────────────────────────
function str(id) { return id ? id.toString() : null; }

function mapRole(role) {
  if (!role) return 'OFFICER';
  const r = role.toUpperCase();
  if (r === 'ADMIN' || r === 'COMPANY_ADMIN' || r === 'COMPANY') return 'COMPANY';
  if (r === 'OPS_MANAGER' || r === 'MANAGER' || r === 'OPS') return 'OPS_MANAGER';
  if (r === 'FD' || r === 'FIELD_DIRECTOR') return 'FD';
  if (r === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  return 'OFFICER';
}

function mapLogType(type) {
  if (!type) return 'GENERAL';
  const t = type.toUpperCase();
  const types = ['PATROL', 'INCIDENT', 'ALARM', 'ACCESS', 'VISITOR', 'HANDOVER', 'MAINTENANCE', 'VEHICLE', 'WELFARE', 'KEYHOLDING', 'GENERAL'];
  return types.includes(t) ? t : 'GENERAL';
}

function splitName(fullName) {
  if (!fullName) return { first: '', last: '' };
  const parts = fullName.trim().split(' ');
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
}

// ── Main ─────────────────────────────────────────────────────
async function migrate() {
  const mongo = new MongoClient(MONGODB_URI);
  
  try {
    await mongo.connect();
    console.log('✅  Connected to MongoDB');

    // Discover available databases and collections
    const adminDb = mongo.db().admin();
    const { databases } = await adminDb.listDatabases();
    console.log('\n📂  Databases found:', databases.map(d => d.name).join(', '));

    // Try to find the right database (skip admin/local/config)
    const appDbs = databases.filter(d => !['admin', 'local', 'config'].includes(d.name));
    if (appDbs.length === 0) { console.error('❌  No app databases found'); return; }

    const dbName = appDbs[0].name;
    console.log(`\n📁  Using database: ${dbName}`);
    const db = mongo.db(dbName);

    const collections = await db.listCollections().toArray();
    console.log('📋  Collections:', collections.map(c => c.name).join(', '));
    console.log('');

    // ── ID Maps (MongoDB ObjectId → Supabase UUID) ────────────
    const companyMap = new Map(); // mongoId → supabaseId
    const userMap    = new Map();
    const clientMap  = new Map();
    const siteMap    = new Map();

    const collectionNames = collections.map(c => c.name.toLowerCase());

    // ── 1. Companies ─────────────────────────────────────────
    const companyColName = collectionNames.find(n => n.includes('compan'));
    if (companyColName) {
      const companies = await db.collection(companyColName).find({}).toArray();
      console.log(`🏢  Migrating ${companies.length} companies...`);

      for (const c of companies) {
        const payload = {
          name: c.name || c.companyName || 'DOB Live Client',
          email: c.email || null,
          phone: c.phone || null,
          address: c.address || null,
          active: c.active !== false,
        };
        const { data, error } = await supabase.from('companies').insert(payload).select('id').single();
        if (error) { console.error('  ⚠️  Company insert failed:', error.message, payload.name); continue; }
        companyMap.set(str(c._id), data.id);
        console.log(`  ✓ ${payload.name} → ${data.id}`);
      }
    } else {
      // Create a default company if none found
      console.log('🏢  No companies collection — creating default company...');
      const { data, error } = await supabase
        .from('companies')
        .insert({ name: 'DOB Live', active: true })
        .select('id').single();
      if (!error) {
        companyMap.set('default', data.id);
        console.log(`  ✓ Default company → ${data.id}`);
      }
    }

    const defaultCompanyId = [...companyMap.values()][0];
    if (!defaultCompanyId) { console.error('❌  No company ID — cannot continue'); return; }

    // ── 2. Clients ───────────────────────────────────────────
    const clientColName = collectionNames.find(n => n.includes('client'));
    if (clientColName) {
      const clients = await db.collection(clientColName).find({}).toArray();
      console.log(`\n👥  Migrating ${clients.length} clients...`);

      for (const c of clients) {
        const companyId = companyMap.get(str(c.company || c.company_id)) || defaultCompanyId;
        const payload = {
          company_id: companyId,
          client_company_name: c.name || c.companyName || c.client_company_name || 'Unknown Client',
          contact_name: c.contactName || c.contact_name || '',
          contact_email: c.email || c.contactEmail || null,
          contact_phone: c.phone || c.contactPhone || null,
          active: c.active !== false,
        };
        const { data, error } = await supabase.from('clients').insert(payload).select('id').single();
        if (error) { console.error('  ⚠️  Client insert failed:', error.message); continue; }
        clientMap.set(str(c._id), data.id);
        console.log(`  ✓ ${payload.client_company_name}`);
      }
    }

    // ── 3. Users ─────────────────────────────────────────────
    const userColName = collectionNames.find(n => n.includes('user'));
    if (userColName) {
      const users = await db.collection(userColName).find({}).toArray();
      console.log(`\n👤  Migrating ${users.length} users...`);

      for (const u of users) {
        const companyId = companyMap.get(str(u.company || u.company_id || u.companyId)) || defaultCompanyId;
        const { first, last } = u.firstName ? { first: u.firstName, last: u.lastName || '' } : splitName(u.name || u.fullName || '');
        
        const payload = {
          company_id: companyId,
          clerk_id: null,               // will be stamped on first Clerk sign-in
          role: mapRole(u.role),
          first_name: first || u.email?.split('@')[0] || 'Unknown',
          last_name: last || '',
          email: (u.email || '').toLowerCase().trim(),
          phone: u.phone || u.phoneNumber || null,
          sia_licence_number: u.siaLicenceNumber || u.sia_licence_number || u.siaNumber || null,
          sia_expiry_date: u.siaExpiryDate || u.sia_expiry_date || null,
          active: u.active !== false,
        };

        if (!payload.email) { console.warn('  ⚠️  Skipping user with no email'); continue; }

        // Check if email already exists (idempotent)
        const { data: existing } = await supabase.from('users').select('id').eq('email', payload.email).single();
        if (existing) {
          userMap.set(str(u._id), existing.id);
          console.log(`  ↩  ${payload.email} already exists`);
          continue;
        }

        const { data, error } = await supabase.from('users').insert(payload).select('id').single();
        if (error) { console.error('  ⚠️  User insert failed:', error.message, payload.email); continue; }
        userMap.set(str(u._id), data.id);
        console.log(`  ✓ ${payload.email} [${payload.role}]`);
      }
    }

    // ── 4. Sites ─────────────────────────────────────────────
    const siteColName = collectionNames.find(n => n.includes('site'));
    if (siteColName) {
      const sites = await db.collection(siteColName).find({}).toArray();
      console.log(`\n📍  Migrating ${sites.length} sites...`);

      for (const s of sites) {
        const companyId = companyMap.get(str(s.company || s.company_id)) || defaultCompanyId;
        const clientId  = clientMap.get(str(s.client || s.client_id)) || null;

        const payload = {
          company_id: companyId,
          client_id:  clientId,
          name: s.name || 'Unknown Site',
          address: s.address || null,
          postcode: s.postcode || s.post_code || null,
          what3words: s.what3words || s.w3w || null,
          notes: s.notes || null,
          active: s.active !== false,
          status: s.status?.toUpperCase() || 'ACTIVE',
        };

        const { data, error } = await supabase.from('sites').insert(payload).select('id').single();
        if (error) { console.error('  ⚠️  Site insert failed:', error.message, payload.name); continue; }
        siteMap.set(str(s._id), data.id);
        console.log(`  ✓ ${payload.name}`);
      }
    }

    // ── 5. Occurrence Logs ───────────────────────────────────
    const logColName = collectionNames.find(n => n.includes('log') || n.includes('occurrence') || n.includes('incident'));
    if (logColName) {
      const logs = await db.collection(logColName).find({}).toArray();
      console.log(`\n📝  Migrating ${logs.length} logs...`);
      let ok = 0, fail = 0;

      for (const l of logs) {
        const companyId = companyMap.get(str(l.company || l.company_id)) || defaultCompanyId;
        const siteId    = siteMap.get(str(l.site || l.site_id)) || [...siteMap.values()][0] || null;
        const officerId = userMap.get(str(l.officer || l.officer_id || l.user || l.user_id)) || null;

        const payload = {
          company_id:  companyId,
          site_id:     siteId,
          officer_id:  officerId,
          log_type:    mapLogType(l.type || l.log_type || l.logType),
          title:       l.title || l.summary || null,
          description: l.description || l.details || l.notes || null,
          occurred_at: l.createdAt || l.occurred_at || l.occurredAt || new Date().toISOString(),
          meta:        l.meta || l.details || null,
        };

        const { error } = await supabase.from('occurrence_logs').insert(payload);
        if (error) { fail++; } else { ok++; }
      }
      console.log(`  ✓ ${ok} inserted, ${fail} failed`);
    }

    // ── 6. Tasks ─────────────────────────────────────────────
    const taskColName = collectionNames.find(n => n.includes('task'));
    if (taskColName) {
      const tasks = await db.collection(taskColName).find({}).toArray();
      console.log(`\n✅  Migrating ${tasks.length} tasks...`);
      let ok = 0, fail = 0;

      for (const t of tasks) {
        const companyId  = companyMap.get(str(t.company || t.company_id)) || defaultCompanyId;
        const siteId     = siteMap.get(str(t.site || t.site_id)) || null;
        const assignedTo = userMap.get(str(t.assignedTo || t.assigned_to || t.officer)) || null;
        const createdBy  = userMap.get(str(t.createdBy || t.created_by)) || null;

        const status = (() => {
          const s = (t.status || '').toUpperCase();
          if (s === 'COMPLETE' || s === 'COMPLETED' || s === 'DONE') return 'COMPLETE';
          if (s === 'IN_PROGRESS' || s === 'INPROGRESS' || s === 'ACTIVE') return 'IN_PROGRESS';
          return 'PENDING';
        })();

        const payload = {
          company_id:  companyId,
          site_id:     siteId,
          assigned_to: assignedTo,
          assigned_by: createdBy,
          title:       t.title || t.name || 'Untitled Task',
          description: t.description || t.notes || null,
          due_date:    t.dueDate || t.due_date || null,
        };

        const { error } = await supabase.from('tasks').insert(payload);
        if (error) { fail++; } else { ok++; }
      }
      console.log(`  ✓ ${ok} inserted, ${fail} failed`);
    }

    // ── Summary ───────────────────────────────────────────────
    console.log('\n🎉  Migration complete!');
    console.log(`    Companies : ${companyMap.size}`);
    console.log(`    Clients   : ${clientMap.size}`);
    console.log(`    Users     : ${userMap.size}`);
    console.log(`    Sites     : ${siteMap.size}`);
    console.log('\nNext: remove MONGODB_URI from Render env vars.');

  } catch (err) {
    console.error('❌  Migration failed:', err.message);
    console.error(err);
  } finally {
    await mongo.close();
  }
}

migrate();
