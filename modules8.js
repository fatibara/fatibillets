'use strict';
/* FatiBillets — demandes de la Direction (novembre 2026) :
   commissions modifiables à tout moment (dont transport), votes améliorés (nombre libre, podium, page candidat, partage,
   export et impression des résultats, ajout de candidats avec photo), points de vente et comptes vendeurs créés par
   l'organisateur, profil organisateur (logo, affiche, catégories), paiement direct sur LengoPay.
   Chargé après modules7.js ; nécessite la base v10 et la fonction serveur org-create-seller. */

/* =====================================================================
   1. COMMISSIONS : TOUS LES TAUX MODIFIABLES PAR L'ADMINISTRATEUR, DONT LE TRANSPORT
   ===================================================================== */
const _param8 = ADMIN_R.parametres;
ADMIN_R.parametres = async (D, me) => {
  const h = await _param8(D, me), S = (DATA && DATA.settings) || {}, v = typeof S.commission_transport === 'number' ? +(S.commission_transport * 100).toFixed(2) : '';
  return h.replace('<label class="f">Dons (cagnottes) (%)', `<label class="f">Transport (%)<input name="commission_transport" type="number" min="0" max="50" step="0.1" value="${v}" placeholder="Non fixé"></label><label class="f">Dons (cagnottes) (%)`)
    .replace('<h2>Commissions de la plateforme</h2>', '<h2>Commissions de la plateforme</h2><div class="note">Vous pouvez modifier ces taux à tout moment. Chaque changement est enregistré dans le journal d\'audit et s\'applique immédiatement aux calculs.</div>');
};
F.rates = async f => {
  for (const k of ['commission_tickets_online', 'commission_tickets_pos', 'commission_votes', 'commission_applications', 'commission_donations', 'commission_transport']) {
    const v = f.get(k); if (v === null || v === '') continue;
    await rpc2('set_setting', { p_key: k, p_value: +v / 100, p_reason: f.get('reason') });
  }
  DATA = null; XC = null; toast('Taux de commission enregistrés.'); await render();
};

/* =====================================================================
   2. VOTES
   ===================================================================== */
