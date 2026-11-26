'use strict';
/* FatiBillets — concours : page publique et profil candidat refaits (mobile d'abord), vote anonyme clair,
   page organisateur « Mes candidats » par concours ; FATI-TRANSPORT : billets du voyageur dans « Mes billets »,
   solde et demandes de paiement du transporteur.
   Chargé après modules12.js ; nécessite la base v15. */

/* =====================================================================
   1. VOTE ANONYME : LE NOM DISPARAÎT VRAIMENT
   ===================================================================== */
payerModal = function (title, sub, withMessage, cb) {
  payerModal.cb = cb;
  modal(`<h2>${esc(title)}</h2><p class="mut">${sub}</p><form data-f="payer" class="stack">
  <label class="row sm anon-ck"><input type="checkbox" name="anon" onchange="anonSwitch(this)"> <span><b>Rester anonyme</b><br><span class="xs mut">Mon nom${withMessage ? ' et mon message' : ''} ne seront affichés nulle part publiquement.</span></span></label>
  <label class="f anon-hide">Nom complet<input name="name" required minlength="3" autocomplete="name" value="${esc(ME?.full_name || '')}"></label>
  <div class="note sm anon-note" hidden>${ic('shield')} Vous restez anonyme : votre nom n'est pas demandé. Le téléphone sert uniquement au paiement et n'est jamais affiché.</div>
  <label class="f">Téléphone (pour le paiement)<input name="phone" required pattern="[+0-9 ]{8,}" inputmode="tel" autocomplete="tel" value="${esc(ME?.phone || '')}"></label>
  <label class="f anon-hide">E-mail <span class="xs mut">(facultatif, pour recevoir le reçu)</span><input name="email" type="email" autocomplete="email" value="${esc(ME?.email || '')}"></label>
  ${withMessage ? '<label class="f">Message (facultatif)<textarea name="message" rows="2" maxlength="500"></textarea></label>' : ''}
  <div class="row"><button class="btn" style="flex:1">Continuer vers le paiement</button><button type="button" class="btn ghost" data-a="close">Annuler</button></div></form>`);
};
window.anonSwitch = c => {
  const f = c.form, n = f.elements.name, e = f.elements.email, on = c.checked;
  f.querySelectorAll('.anon-hide').forEach(l => { l.hidden = on; });
  f.querySelector('.anon-note').hidden = !on;
  if (on) { n.dataset.v = n.value; n.value = 'Anonyme'; e.dataset.v = e.value; e.value = ''; } else { n.value = n.dataset.v || ''; e.value = e.dataset.v || ''; }
};

/* =====================================================================
   2. PAGE PUBLIQUE D'UN CONCOURS
   ===================================================================== */
