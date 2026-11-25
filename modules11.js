'use strict';
/* FatiBillets — espace organisateur complet (novembre 2026) :
   tableau de bord avec graphiques, création d'événement (billets gratuits/payants, période de vente, lieu enregistré),
   dates modifiables même en ligne, concours (créer, modifier, supprimer, en ligne, candidats illimités, rapport PDF),
   cagnottes (créer, modifier, supprimer, en ligne, montants min/max, dates, affiche, photos),
   scanners (comptes créés par l'organisateur, paramètres, statistiques, activer, supprimer).
   Chargé après modules10.js ; nécessite la base v13 et la fonction serveur org-scanner. */

const pct = (a, b) => (b > 0 ? Math.min(100, Math.round(a / b * 100)) : 0);
const bar = (a, b) => `<div class="bar ${a >= b && b > 0 ? 'done' : ''}" style="margin:4px 0 0"><i style="width:${pct(a, b)}%"></i></div>`;
const onBadge = x => badge(x.published === false ? ['Hors ligne', 'gray'] : ['En ligne', 'green']);
const period = (s, e) => ts(s) > Date.now() ? ['À venir', 'blue'] : ts(e) < Date.now() ? ['Terminé', 'gray'] : ['En cours', 'orange'];
const isoL = v => (v ? toLocalInput(v) : '');

/* =====================================================================
   1. TABLEAU DE BORD ORGANISATEUR
   ===================================================================== */
