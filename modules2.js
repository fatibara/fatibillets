'use strict';
/* FatiBillets — rôles et administration : administrateurs secondaires, notifications, réclamations,
   assistance à distance, modification d'événement, scanner, historique vendeur, transactions.
   Chargé après modules.js ; nécessite la base v4 (supabase/schema_v4.sql). */

Object.assign(ICONS, {
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
});
const tStatus = s => ({ ouvert: ['Ouvert', 'orange'], en_cours: ['En cours', 'blue'], resolu: ['Résolu', 'green'] }[s] || [s, 'gray']);
const trunc = v => { const s = String(v ?? '—'); return s.length > 80 ? s.slice(0, 80) + '…' : s; };
const ART_ROLES = ['Artiste principal', 'Artiste invité', 'Guest star', 'DJ', 'Humoriste', 'Présentateur', 'Conférencier', 'Membre du jury', 'Ambassadeur', 'Invité d\'honneur', 'Invité'];
async function uploadImage(file) {
  if (!file || !file.size) return null;
  if (file.size > 3 * 1024 * 1024) throw new Error('Une image dépasse 3 Mo.');
  const path = ME.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ({ 'image/png': 'png', 'image/webp': 'webp' }[file.type] || 'jpg');
  const r = await sb.storage.from('affiches').upload(path, file, { contentType: file.type });
  if (r.error) throw new Error('Envoi d\'image impossible : ' + r.error.message);
  return sb.storage.from('affiches').getPublicUrl(path).data.publicUrl;
}

/* ---------- cloche de notifications ---------- */
let BELL = { at: 0, n: 0 };
async function bellSync(force) {
  const b = $('#bell'); if (!b) return;
  if (!ME) { b.hidden = true; return; }
  if (force || Date.now() - BELL.at > 20000) {
    BELL.at = Date.now();
    try { BELL.n = (await q(sb.rpc('my_notifications'))).unread; } catch (e) { b.hidden = true; return; }
  }
  b.hidden = false;
  $('#bellN').textContent = BELL.n > 0 ? (BELL.n > 99 ? '99+' : BELL.n) : '';
}
const _baseRender = render;
render = async function () { await _baseRender(); bellSync(); };
setInterval(() => { if (!document.hidden) bellSync(true); }, 60000);

VIEWS.notifications = async () => {
  if (!ME) return needLogin();
  const r = await rpc2('my_notifications'), pr = r.prefs || {};
  BELL = { at: Date.now(), n: 0 };
  if (r.unread) rpc2('mark_notifications_read').catch(() => {});
  return head('Notifications', 'Les événements importants de votre compte.') + `<div class="wrap sec"><div class="cols"><div class="card pad">${r.list.length ? r.list.map(n => `<a class="notif ${n.read ? '' : 'unread'}" href="${/^#\/[\w/-]*$/.test(n.link || '') ? esc(n.link) : '#/notifications'}"><b>${esc(n.title)}</b>${n.body ? `<div class="sm mut">${esc(n.body)}</div>` : ''}<div class="xs mut">${dtFmt(n.at)}</div></a>`).join('') : '<div class="empty">Aucune notification pour le moment.</div>'}</div>
  <form class="card pad stack sticky" data-f="notifPrefs"><h3>Préférences</h3>${[['interne', 'Dans mon espace FatiBillets'], ['email', 'Par e-mail'], ['sms', 'Par SMS']].map(([k, l]) => `<label class="row sm"><input type="checkbox" name="${k}" ${pr[k] ?? (k !== 'sms') ? 'checked' : ''}> ${l}</label>`).join('')}<p class="xs mut" style="margin:0">Les notifications dans votre espace fonctionnent dès maintenant. L'envoi par e-mail et par SMS démarrera quand FATIGLOBAL aura branché son service d'envoi : vos préférences seront alors appliquées.</p><div><button class="btn s">Enregistrer</button></div></form></div></div>`;
};

