import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bldooffwqjsjoxqkuivr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6JqdakJGKDHB6MaGjuV-3g_BNv7BT0S';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) {
    throw error;
  }
  return data;
}