const voteUrl = (c, k) => location.origin + location.pathname + '#/candidat/' + c + (k ? '/' + k : '');
async function voteData(id) {
  const [c, R, Cd] = await Promise.all([q(sb.from('vote_campaigns').select('*').eq('id', id).maybeSingle()), rpc2('vote_results', { p_campaign: id }), q(sb.from('vote_candidates').select('*').eq('campaign_id', id))]);
  if (!c) return null;
  const info = Object.fromEntries(Cd.map(x => [x.id, x])); R.sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
  const tot = R.reduce((a, x) => a + +x.votes, 0); R.forEach((x, i) => Object.assign(x, info[x.candidate_id] || {}, { rank: i + 1, pct: tot ? x.votes / tot * 100 : 0 }));
  return { c, R, tot, st: cStatus(c), max: c.max_per_purchase || 1000 };
}
const avatar = (x, cls = 'av') => safeUrl(x.photo_url) ? `<img class="${cls}" src="${esc(x.photo_url)}" alt="${esc(x.name)}" loading="lazy">` : `<div class="${cls}">${esc(initials(x.name))}</div>`;
function voteBox(V, x) {
  if (V.st[0] !== 'Ouvert') return `<div class="note">Votes ${V.st[0].toLowerCase()}.</div>`;
  if (+V.c.price === 0) return `<button class="btn s" data-a="vote3" data-cand="${x.candidate_id}" data-name="${esc(x.name)}" data-price="0" data-cur="${esc(V.c.currency)}">Voter gratuitement</button>`;
  return `<div class="vote-box"><div class="chips">${[1, 5, 10, 50, 100].filter(n => n <= V.max).map(n => `<button type="button" class="chip" data-a="vqty" data-id="${x.candidate_id}" data-v="${n}">${n}</button>`).join('')}</div><div class="row"><input class="in" type="number" min="1" max="${V.max}" step="1" value="1" id="vn-${x.candidate_id}" aria-label="Nombre de votes" style="width:110px;margin:0" data-i="vqtyIn" data-price="${V.c.price}" data-cur="${esc(V.c.currency)}"><button class="btn s" data-a="vote3" data-cand="${x.candidate_id}" data-name="${esc(x.name)}" data-price="${V.c.price}" data-cur="${esc(V.c.currency)}">Voter</button></div><div class="xs mut" id="vt-${x.candidate_id}">Total : ${money(V.c.price, V.c.currency)}</div></div>`;
}
VIEWS.vote = async p => {
  const V = await voteData(p[1]); if (!V) return vNotFound();
  const { c, R, tot, st } = V, f = norm(UI.vq || ''), pod = R.slice(0, 3);
  return `<div class="poster big vote-head" style="${imgBg(c.image_url, c.color1, c.color2)};border-radius:0"><div class="wrap"><span class="p-cat">Concours · ${esc(c.org_name || '')}</span><span class="p-name">${esc(c.name)}</span><div class="row" style="margin-top:10px">${badge(st)}<span class="sm" style="color:#fff">${num(tot)} votes · ${R.length} candidats · ${+c.price === 0 ? 'vote gratuit' : money(c.price, c.currency) + ' par vote'} · clôture ${dFmt(c.ends_at)} à ${hFmt(c.ends_at)}</span></div></div></div>
  <div class="wrap sec stack"><div class="row between"><div class="row"><button class="btn s ghost" data-a="shareLink" data-url="${esc(voteUrl(c.id))}" data-title="${esc(c.name)}">Partager le concours</button><button class="btn s ghost" data-a="votePrint" data-id="${c.id}">Imprimer le classement</button></div><input class="in" style="max-width:300px;margin:0" data-i="vq" value="${esc(UI.vq || '')}" placeholder="Rechercher un candidat"></div>
  ${tot && !f ? `<div class="podium">${[1, 0, 2].map(i => pod[i] ? `<a class="pod pod-${i + 1}" href="#/candidat/${c.id}/${pod[i].candidate_id}">${avatar(pod[i], 'pod-av')}<b>${esc(pod[i].name)}</b><span class="sm">${num(pod[i].votes)} votes · ${pod[i].pct.toFixed(1)} %</span><div class="pod-step">${i + 1}</div></a>` : '').join('')}</div>` : ''}
  ${c.description ? `<details class="card pad"><summary style="cursor:pointer;font-weight:700">À propos du concours</summary>${paras(c.description)}</details>` : ''}
  <h2 style="margin:6px 0 0">Classement général</h2><div class="stack">${R.map(x => !f || norm(x.name).includes(f) ? `<div class="cand cand2"><div class="rank ${x.rank === 1 ? 'r1' : ''}">${x.rank}</div><a href="#/candidat/${c.id}/${x.candidate_id}">${avatar(x)}</a><div style="flex:1;min-width:150px"><a href="#/candidat/${c.id}/${x.candidate_id}" style="color:inherit"><b>${esc(x.name)}</b></a><div class="xs mut">${esc(x.city || '')}${x.number ? ' · N° ' + x.number : ''}</div><div class="bar" style="margin-top:6px"><i style="width:${R[0].votes ? (x.votes / R[0].votes * 100).toFixed(1) : 0}%"></i></div><div class="xs mut">${num(x.votes)} votes · ${x.pct.toFixed(1)} %</div></div>${voteBox(V, x)}<button class="btn s ghost" data-a="shareLink" data-url="${esc(voteUrl(c.id, x.candidate_id))}" data-title="${esc(x.name + ' — ' + c.name)}" title="Partager">↗</button></div>` : '').join('')}</div></div>`;
};
VIEWS.candidat = async p => {
  const V = await voteData(p[1]); if (!V) return vNotFound(); const x = V.R.find(r => r.candidate_id === p[2]); if (!x) return VIEWS.vote(['vote', p[1]]);
  return `<div class="wrap sec"><p class="sm"><a href="#/vote/${V.c.id}">← ${esc(V.c.name)}</a></p><div class="cols"><div class="card pad stack cand-page"><div class="row" style="gap:18px">${avatar(x, 'cand-photo')}<div>${V.tot ? `<span class="badge b-orange">${x.rank === 1 ? '🏆 ' : ''}${x.rank}${x.rank === 1 ? 'er' : 'e'} sur ${V.R.length}</span>` : '<span class="badge b-gray">Aucun vote pour le moment</span>'}<h1 style="font-size:2rem;margin:8px 0 2px">${esc(x.name)}</h1><div class="mut">${esc(x.city || '')}${x.number ? ' · Candidat n° ' + x.number : ''}</div><div style="margin-top:8px"><b style="font-size:1.6rem;color:var(--o-d)">${num(x.votes)}</b> votes · ${x.pct.toFixed(1)} % des votes</div></div></div>${x.bio ? `<div>${paras(x.bio)}</div>` : ''}<div class="row"><button class="btn s ghost" data-a="shareLink" data-url="${esc(voteUrl(V.c.id, x.candidate_id))}" data-title="${esc(x.name + ' — ' + V.c.name)}">Partager ce candidat</button><a class="btn s ghost" href="#/vote/${V.c.id}">Voir le classement</a></div></div>
  <aside class="card pad stack sticky"><h3 style="margin:0">Voter pour ${esc(x.name)}</h3><p class="sm mut" style="margin:0">${+V.c.price === 0 ? 'Vote gratuit, un vote à la fois.' : money(V.c.price, V.c.currency) + ' par vote. Choisissez le nombre de votes que vous voulez (jusqu\'à ' + num(V.max) + ' par paiement).'}</p>${voteBox(V, x)}<p class="xs mut" style="margin:0">Paiement sécurisé par LengoPay (Orange Money, MTN MoMo, carte). Vos votes sont comptés dès la confirmation du paiement.</p></aside></div></div>`;
};
function rankingSheet(V) { return `<div class="print-head"><h2 style="margin:0">${esc(V.c.name)}</h2><p class="sm">Classement général au ${dtFmt(Date.now())} · ${num(V.tot)} votes · ${esc(V.c.org_name || '')}</p></div><table><tr><th>Rang</th><th>Candidat</th><th>Ville</th><th class="n">Votes</th><th class="n">Part</th></tr>${V.R.map(x => `<tr><td><b>${x.rank}</b></td><td>${esc(x.name)}</td><td>${esc(x.city || '')}</td><td class="n">${num(x.votes)}</td><td class="n">${x.pct.toFixed(1)} %</td></tr>`).join('')}</table>`; }