/* ---------- assistance : dossiers de l'utilisateur ---------- */
function supportCard(t, staff) {
  return `<div class="card pad stack"><div class="row between"><div><b>${esc(t.subject)}</b><div class="xs mut">${esc(t.number)} · ouvert le ${dtFmt(t.created_at)}${staff && t.user ? ' · ' + esc(t.user.name || t.user.email || '') + ' (' + esc(ROLE_L[t.user.role] || '') + ')' : ''}${t.assignee ? ' · suivi par ' + esc(t.assignee) : ''}</div></div>${badge(tStatus(t.status))}</div>
  <div class="stack">${t.messages.map(m => `<div class="msg ${m.staff ? 'staff' : ''}"><div class="xs mut">${m.staff ? 'Équipe FATIGLOBAL' : staff ? 'Utilisateur' : 'Vous'} · ${dtFmt(m.at)}</div><div style="white-space:pre-wrap">${esc(m.body)}</div></div>`).join('')}</div>
  <form class="row" data-f="ticketReply" data-id="${t.id}"><input class="in" style="flex:1;margin:0;min-width:160px" name="body" required minlength="2" maxlength="5000" placeholder="${staff ? 'Réponse à l\'utilisateur…' : 'Votre message…'}"><button class="btn s">Envoyer</button></form>
  ${staff ? `<div class="row">${[['en_cours', 'Marquer en cours'], ['resolu', 'Marquer résolu'], ['ouvert', 'Rouvrir']].filter(([s]) => s !== t.status).map(([s, l]) => `<button class="chip" data-a="ticketStatus" data-id="${t.id}" data-v="${s}">${l}</button>`).join('')}</div>` : ''}</div>`;
}
VIEWS.assistance = async () => {
  if (!ME) return needLogin();
  const T = await rpc2('my_tickets');
  return head('Assistance', 'Une question, un problème de paiement ou de billet ? Ouvrez un dossier : l\'équipe FATIGLOBAL vous répond ici.') + `<div class="wrap sec"><div class="cols"><div class="stack">${T.length ? T.map(t => supportCard(t, false)).join('') : '<div class="empty">Vous n\'avez ouvert aucun dossier.</div>'}</div>
  <form class="card pad stack sticky" data-f="newTicket"><h3>Nouveau dossier</h3><label class="f">Sujet<input name="subject" required minlength="4" maxlength="120" placeholder="Ex. Billet non reçu après paiement"></label><label class="f">Description<textarea name="body" rows="5" required minlength="10" maxlength="5000" placeholder="Décrivez le problème, avec la référence de commande si vous l'avez."></textarea></label><button class="btn">Envoyer le dossier</button></form></div></div>`;
};

/* ---------- mon compte : assistance et autorisation d'assistance à distance ---------- */
const _compte = VIEWS.compte;
VIEWS.compte = async p => {
  const h = await _compte(p); if (!ME) return h;
  let until = null; if (role() === 'organisateur') { try { until = await rpc2('my_assistance'); } catch (e) { /* base pas à jour */ } }
  return h + `<div class="wrap" style="padding-bottom:34px"><div class="cols"><div class="card pad stack"><h2>${ic('help')} Assistance</h2><p class="sm mut" style="margin:0">Une question ou un problème ? Ouvrez un dossier suivi par l'équipe FATIGLOBAL.</p><div class="row"><a class="btn s" href="#/assistance">Mes dossiers d'assistance</a><a class="btn s ghost" href="#/notifications">Notifications et préférences</a></div></div>
  ${role() === 'organisateur' ? `<div class="card pad stack"><h2>Assistance à distance</h2>${until ? `<div class="note">L'équipe FATIGLOBAL peut consulter votre espace, en lecture seule, jusqu'au <b>${dtFmt(until)}</b>.</div><div><button class="btn s danger" data-a="revokeAssist">Retirer l'autorisation</button></div>` : `<p class="sm mut" style="margin:0">Autorisez temporairement FATIGLOBAL à consulter votre espace pour vous aider. Aucun mot de passe n'est partagé, l'accès est en lecture seule et chaque consultation est enregistrée dans le journal d'audit.</p><form class="row" data-f="grantAssist"><select class="in" name="hours" style="width:auto;margin:0"><option value="1">Pendant 1 heure</option><option value="4">Pendant 4 heures</option><option value="24">Pendant 24 heures</option></select><button class="btn s">Autoriser</button></form>`}</div>` : ''}</div></div>`;
};

