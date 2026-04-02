export const SUPABASE_URL = 'https://wycjvjlhabiyhusupivx.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5Y2p2amxoYWJpeWh1c3VwaXZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Mjc2MzksImV4cCI6MjA3NDQwMzYzOX0.pFu4bfrsvZpr7D4bh3LhoDZuRetsUZO6p2MavMtfyv0';

export const fallbackDepartments = [
  'DACOC', 'DADIN', 'DAEFI', 'DAELN', 'DAELT', 'DAEST', 'DAFCH', 'DAFIS', 'DAGEE', 'DAINF', 'DALEM', 'DALIC', 'DAMAT', 'DAMEC', 'DAQBI', 'DEAAU', 'DAEDU',
  'CPGEI', 'PPGA', 'PPGCA', 'PPGCTA', 'PPGDP', 'PPGEB', 'PPGEC', 'PPGEF', 'PPGEL', 'PPGEM', 'PPGET', 'PPGFA', 'PPGFCET', 'PPGPGP', 'PPGQ', 'PPGSAU', 'PPGSE', 'PPGTE', 'PROFIAP', 'PROFMAT'
];

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