// Organisateur : ajout de candidats avec photo, export détaillé et impression.
const _orgVotes8 = ORG_R.votes;
ORG_R.votes = async () => {
  const h = await _orgVotes8(), X = await extras(); if (!X.campaigns.length) return h;
  return h + `<div class="wrap" style="padding-bottom:34px"><div class="card pad stack"><h2 style="margin:0">Candidats, résultats et impression</h2>${X.campaigns.map(k => `<div class="stack" style="border-top:1px solid var(--line);padding-top:12px"><div class="row between"><b>${esc(k.name)}</b><div class="row"><button class="btn s ghost" data-a="voteCsv" data-id="${k.id}" data-name="${esc(k.name)}">Télécharger chaque vote (Excel/CSV)</button><button class="btn s ghost" data-a="votePrint" data-id="${k.id}">Imprimer le classement général</button><button class="btn s ghost" data-a="shareLink" data-url="${esc(voteUrl(k.id))}" data-title="${esc(k.name)}">Lien de partage</button></div></div>
  <form class="tier-edit" data-f="candAdd" data-id="${k.id}"><b>Ajouter un candidat</b><div class="g3"><label class="f">Nom<input name="name" required minlength="2"></label><label class="f">Ville<input name="city"></label><label class="f">Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label></div><label class="f">Présentation<textarea name="bio" rows="2" maxlength="1500"></textarea></label><div><button class="btn s">Ajouter le candidat</button></div></form></div>`).join('')}</div></div>`;
};

/* =====================================================================
   3. POINTS DE VENTE ET COMPTES VENDEURS
   ===================================================================== */
