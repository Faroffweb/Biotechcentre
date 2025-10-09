import { createClient } from '@supabase/supabase-js';

// Hardcoding credentials to fix runtime error where `process.env` is not defined.
// In a real build environment, these should come from environment variables.
const supabaseUrl = 'https://nftrbattvszunozvfjeu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mdHJiYXR0dnN6dW5venZmamV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NDM2NzgsImV4cCI6MjA3NTUxOTY3OH0.Vg3pKc6q37vXl5UUPLZeBWJMifwXfan3wxhT_635Ss8';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key are required.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
