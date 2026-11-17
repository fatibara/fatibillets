'use strict';
/* FatiBillets — panier multi-événements (paiement groupé) et version anglaise de l'interface.
   Chargé après modules4.js ; le panier nécessite la base v7 (supabase/schema_v7.sql). */

/* =====================================================================
   1. LANGUE
   Les textes de l'interface sont traduits à l'affichage. Les contenus saisis
   par les organisateurs (noms, descriptions) restent dans leur langue d'origine.
   ===================================================================== */
const LANG_KEY = 'fatibillets-langue';
try { window.FB_LANG = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'fr'; } catch (e) { window.FB_LANG = 'fr'; }
document.documentElement.lang = window.FB_LANG;

const EN = {
  // navigation et en-tête
  'Événements': 'Events', 'Votes': 'Votes', 'Cagnottes': 'Fundraisers', 'Inscriptions': 'Applications', 'Lieux': 'Venues', 'Mes billets': 'My tickets', 'Billets': 'Tickets',
  'Espace organisateur': 'Organizer area', 'Espace': 'My area', 'Scanner': 'Scanner', 'Administration': 'Administration', 'Admin': 'Admin', 'Mon compte': 'My account', 'Compte': 'Account',
  'Connexion': 'Sign in', 'Vente au guichet': 'Box office', 'Vente': 'Sales', 'Panier': 'Cart', 'Mon panier': 'My cart', 'Notifications': 'Notifications',
  // pied de page
  'Centre d\'aide': 'Help center', 'Blog': 'Blog', 'Contact': 'Contact', 'Prix et frais': 'Pricing and fees', 'Conditions': 'Terms', 'Confidentialité': 'Privacy', 'À propos': 'About', 'Assistance': 'Support',
  '— Une seule plateforme, plusieurs services, une ambition internationale.': '— One platform, many services, an international ambition.',
  // accueil
  'Guinée · Afrique · International': 'Guinea · Africa · International', 'Vos événements, vos billets,': 'Your events, your tickets,', 'une seule plateforme.': 'one single platform.',
  'Concerts, festivals, spectacles, conférences : réservez en quelques secondes et recevez votre billet sécurisé par QR code.': 'Concerts, festivals, shows, conferences: book in seconds and get a secure QR-code ticket.',
  'Rechercher': 'Search', 'Découvrir les événements': 'Discover events', 'Trier par': 'Sort by', 'Date': 'Date', 'Prix': 'Price',
  'Toutes les dates': 'All dates', 'Aujourd\'hui': 'Today', 'Demain': 'Tomorrow', 'Cette semaine': 'This week', 'Ce week-end': 'This weekend', 'Semaine prochaine': 'Next week', 'Ce mois': 'This month', 'Mois prochain': 'Next month',
  'Toutes catégories': 'All categories', 'Plus de filtres': 'More filters', 'Pays': 'Country', 'Ville': 'City', 'Prix minimum': 'Minimum price', 'Prix maximum': 'Maximum price', 'Gratuits uniquement': 'Free only', 'Appliquer': 'Apply', 'Réinitialiser': 'Reset', 'Tous': 'All',
  'Billetterie': 'Ticketing', 'Concours': 'Contests', 'Contributions': 'Donations', 'Candidatures': 'Applications',
  'Aucun événement ne correspond.': 'No event matches.', 'Essayez un autre mot-clé, une autre date ou retirez un filtre.': 'Try another keyword or date, or remove a filter.',
  'Aucun événement ne correspond à ces filtres.': 'No event matches these filters.', 'Retirer les filtres': 'Remove filters', 'Gratuit': 'Free',
  // statuts
  'Billetterie ouverte': 'On sale', 'En cours': 'Ongoing', 'Terminé': 'Ended', 'Annulé': 'Cancelled', 'SOLD OUT': 'SOLD OUT', 'À venir': 'Upcoming', 'Ouvert': 'Open', 'Clôturé': 'Closed', 'Suspendu': 'Suspended',
  'Clôturée': 'Closed', 'Objectif atteint': 'Goal reached', 'Suspendue': 'Suspended', 'Ouvertes': 'Open', 'Clôturées': 'Closed', 'Publié': 'Published', 'Brouillon': 'Draft', 'Corbeille': 'Trash',
  'Valide': 'Valid', 'Utilisé': 'Used', 'Remboursé': 'Refunded', 'Actif': 'Active', 'Active': 'Active', 'Inactive': 'Inactive', 'Inactif': 'Inactive',
  'En attente de paiement': 'Awaiting payment', 'Paiement en vérification': 'Payment being verified', 'Confirmée': 'Confirmed', 'Expirée': 'Expired', 'Annulée': 'Cancelled', 'Remboursement en cours': 'Refund in progress',
  'En attente': 'Pending', 'Acceptée': 'Accepted', 'Refusée': 'Rejected', 'Confirmé': 'Confirmed', 'Résolu': 'Resolved', 'Approuvée': 'Approved', 'Rejetée': 'Rejected',
  // page événement
  '← Tous les événements': '← All events', 'Lieu': 'Venue', 'Ville · Pays': 'City · Country', 'Organisateur': 'Organizer', 'Public': 'Audience', 'Tout public': 'All audiences',
  'Conditions d\'accès :': 'Access conditions:', 'Artistes et invités à l\'affiche': 'Featured artists and guests', 'Réserver': 'Book', '1. Choisissez la date': '1. Choose the date',
  '2. Choisissez la catégorie': '2. Choose the category', '3. Vos coordonnées': '3. Your details', 'Total': 'Total', 'Nom complet': 'Full name', 'Téléphone': 'Phone', 'E-mail': 'Email',
  'Vos places sont bloquées 30 minutes le temps du paiement. Aucun compte n\'est nécessaire.': 'Your seats are held for 30 minutes while you pay. No account needed.',
  'Vos places sont bloquées 30 minutes le temps du paiement.': 'Your seats are held for 30 minutes while you pay.',
  'SOLD OUT — PLACES ÉPUISÉES': 'SOLD OUT', 'SOLD OUT – PLACES ÉPUISÉES': 'SOLD OUT', 'Cet événement est terminé.': 'This event has ended.', 'Cet événement a été annulé.': 'This event has been cancelled.',
  'Ajouter au panier': 'Add to cart', '♡ Ajouter aux favoris': '♡ Add to favorites', '♥ Dans mes favoris': '♥ In my favorites', 'Partager': 'Share', 'Ajouter au calendrier': 'Add to calendar',
  'Fiche du lieu': 'Venue details', 'Organisé par': 'Organized by', 'Voir le profil': 'View profile', 'Avis des participants': 'Attendee reviews', 'Aucun avis pour le moment.': 'No reviews yet.',
  'Donner mon avis': 'Write a review', 'Modifier mon avis': 'Edit my review', 'Publier mon avis': 'Post my review', 'Vente terminée pour cette catégorie': 'Sales ended for this category',
  // commande et paiement
  'Paiement': 'Payment', '← Mes billets': '← My tickets', 'Places bloquées pendant': 'Seats held for', 'Passé ce délai, les places sont remises en vente automatiquement.': 'After this time, the seats go back on sale automatically.',
  'Annuler et libérer les places': 'Cancel and release the seats', 'Paiement sécurisé par LengoPay. Vous serez redirigé puis ramené sur cette page.': 'Secure payment by LengoPay. You will be redirected and brought back to this page.',
  'Paiement en cours de vérification': 'Payment being verified', 'Actualiser': 'Refresh', 'Afficher / Imprimer': 'Show / Print', 'Imprimer / PDF': 'Print / PDF', 'Fermer': 'Close',
  'BILLET D\'ENTRÉE': 'ADMISSION TICKET', 'Réservation expirée': 'Reservation expired', 'Les places ont été remises en vente.': 'The seats have been put back on sale.', 'Relancer une réservation': 'Book again',
  'Continuer vers le paiement': 'Continue to payment', 'Annuler': 'Cancel', 'Paiement confirmé': 'Payment confirmed', 'Paiement en attente': 'Payment pending',
  'Mes billets': 'My tickets', 'Vous n\'avez pas encore de billet.': 'You have no tickets yet.',
  // panier
  'Votre panier est vide.': 'Your cart is empty.', 'Réserver et payer': 'Book and pay', 'Retirer': 'Remove', 'Payer le panier': 'Pay for the cart', 'Payer le panier complet': 'Pay for the whole cart',
  // connexion et compte
  'Créer un compte': 'Create an account', 'Mot de passe': 'Password', 'Se connecter': 'Sign in', 'Créer mon compte': 'Create my account', 'Mot de passe oublié ?': 'Forgot password?',
  'Connexion requise': 'Sign-in required', 'Connectez-vous pour accéder à cette page.': 'Sign in to access this page.', 'Accès refusé': 'Access denied', 'Retour à l\'accueil': 'Back to home',
  'Profil': 'Profile', 'Nom': 'Name', 'Rôle': 'Role', 'Statut': 'Status', 'Enregistrer': 'Save', 'Se déconnecter': 'Sign out', 'Devenir organisateur': 'Become an organizer',
  'Informations personnelles': 'Personal information', 'Date de naissance': 'Date of birth', 'Changer le mot de passe': 'Change password', 'Mot de passe actuel': 'Current password',
  'Nouveau mot de passe': 'New password', 'Répéter le nouveau mot de passe': 'Repeat the new password', 'Modifier le mot de passe': 'Change password', 'Mes favoris': 'My favorites',
  'Organisateurs suivis': 'Followed organizers', 'Mes avis': 'My reviews', 'Mes votes et contributions': 'My votes and donations', 'Mes candidatures': 'My applications',
  'Mes dossiers d\'assistance': 'My support tickets', 'Notifications et préférences': 'Notifications and preferences', 'Préférences': 'Preferences', 'Suivre': 'Follow', 'Abonné ✓': 'Following ✓', 'Ne plus suivre': 'Unfollow',
  'Participant': 'Attendee', 'Vendeur': 'Seller', 'Administrateur général': 'General administrator', 'Administrateur secondaire': 'Secondary administrator',
  // votes, cagnottes, inscriptions
  'Votes et concours': 'Votes and contests', 'Voter': 'Vote', 'Rechercher un candidat': 'Search for a candidate', 'votes': 'votes', 'Contribuer': 'Donate',
  'Cagnottes et contributions': 'Fundraisers and donations', 'Dernières contributions': 'Latest donations', 'Inscriptions et candidatures': 'Applications and registrations',
  'Déposer ma candidature': 'Apply', 'Suivre ma candidature': 'Track my application', 'Numéro de dossier': 'Application number', 'E-mail utilisé': 'Email used', 'SOUMETTRE MA CANDIDATURE': 'SUBMIT MY APPLICATION',
  'Identité et coordonnées': 'Identity and contact details', 'Parcours académique': 'Education', 'Compétences et expériences': 'Skills and experience', 'Disponibilité et motivations': 'Availability and motivation',
  // pages
  'Nous contacter': 'Contact us', 'Objet': 'Subject', 'Message': 'Message', 'Envoyer': 'Send', 'Autres moyens': 'Other options', 'Participants': 'Attendees', 'Organisateurs': 'Organizers',
  'Cette page est en cours de rédaction.': 'This page is being written.', 'Aucun article publié pour le moment.': 'No articles published yet.', '← Tous les articles': '← All articles',
  'Salles, espaces et sites pour vos événements.': 'Halls, spaces and sites for your events.', 'Type': 'Type', 'Capacité minimum': 'Minimum capacity', 'Filtrer': 'Filter', '← Tous les lieux': '← All venues',
  'Commodités': 'Amenities', 'Tarifs': 'Rates', 'Disponibilité': 'Availability', 'Restauration et boissons': 'Food and drinks', 'Demander un devis': 'Request a quote', 'Envoyer la demande': 'Send request',
  'Événements à venir': 'Upcoming events', 'Événements à venir dans ce lieu': 'Upcoming events at this venue', 'Adresse': 'Address', 'Places assises': 'Seats', 'Places debout': 'Standing',
  'Maintenance en cours': 'Maintenance in progress',
  // organisateur et administration
  'Votes': 'Votes', 'Finances': 'Finances', 'Vendeurs': 'Sellers', 'Scanners': 'Scanners', 'Transactions': 'Transactions', 'Avis': 'Reviews', 'Profil public': 'Public profile',
  'Mes événements': 'My events', '+ Créer un événement': '+ Create an event', 'Créer un événement': 'Create an event', 'Modifier': 'Edit', 'Statistiques': 'Statistics',
  'Paiements à vérifier': 'Payments to verify', 'Billets émis': 'Issued tickets', 'Confirmer': 'Confirm', 'Rejeter': 'Reject', 'Rembourser': 'Refund', 'Exporter (Excel/CSV)': 'Export (Excel/CSV)',
  'Recettes billetterie': 'Ticket revenue', 'Billets vendus': 'Tickets sold', 'Billets disponibles': 'Tickets available', 'Recettes': 'Revenue', 'Vue d\'ensemble': 'Overview', 'Comptes et rôles': 'Accounts and roles',
  '⚙ Paramètres': '⚙ Settings', 'Paramètres': 'Settings', 'Catégories': 'Categories', 'Journal d\'audit': 'Audit log', 'Réclamations': 'Complaints', 'Paiements': 'Payments', 'Pays et devises': 'Countries and currencies',
  'Votes et cagnottes': 'Votes and fundraisers', 'Pages et aide': 'Pages and help', 'Direction FATIGLOBAL': 'FATIGLOBAL Management', 'Contrôle des billets': 'Ticket control', 'Valider': 'Validate',
  'Scanner avec la caméra': 'Scan with the camera', 'Mes dernières opérations': 'My latest scans', 'BILLET VALIDE — ENTRÉE AUTORISÉE': 'VALID TICKET — ENTRY ALLOWED', 'TICKET DÉJÀ UTILISÉ': 'TICKET ALREADY USED',
  'BILLET INCONNU': 'UNKNOWN TICKET', 'BILLET INVALIDÉ': 'INVALIDATED TICKET', 'BILLET POUR UNE AUTRE DATE': 'TICKET FOR ANOTHER DATE', 'BILLET D\'UN AUTRE ÉVÉNEMENT': 'TICKET FOR ANOTHER EVENT',
  'Vous êtes connecté': 'You are signed in', 'Récapitulatif': 'Summary', 'Vider le panier': 'Empty the cart', 'Voir': 'View', 'Réservez plusieurs événements et payez en une seule fois.': 'Book several events and pay once.',
  'Description': 'Description', 'Slogan': 'Slogan', 'Catégorie': 'Category', 'Publier l\'événement': 'Publish the event', 'Commission FATIGLOBAL': 'FATIGLOBAL commission', 'Disponible au retrait': 'Available for withdrawal',
  'Demande de paiement': 'Payout request', 'Mes demandes': 'My requests', 'Envoyer à la Direction': 'Send to management', 'Mes lieux': 'My venues', '+ Nouveau lieu': '+ New venue',
  'Chargement…': 'Loading…', 'Une erreur est survenue': 'An error occurred', 'Réessayer': 'Try again', 'Page introuvable': 'Page not found',
};
const EN_RX = [
  [/^(\d+) événements?$/, '$1 event(s)'], [/^(\d+) lieu\(x\)$/, '$1 venue(s)'], [/^Réserver (\d+) billets?$/, 'Book $1 ticket(s)'], [/^Dès (.+)$/, 'From $1'],
  [/^Plus que (\d+) places? !$/, 'Only $1 left!'], [/^([\d\s ]+) places disponibles$/, '$1 seats available'], [/^Payer (.+)$/, 'Pay $1'], [/^Clôture : (.+)$/, 'Closes: $1'],
  [/^Titulaire : (.+)$/, 'Holder: $1'], [/^Créé le (.+)$/, 'Created on $1'], [/^Vente à partir du (.+) à (.+)$/, 'On sale from $1 at $2'], [/^Jusqu'au (.+)$/, 'Until $1'],
  [/^(\d+) candidats · (.+) votes$/, '$1 candidates · $2 votes'], [/^(.+) \/ vote$/, '$1 / vote'], [/^Vote gratuit$/, 'Free vote'], [/^sur (.+)$/, 'of $1'],
];
function trText(s) {
  const k = s.replace(/\s+/g, ' ').trim(); if (!k || k.length > 220) return null;
  let v = EN[k];
  if (v == null) for (const [rx, rep] of EN_RX) { if (rx.test(k)) { v = k.replace(rx, rep); break; } }
  return v == null || v === k ? null : s.replace(s.trim(), v);
}
function translateTree(root) {
  if (window.FB_LANG !== 'en' || !root) return;
  if (root.nodeType === 3) { const t = trText(root.nodeValue); if (t) root.nodeValue = t; return; }
  if (root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|svg)$/i.test(root.nodeName)) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) { const t = trText(n.nodeValue); if (t) n.nodeValue = t; }
  root.querySelectorAll && root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
    for (const a of ['placeholder', 'title', 'aria-label']) { const v = el.getAttribute(a); const t = v && trText(v); if (t) el.setAttribute(a, t); }
  });
}
if (window.FB_LANG === 'en') {
  new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(n => translateTree(n)); }).observe(document.body, { childList: true, subtree: true });
  const _toast5 = toast; toast = m => _toast5(trText(String(m)) || m);
}
function langSwitch(v) { try { localStorage.setItem(LANG_KEY, v); } catch (e) { /* stockage indisponible */ } location.reload(); }

