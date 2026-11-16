// Connexion à Supabase. Deux environnements : PRODUCTION (le vrai site) et TEST (pour essayer sans risque).
// Supabase > Project Settings > API : « Project URL » et clé « anon public » de chaque projet.
// La clé « anon » est faite pour être publique. Ne mettez JAMAIS ici la clé « service_role »
// ni les clés LengoPay : elles vont dans Supabase > Edge Functions > Secrets.
(function () {
  const PRODUCTION = {
    url: 'https://kifqplrxzpwjynpbmpfb.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZnFwbHJ4enB3anlucGJtcGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2NTk2NTcsImV4cCI6MjExMDIzNTY1N30.TdtH1yJjUsTlDMDogSENGHQ5jQ6LNN_vHIDSYm-karA',
    lengopay: true,
  };
  // Projet Supabase de test : à remplir quand il sera créé. Tant qu'il est vide, tout pointe sur la production.
  const TEST = {
    url: '',
    anonKey: '',
    lengopay: true,
  };
  // Adresses qui utilisent la PRODUCTION. Toute autre adresse (ordinateur local, site de test) utilise le projet de TEST.
  const PRODUCTION_HOSTS = ['fatibillets.vercel.app'];

  const onProd = PRODUCTION_HOSTS.includes(location.hostname) || !TEST.url;
  window.FB_CONFIG = Object.assign({ env: onProd ? 'production' : 'test' }, onProd ? PRODUCTION : TEST);
})();
