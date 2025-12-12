// Supabase Configuration
// Replace these with your actual Supabase project credentials from:
// Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://ofjvbvfesjpaqjwujnbk.supabase.co'; // e.g., 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9manZidmZlc2pwYXFqd3VqbmJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MzUwNTUsImV4cCI6MjA4MTAxMTA1NX0._TmqlX2Qqo81tJ64GSiDtTPE7VCZGIgJVUlx-FajNgk'; // Your anon/public key

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