ORG_TABS[0][1] = 'Tableau de bord';
function chart30(D) {
  const W = 720, H = 190, P = 28, n = D.length, max = Math.max(1, ...D.map(d => +d.sold)), bw = (W - P * 2) / n;
  const maxA = Math.max(1, ...D.map(d => +d.amount));
  const line = D.map((d, i) => `${P + i * bw + bw / 2},${H - P - (+d.amount / maxA) * (H - P * 2)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Billets vendus et recettes sur 30 jours">
    ${[0, .5, 1].map(r => `<line x1="${P}" x2="${W - P}" y1="${H - P - r * (H - P * 2)}" y2="${H - P - r * (H - P * 2)}" class="grid"/>`).join('')}
    ${D.map((d, i) => { const h = (+d.sold / max) * (H - P * 2); return `<rect x="${P + i * bw + 2}" y="${H - P - h}" width="${Math.max(2, bw - 4)}" height="${h}" rx="2" class="b"><title>${dFmt(d.day)} : ${num(d.sold)} billet(s) · ${money(d.amount)}</title></rect>`; }).join('')}
    <polyline points="${line}" class="l"/>
    ${D.filter((d, i) => i % 5 === 0 || i === n - 1).map(d => { const i = D.indexOf(d); return `<text x="${P + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${new Date(d.day).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</text>`; }).join('')}
    <text x="${P}" y="14">${num(max)} billets</text><text x="${W - P}" y="14" text-anchor="end" class="lt">${money(maxA)}</text></svg>
    <div class="row xs mut" style="gap:14px"><span><i class="lg b"></i> Billets vendus par jour</span><span><i class="lg l"></i> Recettes par jour</span></div>`;
}
const oSt = s => ({ confirme: ['Payée', 'green'], a_verifier: ['À vérifier', 'orange'], en_attente: ['En attente', 'blue'], expire: ['Expirée', 'gray'], annule: ['Annulée', 'gray'], a_rembourser: ['À rembourser', 'red'] }[s] || [s, 'gray']);
ORG_R[''] = async () => {
  let O; try { O = await rpc2('org_overview'); } catch (e) { return orgTickets(); }
  const K = O.kpi, rev = Object.entries(O.revenue || {}), f = UI.ordF || '', ev = UI.ordEv || '';
  const orders = O.orders.filter(o => (!f || o.status === f) && (!ev || o.event === ev));
  const old = await orgTickets();
  return `<div class="wrap sec stack" style="padding-top:22px">
  <div class="row between"><h2 style="margin:0">Résumé de mon activité</h2><a class="btn" href="#/org/nouveau">+ Créer un événement</a></div>
  <div class="kpis">${rev.length ? rev.map(([c, a]) => `<div class="kpi hot"><small>Recettes billets (${esc(c)})</small><b>${money(a, c)}</b></div>`).join('') : `<div class="kpi hot"><small>Recettes billets</small><b>${money(0)}</b></div>`}
    <div class="kpi"><small>Billets vendus</small><b>${num(K.sold)}</b><span class="xs mut">sur ${num(K.capacity)} places · ${pct(K.sold, K.capacity)} %</span></div>
    <div class="kpi"><small>Commandes passées</small><b>${num(K.orders)}</b><span class="xs mut">${num(K.paid)} payées · ${num(K.pending)} en attente</span></div>
    <div class="kpi"><small>Événements</small><b>${num(K.events)}</b><span class="xs mut">${num(K.published)} publiés · ${num(K.upcoming)} à venir</span></div>
    <div class="kpi"><small>Entrées contrôlées</small><b>${num(K.scanned)}</b><span class="xs mut">${pct(K.scanned, K.sold)} % des billets</span></div></div>
  <div class="card pad"><h2>Évolution des ventes — 30 derniers jours</h2>${chart30(O.daily)}</div>
  <div class="card pad"><h2>Mes événements en détail</h2>${O.events.length ? `<div class="tw"><table><tr><th>Événement</th><th>Statut</th><th>Prochaine date</th><th class="n">Commandes</th><th>Billets vendus</th><th class="n">Recettes</th><th class="n">Entrées</th><th></th></tr>${O.events.map(e => `<tr><td><a href="#/e/${e.id}"><b>${esc(e.name)}</b></a><div class="xs mut">${esc(e.city || '')} · ${e.dates} date(s)</div><div class="xs mut">${e.tiers.map(t => esc(t.name) + ' ' + num(t.sold) + '/' + num(t.quota)).join(' · ')}</div></td>
    <td>${badge(e.cancelled ? ['Annulé', 'gray'] : !e.published ? ['Brouillon', 'gray'] : e.next_at ? ['En vente', 'green'] : ['Terminé', 'gray'])}</td><td class="sm">${e.next_at ? dFmt(e.next_at) + ' · ' + hFmt(e.next_at) : '—'}</td>
    <td class="n">${num(e.orders)}<div class="xs mut">${num(e.paid)} payées</div></td><td style="min-width:130px"><b>${num(e.sold)}</b> / ${num(e.capacity)}${bar(+e.sold, +e.capacity)}</td><td class="n"><b>${money(e.revenue, e.currency)}</b></td><td class="n">${num(e.scanned)}</td>
    <td class="r nowrap"><a class="btn s ghost" href="#/org/stats/${e.id}">Statistiques</a> <a class="btn s ghost" href="#/org/modifier/${e.id}">Modifier</a></td></tr>`).join('')}</table></div>` : '<div class="empty">Aucun événement. <a href="#/org/nouveau">Créez le premier</a>.</div>'}</div>
  <div class="card pad stack"><div class="row between"><h2 style="margin:0">Commandes passées</h2><div class="row" style="gap:6px"><select class="in" style="margin:0;max-width:220px" data-i="ordEv"><option value="">Tous les événements</option>${[...new Set(O.orders.map(o => o.event))].map(n => `<option ${ev === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><button class="btn s ghost" data-a="ordCsv">Exporter (Excel/CSV)</button></div></div>
  <div class="chips">${[['', 'Toutes'], ['confirme', 'Payées'], ['en_attente', 'En attente'], ['a_verifier', 'À vérifier'], ['expire', 'Expirées'], ['annule', 'Annulées']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="ordF" data-v="${k}">${l} <span class="mut">${k ? O.orders.filter(o => o.status === k).length : O.orders.length}</span></button>`).join('')}</div>
  ${orders.length ? `<div class="tw"><table><tr><th>Date</th><th>Acheteur</th><th>Événement</th><th class="n">Billets</th><th class="n">Montant</th><th>Canal</th><th>Statut</th></tr>${orders.map(o => `<tr><td class="sm nowrap">${dtFmt(o.created_at)}</td><td><b>${esc(o.name)}</b><div class="xs mut">${esc(o.phone || '')}</div></td><td>${esc(o.event)}</td><td class="n">${num(o.n)}</td><td class="n">${money(o.total, o.currency)}</td><td class="sm">${o.pos ? 'Point de vente' : esc(o.method || 'En ligne')}</td><td>${badge(oSt(o.status))}</td></tr>`).join('')}</table></div>` : '<p class="sm mut">Aucune commande pour ce filtre.</p>'}</div></div>` + old;
};
I.ordEv = v => { UI.ordEv = v; render(); };

/* =====================================================================
   2. CRÉATION D'ÉVÉNEMENT : LIEU ENREGISTRÉ, PÉRIODE DE VENTE DES BILLETS
   ===================================================================== */
const _org11 = VIEWS.org;
VIEWS.org = async p => {
  const h = await _org11(p); if (!(p[1] === 'nouveau' && ME && role() === 'organisateur')) return h;
  return h.replace('<label class="f">Affiche de l\'événement', '<label class="row sm" style="margin-top:-6px"><input type="checkbox" name="save_venue" checked> Enregistrer ce lieu dans « Mes lieux » (si aucun lieu enregistré n\'est choisi)</label><label class="f">Affiche de l\'événement');
};
const _newEvent11 = F.newEvent;
F.newEvent = async (f, form) => {
  await _newEvent11(f, form);
  const id = (location.hash.match(/([0-9a-f]{8}-[0-9a-f-]{27})/) || [])[1]; if (!id) return;
  const notes = [];
  // Période de vente de chaque billet (appliquée à toutes les dates).
  const names = f.getAll('tn').map(s => s.trim()), S = f.getAll('ts'), E = f.getAll('te');
  if (S.some(Boolean) || E.some(Boolean)) {
    try {
      const T = await q(sb.from('tiers').select('id,name').eq('event_id', id));
      for (const t of T) { const i = names.indexOf(t.name); if (i < 0 || !(S[i] || E[i])) continue; await rpc2('update_tier', { p_id: t.id, p: { sales_start: S[i] ? fromLocalInput(S[i]) : '', sales_end: E[i] ? fromLocalInput(E[i]) : '' } }); }
    } catch (e) { notes.push('période de vente : ' + e.message); }
  }
  // Lieu saisi à la main : enregistré dans « Mes lieux » et rattaché à l'événement.
  if (!f.get('venue_id') && f.get('save_venue') && (f.get('venue') || '').trim()) {
    try {
      const V = await q(sb.from('venues').select('id,name,city').eq('organizer_id', ME.id));
      const name = f.get('venue').trim(), city = (f.get('city') || '').trim();
      let vid = (V.find(v => v.name.toLowerCase() === name.toLowerCase() && (v.city || '').toLowerCase() === city.toLowerCase()) || {}).id;
      if (!vid) vid = await rpc2('save_venue', { p: { name, address: name, city, country: f.get('country') || 'Guinée', listed: false } });
      await rpc2('set_event_venue', { p_event: id, p_venue: vid });
    } catch (e) { notes.push('lieu : ' + e.message); }
  }
  if (notes.length) toast('Événement enregistré. À vérifier — ' + notes.join(' ; '));
};

/* =====================================================================
   3. DATES DE L'ÉVÉNEMENT : CHANGER, AJOUTER, SUPPRIMER (MÊME EN LIGNE)
   ===================================================================== */
const _modifier11 = ORG_R.modifier;
ORG_R.modifier = async () => {
  const h = await _modifier11(), id = (location.hash.match(/modifier\/([0-9a-f-]{36})/) || [])[1]; if (!id) return h;
  let D = []; try { D = await q(sb.from('event_dates').select('*').eq('event_id', id).order('starts_at')); } catch (e) { return h; }
  const dur = d => Math.max(1, Math.round((ts(d.ends_at) - ts(d.starts_at)) / 36e5));
  return `<div class="wrap" style="padding-top:22px"><div class="card pad stack" style="max-width:900px"><h2 style="margin:0">Dates de l'événement</h2><p class="sm mut" style="margin:0">Vous pouvez changer une date même si la vente est ouverte : les billets déjà vendus restent valables et leurs acheteurs sont prévenus.</p>
  ${D.map((d, i) => `<form class="date-edit" data-f="evDate" data-ev="${id}" data-id="${d.id}"><b>Date ${i + 1}</b><label class="f">Début<input name="start" type="datetime-local" required value="${isoL(d.starts_at)}"></label><label class="f">Durée (heures)<input name="dur" type="number" min="1" max="72" required value="${dur(d)}"></label><button class="btn s">Enregistrer</button>${D.length > 1 ? `<button type="button" class="btn s ghost" data-a="evDateDel" data-id="${d.id}">Supprimer</button>` : ''}</form>`).join('')}
  <form class="date-edit add" data-f="evDate" data-ev="${id}" data-id=""><b>+ Nouvelle date</b><label class="f">Début<input name="start" type="datetime-local" required></label><label class="f">Durée (heures)<input name="dur" type="number" min="1" max="72" required value="${D[0] ? dur(D[0]) : 5}"></label><button class="btn s">Ajouter la date</button></form>
  <p class="xs mut" style="margin:0">Une nouvelle date reçoit les mêmes billets (noms, prix, quantités) que la première date.</p></div></div>` + h;
};

/* =====================================================================
   4. CONCOURS ET VOTES
   ===================================================================== */
const candRow = () => `<div class="dyn-row cand-row"><label class="f">Nom<input name="cn" required minlength="2"></label><label class="f">Ville<input name="cc"></label><label class="f">Profession<input name="cpf"></label><label class="f">Âge<input name="ca" type="number" min="1" max="120"></label>${delBtn}<label class="f">Photo<input name="cph" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="f" style="grid-column:span 3">Présentation<input name="cb" maxlength="1500"></label></div>`;
ORG_R.votes = async () => {
  const [C, X] = await Promise.all([q(sb.from('vote_campaigns').select('*').eq('organizer_id', ME.id).order('created_at', { ascending: false })), extras().catch(() => ({ campaigns: [] }))]);
  const ids = C.map(c => c.id), CD = ids.length ? await q(sb.from('vote_candidates').select('*').in('campaign_id', ids).order('number')) : [];
  const stats = Object.fromEntries((X.campaigns || []).map(c => [c.id, c])), ed = UI.vEdit === 'new' ? {} : C.find(c => c.id === UI.vEdit), open = UI.vCands;
  const editor = ed ? `<form class="card pad stack" data-f="voteSave" data-id="${ed.id || ''}" style="max-width:980px"><div class="row between"><h2 style="margin:0">${ed.id ? 'Modifier « ' + esc(ed.name) + ' »' : 'Nouveau concours'}</h2><label class="switch"><input type="checkbox" name="published" ${ed.published === false ? '' : 'checked'}><span></span> En ligne</label></div>
  <div class="g2"><label class="f">Titre du concours<input name="name" required minlength="3" value="${esc(ed.name || '')}" placeholder="Ex. Miss Guinée 2027"></label><label class="f">Nom de l'organisateur affiché<input name="org_name" value="${esc(ed.org_name || ME.org_name || '')}"></label>
  <label class="f">Payant seulement ?<select name="paid_only" onchange="const p=this.closest('form').elements.price;p.readOnly=this.value==='0';if(this.value==='0')p.value=0"><option value="1">Oui — chaque vote est payant</option><option value="0" ${ed.id && +ed.price === 0 ? 'selected' : ''}>Non — vote gratuit</option></select></label><label class="f">Prix d'un vote (GNF)<input name="price" type="number" min="0" step="100" value="${ed.id ? ed.price : 1000}" ${ed.id && +ed.price === 0 ? 'readonly' : ''}></label>
  <label class="f">Début du vote<input name="starts" type="datetime-local" required value="${ed.id ? isoL(ed.starts_at) : isoL(Date.now())}"></label><label class="f">Fin du vote<input name="ends" type="datetime-local" required value="${ed.id ? isoL(ed.ends_at) : isoL(Date.now() + 30 * DAY)}"></label>
  <label class="f">Votes maximum par achat<input name="max" type="number" min="1" max="10000" value="${ed.max_per_purchase || 1000}"></label><span></span></div>
  <label class="f">Description courte <span class="xs mut">(affichée sur la carte du concours)</span><input name="short_desc" maxlength="200" value="${esc(ed.short_desc || '')}"></label><label class="f">Description complète et règlement<textarea name="description" rows="4">${esc(ed.description || '')}</textarea></label>
  <div class="g3"><label class="f">Image / affiche${ed.image_url ? ' (remplacer)' : ''}<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="f">Bannière${ed.banner_url ? ' (remplacer)' : ''}<input name="banner" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="f">Logo de l'organisateur${ed.logo_url ? ' (remplacer)' : ''}<input name="logo" type="file" accept="image/jpeg,image/png,image/webp"></label></div>
  ${ed.id ? '' : `<div><div class="row between"><h3 style="margin:0">Candidats</h3><button type="button" class="btn s ghost" data-a="rowAdd2" data-k="cand">+ Ajouter un candidat</button></div><div class="dyn-list" data-list="cand" style="margin-top:10px">${candRow()}${candRow()}</div><p class="xs mut" style="margin:4px 0 0">Ajoutez autant de candidats que nécessaire. Vous pourrez en ajouter, modifier ou retirer ensuite.</p></div>`}
  <div class="row"><button class="btn xl">Enregistrer</button><button type="button" class="btn ghost" data-a="vEdit" data-id="">Annuler</button></div></form>` : '';
  const card = c => { const s = stats[c.id] || {}, R = s.results || [], tot = R.reduce((a, x) => a + +x.votes, 0), cands = CD.filter(x => x.campaign_id === c.id);
    return `<div class="card pad stack"><div class="row" style="gap:14px;align-items:flex-start">${safeUrl(c.image_url) ? `<img src="${esc(c.image_url)}" alt="" class="thumb">` : `<div class="thumb ph">${ic('vote')}</div>`}<div style="flex:1;min-width:200px"><div class="row between" style="align-items:flex-start"><h2 style="margin:0">${esc(c.name)}</h2><div class="row" style="gap:6px">${onBadge(c)}${badge(c.suspended ? ['Suspendu', 'red'] : period(c.starts_at, c.ends_at))}${badge(+c.price ? [money(c.price, c.currency) + ' / vote', 'orange'] : ['Vote gratuit', 'blue'])}</div></div>
    <p class="sm mut" style="margin:4px 0">${esc(c.short_desc || '')}</p><p class="xs mut" style="margin:0">Du ${dFmt(c.starts_at)} ${hFmt(c.starts_at)} au ${dFmt(c.ends_at)} ${hFmt(c.ends_at)}</p></div></div>
    <div class="kpis kpis-s"><div class="kpi"><small>Votes</small><b>${num(tot)}</b></div><div class="kpi hot"><small>Recettes</small><b>${money(s.revenue || 0, c.currency)}</b></div><div class="kpi"><small>Candidats</small><b>${cands.length}</b></div><div class="kpi"><small>En tête</small><b style="font-size:1rem">${R[0] && +R[0].votes ? esc(R[0].name) : '—'}</b></div></div>
    <div class="row" style="gap:6px"><button class="btn s" data-a="vCands" data-id="${c.id}">${open === c.id ? 'Fermer les candidats' : 'Candidats (' + cands.length + ')'}</button><button class="btn s ghost" data-a="vEdit" data-id="${c.id}">Modifier</button><button class="btn s ghost" data-a="online13" data-kind="vote" data-id="${c.id}" data-on="${c.published === false ? 1 : 0}">${c.published === false ? 'Mettre en ligne' : 'Mettre hors ligne'}</button><button class="btn s ghost" data-a="voteReport" data-id="${c.id}">Rapport PDF</button><button class="btn s ghost" data-a="voteCsv" data-id="${c.id}" data-name="${esc(c.name)}">Excel/CSV</button><a class="btn s ghost" href="#/vote/${c.id}">Voir la page</a><button class="btn s ghost" data-a="shareLink" data-url="${esc(location.origin + location.pathname + '#/vote/' + c.id)}" data-title="${esc(c.name)}">Lien</button><button class="btn s danger" data-a="del13" data-kind="vote" data-id="${c.id}" data-name="${esc(c.name)}">Supprimer</button></div>
    ${open === c.id ? `<div class="stack">${cands.map(x => { const r = R.find(y => y.id === x.id) || {}; return `<form class="cand-edit" data-f="candSave" data-id="${x.id}"><div class="row" style="gap:12px;align-items:flex-start">${safeUrl(x.photo_url) ? `<img src="${esc(x.photo_url)}" alt="" class="av-l">` : `<div class="av-l ph">${esc((x.name || '?').slice(0, 1))}</div>`}<div style="flex:1" class="stack"><div class="row between"><b>N° ${x.number} · ${num(r.votes || 0)} vote(s)</b><span class="row" style="gap:6px">${+r.votes ? `<button type="button" class="btn s ghost" data-a="cancelVotes" data-cand="${x.id}" data-name="${esc(x.name)}" data-max="${r.votes}">Annuler un lot</button>` : ''}<button type="button" class="btn s ghost" data-a="shareLink" data-url="${esc(voteUrl(c.id, x.id))}" data-title="${esc(x.name)}">Lien</button><button type="button" class="btn s danger" data-a="candDel" data-id="${x.id}" data-name="${esc(x.name)}">Retirer</button></span></div>
      <div class="g4"><label class="f">Nom<input name="name" required value="${esc(x.name)}"></label><label class="f">Ville<input name="city" value="${esc(x.city || '')}"></label><label class="f">Profession<input name="profession" value="${esc(x.profession || '')}"></label><label class="f">Âge<input name="age" type="number" min="1" max="120" value="${x.age || ''}"></label></div>
      <div class="g2"><label class="f">Réseau social (lien)<input name="social" value="${esc(x.social || '')}" placeholder="https://…"></label><label class="f">Photo${x.photo_url ? ' (remplacer)' : ''}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label></div><label class="f">Présentation<textarea name="bio" rows="2" maxlength="1500">${esc(x.bio || '')}</textarea></label><div><button class="btn s">Enregistrer</button></div></div></div></form>`; }).join('')}
      <form class="cand-edit add" data-f="candSave" data-camp="${c.id}" data-id=""><b>+ Ajouter un candidat</b><div class="g4"><label class="f">Nom<input name="name" required minlength="2"></label><label class="f">Ville<input name="city"></label><label class="f">Profession<input name="profession"></label><label class="f">Âge<input name="age" type="number" min="1" max="120"></label></div><div class="g2"><label class="f">Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="f">Réseau social (lien)<input name="social"></label></div><label class="f">Présentation<textarea name="bio" rows="2" maxlength="1500"></textarea></label><div><button class="btn s">Ajouter le candidat</button></div></form></div>` : ''}</div>`; };
  return `<div class="wrap sec stack" style="padding-top:22px"><div class="row between"><h2 style="margin:0">Mes concours</h2><button class="btn" data-a="vEdit" data-id="new">+ Nouveau concours</button></div>${editor}${C.length ? C.map(card).join('') : ed ? '' : '<div class="empty"><b>Aucun concours.</b><br>Créez votre premier concours : miss, talents, meilleur artiste…</div>'}</div>`;
};
// Rapport imprimable (PDF) d'un concours.
A.voteReport = async el => {
  const w = window.open('', '_blank'); if (!w) return toast('Autorisez l\'ouverture des fenêtres pour ce site, puis recommencez.');
  w.document.write('<p style="font-family:sans-serif;padding:30px">Préparation du rapport…</p>');
  try {
    const R = await rpc2('vote_report', { p_campaign: el.dataset.id }), c = R.campaign, T = R.totals, tot = +T.votes || 0, img = u => (safeUrl(u) ? `<img src="${esc(u)}" alt="">` : '<span class="ph"></span>');
    const maxD = Math.max(1, ...R.daily.map(d => +d.votes));
    w.document.open(); w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport — ${esc(c.name)}</title><style>
      body{font-family:Segoe UI,Arial,sans-serif;color:#1f2937;margin:28px}h1{margin:0;font-size:22px}h2{font-size:15px;margin:22px 0 8px;color:#9a3412;text-transform:uppercase;letter-spacing:.04em}
      .hd{display:flex;gap:14px;align-items:center;border-bottom:3px solid #f26a0f;padding-bottom:12px}.hd img{width:60px;height:60px;object-fit:cover;border-radius:10px}.mut{color:#6b7280;font-size:12px}
      .k{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.k div{border:1px solid #e5e7eb;border-radius:10px;padding:10px}.k b{display:block;font-size:20px}
      table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:middle}th{background:#fff5eb}td.n,th.n{text-align:right}
      td img,.ph{width:34px;height:34px;border-radius:50%;object-fit:cover;display:inline-block;background:#ffe6cf;vertical-align:middle}.bar{height:8px;background:#ffe6cf;border-radius:6px}.bar i{display:block;height:100%;background:#f26a0f;border-radius:6px}
      .day{display:flex;align-items:center;gap:8px;font-size:12px}.day span{width:80px}.day .bar{flex:1}tr.first td{font-weight:700}@media print{button{display:none}body{margin:12mm}}</style></head><body>
      <div class="hd">${safeUrl(c.logo_url) ? `<img src="${esc(c.logo_url)}" alt="">` : ''}<div><h1>${esc(c.name)}</h1><div class="mut">${esc(c.org_name || '')} · du ${dtFmt(c.starts_at)} au ${dtFmt(c.ends_at)} · ${+c.price ? money(c.price, c.currency) + ' par vote' : 'vote gratuit'}</div><div class="mut">Rapport édité le ${dtFmt(Date.now())} — FatiBillets</div></div></div>
      <h2>Synthèse</h2><div class="k"><div><span class="mut">Votes</span><b>${num(tot)}</b></div><div><span class="mut">Recettes</span><b>${money(T.amount, c.currency)}</b></div><div><span class="mut">Achats de votes</span><b>${num(T.purchases)}</b></div><div><span class="mut">Votants distincts</span><b>${num(T.buyers)}</b></div></div>
      <h2>Classement général</h2><table><tr><th>Rang</th><th></th><th>Candidat</th><th>Ville</th><th>Profession</th><th class="n">Votes</th><th class="n">Part</th><th class="n">Montant</th></tr>${R.results.map((x, i) => `<tr class="${i === 0 && +x.votes ? 'first' : ''}"><td>${i + 1}</td><td>${img(x.photo_url)}</td><td>N° ${x.number} — ${esc(x.name)}${x.age ? ' (' + x.age + ' ans)' : ''}</td><td>${esc(x.city || '')}</td><td>${esc(x.profession || '')}</td><td class="n">${num(x.votes)}</td><td class="n">${tot ? (x.votes / tot * 100).toFixed(1) : '0.0'} %</td><td class="n">${money(x.amount, c.currency)}</td></tr>`).join('')}</table>
      <h2>Votes par jour</h2>${R.daily.length ? R.daily.map(d => `<div class="day"><span>${dFmt(d.day)}</span><div class="bar"><i style="width:${(d.votes / maxD * 100).toFixed(1)}%"></i></div><b>${num(d.votes)}</b></div>`).join('') : '<p class="mut">Aucun vote confirmé.</p>'}
      <p class="mut" style="margin-top:24px">Seuls les votes confirmés sont comptés. Les lots annulés (fraude, anomalie) sont déduits du classement.</p>
      <button onclick="print()" style="margin-top:14px;padding:10px 18px;border:0;border-radius:8px;background:#f26a0f;color:#fff;font-weight:700">Imprimer / Enregistrer en PDF</button></body></html>`);
    w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* l'utilisateur imprimera avec le bouton */ } }, 600);
  } catch (e) { w.close(); toast(e.message); }
};