/* =====================================================================
   2. PANIER MULTI-ÉVÉNEMENTS
   Chaque date d'événement donne sa propre commande (stock et comptabilité inchangés),
   puis le panier regroupe les commandes payantes pour un seul paiement LengoPay.
   ===================================================================== */
const CART_KEY = 'fatibillets-panier', CART_MAX_DATES = 3;
const cartGet = () => { try { const c = JSON.parse(localStorage.getItem(CART_KEY)); return Array.isArray(c) ? c : []; } catch (e) { return []; } };
const cartSet = c => { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) { /* stockage indisponible */ } cartSync(); };
function cartSync() {
  const b = $('#cartBtn'); if (!b) return; const n = cartGet().reduce((a, x) => a + x.q, 0);
  b.hidden = !n; $('#cartN').textContent = n ? String(n) : '';
}
function cartResolve(D) {
  const now = Date.now(), lines = [];
  for (const it of cartGet()) {
    for (const ev of D.events) { const d = ev.dates.find(x => x.id === it.d); if (!d) continue; const t = d.tiers.find(x => x.id === it.t); if (t && d.end > now && !ev.cancelled) lines.push({ ...it, ev, d, t }); }
  }
  return lines;
}

const _vEvent5 = VIEWS.e;
VIEWS.e = async p => {
  const h = await _vEvent5(p);
  return h.replace(/(<button class="btn xl">Réserver[^<]*<\/button>)(<\/form>)/, '$1<button type="button" class="btn ghost" data-a="addCart">Ajouter au panier</button>$2');
};
VIEWS.commande = async p => {
  let h = await vOrder(p[1]);
  try { const o = await rpc('get_order', { p_id: p[1] }); if (o && o.cart_id && o.status === 'en_attente') h = h.replace(/<button class="btn xl" data-a="lengopay"[\s\S]*?<\/button>/, `<a class="btn xl" href="#/panier/${o.cart_id}">Payer le panier complet</a>`); } catch (e) { /* commande seule */ }
  return h;
};

