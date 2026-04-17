const { requireAuth, clerkClient } = require('@clerk/express');
const supabase = require('../lib/supabase');

// Require a valid Clerk session - return 401 JSON, never redirect
const requireClerkAuth = requireAuth({ signInUrl: null });

// Middleware to convert Clerk redirects to 401 JSON
function clerkAuthMiddleware(req, res, next) {
  requireClerkAuth(req, res, (err) => {
    if (err) return res.status(401).json({ error: 'Unauthorised' });
    if (!req.auth?.userId) return res.status(401).json({ error: 'Unauthorised' });
    next();
  });
}

// Resolve the Clerk user to a DB user and attach to req
async function resolveUser(req, res, next) {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) return res.status(401).json({ error: 'Unauthorised' });

    // Primary lookup: by clerk_id
    let { data: user } = await supabase
      .from('users')
      .select('id, clerk_id, company_id, role, first_name, last_name, email, active, is_route_planner')
      .eq('clerk_id', clerkId)
      .single();

    // Fallback: fetch email from Clerk API and match against migrated users
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
            // Auto-link: stamp the clerk_id so future logins hit the fast path
            await supabase
              .from('users')
              .update({ clerk_id: clerkId })
              .eq('id', emailUser.id);
            user = { ...emailUser, clerk_id: clerkId };
          }
        }
      } catch (clerkErr) {
        console.error('Clerk user fetch failed:', clerkErr.message);
      }
    }

    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.active) return res.status(403).json({ error: 'Account disabled' });

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Require specific roles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorised' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Combined: Clerk auth + DB user resolution
const authenticate = [clerkAuthMiddleware, resolveUser];

module.exports = { authenticate, requireRole, requireClerkAuth, resolveUser };
