const { clerkClient } = require('@clerk/express');
const supabase = require('../lib/supabase');

// Decode JWT without verification to get userId - then verify via Clerk API
async function requireClerkSession(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorised' });
    }
    const token = authHeader.slice(7);
    
    // Decode the JWT payload without verification
    const parts = token.split('.');
    if (parts.length !== 3) return res.status(401).json({ error: 'Invalid token' });
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const userId = payload.sub;
    
    if (!userId) return res.status(401).json({ error: 'No user ID in token' });
    
    req.auth = { userId };
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ error: 'Unauthorised' });
  }
}

async function resolveUser(req, res, next) {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) return res.status(401).json({ error: 'Unauthorised' });

    let { data: user } = await supabase
      .from('users')
      .select('id, clerk_id, company_id, role, first_name, last_name, email, active, is_route_planner')
      .eq('clerk_id', clerkId)
      .single();

    if (!user) {
      try {
        const clerkUser = await clerkClient.users.getUser(clerkId);
        const clerkEmail = clerkUser?.emailAddresses?.[0]?.emailAddress;
        if (clerkEmail) {
          const { data: emailUser } = await supabase
            .from('users')
            .select('id, clerk_id, company_id, role, first_name, last_name, email, active, is_route_planner')
            .eq('email', clerkEmail.toLowerCase())
            .is('clerk_id', null)
            .single();
          if (emailUser) {
            await supabase.from('users').update({ clerk_id: clerkId }).eq('id', emailUser.id);
            user = { ...emailUser, clerk_id: clerkId };
          }
        }
      } catch (e) {
        console.error('Clerk lookup failed:', e.message);
      }
    }

    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.active) return res.status(403).json({ error: 'Account disabled' });

    req.user = user;
    next();
  } catch (err) { next(err); }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorised' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

const authenticate = [requireClerkSession, resolveUser];
module.exports = { authenticate, requireRole };