/* ---------- scanner : événements attribués, point de contrôle, historique ---------- */
VIEWS.scan = async () => {
  if (!ME) return needLogin(); if (!['organisateur', 'scanner', 'admin'].includes(role())) return denied();
  let C = null; try { C = await rpc2('my_scan_context'); } catch (e) { return vScan(); }
  if (UI.scanEv && !C.events.some(e => e.id === UI.scanEv)) UI.scanEv = '';
  if (!UI.scanEv && C.events.length === 1) UI.scanEv = C.events[0].id;
  if (!C.events.length && role() === 'scanner') return head('Contrôle des billets', 'Interface scanner') + box('Aucun événement attribué', '<p class="mut">Votre organisateur doit vous affecter à un événement.</p>');
  return head('Contrôle des billets', 'Un billet ne peut être validé qu\'une seule fois. La vérification est faite par le serveur.') + `<div class="wrap sec"><div class="scan stack">
  <div class="kpis"><div class="kpi"><small>Scans (24 h)</small><b>${num(C.today.total)}</b></div><div class="kpi"><small>Entrées validées (24 h)</small><b>${num(C.today.valid)}</b></div></div>
  <label class="f">Événement contrôlé<select data-i="scanEv">${C.events.length > 1 ? '<option value="">Tous mes événements</option>' : ''}${C.events.map(e => `<option value="${e.id}" ${UI.scanEv === e.id ? 'selected' : ''}>${esc(e.name)}${e.checkpoint ? ' — ' + esc(e.checkpoint) : ''}</option>`).join('')}</select></label>
  ${'BarcodeDetector' in window ? `<div class="card pad stack"><video id="cam" playsinline muted style="width:100%;border-radius:12px;background:#000;display:none"></video><button class="btn" data-a="camToggle" id="camBtn">${ic('cam')} Scanner avec la caméra</button></div>` : '<div class="note">La lecture par caméra n\'est pas disponible sur ce navigateur : saisissez le code du billet, ou utilisez Chrome sur Android.</div>'}
  <form class="row" data-f="scan"><input class="in" style="flex:1;margin:0;font-family:Consolas,monospace;text-transform:uppercase" name="code" placeholder="Code du billet (FB-…)" required autocomplete="off"><button class="btn">Valider</button></form>
  <div id="scanres"><div class="empty">Scannez un QR code ou saisissez un code de billet.</div></div>
  <div class="card pad"><div class="row between"><h3 style="margin:0">Mes dernières opérations</h3><button class="btn s ghost" data-a="refresh">Actualiser</button></div>${C.recent.length ? C.recent.map(s => `<div class="row between xs" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${dtFmt(s.at)} · <span class="tk-code">${esc(s.code)}</span></span>${badge([s.result, s.ok ? 'green' : 'red'])}</div>`).join('') : '<p class="sm mut">Aucun scan enregistré.</p>'}</div></div></div>`;
};

/* ---------- vendeur : historique des ventes ---------- */
const _vente = VIEWS.vente;
VIEWS.vente = async p => {
  const h = await _vente(p); if (role() !== 'vendeur') return h;
  let S = null; try { S = await rpc2('my_sales'); } catch (e) { return h; }
  return h + `<div class="wrap" style="padding-bottom:34px"><div class="card pad" style="max-width:820px;margin:0 auto"><div class="row between"><h2>Mon historique</h2><span class="sm mut">${num(S.count)} billet(s) · ${money(S.amount)}</span></div>${S.list.length ? `<div class="tw"><table><tr><th>Date</th><th>Événement</th><th>Acheteur</th><th class="n">Billets</th><th class="n">Montant</th><th>Encaissement</th><th></th></tr>${S.list.map(o => `<tr><td class="sm nowrap">${dtFmt(o.at)}</td><td>${esc(o.event)}</td><td>${esc(o.buyer)}</td><td class="n">${o.n}</td><td class="n">${money(o.total, o.currency)}</td><td class="sm">${esc(o.method || '')}</td><td class="r"><a class="btn s ghost" href="#/commande/${o.id}">Billets</a></td></tr>`).join('')}</table></div>` : '<p class="sm mut">Aucune vente pour le moment.</p>'}</div></div>`;
};