/* =====================================================================
   5. CAGNOTTES
   ===================================================================== */
ORG_R.cagnottes = async () => {
  let P = []; try { P = await rpc2('org_pots'); } catch (e) { return box('Cagnottes indisponibles', `<p class="mut">${esc(e.message)}</p>`); }
  const ed = UI.pEdit === 'new' ? {} : P.find(x => x.id === UI.pEdit), open = UI.pOpen;
  const editor = ed ? `<form class="card pad stack" data-f="potSave13" data-id="${ed.id || ''}" style="max-width:980px"><div class="row between"><h2 style="margin:0">${ed.id ? 'Modifier « ' + esc(ed.name) + ' »' : 'Nouvelle cagnotte'}</h2><label class="switch"><input type="checkbox" name="published" ${ed.published === false ? '' : 'checked'}><span></span> En ligne</label></div>
  <div class="g2"><label class="f">Titre de la cagnotte<input name="name" required minlength="3" value="${esc(ed.name || '')}" placeholder="Ex. Soutien aux sinistrés de Kaloum"></label><label class="f">Objectif (GNF)<input name="goal" type="number" min="1000" step="1000" required value="${ed.goal || ''}"></label>
  <label class="f">Contribution minimum (GNF)<input name="min" type="number" min="0" step="500" value="${ed.id ? ed.min_amount : 5000}"></label><label class="f">Contribution maximum (GNF) <span class="xs mut">(vide = sans limite)</span><input name="max" type="number" min="0" step="500" value="${ed.max_amount || ''}"></label>
  <label class="f">Début de la collecte<input name="starts" type="datetime-local" required value="${ed.id ? isoL(ed.starts_at) : isoL(Date.now())}"></label><label class="f">Fin de la collecte<input name="ends" type="datetime-local" required value="${ed.id ? isoL(ed.ends_at) : isoL(Date.now() + 30 * DAY)}"></label></div>
  <label class="f">Description<textarea name="description" rows="4" required>${esc(ed.description || '')}</textarea></label><label class="row sm"><input type="checkbox" name="public" ${ed.is_public === false ? '' : 'checked'}> Visible dans la liste publique des cagnottes (sinon : accessible seulement par le lien)</label>
  <label class="f">Affiche${ed.image_url ? ' (choisir un fichier pour la remplacer)' : ''}<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label>${safeUrl(ed.image_url) ? `<img src="${esc(ed.image_url)}" alt="" style="max-height:150px;border-radius:12px;object-fit:cover;align-self:flex-start">` : ''}
  <div class="sm" style="font-weight:650">Photos (12 maximum)</div>${(ed.gallery || []).length ? `<div class="gal-edit">${ed.gallery.map(u => `<label><img src="${esc(u)}" alt=""><span class="xs"><input type="checkbox" name="keep" value="${esc(u)}" checked> garder</span></label>`).join('')}</div>` : ''}<label class="f">Ajouter des photos<input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp"></label>
  <div class="row"><button class="btn xl">Enregistrer</button><button type="button" class="btn ghost" data-a="pEdit" data-id="">Annuler</button></div></form>` : '';
  const card = x => `<div class="card pad stack"><div class="row" style="gap:14px;align-items:flex-start">${safeUrl(x.image_url) ? `<img src="${esc(x.image_url)}" alt="" class="thumb">` : `<div class="thumb ph">${ic('heart')}</div>`}<div style="flex:1;min-width:200px"><div class="row between" style="align-items:flex-start"><h2 style="margin:0">${esc(x.name)}</h2><div class="row" style="gap:6px">${onBadge(x)}${badge(x.suspended ? ['Suspendue', 'red'] : period(x.starts_at, x.ends_at))}${x.is_public ? '' : badge(['Privée', 'gray'])}</div></div>
    <p class="xs mut" style="margin:4px 0 0">Du ${dFmt(x.starts_at)} au ${dFmt(x.ends_at)} · minimum ${money(x.min_amount, x.currency)}${x.max_amount ? ' · maximum ' + money(x.max_amount, x.currency) : ''}</p>
    <div class="row between sm" style="margin-top:8px"><b>${money(x.collected, x.currency)}</b><span class="mut">sur ${money(x.goal, x.currency)} · ${pct(+x.collected, +x.goal)} % · ${num(x.contributors)} contribution(s)</span></div>${bar(+x.collected, +x.goal)}</div></div>
    <div class="row" style="gap:6px"><button class="btn s" data-a="pOpen" data-id="${x.id}">${open === x.id ? 'Masquer les contributions' : 'Contributions (' + num(x.contributors) + ')'}</button><button class="btn s ghost" data-a="pEdit" data-id="${x.id}">Modifier</button><button class="btn s ghost" data-a="online13" data-kind="pot" data-id="${x.id}" data-on="${x.published === false ? 1 : 0}">${x.published === false ? 'Mettre en ligne' : 'Mettre hors ligne'}</button><a class="btn s ghost" href="#/cagnotte/${x.id}">Voir la page</a><button class="btn s ghost" data-a="shareLink" data-url="${esc(location.origin + location.pathname + '#/cagnotte/' + x.id)}" data-title="${esc(x.name)}">Lien</button>${x.last.length ? `<button class="btn s ghost" data-a="potCsv" data-id="${x.id}">Excel/CSV</button>` : ''}<button class="btn s danger" data-a="del13" data-kind="pot" data-id="${x.id}" data-name="${esc(x.name)}">Supprimer</button></div>
    ${open === x.id ? (x.last.length ? `<div class="tw"><table><tr><th>Contributeur</th><th>Téléphone</th><th class="n">Montant</th><th>Date</th></tr>${x.last.map(l => `<tr><td>${esc(l.name)}</td><td class="sm">${esc(l.phone || '')}</td><td class="n">${money(l.amount, x.currency)}</td><td class="sm">${dtFmt(l.at)}</td></tr>`).join('')}</table></div><p class="xs mut">Les 50 dernières contributions. Le nom d'un contributeur anonyme n'est jamais affiché sur la page publique.</p>` : '<p class="sm mut">Aucune contribution pour le moment.</p>') : ''}</div>`;
  window.__pots = P;
  return `<div class="wrap sec stack" style="padding-top:22px"><div class="row between"><h2 style="margin:0">Mes cagnottes</h2><button class="btn" data-a="pEdit" data-id="new">+ Nouvelle cagnotte</button></div>${editor}${P.length ? P.map(card).join('') : ed ? '' : '<div class="empty"><b>Aucune cagnotte.</b><br>Créez votre première campagne de collecte.</div>'}</div>`;
};