const ordinal = n => n + (n === 1 ? 'er' : 'e');
function candCard(V, x) {
  const url = `#/candidat/${V.c.id}/${x.candidate_id}`, info = [x.city, x.profession, x.age ? x.age + ' ans' : ''].filter(Boolean).join(' · ');
  return `<a class="cc" href="${url}"><div class="cc-ph">${safeUrl(x.photo_url) ? `<img src="${esc(x.photo_url)}" alt="${esc(x.name)}" loading="lazy">` : `<span>${esc(initials(x.name))}</span>`}${V.tot ? `<span class="cc-rank ${x.rank <= 3 ? 'top' : ''}">${ordinal(x.rank)}</span>` : ''}${x.number ? `<span class="cc-num">N° ${x.number}</span>` : ''}</div>
  <div class="cc-b"><b class="cc-name">${esc(x.name)}</b>${info ? `<span class="xs mut">${esc(info)}</span>` : ''}<div class="bar"><i style="width:${V.R[0] && V.R[0].votes ? (x.votes / V.R[0].votes * 100).toFixed(1) : 0}%"></i></div><span class="sm"><b>${num(x.votes)}</b> votes · ${x.pct.toFixed(1)} %</span><span class="btn s cc-btn">${V.st[0] === 'Ouvert' ? 'Voir et voter' : 'Voir le profil'}</span></div></a>`;
}
VIEWS.vote = async p => {
  const V = await voteData(p[1]); if (!V) return vNotFound();
  const { c, R, tot, st } = V, f = norm(UI.vq || ''), sort = UI.vSort || 'rank', view = UI.vView || 'grid';
  let L = R.filter(x => !f || norm(x.name).includes(f) || String(x.number || '') === f);
  if (sort === 'num') L = [...L].sort((a, b) => (a.number || 9999) - (b.number || 9999)); else if (sort === 'name') L = [...L].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const pod = R.slice(0, 3), ends = ts(c.ends_at) - Date.now(), left = ends > 0 ? (ends > DAY ? Math.ceil(ends / DAY) + ' j' : Math.ceil(ends / 36e5) + ' h') : '';
  return `${safeUrl(c.banner_url) ? `<div class="vote-banner" style="background-image:url('${esc(c.banner_url)}')"></div>` : `<div class="poster big vote-head" style="${imgBg(c.image_url, c.color1, c.color2)};border-radius:0;min-height:150px"></div>`}
  <div class="wrap"><div class="vh card">${safeUrl(c.logo_url) ? `<img class="vh-logo" src="${esc(c.logo_url)}" alt="">` : ''}<div class="vh-t"><span class="xs mut">Concours · ${esc(c.org_name || '')}</span><h1>${esc(c.name)}</h1>${c.short_desc ? `<p class="sm mut" style="margin:0">${esc(c.short_desc)}</p>` : ''}</div>
  <div class="vh-stats"><span>${badge(st)}</span><span><b>${num(tot)}</b><small>votes</small></span><span><b>${R.length}</b><small>candidats</small></span><span><b>${+c.price ? money(c.price, c.currency) : 'Gratuit'}</b><small>${+c.price ? 'par vote' : 'vote'}</small></span>${left ? `<span><b>${left}</b><small>restant</small></span>` : ''}</div></div></div>
  <div class="wrap sec stack" style="padding-top:14px">
  ${ts(c.starts_at) > Date.now() ? `<div class="note">Le vote ouvre le <b>${dFmt(c.starts_at)} à ${hFmt(c.starts_at)}</b>. Découvrez les candidats dès maintenant.</div>` : ''}
  ${tot && !f ? `<div class="podium">${[1, 0, 2].map(i => pod[i] ? `<a class="pod pod-${i + 1}" href="#/candidat/${c.id}/${pod[i].candidate_id}">${avatar(pod[i], 'pod-av')}<b>${esc(pod[i].name)}</b><span class="sm">${num(pod[i].votes)} votes · ${pod[i].pct.toFixed(1)} %</span><div class="pod-step">${i + 1}</div></a>` : '').join('')}</div>` : ''}
  <div class="v-tools"><input class="in" data-i="vq" value="${esc(UI.vq || '')}" placeholder="Rechercher un candidat (nom ou numéro)"><select class="in" data-i="vSort"><option value="rank" ${sort === 'rank' ? 'selected' : ''}>Classement</option><option value="num" ${sort === 'num' ? 'selected' : ''}>Numéro</option><option value="name" ${sort === 'name' ? 'selected' : ''}>Nom</option></select>
    <div class="seg"><button class="${view === 'grid' ? 'on' : ''}" data-a="vView" data-v="grid">Cartes</button><button class="${view === 'list' ? 'on' : ''}" data-a="vView" data-v="list">Classement</button></div>
    <button class="btn s ghost" data-a="shareLink" data-url="${esc(voteUrl(c.id))}" data-title="${esc(c.name)}">Partager</button><button class="btn s ghost" data-a="votePrint" data-id="${c.id}">Imprimer</button></div>
  ${!L.length ? '<div class="empty">Aucun candidat ne correspond à la recherche.</div>' : view === 'grid' ? `<div class="cc-grid">${L.map(x => candCard(V, x)).join('')}</div>`
    : `<div class="card"><div class="rk">${L.map(x => `<a class="rk-row" href="#/candidat/${c.id}/${x.candidate_id}"><span class="rank ${x.rank === 1 ? 'r1' : ''}">${x.rank}</span>${avatar(x)}<span class="rk-n"><b>${esc(x.name)}</b><span class="xs mut">${x.number ? 'N° ' + x.number + ' · ' : ''}${esc(x.city || '')}</span><span class="bar"><i style="width:${R[0].votes ? (x.votes / R[0].votes * 100).toFixed(1) : 0}%"></i></span></span><span class="rk-v"><b>${num(x.votes)}</b><span class="xs mut">${x.pct.toFixed(1)} %</span></span></a>`).join('')}</div></div>`}
  ${c.description ? `<details class="card pad"><summary style="cursor:pointer;font-weight:700">À propos du concours et règlement</summary>${paras(c.description)}</details>` : ''}
  <p class="xs mut" style="margin:0">Classement mis à jour à chaque vote confirmé. ${+c.price ? 'Paiement sécurisé par LengoPay (Orange Money, MTN MoMo, carte).' : ''} Clôture le ${dFmt(c.ends_at)} à ${hFmt(c.ends_at)}.</p></div>`;
};
VIEWS.candidat = async p => {
  const V = await voteData(p[1]); if (!V) return vNotFound(); const i = V.R.findIndex(r => r.candidate_id === p[2]); if (i < 0) return VIEWS.vote(['vote', p[1]]);
  const x = V.R[i], byNum = [...V.R].sort((a, b) => (a.number || 9999) - (b.number || 9999)), k = byNum.indexOf(x), prev = byNum[k - 1], next = byNum[k + 1];
  const ahead = i > 0 ? V.R[i - 1] : null, gap = ahead ? ahead.votes - x.votes : 0;
  const facts = [['Numéro', x.number ? 'N° ' + x.number : ''], ['Ville', x.city], ['Profession', x.profession], ['Âge', x.age ? x.age + ' ans' : '']].filter(f => f[1]);
  return `<div class="wrap sec"><p class="sm"><a href="#/vote/${V.c.id}">← ${esc(V.c.name)}</a></p><div class="cp">
  <div class="cp-photo">${safeUrl(x.photo_url) ? `<img src="${esc(x.photo_url)}" alt="${esc(x.name)}">` : `<span>${esc(initials(x.name))}</span>`}${V.tot ? `<span class="cc-rank ${x.rank <= 3 ? 'top' : ''}">${ordinal(x.rank)} / ${V.R.length}</span>` : ''}</div>
  <div class="cp-main stack"><div><h1 style="margin:0;font-size:clamp(1.6rem,5vw,2.3rem)">${esc(x.name)}</h1><span class="mut">${esc(V.c.name)}</span></div>
    ${facts.length ? `<div class="cp-facts">${facts.map(([l, v]) => `<div><small>${l}</small><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
    <div class="cp-score"><div><b>${num(x.votes)}</b><small>votes</small></div><div><b>${x.pct.toFixed(1)} %</b><small>des votes</small></div><div><b>${V.tot ? ordinal(x.rank) : '—'}</b><small>au classement</small></div></div>
    ${ahead && gap > 0 ? `<p class="sm" style="margin:0">À <b>${num(gap)} vote${gap > 1 ? 's' : ''}</b> de ${esc(ahead.name)} (${ordinal(ahead.rank)}).</p>` : x.rank === 1 && V.tot ? `<p class="sm" style="margin:0;color:var(--o-d);font-weight:700">En tête du classement.</p>` : ''}
    <div class="card pad stack cp-vote" id="voter"><h3 style="margin:0">Voter pour ${esc(x.name)}</h3><p class="sm mut" style="margin:0">${+V.c.price === 0 ? 'Vote gratuit.' : money(V.c.price, V.c.currency) + ' par vote — jusqu\'à ' + num(V.max) + ' votes par paiement.'} Vous pouvez voter de façon anonyme.</p>${voteBox(V, x)}</div>
    ${x.bio ? `<div class="card pad"><h3 style="margin-top:0">Présentation</h3>${paras(x.bio)}</div>` : ''}
    <div class="row" style="gap:8px">${safeUrl(x.social) ? `<a class="btn s ghost" href="${esc(x.social)}" target="_blank" rel="noopener noreferrer">Réseau social ↗</a>` : ''}<button class="btn s ghost" data-a="shareLink" data-url="${esc(voteUrl(V.c.id, x.candidate_id))}" data-title="${esc(x.name + ' — ' + V.c.name)}">Partager ce candidat</button></div>
    <div class="row between cp-nav">${prev ? `<a class="btn s ghost" href="#/candidat/${V.c.id}/${prev.candidate_id}">← ${esc(prev.name)}</a>` : '<span></span>'}${next ? `<a class="btn s ghost" href="#/candidat/${V.c.id}/${next.candidate_id}">${esc(next.name)} →</a>` : ''}</div></div></div></div>
  ${V.st[0] === 'Ouvert' ? `<div class="cp-sticky"><b>${esc(x.name)}</b><a class="btn s" href="#voter" onclick="document.getElementById('voter').scrollIntoView({behavior:'smooth'});return false">Voter</a></div>` : ''}`;
};
Object.assign(A, { vView(el) { UI.vView = el.dataset.v; render(); } });
I.vSort = v => { UI.vSort = v; render(); };

/* =====================================================================
   3. ORGANISATEUR : PAGE « MES CANDIDATS » D'UN CONCOURS
   ===================================================================== */
ORG_TABS.splice(ORG_TABS.findIndex(t => t[0] === 'votes') + 1, 0, ['candidats', 'Mes candidats']);
ORG_R.candidats = async () => {
  const id = (location.hash.match(/candidats\/([0-9a-f-]{36})/) || [])[1];
  const C = await q(sb.from('vote_campaigns').select('*').eq('organizer_id', ME.id).order('created_at', { ascending: false }));
  if (!id) return `<div class="wrap sec stack" style="padding-top:22px"><h2 style="margin:0">Mes candidats</h2><p class="sm mut" style="margin:0">Choisissez un concours.</p>${C.length ? `<div class="ev-list">${C.map(c => `<a class="card ev-item" href="#/org/candidats/${c.id}" style="color:inherit">${safeUrl(c.image_url) ? `<img src="${esc(c.image_url)}" alt="" class="thumb">` : `<div class="thumb ph">${ic('vote')}</div>`}<div class="ev-main"><h3 style="margin:0">${esc(c.name)}</h3><span class="xs mut">Du ${dFmt(c.starts_at)} au ${dFmt(c.ends_at)}</span></div></a>`).join('')}</div>` : '<div class="empty">Aucun concours. <a href="#/org/votes">Créer un concours</a></div>'}</div>`;
  const V = await voteData(id); if (!V || V.c.organizer_id !== ME.id) return box('Concours introuvable', '<a class="btn" href="#/org/votes">Mes concours</a>');
  let amounts = {}; try { const Rp = await rpc2('vote_report', { p_campaign: id }); amounts = Object.fromEntries(Rp.results.map(r => [r.id, r])); } catch (e) { /* rapport indisponible */ }
  const { c, R, tot } = V, sel = UI.cEdit, s = UI.cSort || 'rank';
  const L = s === 'num' ? [...R].sort((a, b) => (a.number || 9999) - (b.number || 9999)) : s === 'name' ? [...R].sort((a, b) => a.name.localeCompare(b.name, 'fr')) : R;
  const ed = sel === 'new' ? {} : R.find(x => x.candidate_id === sel);
  const form = ed ? `<form class="card pad stack" data-f="candSave" data-id="${ed.candidate_id || ''}" data-camp="${c.id}"><div class="row between"><h2 style="margin:0">${ed.candidate_id ? 'Modifier ' + esc(ed.name) : 'Ajouter un candidat'}</h2>${ed.candidate_id && +ed.votes ? `<button type="button" class="btn s ghost" data-a="cancelVotes" data-cand="${ed.candidate_id}" data-name="${esc(ed.name)}" data-max="${ed.votes}">Annuler un lot de votes</button>` : ''}</div>
  <div class="cand-form"><div class="cand-form-ph">${ed.candidate_id ? avatar(ed, 'av-l') : `<div class="av-l ph">${ic('user')}</div>`}<label class="f">Photo${ed.photo_url ? ' (remplacer)' : ''}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label></div>
  <div class="stack"><div class="g4"><label class="f">N° (ordre)${ed.candidate_id ? '' : ' <span class="xs mut">vide = à la suite</span>'}<input name="number" type="number" min="1" max="9999" value="${ed.number || ''}"></label><label class="f" style="grid-column:span 2">Nom<input name="name" required minlength="2" value="${esc(ed.name || '')}"></label><label class="f">Âge<input name="age" type="number" min="1" max="120" value="${ed.age || ''}"></label></div>
  <div class="g3"><label class="f">Ville<input name="city" value="${esc(ed.city || '')}"></label><label class="f">Profession<input name="profession" value="${esc(ed.profession || '')}"></label><label class="f">Réseau social (lien)<input name="social" value="${esc(ed.social || '')}" placeholder="https://…"></label></div>
  <label class="f">Présentation<textarea name="bio" rows="3" maxlength="1500">${esc(ed.bio || '')}</textarea></label></div></div>
  <div class="row"><button class="btn">Enregistrer</button><button type="button" class="btn ghost" data-a="cEdit" data-id="">Fermer</button>${ed.candidate_id ? `<button type="button" class="btn danger" data-a="candDel" data-id="${ed.candidate_id}" data-name="${esc(ed.name)}" style="margin-left:auto">Retirer ce candidat</button>` : ''}</div></form>` : '';
  return `<div class="wrap sec stack" style="padding-top:22px"><p class="sm" style="margin:0"><a href="#/org/votes">← Mes concours</a></p>
  <div class="row between" style="align-items:flex-start"><div><h2 style="margin:0">Candidats — ${esc(c.name)}</h2><p class="sm mut" style="margin:4px 0 0">${badge(V.st)} · du ${dFmt(c.starts_at)} au ${dFmt(c.ends_at)} · ${+c.price ? money(c.price, c.currency) + ' par vote' : 'vote gratuit'}</p></div>
  <div class="row" style="gap:6px"><button class="btn" data-a="cEdit" data-id="new">+ Ajouter un candidat</button><a class="btn ghost" href="#/vote/${c.id}">Voir la page publique</a><button class="btn ghost" data-a="voteReport" data-id="${c.id}">Rapport PDF</button></div></div>
  <div class="kpis"><div class="kpi"><small>Candidats</small><b>${R.length}</b></div><div class="kpi hot"><small>Votes</small><b>${num(tot)}</b></div><div class="kpi"><small>En tête</small><b style="font-size:1rem">${tot ? esc(R[0].name) : '—'}</b></div><div class="kpi"><small>Écart 1er / 2e</small><b>${R[1] ? num(R[0].votes - R[1].votes) : '—'}</b></div></div>
  ${form}
  ${R.length ? `<div class="card pad stack"><div class="row between"><h2 style="margin:0">Classement des candidats</h2><select class="in" style="margin:0;max-width:200px" data-i="cSort"><option value="rank" ${s === 'rank' ? 'selected' : ''}>Par classement</option><option value="num" ${s === 'num' ? 'selected' : ''}>Par numéro</option><option value="name" ${s === 'name' ? 'selected' : ''}>Par nom</option></select></div>
  <div class="tw"><table class="cand-tbl"><tr><th>Rang</th><th></th><th>Candidat</th><th class="n">Votes</th><th>Part</th>${+c.price ? '<th class="n">Montant</th>' : ''}<th></th></tr>${L.map(x => `<tr class="${sel === x.candidate_id ? 'on' : ''}"><td><span class="rank ${x.rank === 1 && tot ? 'r1' : ''}">${x.rank}</span></td><td>${avatar(x)}</td><td><b>${x.number ? 'N° ' + x.number + ' — ' : ''}${esc(x.name)}</b><div class="xs mut">${esc([x.city, x.profession, x.age ? x.age + ' ans' : ''].filter(Boolean).join(' · '))}</div></td><td class="n"><b>${num(x.votes)}</b></td><td style="min-width:120px">${x.pct.toFixed(1)} %<div class="bar"><i style="width:${R[0].votes ? (x.votes / R[0].votes * 100).toFixed(1) : 0}%"></i></div></td>${+c.price ? `<td class="n">${money((amounts[x.candidate_id] || {}).amount || 0, c.currency)}</td>` : ''}
    <td class="r nowrap"><button class="btn s ghost" data-a="cEdit" data-id="${x.candidate_id}">Modifier</button> <button class="btn s ghost" data-a="shareLink" data-url="${esc(voteUrl(c.id, x.candidate_id))}" data-title="${esc(x.name)}">Lien</button></td></tr>`).join('')}</table></div></div>` : `<div class="empty"><b>Aucun candidat pour le moment.</b><br>Ajoutez vos candidats avec leur photo et leur présentation.<br><button class="btn" style="margin-top:12px" data-a="cEdit" data-id="new">+ Ajouter un candidat</button></div>`}</div>`;
};
Object.assign(A, { cEdit(el) { UI.cEdit = el.dataset.id || null; render().then(() => { const f = $('[data-f="candSave"]'); if (f && UI.cEdit) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); } });
I.cSort = v => { UI.cSort = v; render(); };
const _candSave13 = F.candSave;
F.candSave = async (f, form) => { await _candSave13(f, form); if (location.hash.includes('/candidats/')) { UI.cEdit = form.dataset.id ? null : 'new'; await render(); } };

/* =====================================================================
   4. VOYAGEUR : BILLETS DE TRANSPORT DANS « MES BILLETS »
   ===================================================================== */
const TR_KEY = 'fatibillets-transport';
const trIds = () => { try { return JSON.parse(localStorage.getItem(TR_KEY)) || []; } catch (e) { return []; } };
const trRemember = id => { try { localStorage.setItem(TR_KEY, JSON.stringify([id, ...trIds().filter(x => x !== id)].slice(0, 50))); } catch (e) { /* stockage indisponible */ } };
const _pay13 = VIEWS.paiement;
VIEWS.paiement = async p => { const h = await _pay13(p); if (h.includes('Billet de transport') && p[1]) trRemember(p[1]); return h; };
VIEWS.billets = async () => {
  const h = await vTickets(); let L = [];
  if (ME) { try { L = await rpc2('my_transport'); } catch (e) { L = []; } }
  const seen = new Set(L.map(x => x.id)), extra = (await Promise.all(trIds().filter(id => !seen.has(id)).map(id => rpc2('get_purchase', { p_id: id }).catch(() => null)))).filter(x => x && x.kind === 'transport' && x.status !== 'annule');
  const all = [...L, ...extra].sort((a, b) => ts(b.created_at) - ts(a.created_at));
  if (!all.length) return h;
  const st = s => s === 'confirme' ? ['Confirmé', 'green'] : s === 'a_rembourser' ? ['Remboursement en cours', 'red'] : ['En attente de paiement', 'orange'];
  return h + `<div class="wrap" style="padding-bottom:34px"><h2 style="margin:0 0 10px">${ic('bus')} Mes billets de transport</h2><div class="stack" style="max-width:720px">${all.map(x => `<a class="card pad" href="#/paiement/${x.id}" style="display:block;color:inherit"><div class="row between"><b>${esc((x.label || 'Transport').replace(/^Transport\s*/, '') || 'Transport')}</b>${badge(st(x.status))}</div><div class="sm mut">${x.departs_at ? 'Départ le ' + dFmt(x.departs_at) + ' à ' + hFmt(x.departs_at) + ' · ' : ''}${money(x.amount, x.currency)} · ${x.status === 'confirme' ? 'afficher mes billets (QR code) →' : 'ouvrir la réservation →'}</div></a>`).join('')}</div></div>`;
};

/* =====================================================================
   5. TRANSPORTEUR : SOLDE ET DEMANDES DE PAIEMENT
   ===================================================================== */
CAR_TABS.push(['paiements', 'Paiements']);
const _car13 = VIEWS.transporteur;
VIEWS.transporteur = async p => {
  if (p[1] !== 'paiements' || !ME || role() !== 'transporteur') return _car13(p);
  let B; try { B = await rpc2('carrier_balance'); } catch (e) { return box('Paiements indisponibles', `<p class="mut">${esc(e.message)}</p>`); }
  const pst = s => ({ en_attente: ['En attente', 'orange'], info: ['Information demandée', 'blue'], approuvee: ['Payée', 'green'], rejetee: ['Refusée', 'red'] }[s] || [s, 'gray']);
  const body = `<div class="kpis"><div class="kpi hot"><small>Disponible</small><b>${money(B.available)}</b></div><div class="kpi"><small>Ventes en ligne (LengoPay)</small><b>${money(B.online)}</b></div><div class="kpi"><small>Commission FATIGLOBAL${B.rate != null ? ' (' + (B.rate * 100).toLocaleString('fr-FR') + ' %)' : ''}</small><b>${B.commission == null ? 'non fixée' : money(B.commission)}</b></div><div class="kpi"><small>Déjà payé</small><b>${money(B.paid)}</b></div><div class="kpi"><small>Demandes en cours</small><b>${money(B.pending)}</b></div></div>
  <p class="xs mut">Les ventes au guichet (${money(B.counter)}) sont encaissées directement par vous : elles ne figurent pas dans le solde.</p>
  <div class="cols"><div class="stack">${B.rate == null ? '<div class="note">La Direction FATIGLOBAL n\'a pas encore fixé la commission transport. Les demandes de paiement ouvriront dès qu\'elle le sera.</div>' : ''}
  <form class="card pad stack" data-f="carPayout"><h2 style="margin:0">Demander un paiement</h2><label class="f">Montant (GNF)<input name="amount" type="number" min="1" max="${B.available}" step="1" required ${B.available > 0 ? '' : 'disabled'} value="${B.available || ''}"></label><label class="f">Où recevoir le paiement<textarea name="details" rows="2" required minlength="6" placeholder="Ex. Orange Money 6XX XX XX XX au nom de …, ou banque et numéro de compte"></textarea></label><button class="btn" ${B.available > 0 && B.rate != null ? '' : 'disabled'}>Envoyer la demande à la Direction</button><p class="xs mut" style="margin:0">La Direction FATIGLOBAL vérifie et effectue le paiement. Vous êtes notifié à chaque étape.</p></form>
  ${B.by_month.length ? `<div class="card pad"><h2>Ventes en ligne par mois</h2><div class="tw"><table><tr><th>Mois</th><th class="n">Places</th><th class="n">Montant</th></tr>${B.by_month.map(m => `<tr><td>${new Date(m.month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</td><td class="n">${num(m.seats)}</td><td class="n">${money(m.amount)}</td></tr>`).join('')}</table></div></div>` : ''}</div>
  <div class="card pad"><h2>Mes demandes</h2>${B.payouts.length ? B.payouts.map(x => `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="row between"><b>${esc(x.ref)} · ${money(x.amount, x.currency)}</b>${badge(pst(x.status))}</div><div class="xs mut">Demandée le ${dtFmt(x.created_at)}${x.decided_at ? ' · décidée le ' + dtFmt(x.decided_at) : ''}</div>${x.reason ? `<div class="sm">« ${esc(x.reason)} »</div>` : ''}</div>`).join('') : '<p class="sm mut">Aucune demande pour le moment.</p>'}</div></div>`;
  return head(esc(B.carrier.name), (B.carrier.kind === 'fatiglobal' ? 'Flotte FATIGLOBAL' : 'Transporteur partenaire')) + `<div class="wrap" style="padding-top:18px"><div class="tabs admin-tabs">${CAR_TABS.map(([k, l]) => `<a class="${k === 'paiements' ? 'on' : ''}" href="#/transporteur${k ? '/' + k : ''}">${l}</a>`).join('')}</div></div><div class="wrap sec" style="padding-top:8px">${body}</div>`;
};
F.carPayout = async f => { const ref = await rpc2('carrier_request_payout', { p_amount: +f.get('amount'), p_details: f.get('details') }); toast('Demande ' + ref + ' envoyée à la Direction.'); await render(); };

Object.assign(EN, { 'Rester anonyme': 'Stay anonymous', 'Voir et voter': 'View and vote', 'Voir le profil': 'View profile', 'Mes billets de transport': 'My transport tickets', 'Demander un paiement': 'Request a payout', 'Cartes': 'Cards', 'Classement': 'Ranking' });

// boot() est appelé à la fin de modules14.js, chargé après ce fichier.
