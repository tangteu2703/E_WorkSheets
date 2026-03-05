// js/supabase-config.js
const SUPABASE_URL = 'https://gapskgtvhqwrfgmelhgc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhcHNrZ3R2aHF3cmZnbWVsaGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODc5NzYsImV4cCI6MjA4ODI2Mzk3Nn0.Gg7guo6IKCSPQNNISmycrE25yfjtQVfOYtfiKo1hzxA';

// Initialize Supabase client
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
