import { createClient } from '@supabase/supabase-js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error(
    'Usage: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/promote-admin.mjs you@example.com',
  );
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error(
    'SUPABASE_URL and SUPABASE_SECRET_KEY are required. Keep the secret key outside the repository.',
  );
  process.exit(1);
}

const client = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: users, error: usersError } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) throw usersError;
const user = users.users.find((item) => item.email?.toLowerCase() === email);
if (!user) throw new Error(`No account found for ${email}`);
const { error } = await client.from('profiles').update({ role: 'admin', status: 'active' }).eq('id', user.id);
if (error) throw error;
console.log(`Admin role granted to ${email}`);
