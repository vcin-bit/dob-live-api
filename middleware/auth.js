const { requireAuth } = require('@clerk/express');
const supabase = require('../lib/supabase');

// Require a valid Clerk session
const requireClerkAuth = requireAuth();

// Resolve the Clerk user to a DB user and attach to req
async function resolveUser(req, res, next) {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) return res.status(401).json({ error: 'Unauthorised' });

    // Primary lookup: by clerk_id
    let { data: user } = await supabase
      .from('users')
      .select('id, clerk_id, company_id, role, first_name, last_name, email, active')
      .eq('clerk_id', clerkId)
      .single();

    // Fallback: match by email for users migrated from MongoDB who have not yet
    // signed in via Clerk. On first match we stamp the clerk_id so future logins hit the fast path.
    if (!user) {
      const clerkEmail = req.auth?.sessionClaims?.email;
      if (clerkEmail) {
        const { data: emailUser } = await supabase
          .from('users')
          .select('id, clerk_id, company_id, role, first_name, last_name, email, active')
          .eq('email', clerkEmail)
          .is('clerk_id', null)
          .single();

        if (emailUser) {
          await supabase
            .from('users')
            .update({ clerk_id: clerkId })
            .eq('id', emailUser.id);
          user = { ...emailUser, clerk_id: clerkId };
        }
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
const authenticate = [requireClerkAuth, resolveUser];

module.exports = { authenticate, requireRole, requireClerkAuth, resolveUser };
