'use strict';
/* FatiBillets — choix du profil à la création du compte : Participant, Organisateur, Transport & logistique.
   Chaque profil arrive sur sa page. Organisateur et Transport & logistique sont validés par la Direction FATIGLOBAL.
   Chargé après modules9.js ; nécessite la base v12 (supabase/schema_v12.sql). */

const PROFILES = [
  ['participant', 'Participant', 'Acheter des billets, voter, contribuer aux cagnottes, réserver un trajet.', 'ticket', 'Actif tout de suite'],
  ['organisateur', 'Organisateur', 'Publier vos événements, vendre vos billets, gérer vos votes, cagnottes et inscriptions.', 'cal', 'Validé par la Direction'],
  ['transport', 'Transport & logistique', 'Proposer vos trajets, vendre vos places, gérer véhicules, chauffeurs et colis.', 'bus', 'Validé par la Direction'],
];
const ACTIVITY_L = { passagers: 'Transport de passagers', logistique: 'Logistique et colis', les_deux: 'Passagers, logistique et colis' };
const CITY_LIST = () => (typeof CITIES !== 'undefined' && Array.isArray(CITIES) ? CITIES : []);

/* ---------- formulaire de création du compte ---------- */
window.pfSwitch = input => {
  const form = input.closest('form'), v = input.value; form.dataset.p = v;
  form.querySelectorAll('.pf-card').forEach(c => c.classList.toggle('on', c.contains(input)));
  form.querySelectorAll('[data-for]').forEach(box => { const on = box.dataset.for === v; box.hidden = !on; box.querySelectorAll('input,select').forEach(i => { i.disabled = !on; }); });
  const b = form.querySelector('button.btn.xl'); if (b) b.textContent = v === 'participant' ? 'Créer mon compte' : v === 'organisateur' ? 'Créer mon compte organisateur' : 'Créer mon compte transport & logistique';
};
function vSignup(pre) {
  const sel = PROFILES.some(p => p[0] === pre) ? pre : 'participant';
  const box = (k, html) => `<div class="stack" data-for="${k}" ${k === sel ? '' : 'hidden'}>${html.replace(/<(input|select)/g, k === sel ? '<$1' : '<$1 disabled')}</div>`;
  return `<div class="wrap sec"><div class="card pad stack" style="max-width:620px;margin:0 auto"><div class="tabs" style="margin-bottom:6px"><a href="#" data-a="authTab" data-v="in">Connexion</a><a href="#" data-a="authTab" data-v="up" class="on">Créer un compte</a></div>
  <form class="stack" data-f="signup" data-p="${sel}"><div><div class="sm" style="font-weight:700;margin-bottom:8px">Je crée un compte :</div><div class="pf-grid">${PROFILES.map(([k, l, d, icon, tag]) => `<label class="pf-card ${k === sel ? 'on' : ''}"><input type="radio" name="profile" value="${k}" ${k === sel ? 'checked' : ''} onchange="pfSwitch(this)"><span class="pf-ic">${ic(icon)}</span><b>${l}</b><span class="xs mut">${d}</span><span class="pf-tag">${tag}</span></label>`).join('')}</div></div>
  <div class="g2"><label class="f">Nom complet<input name="name" required minlength="3" autocomplete="name"></label><label class="f">Téléphone (il vous servira à vous connecter)<input name="phone" required pattern="[+0-9 ]{8,}" inputmode="tel" autocomplete="tel"></label></div>
  ${box('organisateur', `<label class="f">Nom de votre organisation ou structure<input name="org_name" required minlength="2" placeholder="Ex. LIOEVENTS"></label>`)}
  ${box('transport', `<div class="g2"><label class="f">Nom de votre entreprise de transport<input name="carrier_name" required minlength="2" placeholder="Ex. Express Kindia"></label><label class="f">Activité<select name="carrier_activity" required>${Object.entries(ACTIVITY_L).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label></div><label class="f">Ville principale<input name="carrier_city" list="pf-cities" placeholder="Ex. Conakry"></label><datalist id="pf-cities">${CITY_LIST().slice(0, 300).map(c => `<option value="${esc(c.name || c)}">`).join('')}</datalist>`)}
  <div class="g2"><label class="f">E-mail<input name="email" type="email" required autocomplete="email"></label><label class="f">Mot de passe<input name="password" type="password" required minlength="8" autocomplete="new-password"></label></div>
  <div class="note sm" data-for="organisateur" ${sel === 'organisateur' ? '' : 'hidden'}>Votre demande est envoyée automatiquement à la Direction FATIGLOBAL. Dès la validation, votre espace organisateur s'ouvre et vous êtes notifié.</div>
  <div class="note sm" data-for="transport" ${sel === 'transport' ? '' : 'hidden'}>Votre demande est envoyée automatiquement à la Direction FATIGLOBAL. Dès la validation, votre espace Transport & logistique s'ouvre et vous êtes notifié.</div>
  <button class="btn xl">${sel === 'participant' ? 'Créer mon compte' : sel === 'organisateur' ? 'Créer mon compte organisateur' : 'Créer mon compte transport & logistique'}</button><p class="xs mut" style="margin:0">Le compte est gratuit. Il n'est pas obligatoire pour acheter un billet.</p></form></div></div>`;
}
const _connexion10 = VIEWS.connexion;
VIEWS.connexion = async p => {
  if (p && PROFILES.some(x => x[0] === p[1])) UI.authTab = 'up';
  return UI.authTab === 'up' && !ME ? vSignup(p && p[1]) : _connexion10(p);
};
const _authTab10 = A.authTab;
A.authTab = el => { if (el.dataset.v === 'in' && /^#\/connexion\/./.test(location.hash)) { UI.authTab = 'in'; location.hash = '#/connexion'; return; } return _authTab10(el); };
F.signup = async f => {
  const prof = f.get('profile') || 'participant', phone = f.get('phone').trim();
  let used = false; try { used = await rpc2('phone_in_use', { p_phone: phone }); } catch (e) { /* base pas à jour */ }
  if (used) throw new Error('Ce numéro de téléphone est déjà utilisé par un autre compte. Connectez-vous, ou utilisez un autre numéro.');
  const meta = { full_name: f.get('name').trim(), phone, profile: prof };
  if (prof === 'organisateur') meta.org_name = f.get('org_name').trim();
  if (prof === 'transport') Object.assign(meta, { carrier_name: f.get('carrier_name').trim(), carrier_activity: f.get('carrier_activity'), city: (f.get('carrier_city') || '').trim() });
  const { data, error } = await sb.auth.signUp({ email: f.get('email').trim(), password: f.get('password'), options: { data: meta, emailRedirectTo: location.origin + location.pathname } });
  if (error) throw new Error(error.message);
  const next = prof === 'organisateur' ? '#/org' : prof === 'transport' ? '#/transporteur' : '#/compte';
  if (!data.session) { modal(`<h2>Vérifiez votre boîte mail</h2><p>Un lien de confirmation a été envoyé à <b>${esc(f.get('email'))}</b>. Cliquez dessus pour activer votre compte${prof === 'participant' ? '' : ' : votre demande est déjà transmise à la Direction FATIGLOBAL'}.</p><button class="btn" data-a="close">Compris</button>`); return; }
  await loadMe(); location.hash = next; await render();
  toast(prof === 'participant' ? 'Bienvenue sur FatiBillets !' : 'Compte créé : votre demande est transmise à la Direction FATIGLOBAL.');
};
// Après connexion par e-mail : chacun arrive sur sa page.
const _signin10 = F.signin;
F.signin = async f => { await _signin10(f); const l = landing(); if (l !== '#/' && location.hash !== l) location.hash = l; };

/* ---------- page de chaque profil en attente de validation ---------- */
const steps = (done, label) => `<ol class="pf-steps"><li class="ok">${ic('check')} Compte créé</li><li class="${done ? 'ok' : 'cur'}">${done ? ic('check') : '<span class="spin-dot"></span>'} Vérification par la Direction FATIGLOBAL</li><li>${label}</li></ol>`;
function pendingPage(kind) {
  const org = kind === 'organisateur', req = org ? ME.org_requested : !!ME.carrier_request, r = ME.carrier_request || {};
  const title = org ? 'Espace organisateur' : 'Espace Transport & logistique';
  if (ME.role !== 'participant') return box(title, `<p class="mut">Cet espace n'est pas disponible pour votre type de compte.</p><a class="btn" href="${landing()}">Retour à mon espace</a>`);
  const body = req
    ? `${steps(false, org ? 'Ouverture de votre espace organisateur' : 'Ouverture de votre espace transporteur')}<div class="note"><b>Demande en cours d'examen</b><br>${org ? 'Organisation : <b>' + esc(ME.org_name || '') + '</b>' : 'Entreprise : <b>' + esc(r.name || '') + '</b> · ' + esc(ACTIVITY_L[r.activity] || '') + (r.city ? ' · ' + esc(r.city) : '')}<br><span class="sm mut">Vous recevrez une notification dès la décision. En général sous 24 à 48 heures ouvrées.</span></div>
       <p class="sm mut" style="margin:0">${org ? 'Une fois validé, vous pourrez publier vos événements, vendre vos billets en ligne et en point de vente, créer des votes, des cagnottes et des formulaires d\'inscription.' : 'Une fois validé, vous pourrez ajouter vos véhicules et chauffeurs, programmer vos trajets, vendre vos places en ligne et gérer vos colis.'}</p>`
    : org ? `<p class="mut" style="margin:0">Publiez vos événements et vendez vos billets. Chaque demande est validée par la Direction FATIGLOBAL.</p><form class="stack" data-f="orgRequest"><label class="f">Nom de votre organisation<input name="org" required minlength="2"></label><button class="btn">Envoyer la demande</button></form>`
    : `<p class="mut" style="margin:0">Transporteurs, agences de voyage et sociétés de logistique : vendez vos places et gérez vos colis sur FatiBillets. Chaque demande est validée par la Direction FATIGLOBAL.</p><form class="stack" data-f="carrierRequest"><div class="g2"><label class="f">Nom de votre entreprise<input name="name" required minlength="2"></label><label class="f">Activité<select name="activity">${Object.entries(ACTIVITY_L).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label></div><label class="f">Ville principale<input name="city" placeholder="Ex. Conakry"></label><button class="btn">Envoyer la demande</button></form>`;
  return head(title, req ? 'Votre demande a bien été reçue.' : 'Faites votre demande en une minute.') + `<div class="wrap sec"><div class="card pad stack" style="max-width:720px;margin:0 auto">${body}<div class="row"><a class="btn ghost" href="#/">Voir les événements</a><a class="btn ghost" href="#/compte">Mon compte</a></div></div></div>`;
}
const _org10 = VIEWS.org;
VIEWS.org = async p => (ME && role() === 'participant' ? pendingPage('organisateur') : _org10(p));
const _tr10 = VIEWS.transporteur;
VIEWS.transporteur = async p => (ME && role() === 'participant' ? pendingPage('transport') : _tr10(p));

// Mon compte : rappel du profil demandé et accès à la demande Transport & logistique.
const _compte10 = VIEWS.compte;
VIEWS.compte = async p => {
  const h = await _compte10(p); if (!ME || role() !== 'participant') return h;
  const r = ME.carrier_request, card = `<div class="card pad stack"><h2>Transport & logistique</h2>${r ? `<div class="note">Votre demande pour « ${esc(r.name || '')} » est en cours d'examen par la Direction.</div>` : '<p class="sm mut">Transporteur, agence de voyage ou logistique ? Vendez vos places et gérez vos colis sur FatiBillets.</p><a class="btn ghost" href="#/transporteur">Faire une demande</a>'}</div>`;
  const anchor = '<div class="card pad stack"><h2>Devenir organisateur</h2>';
  return h.includes(anchor) ? h.replace(anchor, card + anchor) : h;
};

/* ---------- Direction : demandes de profil à valider ---------- */
const _comptes10 = ADMIN_R.comptes;
ADMIN_R.comptes = async (D, me) => {
  const h = await _comptes10(D, me), orgs = (D.user_list || []).filter(u => u.org_requested && u.role === 'participant');
  let cars = []; try { cars = await rpc2('admin_carrier_requests'); } catch (e) { /* pas la permission ou base pas à jour */ }
  if (!orgs.length && !cars.length) return h;
  const row = (who, what, ok, ko) => `<tr><td><b>${esc(who.full_name || '—')}</b><div class="xs mut">${esc(who.email || '')} · ${esc(who.phone || '')}</div></td><td>${what}</td><td class="r nowrap">${ok} ${ko}</td></tr>`;
  return `<div class="card pad stack" style="margin-bottom:16px"><h2 style="margin:0">Demandes de profil à valider <span class="badge b-blue">${orgs.length + cars.length}</span></h2><div class="tw"><table><tr><th>Compte</th><th>Demande</th><th></th></tr>
  ${orgs.map(u => row(u, `${badge(['Organisateur', 'orange'])} <b>${esc(u.org_name || '')}</b>`, `<button class="btn s ok" data-a="pfOrgOk" data-id="${u.id}" data-name="${esc(u.org_name || u.email || '')}">Valider</button>`, `<button class="btn s ghost" data-a="pfOrgKo" data-id="${u.id}">Refuser</button>`)).join('')}
  ${cars.map(u => { const r = u.request || {}; return row(u, `${badge(['Transport & logistique', 'blue'])} <b>${esc(r.name || '')}</b><div class="xs mut">${esc(ACTIVITY_L[r.activity] || '')}${r.city ? ' · ' + esc(r.city) : ''} · ${dFmt(r.at)}</div>`, `<button class="btn s ok" data-a="pfCarOk" data-id="${u.id}" data-name="${esc(r.name || '')}">Valider</button>`, `<button class="btn s ghost" data-a="pfCarKo" data-id="${u.id}">Refuser</button>`); }).join('')}
  </table></div></div>` + h;
};

Object.assign(A, {
  pfOrgOk(el) { askReason('Valider l\'organisateur « ' + el.dataset.name + ' »', m => act(() => rpc('admin_set_user', { p_id: el.dataset.id, p_role: 'organisateur', p_status: 'actif', p_reason: m }), 'Espace organisateur ouvert.')); },
  pfOrgKo(el) { askReason('Refuser la demande organisateur', m => act(() => rpc2('admin_reject_organizer', { p_user: el.dataset.id, p_reason: m }), 'Demande refusée : le demandeur est notifié.')); },
  pfCarOk(el) { askReason('Valider le transporteur « ' + el.dataset.name + ' »', m => act(() => rpc2('admin_decide_carrier', { p_user: el.dataset.id, p_ok: true, p_reason: m }), 'Espace Transport & logistique ouvert.')); },
  pfCarKo(el) { askReason('Refuser la demande Transport & logistique', m => act(() => rpc2('admin_decide_carrier', { p_user: el.dataset.id, p_ok: false, p_reason: m }), 'Demande refusée : le demandeur est notifié.')); },
});
F.carrierRequest = async f => { await rpc2('request_carrier', { p_name: f.get('name'), p_activity: f.get('activity'), p_city: f.get('city') }); await loadMe(); toast('Demande envoyée à la Direction FATIGLOBAL.'); await render(); };

Object.assign(EN, { 'Je crée un compte :': 'I am creating an account:', 'Participant': 'Participant', 'Organisateur': 'Organizer', 'Transport & logistique': 'Transport & logistics', 'Actif tout de suite': 'Active right away', 'Validé par la Direction': 'Approved by management', 'Demandes de profil à valider': 'Profile requests to approve', 'Valider': 'Approve', 'Refuser': 'Reject' });

// boot() est appelé à la fin de modules11.js, chargé après ce fichier.