VIEWS.panier = async p => {
  if (p[1]) return cartPage(p[1]);
  const D = await loadData(true), L = cartResolve(D);
  if (L.length !== cartGet().length) cartSet(L.map(({ d, t, q }) => ({ d: d.id, t: t.id, q })));
  if (!L.length) return head('Mon panier', 'Réservez plusieurs événements et payez en une seule fois.') + box('Votre panier est vide.', '<a class="btn" href="#/">Découvrir les événements</a>');
  const groups = [...new Set(L.map(x => x.d.id))].map(id => L.filter(x => x.d.id === id)), curs = [...new Set(L.map(x => x.ev.currency))];
  const total = L.reduce((a, x) => a + x.q * x.t.price, 0);
  return head('Mon panier', 'Réservez plusieurs événements et payez en une seule fois.') + `<div class="wrap sec"><div class="cols"><div class="stack">${groups.map(g => `<div class="card pad"><div class="row between"><div><b>${esc(g[0].ev.name)}</b><div class="sm mut">${ic('cal')} ${dFmt(g[0].d.start)} · ${hFmt(g[0].d.start)} · ${esc(g[0].ev.venue || '')}</div></div><a class="btn s ghost" href="#/e/${g[0].ev.id}">Voir</a></div>${g.map(x => { const i = cartGet().findIndex(c => c.t === x.t.id); const max = Math.min(x.t.avail, x.t.max_per_order || 10); return `<div class="tier"><div class="t-i"><b>${esc(x.t.name)}</b><div class="sm" style="color:var(--o-d);font-weight:700">${fmt(x.t.price, x.ev.currency)}</div>${x.q > max ? `<div class="xs" style="color:var(--red);font-weight:700">Plus que ${max} place(s) disponible(s)</div>` : ''}</div><div class="step"><button data-a="cartQty" data-i="${i}" data-d="-1" aria-label="Moins">−</button><span>${x.q}</span><button data-a="cartQty" data-i="${i}" data-d="1" ${x.q >= max ? 'disabled' : ''} aria-label="Plus">+</button></div></div>`; }).join('')}</div>`).join('')}
  <div><button class="link sm" data-a="cartClear">Vider le panier</button></div></div>
  <aside class="card pad stack sticky"><h3 style="margin:0">Récapitulatif</h3>${curs.length > 1 ? '<div class="note">Les billets du panier sont dans des devises différentes : réservez-les séparément.</div>' : `<div class="total"><span>Total</span><span>${fmt(total, curs[0])}</span></div>`}
  ${groups.length > CART_MAX_DATES ? `<div class="note">Un panier est limité à ${CART_MAX_DATES} dates d'événement différentes.</div>` : ''}
  <form class="stack" data-f="cartCheckout"><label class="f">Nom complet<input name="name" required minlength="3" autocomplete="name" value="${esc(ME?.full_name || '')}"></label><label class="f">Téléphone<input name="phone" required pattern="[+0-9 ]{8,}" inputmode="tel" autocomplete="tel" value="${esc(ME?.phone || '')}"></label><label class="f">E-mail<input name="email" type="email" required autocomplete="email" value="${esc(ME?.email || '')}"></label><button class="btn xl" ${curs.length > 1 || groups.length > CART_MAX_DATES ? 'disabled' : ''}>Réserver et payer</button></form>
  <p class="xs mut" style="margin:0">Toutes les places sont bloquées 30 minutes le temps d'un paiement unique. Chaque événement reçoit ses propres billets.</p></aside></div></div>`;
};
async function cartPage(id) {
  let c = await rpc2('get_cart', { p_id: id }); if (!c) return vNotFound();
  if (c.pay_started && c.status === 'en_attente') { try { await fn('lengopay-pay', { action: 'check', cart_id: id }); c = await rpc2('get_cart', { p_id: id }); } catch (e) { /* on réessaiera */ } }
  c.orders.forEach(o => rememberOrder(o.id));
  const expired = c.status === 'en_attente' && (!c.expires_at || ts(c.expires_at) < Date.now()) && !c.pay_started;
  vOrder.poll = c.status === 'en_attente' && c.pay_started ? id : null;
  const recap = `<div class="card pad">${c.orders.map(o => `<div class="row between sm" style="padding:6px 0;border-bottom:1px solid var(--line)"><span><b>${esc(o.event.name)}</b><br><span class="xs mut">${dFmt(o.starts_at)} · ${o.items.map(i => i.qty + ' × ' + esc(i.name)).join(', ')}</span></span><b>${fmt(o.total, o.currency)}</b></div>`).join('')}<div class="total"><span>Total</span><span>${fmt(c.total, c.currency)}</span></div></div>`;
  let body;
  if (c.status === 'confirme') body = `<div class="note">${ic('check')} Panier payé. Vos billets sont ci-dessous et dans « Mes billets ».</div>${c.orders.filter(o => o.status === 'confirme').map(o => o.tickets.map(k => ticketCard(k, o)).join('')).join('')}${c.orders.some(o => o.status === 'a_rembourser') ? '<div class="note">Une partie du paiement est arrivée après l\'expiration de la réservation et n\'a pas pu être honorée : elle vous sera remboursée.</div>' : ''}`;
  else if (c.status === 'a_rembourser') body = `<div class="card pad"><h2>Remboursement en cours</h2><p>Votre paiement a été reçu mais n'a pas pu être pris en compte. FATIGLOBAL vous rembourse : conservez la référence ${esc(c.id.slice(0, 8).toUpperCase())}.</p></div>`;
  else if (expired) body = `<div class="card pad"><h2>Réservation expirée</h2><p class="mut">Les places ont été remises en vente.</p><a class="btn" href="#/panier">Retour au panier</a></div>`;
  else body = `<div class="card pad stack"><h2>${c.pay_started ? ic('clock') + ' Paiement en attente' : 'Paiement du panier'}</h2><p style="margin:0">${c.pay_started ? 'Si vous avez payé, la confirmation arrive dans un instant : cette page se met à jour automatiquement.' : `Payez <b>${money(c.total, c.currency)}</b> en une seule fois par Orange Money, MTN MoMo ou carte.`}</p><button class="btn xl" data-a="payCart" data-id="${c.id}">${ic('phone')} Payer ${money(c.total, c.currency)}</button>${c.pay_started ? '<button class="btn ghost" data-a="refresh">Actualiser</button>' : ''}</div>${c.expires_at && !c.pay_started ? `<div class="cd" id="cdbox"><div><div class="xs" style="opacity:.8">Places bloquées pendant</div><b data-cd="${ts(c.expires_at)}">--:--</b></div><div class="sm" style="opacity:.85">Passé ce délai, les places sont remises en vente automatiquement.</div></div>` : ''}`;
  return head('Mon panier', 'Référence ' + esc(c.id.slice(0, 8).toUpperCase())) + `<div class="wrap sec"><div class="cols"><div class="stack">${body}</div><aside class="sticky">${recap}</aside></div></div>`;
}

