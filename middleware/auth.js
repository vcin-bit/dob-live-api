const { clerkMiddleware, getAuth, clerkClient } = require('@clerk/express');
const supabase = require('../lib/supabase');

// Use official Clerk middleware
const clerkMw = clerkMiddleware({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

async function resolveUser(req, res, next) {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorised' });

    let { data: user } = await supabase
      .from('users')
      .select('id, clerk_id, company_id, role, first_name, last_name, email, active, is_route_planner')
      .eq('clerk_id', userId)
      .single();

    if (!user) {
      try {
        const clerkUser = await clerkClient.users.getUser(userId);
        const clerkEmail = clerkUser?.emailAddresses?.[0]?.emailAddress;
        if (clerkEmail) {
          const { data: emailUser } = await supabase
            .from('users')
            .select('id, clerk_id, company_id, role, first_name, last_name, email, active, is_route_planner')
            .eq('email', clerkEmail.toLowerCase())
            .is('clerk_id', null)
            .single();
          if (emailUser) {
            await supabase.from('users').update({ clerk_id: userId }).eq('id', emailUser.id);
            user = { ...emailUser, clerk_id: userId };
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

const authenticate = [clerkMw, resolveUser];
module.exports = { authenticate, requireRole, clerkMw };