const _orgSell8 = ORG_R.vendeurs;
ORG_R.vendeurs = async () => {
  const h = await _orgSell8(); let P = null; try { P = await rpc2('org_pos'); } catch (e) { return h; }
  const D = await rpc('org_dashboard'), evs = D.events.filter(e => !e.cancelled && ts(e.ends_at) > Date.now()), cur = P.pos.find(x => x.id === UI.posEdit) || {};
  const evChecks = (sel, name) => evs.length ? evs.map(e => `<label class="row sm"><input type="checkbox" name="${name}" value="${e.id}" ${sel.includes(e.id) ? 'checked' : ''}> ${esc(e.name)} <span class="mut">· ${dFmt(e.starts_at)}</span></label>`).join('') : '<p class="sm mut">Aucun événement à venir.</p>';
  const posOpt = sel => `<option value="">— Aucun —</option>${P.pos.filter(x => x.active).map(x => `<option value="${x.id}" ${sel === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}`;
  return h + `<div class="wrap" style="padding-bottom:34px"><div class="stack">
  <div class="cols"><div class="card pad"><div class="row between"><h2 style="margin:0">Points de vente</h2><button class="btn s" data-a="posEdit" data-id="">+ Nouveau</button></div>${P.pos.length ? `<div class="tw" style="margin-top:10px"><table><tr><th>Point de vente</th><th class="n">Vendeurs</th><th class="n">Billets</th><th class="n">Ventes</th><th></th></tr>${P.pos.map(x => `<tr><td><b>${esc(x.name)}</b> ${x.active ? '' : badge(['Fermé', 'gray'])}<div class="xs mut">${esc([x.address, x.city, x.phone].filter(Boolean).join(' · '))}</div></td><td class="n">${x.sellers}</td><td class="n">${num(x.sold)}</td><td class="n">${money(x.amount)}</td><td class="r"><button class="btn s ghost" data-a="posEdit" data-id="${x.id}">Modifier</button></td></tr>`).join('')}</table></div>` : '<p class="sm mut">Créez vos points de vente (guichets, boutiques partenaires…).</p>'}</div>
  <form class="card pad stack" data-f="pos" data-id="${cur.id || ''}"><h2 style="margin:0">${cur.id ? 'Modifier le point de vente' : 'Nouveau point de vente'}</h2><label class="f">Nom<input name="name" required minlength="2" value="${esc(cur.name || '')}" placeholder="Ex. Guichet Kaloum"></label><div class="g2"><label class="f">Adresse<input name="address" value="${esc(cur.address || '')}"></label><label class="f">Ville<input name="city" value="${esc(cur.city || 'Conakry')}"></label></div><label class="f">Téléphone<input name="phone" value="${esc(cur.phone || '')}"></label>${cur.id ? `<label class="row sm"><input type="checkbox" name="active" ${cur.active ? 'checked' : ''}> Ouvert</label>` : ''}<div><button class="btn">Enregistrer</button></div></form></div>
  <form class="card pad stack" data-f="sellerCreate"><h2 style="margin:0">Créer un compte vendeur</h2><p class="sm mut" style="margin:0">Vous choisissez l'identifiant (e-mail) et le mot de passe, puis vous les remettez au vendeur. Ce compte sert uniquement à vendre les billets des événements cochés : il ne peut rien acheter.</p><div class="g2"><label class="f">Nom du vendeur<input name="name" required minlength="2"></label><label class="f">Téléphone<input name="phone" inputmode="tel"></label><label class="f">E-mail (identifiant de connexion)<input name="email" type="email" required autocomplete="off"></label><label class="f">Mot de passe (8 caractères minimum)<input name="password" type="text" required minlength="8" autocomplete="new-password"></label><label class="f">Point de vente<select name="pos_id">${posOpt('')}</select></label></div><div class="sm" style="font-weight:650">Événements qu'il peut vendre</div><div class="feat-list">${evChecks([], 'events')}</div><div><button class="btn">Créer le compte vendeur</button></div></form>
  ${P.sellers.length ? `<div class="card pad stack"><h2 style="margin:0">Vendeurs : point de vente et événements autorisés</h2>${P.sellers.map(s => `<form class="tier-edit" data-f="sellerEvents" data-id="${s.id}"><div class="row between"><b>${esc(s.name || s.email)}</b><span class="xs mut">${esc(s.email)}</span></div><label class="f">Point de vente<select name="pos_id">${posOpt(s.pos_id)}</select></label><div class="feat-list">${evChecks(s.events, 'events')}</div><div><button class="btn s">Enregistrer</button></div></form>`).join('')}</div>` : ''}</div></div>`;
};

/* =====================================================================
   4. PROFIL ORGANISATEUR : LOGO, AFFICHE, CATÉGORIES
   ===================================================================== */
const _profil8 = ORG_R.profil;
ORG_R.profil = async () => {
  const h = await _profil8(), D = await loadData(), cats = ME.org_categories || [];
  const extra = `<label class="f">Affiche / photo de couverture${ME.org_cover ? ' (choisir un fichier pour la remplacer)' : ''}<input name="cover" type="file" accept="image/jpeg,image/png,image/webp"></label>${safeUrl(ME.org_cover) ? `<img src="${esc(ME.org_cover)}" alt="" style="max-height:140px;border-radius:12px;object-fit:cover">` : ''}<div class="sm" style="font-weight:650">Catégories de vos activités (8 maximum)</div><div class="chips">${D.cats.filter(c => c.active).map(c => `<label class="chip ${cats.includes(c.name) ? 'on' : ''}"><input type="checkbox" name="cats" value="${esc(c.name)}" ${cats.includes(c.name) ? 'checked' : ''} style="display:none" onchange="this.parentNode.classList.toggle('on',this.checked)"> ${esc(c.name)}</label>`).join('')}</div>`;
  return h.replace('<div><button class="btn">Enregistrer le profil</button></div>', extra + '<div><button class="btn">Enregistrer le profil</button></div>');
};
F.orgProfile = async f => {
  const [logo, cover] = await Promise.all([uploadImage(f.get('logo')), uploadImage(f.get('cover'))]), socials = Object.fromEntries(Object.keys(SOCIAL_L).map(k => [k, f.get('s_' + k)]));
  await rpc2('update_org_profile', { p: { org_name: f.get('org_name'), org_website: f.get('org_website'), org_public_email: f.get('org_public_email'), org_public_phone: f.get('org_public_phone'), org_about: f.get('org_about'), org_socials: socials, org_logo: logo, org_cover: cover, org_categories: f.getAll('cats').slice(0, 8) } });
  await loadMe(); DATA = null; toast('Profil enregistré.'); await render();
};
const _orgPub8 = VIEWS.organisateur;
VIEWS.organisateur = async p => {
  let h = await _orgPub8(p); let O = null; try { O = await rpc2('organizer_public', { p_id: p[1] }); } catch (e) { return h; } if (!O) return h;
  if (safeUrl(O.cover)) h = h.replace('<div class="wrap sec stack">', `<div class="org-cover" style="background-image:url('${esc(O.cover)}')"></div><div class="wrap sec stack" style="margin-top:-60px;position:relative">`);
  if ((O.categories || []).length) h = h.replace('<h2>Événements à venir</h2>', `<div class="chips">${O.categories.map(c => `<span class="badge b-orange">${esc(c)}</span>`).join(' ')}</div><h2>Événements à venir</h2>`);
  return h;
};
const _org8 = VIEWS.org;
VIEWS.org = async p => {
  let h = await _org8(p);
  if (p[1] !== 'nouveau' && ME && role() === 'organisateur' && (!ME.org_logo || !ME.org_about || !(ME.org_categories || []).length)) {
    h = h.replace('<div class="wrap sec', `<div class="wrap" style="padding-top:14px"><div class="note row between"><span><b>Complétez votre profil d'organisateur</b> : ${[!ME.org_logo && 'logo', !ME.org_about && 'présentation', !(ME.org_categories || []).length && 'catégories'].filter(Boolean).join(', ')}. Il apparaît sur votre page publique et sur vos événements.</span><a class="btn s" href="#/org/profil">Compléter</a></div></div><div class="wrap sec`);
  }
  return h;
};