Object.assign(A, {
  langSwitch(el) { langSwitch(el.dataset.v); },
  addCart(el) {
    const form = el.closest('form'), date = form && form.dataset.date, sel = UI.sel[date] || {}, items = Object.entries(sel).filter(([, q]) => q > 0);
    if (!items.length) return toast('Choisissez au moins un billet.');
    const c = cartGet(), dates = new Set(c.map(x => x.d)); dates.add(date);
    if (dates.size > CART_MAX_DATES) return toast(`Un panier est limité à ${CART_MAX_DATES} dates d'événement différentes.`);
    for (const [t, q] of items) { const x = c.find(i => i.t === t); if (x) x.q += q; else c.push({ d: date, t, q }); }
    cartSet(c); UI.sel[date] = {}; toast('Ajouté au panier.'); render();
  },
  cartQty(el) { const c = cartGet(), x = c[+el.dataset.i]; if (!x) return; x.q += +el.dataset.d; cartSet(c.filter(i => i.q > 0)); render(); },
  cartClear() { cartSet([]); render(); },
  async payCart(el) {
    if (el.disabled) return; el.disabled = true; el.textContent = 'Redirection vers le paiement…';
    try { const r = await fn('lengopay-pay', { action: 'create', cart_id: el.dataset.id }); if (!/^https:\/\//.test(r.payment_url || '')) throw new Error('Lien de paiement invalide.'); location.href = r.payment_url; }
    catch (e) { toast(e.message); render(); }
  },
});
Object.assign(F, {
  async cartCheckout(f) {
    const D = await loadData(true), L = cartResolve(D), groups = [...new Set(L.map(x => x.d.id))];
    if (!L.length) throw new Error('Votre panier est vide.');
    const ids = [];
    try {
      for (const d of groups) {
        const items = L.filter(x => x.d.id === d).map(x => ({ tier_id: x.t.id, qty: x.q }));
        const id = await rpc('reserve', { p_date: d, p_items: items, p_name: f.get('name'), p_phone: f.get('phone'), p_email: f.get('email') });
        ids.push(id); rememberOrder(id);
      }
    } catch (e) {
      for (const id of ids) await rpc('cancel_order', { p_order: id }).catch(() => {});
      throw new Error((e.message || 'Réservation impossible') + ' — aucune place n\'a été gardée, corrigez le panier puis réessayez.');
    }
    const orders = await Promise.all(ids.map(id => rpc('get_order', { p_id: id })));
    const paid = orders.filter(o => o && +o.total > 0).map(o => o.id);
    cartSet([]); DATA = null;
    if (!paid.length) { toast('Billets confirmés.'); location.hash = '#/billets'; return; }
    if (paid.length === 1) { location.hash = '#/commande/' + paid[0]; return; }
    const cid = await rpc2('create_cart', { p_orders: paid }); location.hash = '#/panier/' + cid;
  },
});

/* ---------- en-tête : panier et langue ---------- */
const _render5 = render;
render = async function () { await _render5(); cartSync(); };
(function header() {
  const auth = $('#auth'); if (!auth) return;
  const cart = document.createElement('a'); cart.id = 'cartBtn'; cart.className = 'bell cart-btn'; cart.href = '#/panier'; cart.hidden = true; cart.setAttribute('aria-label', 'Panier');
  cart.innerHTML = ic('ticket') + '<span id="cartN"></span>'; auth.parentNode.insertBefore(cart, auth);
  const foot = document.querySelector('.foot-links');
  if (foot) foot.insertAdjacentHTML('beforeend', window.FB_LANG === 'en' ? '<button class="link lang-btn" data-a="langSwitch" data-v="fr">Français</button>' : '<button class="link lang-btn" data-a="langSwitch" data-v="en">English</button>');
  auth.insertAdjacentHTML('beforebegin', `<button class="lang-top" data-a="langSwitch" data-v="${window.FB_LANG === 'en' ? 'fr' : 'en'}" title="${window.FB_LANG === 'en' ? 'Français' : 'English'}">${window.FB_LANG === 'en' ? 'FR' : 'EN'}</button>`);
  cartSync();
})();

boot();
