// Connexion à votre projet Supabase.
// Supabase > Project Settings > API : copiez « Project URL » et la clé « anon public ».
// La clé « anon » est faite pour être publique. Ne mettez JAMAIS ici la clé « service_role »
// ni les clés LengoPay : elles vont dans Supabase > Edge Functions > Secrets.
window.FB_CONFIG = {
  url: 'https://kifqplrxzpwjynpbmpfb.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZnFwbHJ4enB3anlucGJtcGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2NTk2NTcsImV4cCI6MjExMDIzNTY1N30.TdtH1yJjUsTlDMDogSENGHQ5jQ6LNN_vHIDSYm-karA',
  lengopay: true, // paiement en ligne LengoPay activé (false = paiement vérifié à la main par l'organisateur)
};