/* =====================================================================
   5. PAIEMENT DIRECT : RÉSERVER → PAGE LENGOPAY → CONFIRMATION ORANGE MONEY / MAXIT / MTN
   ===================================================================== */
async function payNow(kind, id) {
  if (!CFG.lengopay) return false;
  modal(`<div style="text-align:center;padding:20px 6px"><div class="spinner"></div><h2 style="margin:14px 0 6px">Redirection vers LengoPay…</h2><p class="sm mut" style="margin:0">Vous allez confirmer le paiement avec Orange Money, MaxIt, MTN MoMo ou votre carte. Vos places sont bloquées 30 minutes.</p></div>`);
  try {
    const r = await fn('lengopay-pay', kind === 'cart' ? { action: 'create', cart_id: id } : { action: 'create', order_id: id });
    if (!/^https:\/\//.test(r.payment_url || '')) throw new Error('Lien de paiement invalide.');
    location.href = r.payment_url; return true;
  } catch (e) { closeModal(); toast(e.message + ' — réessayez depuis la page de la commande.'); return false; }
}
F.reserve = async (f, form) => {
  const date = form.dataset.date, sel = UI.sel[date] || {}, d = DATA.events.flatMap(e => e.dates).find(x => x.id === date);
  const items = Object.entries(sel).filter(([, n]) => n > 0).map(([tier_id, qty]) => ({ tier_id, qty }));
  const seated = (d ? d.tiers : []).filter(t => t.seating && sel[t.id] > 0);
  for (const t of seated) if ((UI.seats[t.id] || []).length !== sel[t.id]) throw new Error('Choisissez vos places pour la catégorie ' + t.name + '.');
  const args = { p_date: date, p_items: items, p_name: f.get('name'), p_phone: f.get('phone'), p_email: f.get('email') };
  const id = seated.length ? await rpc('reserve_seats', { ...args, p_seats: seated.map(t => ({ tier_id: t.id, seats: UI.seats[t.id] })) }) : await rpc('reserve', args);
  rememberOrder(id); UI.sel[date] = {}; seated.forEach(t => delete UI.seats[t.id]); DATA = null;
  const o = await rpc('get_order', { p_id: id }).catch(() => null);
  if (o && +o.total > 0 && await payNow('order', id)) return;
  location.hash = '#/commande/' + id;
};
const _cart8 = F.cartCheckout;
F.cartCheckout = async (f, form) => {
  await _cart8(f, form);
  const m = (location.hash || '').match(/^#\/(panier|commande)\/([0-9a-f-]{36})$/);
  if (m) await payNow(m[1] === 'panier' ? 'cart' : 'order', m[2]);
};

/* =====================================================================
   6. ACTIONS
   ===================================================================== */
Object.assign(A, {
  async shareLink(el) { const url = el.dataset.url; try { if (navigator.share) await navigator.share({ title: el.dataset.title, url }); else { await navigator.clipboard.writeText(url); toast('Lien copié : vous pouvez le coller dans WhatsApp, Facebook…'); } } catch (e) { /* partage annulé */ } },
  vqty(el) { const i = $('#vn-' + el.dataset.id), t = $('#vt-' + el.dataset.id); if (i) { i.value = el.dataset.v; if (t) t.textContent = 'Total : ' + money(+el.dataset.v * +i.dataset.price, i.dataset.cur); } },
  async votePrint(el) { const V = await voteData(el.dataset.id); if (!V) return; modal(`<div class="noprint row between" style="margin-bottom:12px"><b>Classement général</b><div class="row"><button class="btn s" data-a="print">Imprimer / PDF</button><button class="btn s ghost" data-a="close">Fermer</button></div></div>${rankingSheet(V)}`); },
  async voteCsv(el) { const L = await rpc2('vote_export', { p_campaign: el.dataset.id }); download('votes-' + (el.dataset.name || 'concours').replace(/[^\w-]+/g, '-').slice(0, 40) + '.csv', [['Date', 'Candidat', 'Votes', 'Montant', 'Devise', 'Votant', 'Téléphone', 'Référence'], ...L.map(v => [dtFmt(v.at), v.candidate, v.qty, v.amount, v.currency, v.voter, v.phone || '', v.ref || ''])]); toast(L.length + ' paiement(s) de votes exporté(s).'); },
  posEdit(el) { UI.posEdit = el.dataset.id; render(); },
});
A.vote3 = el => {
  const price = +el.dataset.price, i = $('#vn-' + el.dataset.cand), qty = i ? Math.floor(+i.value) : 1, max = i ? +i.max : 1;
  if (!(qty >= 1) || (i && qty > max)) return toast(`Indiquez un nombre de votes entre 1 et ${num(max)}.`);
  const total = qty * price;
  payerModal(`${num(qty)} vote${qty > 1 ? 's' : ''} pour ${el.dataset.name}`, price ? `Montant : <b style="color:var(--o-d)">${money(total, el.dataset.cur)}</b>` : 'Vote gratuit', false, async b => {
    const id = await rpc2('buy_votes', { p_candidate: el.dataset.cand, p_qty: qty, p_name: b.name, p_phone: b.phone, p_email: b.email, p_anonymous: b.anon });
    if (total > 0) await startPay(id); else { toast('Merci ! Votre vote est enregistré.'); await render(); }
  });
};
Object.assign(I, {
  vqtyIn(v) { const el = document.activeElement && document.activeElement.id && document.activeElement.id.startsWith('vn-') ? document.activeElement : null; const id = el ? el.id.slice(3) : null, t = id && $('#vt-' + id); if (t && el) t.textContent = 'Total : ' + money(Math.max(0, Math.floor(+v || 0)) * +el.dataset.price, el.dataset.cur); },
});
Object.assign(F, {
  async candAdd(f, form) { const photo = await uploadImage(f.get('photo')); await rpc2('add_candidate', { p_campaign: form.dataset.id, p: { name: f.get('name'), city: f.get('city'), bio: f.get('bio'), photo_url: photo } }); XC = null; toast('Candidat ajouté.'); await render(); },
  async pos(f, form) { await rpc2('save_pos', { p: { id: form.dataset.id || null, name: f.get('name'), address: f.get('address'), city: f.get('city'), phone: f.get('phone'), active: form.dataset.id ? !!f.get('active') : true } }); UI.posEdit = null; toast('Point de vente enregistré.'); await render(); },
  async sellerCreate(f, form) { await fn('org-create-seller', { name: f.get('name'), email: f.get('email'), password: f.get('password'), phone: f.get('phone'), pos_id: f.get('pos_id') || null, events: f.getAll('events') }); form.reset(); XC = null; modal(`<h2>Compte vendeur créé</h2><p>Remettez ces informations au vendeur :</p><div class="note">Adresse : <b>${esc(location.origin)}</b><br>Identifiant : <b>${esc(f.get('email'))}</b><br>Mot de passe : <b>${esc(f.get('password'))}</b></div><p class="xs mut">Le vendeur se connecte avec « Connexion » et arrive directement sur la vente au guichet. Il peut changer son mot de passe dans « Mon compte ».</p><button class="btn" data-a="close">Compris</button>`); await render(); },
  async sellerEvents(f, form) { await rpc2('set_seller_events', { p_seller: form.dataset.id, p_events: f.getAll('events'), p_pos: f.get('pos_id') || null }); XC = null; toast('Vendeur mis à jour.'); await render(); },
});

/* ---------- un vendeur arrive directement sur la vente ---------- */
const _render8 = render;
render = async function () { if (role() === 'vendeur' && /^(#\/?)?$/.test(location.hash || '')) { location.hash = '#/vente'; return; } await _render8(); };

Object.assign(EN, { 'Partager le concours': 'Share the contest', 'Imprimer le classement': 'Print the ranking', 'Classement général': 'Overall ranking', 'Voter gratuitement': 'Vote for free', 'Partager ce candidat': 'Share this candidate', 'Voir le classement': 'See the ranking', 'Points de vente': 'Points of sale', 'Créer un compte vendeur': 'Create a seller account', 'Redirection vers LengoPay…': 'Redirecting to LengoPay…' });

boot();