/* ---------- espace organisateur : scanners, transactions, modification d'événement ---------- */
ORG_TABS.push(['scanners', 'Scanners'], ['transactions', 'Transactions']);
ORG_R.scanners = async () => {
  const [S, D] = await Promise.all([rpc2('org_scanners'), rpc('org_dashboard')]), evs = D.events.filter(e => !e.cancelled);
  return `<div class="wrap sec stack" style="padding-top:22px"><div class="card pad"><h2>Scanners et points de contrôle</h2>${S.length ? `<div class="tw"><table><tr><th>Scanner</th><th>Événement</th><th>Point de contrôle</th><th class="n">Scans</th><th class="n">Validés</th><th></th></tr>${S.map(s => `<tr><td><b>${esc(s.name || '—')}</b><div class="xs mut">${esc(s.email)}</div></td><td>${esc(s.event)}</td><td>${esc(s.checkpoint || 'Toutes les entrées')}</td><td class="n">${num(s.scans)}</td><td class="n">${num(s.valid)}</td><td class="r"><button class="btn s ghost" data-a="removeScanner" data-id="${s.id}" data-ev="${s.event_id}">Retirer l'accès</button></td></tr>`).join('')}</table></div>` : '<p class="mut sm">Aucun scanner affecté. Vous pouvez aussi contrôler vous-même vos événements depuis « Scanner ».</p>'}</div>
  ${evs.length ? `<form class="card pad stack" data-f="newScanner" style="max-width:620px"><h2>Affecter un scanner</h2><label class="f">E-mail du compte<input name="email" type="email" required></label><label class="f">Événement<select name="event">${evs.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label><label class="f">Point de contrôle (facultatif)<input name="checkpoint" maxlength="60" placeholder="Ex. Porte A, Entrée VIP"></label><div><button class="btn">Affecter</button></div><p class="xs mut" style="margin:0">La personne doit d'abord créer son compte sur le site. Un scanner ne peut ni créer son compte professionnel, ni s'attribuer un événement.</p></form>` : ''}</div>`;
};
ORG_R.transactions = async () => {
  const T = await rpc2('org_transactions'); window.__otx = T;
  return `<div class="wrap sec" style="padding-top:22px"><div class="card pad"><div class="row between"><h2>Mes transactions</h2>${T.length ? '<button class="btn s ghost" data-a="csvOtx">Exporter (Excel/CSV)</button>' : ''}</div>${T.length ? `<div class="tw"><table><tr><th>Date</th><th>Type · Objet</th><th>Payeur</th><th>Moyen · Canal</th><th class="n">Montant</th><th>Statut</th></tr>${T.map(t => `<tr><td class="sm nowrap">${dtFmt(t.at)}</td><td><b>${esc(t.kind)}</b><div class="xs mut">${esc(t.label || '')}</div></td><td class="sm">${esc(t.buyer_name || '')}</td><td class="sm">${esc(t.method || '—')}<div class="xs mut">${t.channel === 'vendeur' ? 'Guichet' : 'En ligne'}</div></td><td class="n"><b>${money(t.amount, t.currency)}</b></td><td>${badge(txStatus(t.status))}</td></tr>`).join('')}</table></div><p class="xs mut">Les 300 opérations les plus récentes de vos activités uniquement.</p>` : '<p class="mut sm">Aucune transaction pour le moment.</p>'}</div></div>`;
};
const artistRow = (a, ev) => `<div class="artist-row"><input type="hidden" data-k="photo" value="${esc(safeUrl(a.photo))}"><div class="g3"><label class="f">Nom ou nom de scène<input data-k="name" required maxlength="80" value="${esc(a.name || '')}"></label><label class="f">Rôle<select data-k="role">${ART_ROLES.map(r => `<option ${r === a.role ? 'selected' : ''}>${esc(r)}</option>`).join('')}${a.role && !ART_ROLES.includes(a.role) ? `<option selected>${esc(a.role)}</option>` : ''}</select></label><label class="f">Profession ou spécialité<input data-k="profession" maxlength="80" value="${esc(a.profession || '')}"></label><label class="f">Pays d'origine<input data-k="country" maxlength="60" value="${esc(a.country || '')}"></label><label class="f">Date de prestation<select data-k="day"><option value="">Toutes les dates</option>${ev.dates.map((d, i) => `<option value="${i}" ${a.day === i ? 'selected' : ''}>${dFmt(d.start)}</option>`).join('')}</select></label><label class="f">Lien officiel (facultatif)<input data-k="link" type="url" maxlength="200" value="${esc(a.link || '')}" placeholder="https://"></label></div><label class="f">Biographie ou présentation<textarea data-k="bio" rows="2" maxlength="800">${esc(a.bio || '')}</textarea></label><div class="row between" style="align-items:flex-end">${safeUrl(a.photo) ? `<img class="av" src="${esc(a.photo)}" alt="">` : ''}<label class="f" style="flex:1">Photo ou portrait${safeUrl(a.photo) ? ' (choisir un fichier pour la remplacer)' : ''}<input data-k="file" type="file" accept="image/jpeg,image/png,image/webp"></label><button type="button" class="btn s ghost" data-a="rmArtist">Retirer</button></div></div>`;
ORG_R.modifier = async () => {
  const id = location.hash.split('/')[3], D = await loadData(true), ev = D.events.find(e => e.id === id);
  if (!ev || ev.organizer_id !== ME.id) return box('Événement introuvable', `<a class="btn" href="#/org">Retour</a>`);
  let H = []; try { H = await rpc2('event_history', { p_id: id }); } catch (e) { /* base pas à jour */ }
  window.__evEdit = ev;
  const t = (n, l, v, x = '') => `<label class="f">${l}<input name="${n}" value="${esc(v || '')}" ${x}></label>`;
  return `<div class="wrap sec stack" style="padding-top:22px"><form class="card pad stack" data-f="editEvent" data-id="${id}" style="max-width:900px"><div class="row between"><h2 style="margin:0">Modifier « ${esc(ev.name)} »</h2><a class="btn s ghost" href="#/e/${id}">Voir la page publique</a></div>
  <div class="g2">${t('name', 'Nom de l\'événement', ev.name, 'required minlength="3"')}<label class="f">Catégorie<select name="category">${D.cats.filter(c => c.active || c.name === ev.category).map(c => `<option ${c.name === ev.category ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>${t('city', 'Ville', ev.city, 'required')}${t('venue', 'Lieu et adresse', ev.venue, 'required')}${t('slogan', 'Slogan', ev.slogan)}<label class="f">Public concerné<select name="audience">${['Tout public', 'Enfant', 'Adolescent', 'Jeune', 'Adulte', 'Famille'].map(a => `<option ${a === ev.audience ? 'selected' : ''}>${a}</option>`).join('')}</select></label></div>
  <label class="f">Description<textarea name="description" rows="4" required>${esc(ev.description || '')}</textarea></label>
  ${t('keywords', 'Mots-clés (séparés par des virgules)', ev.keywords.join(', '))}${t('access', 'Conditions d\'accès', ev.access)}
  <label class="f">Nouvelle affiche (laisser vide pour garder l'actuelle)<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label>
  <h3 style="margin-bottom:0">Artistes et invités à l'affiche</h3><div id="artists" class="stack">${ev.artists.map(a => artistRow(a, ev)).join('')}</div><div><button type="button" class="btn s ghost" data-a="addArtist">+ Ajouter un artiste ou un invité</button></div>
  <p class="xs mut" style="margin:0">Les prix, quotas et dates ne sont pas modifiables après publication : ils engagent les billets déjà vendus. Chaque modification est conservée dans l'historique ci-dessous.</p>
  <div><button class="btn">Enregistrer les modifications</button></div></form>
  <div class="card pad" style="max-width:900px"><h2>Historique des modifications</h2>${H.length ? H.map(h => `<div style="padding:9px 0;border-bottom:1px solid var(--line)"><div class="xs mut">${dtFmt(h.at)} · ${esc(h.actor || '')}</div>${Object.entries(h.changes).map(([k, v]) => `<div class="sm"><b>${esc(k)}</b> : <span class="mut">${esc(trunc(v.avant))}</span> → ${esc(trunc(v.apres))}</div>`).join('')}</div>`).join('') : '<p class="mut sm">Aucune modification depuis la publication.</p>'}</div></div>`;
};

/* ---------- Direction : vue d'ensemble, comptes et rôles, réclamations, assistance ---------- */
ADMIN_TABS.push(['reclamations', 'Réclamations']);
ADMIN_R.vue = async (D, me) => {
  const days = UI.statDays || 30; let S = null; try { S = await rpc2('admin_stats', { p_days: days }); } catch (e) { /* base pas à jour */ }
  const todo = [['comptes', 'Demandes de compte organisateur', D.user_list.filter(u => u.org_requested).length, '#/admin/comptes'], ['paiements', 'Demandes de retrait à décider', D.pending_payouts ?? 0, '#/admin/paiements'], ['reclamations', 'Dossiers d\'assistance ouverts', D.open_tickets ?? 0, '#/admin/reclamations'], ['paiements', 'Paiements à rembourser', (D.refunds || []).length, '#/admin/paiements'], [null, 'Paiements manuels à vérifier', D.pending, '']].filter(([p]) => can(p, me));
  const pts = S ? S.days : [], max = Math.max(1, ...pts.map(x => +x.amount)), tot = pts.reduce((a, x) => a + +x.amount, 0), nb = pts.reduce((a, x) => a + +x.n, 0);
  return `<div class="alerts">${todo.map(([, l, n, h]) => `<a class="alert ${+n ? '' : 'zero'}" ${h ? `href="${h}"` : ''}><b>${num(n)}</b><span class="sm">${l}</span></a>`).join('')}</div>
  <div class="kpis">${D.revenue.map(r => `<div class="kpi hot"><small>Ventes de billets (${esc(r.currency)})</small><b>${money(r.amount, r.currency)}</b></div><div class="kpi hot"><small>Commissions, ${commLabel()} (${esc(r.currency)})</small><b>${commValue(r.amount, r.currency)}</b></div>`).join('')}<div class="kpi"><small>Comptes</small><b>${num(D.users)}</b></div><div class="kpi"><small>Organisateurs</small><b>${num(D.organizers)}</b></div><div class="kpi"><small>Événements</small><b>${num(D.events)}</b></div><div class="kpi"><small>Billets vendus</small><b>${num(D.tickets)}</b></div></div>
  ${S ? `<div class="cols" style="margin-top:22px"><div class="card pad"><div class="row between"><div><h2 style="margin:0">Ventes confirmées</h2><p class="sm mut" style="margin:2px 0 0">${money(tot)} · ${num(nb)} commande(s) de billets · ${days} derniers jours, en GNF (billets, votes, cagnottes)</p></div><div class="chips">${[7, 30, 90].map(n => `<button class="chip ${days === n ? 'on' : ''}" data-a="statDays" data-v="${n}">${n} jours</button>`).join('')}</div></div><div class="chart" role="img" aria-label="Ventes confirmées par jour">${pts.map(x => `<i style="height:${(x.amount / max * 100).toFixed(1)}%" title="${dFmt(x.d)} : ${money(x.amount)}"></i>`).join('')}</div><div class="chart-x"><span>${pts[0] ? dFmt(pts[0].d) : ''}</span><span>${pts.length ? dFmt(pts[pts.length - 1].d) : ''}</span></div></div>
  <div class="card pad"><h2>Activité par pays</h2>${S.countries.length ? `<div class="tw"><table><tr><th>Pays</th><th class="n">Événements</th><th class="n">Billets</th></tr>${S.countries.map(c => `<tr><td><b>${esc(c.country)}</b></td><td class="n">${num(c.events)}</td><td class="n">${num(c.tickets)}</td></tr>`).join('')}</table></div>` : '<p class="mut sm">Aucune donnée.</p>'}</div></div>` : ''}`;
};
ADMIN_R.comptes = async (D, me) => {
  window.__users = D.user_list;
  const roles = Object.entries(ROLE_L).filter(([k]) => me.role === 'admin' || !['admin', 'admin_secondaire'].includes(k)), lockable = u => u.id === ME.id || (me.role !== 'admin' && ['admin', 'admin_secondaire'].includes(u.role));
  const counts = Object.fromEntries(Object.keys(ROLE_L).map(k => [k, D.user_list.filter(u => u.role === k).length]));
  return `<div class="stack"><div class="kpis">${Object.entries(ROLE_L).map(([k, l]) => `<div class="kpi"><small>${l}s</small><b>${num(counts[k])}</b></div>`).join('')}</div>
  <div class="card pad"><div class="row between"><h2 style="margin:0">Comptes (${D.user_list.length})</h2><input class="in" style="max-width:300px;margin:0" data-i="uq" placeholder="Rechercher un nom, un e-mail, une organisation…"></div><div class="tw"><table><tr><th>Compte</th><th>Organisation</th><th>Rôle</th><th>Statut</th><th></th></tr>${D.user_list.map(u => `<tr data-row="${esc(norm([u.full_name, u.email, u.org_name, u.phone, ROLE_L[u.role]].join(' ')))}"><td><b>${esc(u.full_name || '—')}</b><div class="xs mut">${esc(u.email)}${u.phone ? ' · ' + esc(u.phone) : ''}</div>${u.role === 'admin_secondaire' ? `<div class="xs" style="color:var(--o-d)">Accès : ${esc((u.permissions || []).map(k => PERM_L[k]).filter(Boolean).join(', ') || 'aucune rubrique')}</div>` : ''}</td>
  <td>${esc(u.org_name || '')} ${u.org_requested ? badge(['Demande organisateur', 'blue']) : ''}${u.assist_until ? `<div>${badge(['Assistance autorisée', 'green'])}<div class="xs mut">jusqu'au ${dtFmt(u.assist_until)}</div></div>` : ''}</td>
  <td><select class="in" style="margin:0;width:auto" id="role-${u.id}" ${lockable(u) ? 'disabled' : ''}>${(lockable(u) ? Object.entries(ROLE_L) : roles).map(([k, l]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
  <td>${badge(u.status === 'actif' ? ['Actif', 'green'] : ['Suspendu', 'red'])}</td>
  <td class="r nowrap">${u.id === ME.id ? '<span class="xs mut">Vous</span>' : lockable(u) ? '<span class="xs mut">Réservé à l\'administrateur général</span>' : `<button class="btn s" data-a="setRole" data-id="${u.id}" data-status="${u.status}">Enregistrer le rôle</button> <button class="btn s ${u.status === 'actif' ? 'danger' : 'ok'}" data-a="setStatus" data-id="${u.id}" data-role="${u.role}" data-status="${u.status === 'actif' ? 'suspendu' : 'actif'}">${u.status === 'actif' ? 'Suspendre' : 'Réactiver'}</button>`}${me.role === 'admin' && u.role === 'admin_secondaire' ? ` <button class="btn s ghost" data-a="perms" data-id="${u.id}">Permissions</button>` : ''}${u.assist_until && can('assistance', me) ? ` <a class="btn s ghost" href="#/admin/assist/${u.id}">Assister</a>` : ''}</td></tr>`).join('')}</table></div>
  <p class="xs mut" style="margin-top:10px">Un administrateur secondaire ne reçoit aucune permission par défaut : l'administrateur général coche ensuite les rubriques autorisées. Suspendre un organisateur masque immédiatement ses activités. Chaque action exige un motif et est journalisée.</p></div></div>`;
};
ADMIN_R.reclamations = async () => {
  const T = await rpc2('admin_tickets'), f = UI.tf || 'actifs', L = T.filter(t => f === 'tous' || (f === 'actifs' ? t.status !== 'resolu' : t.status === f));
  const n = k => T.filter(t => k === 'tous' || (k === 'actifs' ? t.status !== 'resolu' : t.status === k)).length;
  return `<div class="stack"><div class="chips">${[['actifs', 'À traiter'], ['ouvert', 'Ouverts'], ['en_cours', 'En cours'], ['resolu', 'Résolus'], ['tous', 'Tous']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="tf" data-v="${k}">${l} (${n(k)})</button>`).join('')}</div>${L.length ? L.map(t => supportCard(t, true)).join('') : '<div class="empty">Aucun dossier dans cette liste.</div>'}</div>`;
};
ADMIN_R.assist = async () => {
  const id = location.hash.split('/')[3]; if (!id) return box('Organisateur non précisé', '<a class="btn" href="#/admin/comptes">Comptes</a>');
  const r = await rpc2('assist_view', { p_org: id }), d = r.dashboard, x = r.extras, b = x.balance || {};
  const sold = d.events.reduce((a, e) => a + +e.sold, 0), rev = d.events.reduce((a, e) => a + +e.revenue, 0);
  return `<div class="stack"><div class="note"><b>Assistance à distance — ${esc(r.org)}</b><br>Consultation en lecture seule, autorisée par l'organisateur jusqu'au ${dtFmt(r.until)}. Elle est enregistrée dans le journal d'audit. Aucune action ne peut être faite à la place de l'organisateur depuis la Direction.</div>
  <div class="kpis"><div class="kpi hot"><small>Recettes billetterie</small><b>${money(rev)}</b></div><div class="kpi"><small>Billets vendus</small><b>${num(sold)}</b></div><div class="kpi"><small>Paiements à vérifier</small><b>${d.pending.length}</b></div><div class="kpi"><small>Solde disponible</small><b>${money(b.available || 0)}</b></div></div>
  <div class="card pad"><h2>Événements</h2>${d.events.length ? `<div class="tw"><table><tr><th>Événement</th><th>Date</th><th class="n">Vendus</th><th class="n">Disponibles</th><th class="n">Recettes</th></tr>${d.events.map(e => `<tr><td><b>${esc(e.name)}</b>${e.cancelled ? ' ' + badge(['Annulé', 'gray']) : ''}</td><td class="sm">${dFmt(e.starts_at)}</td><td class="n">${num(e.sold)}</td><td class="n">${num(e.available)}</td><td class="n">${money(e.revenue, e.currency)}</td></tr>`).join('')}</table></div>` : '<p class="mut sm">Aucun événement.</p>'}</div>
  <div class="cols"><div class="card pad"><h2>Paiements à vérifier</h2>${d.pending.length ? d.pending.map(o => `<div class="sm" style="padding:6px 0;border-bottom:1px solid var(--line)"><b>${esc(o.name)}</b> · ${esc(o.event)} · ${money(o.total, o.currency)} · ${esc(o.method || '')} <span class="tk-code">${esc(o.ref || '')}</span></div>`).join('') : '<p class="mut sm">Aucun.</p>'}<h2 style="margin-top:18px">Vendeurs et scanners</h2><p class="sm">${x.sellers.length} vendeur(s) · ${d.scanners.length} affectation(s) de scanner</p></div>
  <div class="card pad"><h2>Autres activités</h2><p class="sm">${x.campaigns.length} concours · ${x.pots.length} cagnotte(s) · ${x.forms.length} formulaire(s) d'inscription</p><h2>Demandes de paiement</h2>${x.payouts.length ? x.payouts.map(p => `<div class="sm" style="padding:6px 0;border-bottom:1px solid var(--line)">${esc(p.ref)} · ${money(p.amount, p.currency)} · ${esc(p.status)}</div>`).join('') : '<p class="mut sm">Aucune.</p>'}</div></div>
  <div><a class="btn ghost" href="#/admin/comptes">Retour aux comptes</a></div></div>`;
};

/* ---------- actions ---------- */
Object.assign(A, {
  statDays(el) { UI.statDays = +el.dataset.v; render(); },
  tf(el) { UI.tf = el.dataset.v; render(); },
  ticketStatus(el) { act(() => rpc2('set_ticket_status', { p_id: el.dataset.id, p_status: el.dataset.v }), 'Statut du dossier mis à jour.'); },
  revokeAssist() { act(() => rpc2('revoke_assistance'), 'Autorisation retirée.'); },
  removeScanner(el) { act(async () => { await rpc2('remove_scanner', { p_scanner: el.dataset.id, p_event: el.dataset.ev }); }, 'Accès scanner retiré.'); },
  csvOtx() { download('mes-transactions.csv', [['Date', 'Type', 'Objet', 'Payeur', 'Moyen', 'Canal', 'Montant', 'Devise', 'Statut'], ...(window.__otx || []).map(t => [dtFmt(t.at), t.kind, t.label, t.buyer_name, t.method, t.channel, t.amount, t.currency, txStatus(t.status)[0]])]); },
  addArtist() { $('#artists').insertAdjacentHTML('beforeend', artistRow({}, window.__evEdit)); },
  rmArtist(el) { el.closest('.artist-row').remove(); },
  perms(el) {
    const u = (window.__users || []).find(x => x.id === el.dataset.id) || {}, cur = u.permissions || [];
    modal(`<h2>Permissions — ${esc(u.full_name || u.email || '')}</h2><p class="sm mut">Cet administrateur secondaire n'aura accès qu'aux rubriques cochées. Les paramètres de la plateforme et la gestion des administrateurs restent réservés à l'administrateur général.</p><form data-f="perms" data-id="${el.dataset.id}" class="stack">${Object.entries(PERM_L).map(([k, l]) => `<label class="row sm"><input type="checkbox" name="perm" value="${k}" ${cur.includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}<label class="f">Motif (journalisé)<input name="reason" required minlength="4"></label><div class="row"><button class="btn" style="flex:1">Enregistrer</button><button type="button" class="btn ghost" data-a="close">Annuler</button></div></form>`);
  },
});
Object.assign(F, {
  async notifPrefs(f) { await rpc2('set_notif_prefs', { p: { interne: !!f.get('interne'), email: !!f.get('email'), sms: !!f.get('sms') } }); toast('Préférences enregistrées.'); await render(); },
  async newTicket(f, form) { const n = await rpc2('open_ticket', { p_subject: f.get('subject'), p_body: f.get('body') }); form.reset(); toast('Dossier ' + n + ' envoyé. Vous serez notifié de la réponse.'); await render(); },
  async ticketReply(f) { await rpc2('ticket_reply', { p_id: arguments[1].dataset.id, p_body: f.get('body') }); toast('Message envoyé.'); await render(); },
  async grantAssist(f) { await rpc2('grant_assistance', { p_hours: +f.get('hours') }); toast('Assistance autorisée.'); await render(); },
  async newScanner(f) { await rpc2('assign_scanner', { p_email: f.get('email'), p_event: f.get('event'), p_checkpoint: f.get('checkpoint') }); toast('Scanner affecté.'); await render(); },
  async perms(f, form) { closeModal(); await rpc2('admin_set_permissions', { p_id: form.dataset.id, p_perms: f.getAll('perm'), p_reason: f.get('reason') }); toast('Permissions enregistrées.'); await render(); },
  async editEvent(f, form) {
    const artists = [];
    for (const row of form.querySelectorAll('.artist-row')) {
      const g = k => row.querySelector(`[data-k="${k}"]`), name = g('name').value.trim(); if (!name) continue;
      const day = g('day').value;
      artists.push({ name, role: g('role').value, profession: g('profession').value.trim(), country: g('country').value.trim(), day: day === '' ? null : +day, link: g('link').value.trim(), bio: g('bio').value.trim(), photo: (await uploadImage(g('file').files[0])) || g('photo').value || null });
    }
    const p = { name: f.get('name'), slogan: f.get('slogan'), description: f.get('description'), category: f.get('category'), city: f.get('city'), venue: f.get('venue'), audience: f.get('audience'), access: f.get('access'), payment_info: CFG.lengopay ? '' : f.get('payment_info'), keywords: f.get('keywords').split(',').map(s => s.trim()).filter(Boolean), artists };
    const img = await uploadImage(f.get('image')); if (img) p.image_url = img;
    await rpc2('update_event', { p_id: form.dataset.id, p }); DATA = null; toast('Modifications enregistrées.'); await render();
  },
});
Object.assign(I, {
  uq(v) { const f = norm(v); document.querySelectorAll('[data-row]').forEach(tr => { tr.hidden = !!f && !tr.dataset.row.includes(f); }); },
  scanEv(v) { UI.scanEv = v; },
});

if ($('#bell')) $('#bell').innerHTML = ic('bell') + '<span id="bellN"></span>';
// boot() est appelé à la fin de modules3.js, chargé après ce fichier.