/* =====================================================================
   6. SCANNERS : COMPTES, PARAMÈTRES, STATISTIQUES
   ===================================================================== */
const SC_SET = [['sound', 'Son à chaque scan'], ['vibrate', 'Vibration à chaque scan'], ['show_holder', 'Afficher le nom du titulaire'], ['manual_entry', 'Autoriser la saisie manuelle du code']];
ORG_R.scanners = async () => {
  let S; try { S = await rpc2('org_scanner_list'); } catch (e) { return box('Scanners indisponibles', `<p class="mut">${esc(e.message)}</p>`); }
  const EV = (await q(sb.from('events').select('id,name,cancelled,archived').eq('organizer_id', ME.id).order('created_at', { ascending: false }))).filter(e => !e.cancelled && !e.archived);
  const L = S.scanners, ed = UI.scEdit === 'new' ? {} : L.find(x => x.id === UI.scEdit), tot = L.reduce((a, x) => a + +x.scans, 0), ok = L.reduce((a, x) => a + +x.valid, 0);
  const evPick = (sel = []) => EV.length ? `<div class="stack" style="gap:6px">${EV.map(e => { const cur = sel.find(x => x.id === e.id); return `<div class="row" style="gap:8px"><label class="row sm" style="flex:1"><input type="checkbox" name="ev" value="${e.id}" ${cur ? 'checked' : ''}> ${esc(e.name)}</label><input class="in" style="margin:0;max-width:220px" name="cp_${e.id}" placeholder="Point de contrôle (ex. Porte A)" value="${esc(cur && cur.checkpoint || '')}"></div>`; }).join('')}</div>` : '<p class="sm mut">Aucun événement actif.</p>';
  const setOn = (s, k) => (s && k in s ? s[k] : true);
  const editor = ed ? `<form class="card pad stack" data-f="scSave" data-id="${ed.id || ''}" style="max-width:900px"><h2 style="margin:0">${ed.id ? 'Modifier le scanner « ' + esc(ed.name || '') + ' »' : 'Nouveau scanner'}</h2>
  ${ed.id ? '' : '<p class="sm mut" style="margin:0">Vous créez le compte et choisissez le mot de passe, puis vous les remettez au scanner. Il se connecte avec son numéro de téléphone et ce mot de passe, et ne peut que contrôler les billets des événements cochés.</p>'}
  <div class="g2"><label class="f">Nom du scanner<input name="name" required minlength="2" value="${esc(ed.name || '')}" placeholder="Ex. Mamadou — Porte A"></label><label class="f">Téléphone (identifiant de connexion)<input name="phone" required inputmode="tel" pattern="[+0-9 ]{8,}" value="${esc(ed.phone || '')}"></label>
  ${ed.id ? `<label class="f">Nouveau mot de passe <span class="xs mut">(laisser vide pour ne pas changer)</span><input name="password" type="text" minlength="8" autocomplete="new-password"></label>` : `<label class="f">E-mail <span class="xs mut">(facultatif)</span><input name="email" type="email" autocomplete="off"></label><label class="f">Mot de passe (8 caractères minimum)<input name="password" type="text" required minlength="8" autocomplete="new-password"></label>`}<label class="f">Note interne <span class="xs mut">(facultatif)</span><input name="label" value="${esc(ed.label || '')}" placeholder="Ex. Équipe sécurité"></label></div>
  <div><h3 style="margin:0 0 8px">Événements à contrôler</h3>${evPick(ed.events || [])}</div>
  <div><h3 style="margin:0 0 8px">Paramètres de l'application scanner</h3><div class="g2">${SC_SET.map(([k, l]) => `<label class="row sm"><input type="checkbox" name="s_${k}" ${setOn(ed.settings, k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
  <div class="row"><button class="btn xl">${ed.id ? 'Enregistrer' : 'Créer le compte scanner'}</button><button type="button" class="btn ghost" data-a="scEdit" data-id="">Annuler</button></div></form>` : '';
  return `<div class="wrap sec stack" style="padding-top:22px"><div class="row between"><h2 style="margin:0">Mes scanners</h2><button class="btn" data-a="scEdit" data-id="new">+ Nouveau scanner</button></div>
  <div class="kpis"><div class="kpi"><small>Scanners</small><b>${L.length}</b><span class="xs mut">${L.filter(x => x.status === 'actif').length} actifs</span></div><div class="kpi"><small>Scans effectués</small><b>${num(tot)}</b></div><div class="kpi hot"><small>Entrées validées</small><b>${num(ok)}</b></div><div class="kpi"><small>Refus</small><b>${num(tot - ok)}</b></div><div class="kpi"><small>Scans aujourd'hui</small><b>${num(L.reduce((a, x) => a + +x.today, 0))}</b></div></div>${editor}
  <div class="card pad">${L.length ? `<div class="tw"><table><tr><th>Scanner</th><th>Événements</th><th class="n">Scans</th><th class="n">Validés</th><th class="n">Refus</th><th>Dernier scan</th><th>Statut</th><th></th></tr>${L.map(x => `<tr><td><b>${esc(x.name || '—')}</b><div class="xs mut">${esc(x.phone || '')}${x.email && !/@scanners\.fatibillets\.app$/.test(x.email) ? ' · ' + esc(x.email) : ''}</div>${x.label ? `<div class="xs mut">${esc(x.label)}</div>` : ''}</td><td class="sm">${x.events.length ? x.events.map(e => esc(e.name) + (e.checkpoint ? ' <span class="mut">(' + esc(e.checkpoint) + ')</span>' : '')).join('<br>') : '<span class="mut">Aucun</span>'}</td><td class="n">${num(x.scans)}</td><td class="n">${num(x.valid)}</td><td class="n">${num(x.scans - x.valid)}</td><td class="sm">${x.last_at ? dtFmt(x.last_at) : '—'}</td><td>${badge(x.status === 'actif' ? ['Actif', 'green'] : ['Désactivé', 'gray'])}</td>
    <td class="r nowrap"><button class="btn s ghost" data-a="scEdit" data-id="${x.id}">Modifier</button> <button class="btn s ghost" data-a="scToggle" data-id="${x.id}" data-on="${x.status === 'actif' ? 0 : 1}">${x.status === 'actif' ? 'Désactiver' : 'Activer'}</button> <button class="btn s danger" data-a="scDel" data-id="${x.id}" data-name="${esc(x.name || '')}">Supprimer</button></td></tr>`).join('')}</table></div>` : '<div class="empty">Aucun scanner. Créez un compte pour chaque personne qui contrôle les entrées.</div>'}</div>
  <div class="cols"><div class="card pad"><h2>Contrôle par événement</h2>${S.by_event.length ? `<div class="tw"><table><tr><th>Événement</th><th>Entrées / billets vendus</th><th class="n">Refus</th></tr>${S.by_event.map(e => `<tr><td><b>${esc(e.name)}</b></td><td style="min-width:150px">${num(e.scanned)} / ${num(e.sold)}${bar(+e.scanned, +e.sold)}</td><td class="n">${num(e.refused)}</td></tr>`).join('')}</table></div>` : '<p class="sm mut">Aucun événement récent.</p>'}</div>
  <div class="card pad"><h2>Derniers scans</h2>${S.recent.length ? `<div class="tw" style="max-height:420px;overflow:auto"><table><tr><th>Heure</th><th>Code</th><th>Résultat</th><th>Scanner</th></tr>${S.recent.map(r => `<tr><td class="sm nowrap">${dtFmt(r.at)}</td><td class="tk-code">${esc(r.code || '')}</td><td>${badge(r.ok ? ['Validé', 'green'] : [r.result || 'Refusé', 'red'])}<div class="xs mut">${esc(r.event)}</div></td><td class="sm">${esc(r.scanner || '')}</td></tr>`).join('')}</table></div>` : '<p class="sm mut">Aucun scan pour le moment.</p>'}</div></div>
  <details class="card pad"><summary class="sm" style="cursor:pointer;font-weight:650">Affecter un compte FatiBillets existant comme scanner</summary>${EV.length ? `<form class="stack" data-f="newScanner" style="margin-top:12px;max-width:620px"><label class="f">E-mail du compte<input name="email" type="email" required></label><label class="f">Événement<select name="event">${EV.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label><label class="f">Point de contrôle (facultatif)<input name="checkpoint" maxlength="60"></label><div><button class="btn s">Affecter</button></div></form>` : ''}</details></div>`;
};

/* ---------- application scanner : paramètres appliqués ---------- */
let SCAN_SET = null;
async function scanSettings() { if (SCAN_SET) return SCAN_SET; try { SCAN_SET = role() === 'scanner' ? await rpc2('my_scanner_settings') : {}; } catch (e) { SCAN_SET = {}; } return SCAN_SET; }
const setv = (s, k) => (s && k in s ? !!s[k] : true);
function beep(ok) {
  try { const C = new (window.AudioContext || window.webkitAudioContext)(), o = C.createOscillator(), g = C.createGain(); o.connect(g); g.connect(C.destination); o.frequency.value = ok ? 880 : 220; g.gain.value = .15; o.start(); o.stop(C.currentTime + (ok ? .15 : .45)); } catch (e) { /* son indisponible */ }
}
doScan = async raw => {
  const el = $('#scanres'); if (!el) return; const S = await scanSettings();
  try {
    const r = await rpc('scan_ticket', UI.scanEv ? { p_code: raw, p_event: UI.scanEv } : { p_code: raw });
    const lines = (r.lines || []).map(l => (setv(S, 'show_holder') ? l : String(l).split(' · ')[0]));
    el.innerHTML = `<div class="res ${r.ok ? 'ok' : 'ko'}"><big>${esc(r.title)}</big><div>${[r.at ? (r.ok ? 'Validé le ' : 'Premier scan : ') + dtFmt(r.at) : '', r.date ? 'Ce billet est valable le ' + dFmt(r.date) + ' à ' + hFmt(r.date) : '', ...lines].filter(Boolean).map(esc).join('<br>')}</div></div>`;
    if (setv(S, 'sound')) beep(r.ok); if (setv(S, 'vibrate') && navigator.vibrate) navigator.vibrate(r.ok ? 90 : [150, 70, 150]);
  } catch (e) { el.innerHTML = `<div class="res ko"><big>ERREUR</big><div>${esc(e.message)}</div></div>`; if (setv(S, 'sound')) beep(false); }
};
const _scan11 = VIEWS.scan;
VIEWS.scan = async p => { const h = await _scan11(p); const S = await scanSettings(); return setv(S, 'manual_entry') ? h : h.replace(/<form class="row" data-f="scan">[\s\S]*?<\/form>/, '<p class="xs mut" style="margin:0">Saisie manuelle désactivée par l\'organisateur : utilisez la caméra.</p>'); };

/* =====================================================================
   7. PAGE PUBLIQUE D'UN CONCOURS : BANNIÈRE, LOGO, DESCRIPTION COURTE
   ===================================================================== */
const _vote11 = VIEWS.vote;
VIEWS.vote = async p => {
  const h = await _vote11(p); let c = null; try { c = await q(sb.from('vote_campaigns').select('banner_url,logo_url,org_name,short_desc,starts_at').eq('id', p[1]).maybeSingle()); } catch (e) { return h; }
  if (!c) return h;
  const top = `${safeUrl(c.banner_url) ? `<div class="vote-banner" style="background-image:url('${esc(c.banner_url)}')"></div>` : ''}${safeUrl(c.logo_url) || c.short_desc || ts(c.starts_at) > Date.now() ? `<div class="wrap"><div class="vote-org">${safeUrl(c.logo_url) ? `<img src="${esc(c.logo_url)}" alt="">` : ''}<div><b>${esc(c.org_name || '')}</b>${c.short_desc ? `<div class="sm mut">${esc(c.short_desc)}</div>` : ''}${ts(c.starts_at) > Date.now() ? `<div class="sm" style="color:var(--o-d);font-weight:700">Le vote ouvre le ${dFmt(c.starts_at)} à ${hFmt(c.starts_at)}</div>` : ''}</div></div></div>` : ''}`;
  return top + h;
};

/* ---------- actions ---------- */
Object.assign(A, {
  ordF(el) { UI.ordF = el.dataset.v; render(); },
  ordCsv() { rpc2('org_overview').then(O => download('commandes.csv', [['Date', 'Acheteur', 'Téléphone', 'Événement', 'Billets', 'Montant', 'Devise', 'Canal', 'Statut'], ...O.orders.map(o => [dtFmt(o.created_at), o.name, o.phone, o.event, o.n, o.total, o.currency, o.pos ? 'Point de vente' : (o.method || 'En ligne'), oSt(o.status)[0]])])).catch(e => toast(e.message)); },
  evDateDel(el) { if (!confirm('Supprimer cette date ? (possible seulement si aucun billet n\'est vendu pour elle)')) return; act(() => rpc2('delete_event_date', { p_date: el.dataset.id }), 'Date supprimée.'); },
  vEdit(el) { UI.vEdit = el.dataset.id || null; render().then(() => { const f = $('[data-f="voteSave"]'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); },
  vCands(el) { UI.vCands = UI.vCands === el.dataset.id ? null : el.dataset.id; render(); },
  candDel(el) { if (!confirm('Retirer le candidat « ' + el.dataset.name + ' » ?')) return; act(async () => { await rpc2('delete_candidate', { p_id: el.dataset.id }); XC = null; }, 'Candidat retiré.'); },
  pEdit(el) { UI.pEdit = el.dataset.id || null; render().then(() => { const f = $('[data-f="potSave13"]'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); },
  pOpen(el) { UI.pOpen = UI.pOpen === el.dataset.id ? null : el.dataset.id; render(); },
  potCsv(el) { const x = (window.__pots || []).find(p => p.id === el.dataset.id); if (x) download('cagnotte-' + x.name.replace(/[^\w-]+/g, '-').slice(0, 40) + '.csv', [['Date', 'Contributeur', 'Téléphone', 'Montant', 'Devise'], ...x.last.map(l => [dtFmt(l.at), l.name, l.phone || '', l.amount, x.currency])]); },
  online13(el) { act(async () => { await rpc2('set_online', { p_kind: el.dataset.kind, p_id: el.dataset.id, p_on: el.dataset.on === '1' }); XC = null; }, el.dataset.on === '1' ? 'Mis en ligne : visible du public.' : 'Mis hors ligne : invisible du public.'); },
  del13(el) {
    const fn0 = { vote: 'delete_campaign', pot: 'delete_pot', form: 'delete_form' }[el.dataset.kind];
    if (!confirm('Supprimer définitivement « ' + el.dataset.name + ' » ?\n\nS\'il a déjà reçu des paiements, la suppression sera refusée : mettez-le plutôt hors ligne.')) return;
    act(async () => { await rpc2(fn0, { p_id: el.dataset.id }); XC = null; UI.vEdit = UI.pEdit = UI.formEdit = null; }, 'Supprimé.');
  },
  appFilter(el) { UI.appFilter = el.dataset.v; render(); },
  scEdit(el) { UI.scEdit = el.dataset.id || null; render().then(() => { const f = $('[data-f="scSave"]'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); },
  scToggle(el) { act(() => rpc2('org_scanner_save', { p_id: el.dataset.id, p: { active: el.dataset.on === '1' } }), el.dataset.on === '1' ? 'Scanner activé.' : 'Scanner désactivé : il ne peut plus se connecter au contrôle.'); },
  scDel(el) {
    if (!confirm('Supprimer le scanner « ' + el.dataset.name + ' » ?\n\nSes accès sont retirés. S\'il a déjà scanné des billets, son compte est fermé et l\'historique des scans est conservé.')) return;
    act(async () => { const r = await fn('org-scanner', { action: 'delete', scanner_id: el.dataset.id }); if (r.mode === 'ferme') toast('Compte fermé : l\'historique de ses scans est conservé.'); }, 'Scanner supprimé.');
  },
  rowAdd2(el) { const list = el.closest('form').querySelector(`[data-list="${el.dataset.k}"]`); if (list.children.length >= 200) return toast('Nombre maximum atteint.'); list.insertAdjacentHTML('beforeend', candRow()); list.lastElementChild.querySelector('input').focus(); },
});
Object.assign(F, {
  async evDate(f, form) {
    const s = new Date(f.get('start')), e = new Date(+s + +f.get('dur') * 36e5);
    if (isNaN(+s)) throw new Error('Date invalide.');
    await rpc2('save_event_date', { p_event: form.dataset.ev, p_date: form.dataset.id || null, p_starts: s.toISOString(), p_ends: e.toISOString() });
    DATA = null; toast(form.dataset.id ? 'Date modifiée. Les acheteurs déjà servis sont prévenus.' : 'Date ajoutée avec les mêmes billets.'); await render();
  },
  async voteSave(f, form) {
    const paid = f.get('paid_only') !== '0', price = paid ? +f.get('price') : 0;
    if (paid && !(price > 0)) throw new Error('Indiquez le prix d\'un vote, ou choisissez « Non — vote gratuit ».');
    const [image_url, banner_url, logo_url] = [await uploadImage(f.get('image')), await uploadImage(f.get('banner')), await uploadImage(f.get('logo'))];
    const p = { id: form.dataset.id || null, name: f.get('name'), org_name: f.get('org_name'), price, paid_only: paid, starts_at: fromLocalInput(f.get('starts')), ends_at: fromLocalInput(f.get('ends')), max_per_purchase: f.get('max'), short_desc: f.get('short_desc'), description: f.get('description'), image_url, banner_url, logo_url, published: !!f.get('published') };
    if (!form.dataset.id) {
      const N = f.getAll('cn'), Cc = f.getAll('cc'), Pf = f.getAll('cpf'), Ag = f.getAll('ca'), Ph = f.getAll('cph'), B = f.getAll('cb'); p.candidates = [];
      for (let i = 0; i < N.length; i++) { if (!N[i].trim()) continue; p.candidates.push({ name: N[i], city: Cc[i], profession: Pf[i], age: Ag[i], bio: B[i], photo_url: await uploadImage(Ph[i]) }); }
    }
    const id = await rpc2('save_campaign', { p }); XC = null; UI.vEdit = null; UI.vCands = form.dataset.id ? UI.vCands : id;
    toast(form.dataset.id ? 'Concours mis à jour.' : 'Concours créé.'); await render();
  },
  async candSave(f, form) {
    const photo_url = await uploadImage(f.get('photo'));
    await rpc2('save_candidate', { p: { id: form.dataset.id || null, campaign_id: form.dataset.camp || null, name: f.get('name'), city: f.get('city'), profession: f.get('profession'), age: f.get('age'), social: f.get('social'), bio: f.get('bio'), photo_url } });
    XC = null; toast(form.dataset.id ? 'Candidat mis à jour.' : 'Candidat ajouté.'); await render();
  },
  async potSave13(f, form) {
    const img = await uploadImage(f.get('image')), added = [];
    for (const file of f.getAll('photos')) { if (file && file.size) { const u = await uploadImage(file); if (u) added.push(u); } }
    const max = f.get('max') ? +f.get('max') : '';
    if (max !== '' && max < +f.get('min')) throw new Error('Le montant maximum doit être supérieur au minimum.');
    await rpc2('save_pot', { p: { id: form.dataset.id || null, name: f.get('name'), description: f.get('description'), goal: f.get('goal'), min_amount: f.get('min'), max_amount: max, starts_at: fromLocalInput(f.get('starts')), ends_at: fromLocalInput(f.get('ends')), is_public: !!f.get('public'), published: !!f.get('published'), image_url: img, gallery: [...f.getAll('keep'), ...added].slice(0, 12) } });
    XC = null; UI.pEdit = null; toast(form.dataset.id ? 'Cagnotte mise à jour.' : 'Cagnotte créée.'); await render();
  },
  async scSave(f, form) {
    const events = f.getAll('ev').map(id => ({ id, checkpoint: f.get('cp_' + id) || '' })), settings = Object.fromEntries(SC_SET.map(([k]) => [k, !!f.get('s_' + k)]));
    if (!form.dataset.id) {
      const r = await fn('org-scanner', { action: 'create', name: f.get('name'), phone: f.get('phone'), email: f.get('email'), password: f.get('password'), label: f.get('label'), events });
      try { await rpc2('org_scanner_save', { p_id: r.scanner_id, p: { settings } }); } catch (e) { /* paramètres par défaut */ }
      UI.scEdit = null; await render();
      modal(`<h2>${ic('check')} Compte scanner créé</h2><p>Remettez ces informations au scanner :</p><div class="note"><b>Identifiant :</b> ${esc(r.login)}<br><b>Mot de passe :</b> celui que vous avez choisi</div><p class="sm mut">Il se connecte sur FatiBillets, puis ouvre « Contrôle des billets ».</p><button class="btn" data-a="close">Compris</button>`);
      return;
    }
    await rpc2('org_scanner_save', { p_id: form.dataset.id, p: { name: f.get('name'), phone: f.get('phone'), label: f.get('label'), events, settings } });
    if (f.get('password')) await fn('org-scanner', { action: 'password', scanner_id: form.dataset.id, password: f.get('password') });
    UI.scEdit = null; toast('Scanner mis à jour.'); await render();
  },
});

Object.assign(EN, { 'Tableau de bord': 'Dashboard', 'Résumé de mon activité': 'My activity summary', 'Mes concours': 'My contests', 'Mes cagnottes': 'My fundraisers', 'Mes scanners': 'My scanners', 'Mes candidatures': 'My applications', 'Nouveau concours': 'New contest', 'Enregistrer': 'Save', 'Mettre en ligne': 'Publish', 'Mettre hors ligne': 'Unpublish', 'Supprimer': 'Delete', 'Modifier': 'Edit' });

boot();
