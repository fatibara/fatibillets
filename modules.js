'use strict';
/* FatiBillets — modules : votes, cagnottes, inscriptions, vente au guichet, finances, pays et devises.
   Chargé après app.js ; nécessite la base v2 (supabase/schema_v2.sql). */

const q = async p => { const r = await p; if (r.error) throw new Error(/schema cache|does not exist/i.test(r.error.message) ? 'Ce module n\'est pas encore activé : la mise à jour de la base (schema_v2.sql) doit être exécutée dans Supabase.' : r.error.message); return r.data; };
const rpc2 = (n, a) => q(sb.rpc(n, a));
const grad = x => `background:linear-gradient(135deg,${esc(x.color1)},${esc(x.color2)})`;
const cStatus = c => c.suspended ? ['Suspendu', 'red'] : Date.now() < ts(c.starts_at) ? ['À venir', 'blue'] : Date.now() > ts(c.ends_at) ? ['Clôturé', 'gray'] : ['Ouvert', 'green'];
const pStatus = (p, collected) => p.suspended ? ['Suspendue', 'red'] : Date.now() > ts(p.ends_at) ? ['Clôturée', 'gray'] : collected >= p.goal ? ['Objectif atteint', 'green'] : ['En cours', 'orange'];
const local = v => { const d = new Date(ts(v)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const endOfDay = s => new Date(s + 'T23:59:00').toISOString();

// Fenêtre « vos coordonnées » avant un paiement (vote, contribution).
function buyerModal(title, sub, cb) {
  buyerModal.cb = cb;
  modal(`<h2>${esc(title)}</h2><p class="mut">${sub}</p><form data-f="buyer" class="stack"><label class="f">Nom complet<input name="name" required minlength="3" autocomplete="name" value="${esc(ME?.full_name || '')}"></label><label class="f">Téléphone<input name="phone" required pattern="[+0-9 ]{8,}" inputmode="tel" autocomplete="tel" value="${esc(ME?.phone || '')}" placeholder="+224 6XX XX XX XX"></label><label class="f">E-mail (facultatif)<input name="email" type="email" autocomplete="email" value="${esc(ME?.email || '')}"></label><div class="row"><button class="btn" style="flex:1">Continuer vers le paiement</button><button type="button" class="btn ghost" data-a="close">Annuler</button></div></form>`);
}
async function startPay(purchaseId) {
  const r = await fn('lengopay-pay', { action: 'create', purchase_id: purchaseId });
  if (!/^https:\/\//.test(r.payment_url || '')) throw new Error('Lien de paiement invalide.');
  location.href = r.payment_url;
}

/* ---------- votes ---------- */
VIEWS.votes = async () => {
  const [C, T] = await Promise.all([q(sb.from('vote_campaigns').select('*').order('created_at', { ascending: false })), rpc2('vote_totals')]);
  const tot = Object.fromEntries(T.map(t => [t.campaign_id, t]));
  return head('Votes et concours', 'Soutenez votre candidat. Les classements sont mis à jour à chaque vote confirmé.') + `<div class="wrap sec">${C.length ? `<div class="grid">${C.map(c => `<a class="card ev" href="#/vote/${c.id}"><div class="poster" style="${grad(c)}">${badge(cStatus(c))}<span class="p-cat">Concours · ${esc(c.org_name || '')}</span><span class="p-name">${esc(c.name)}</span></div><div class="ev-b"><span class="sm mut">${tot[c.id]?.candidates || 0} candidats · ${num(tot[c.id]?.votes || 0)} votes</span><span class="sm mut">${ic('cal')} Clôture : ${dFmt(c.ends_at)}</span><span class="price">${+c.price === 0 ? 'Vote gratuit' : money(c.price, c.currency) + ' / vote'}</span></div></a>`).join('')}</div>` : '<div class="empty"><b>Aucun concours en cours.</b><br>Les campagnes de vote apparaîtront ici.</div>'}</div>`;
};
VIEWS.vote = async p => {
  const [c, R] = await Promise.all([q(sb.from('vote_campaigns').select('*').eq('id', p[1]).maybeSingle()), rpc2('vote_results', { p_campaign: p[1] })]);
  if (!c) return vNotFound();
  R.sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
  const st = cStatus(c), open = st[0] === 'Ouvert', top = Math.max(1, R[0]?.votes || 0), tot = R.reduce((a, x) => a + +x.votes, 0), f = norm(UI.vq || '');
  return head(esc(c.name), esc(c.description || '')) + `<div class="wrap sec stack"><div class="row between"><div class="row">${badge(st)}<span class="sm mut">${num(tot)} votes · ${+c.price === 0 ? 'gratuit' : money(c.price, c.currency) + ' par vote'} · clôture ${dFmt(c.ends_at)}</span></div><input class="in" style="max-width:280px;margin:0" data-i="vq" value="${esc(UI.vq || '')}" placeholder="Rechercher un candidat"></div>
  <div class="stack">${R.map((x, i) => !f || norm(x.name).includes(f) ? `<div class="cand"><div class="rank ${i === 0 ? 'r1' : ''}">${i + 1}</div><div class="av">${esc(initials(x.name))}</div><div style="flex:1;min-width:120px"><b>${esc(x.name)}</b><div class="xs mut">${esc(x.city || '')}</div><div class="bar" style="margin-top:6px"><i style="width:${(x.votes / top * 100).toFixed(1)}%"></i></div></div><div class="r"><b>${num(x.votes)}</b><div class="xs mut">votes</div></div>${open ? `<div class="row">${+c.price === 0 ? '' : `<select class="in" style="width:auto;margin:0" id="vn-${x.candidate_id}" aria-label="Nombre de votes">${[1, 5, 10, 25, 50, 100].map(n => `<option>${n}</option>`).join('')}</select>`}<button class="btn s" data-a="vote" data-cand="${x.candidate_id}" data-name="${esc(x.name)}" data-price="${c.price}" data-cur="${esc(c.currency)}">Voter</button></div>` : ''}</div>` : '').join('')}</div>
  ${open ? '' : `<div class="note">Les votes ne sont pas ouverts pour ce concours (${st[0].toLowerCase()}).</div>`}</div>`;
};

/* ---------- cagnottes ---------- */
function potCard(p, t) {
  const s = +(t?.collected || 0), st = pStatus(p, s), open = st[0] === 'En cours' || st[0] === 'Objectif atteint';
  return `<div class="card ev"><div class="poster" style="${grad(p)}">${badge(st)}<span class="p-cat">Cagnotte · ${esc(p.org_name || '')}</span><span class="p-name">${esc(p.name)}</span></div><div class="ev-b stack"><p class="sm mut" style="margin:0">${esc(p.description || '')}</p><div><div class="row between sm"><b>${money(s, p.currency)}</b><span class="mut">sur ${money(p.goal, p.currency)}</span></div><div class="bar ${s >= p.goal ? 'done' : ''}" style="margin:6px 0"><i style="width:${Math.min(100, s / p.goal * 100)}%"></i></div><div class="row between xs mut"><span>${Math.round(s / p.goal * 100)} % · ${num(t?.contributors || 0)} contributeur${(t?.contributors || 0) > 1 ? 's' : ''}</span><span>Jusqu'au ${dFmt(p.ends_at)}</span></div></div>
  ${open ? `<form class="row" data-f="contrib" data-pot="${p.id}" data-name="${esc(p.name)}" data-cur="${esc(p.currency)}"><input class="in" style="flex:1;margin:0;min-width:120px" name="amount" type="number" min="${Math.max(1, p.min_amount)}" step="1" required placeholder="Montant${+p.min_amount ? ' (min. ' + num(p.min_amount) + ')' : ''}" aria-label="Montant"><button class="btn">Contribuer</button></form>` : ''}</div></div>`;
}
VIEWS.cagnottes = async () => {
  const [P, T] = await Promise.all([q(sb.from('pots').select('*').eq('is_public', true).order('created_at', { ascending: false })), rpc2('pot_totals')]);
  const tot = Object.fromEntries(T.map(t => [t.pot_id, t]));
  return head('Cagnottes et contributions', 'Participez à un projet qui compte. Chaque contribution est confirmée et tracée.') + `<div class="wrap sec">${P.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(330px,100%),1fr))">${P.map(p => potCard(p, tot[p.id])).join('')}</div>` : '<div class="empty"><b>Aucune cagnotte en cours.</b><br>Les collectes apparaîtront ici.</div>'}</div>`;
};
VIEWS.cagnotte = async p => {
  const [x, T] = await Promise.all([q(sb.from('pots').select('*').eq('id', p[1]).maybeSingle()), rpc2('pot_totals')]);
  if (!x) return vNotFound();
  return `<div class="wrap sec"><p class="sm"><a href="#/cagnottes">← Toutes les cagnottes</a></p><div style="max-width:520px">${potCard(x, T.find(t => t.pot_id === x.id))}</div></div>`;
};

/* ---------- page de paiement (vote ou contribution) ---------- */
VIEWS.paiement = async p => {
  let x = await rpc2('get_purchase', { p_id: p[1] }); if (!x) return vNotFound();
  if (x.pay_started && x.status === 'en_attente') { try { await fn('lengopay-pay', { action: 'check', purchase_id: p[1] }); x = await rpc2('get_purchase', { p_id: p[1] }); } catch (e) { /* on réessaiera */ } }
  vOrder.poll = x.pay_started && x.status === 'en_attente' ? p[1] : null;
  const back = x.kind === 'vote' ? `<a class="btn ghost" href="#/vote/${x.campaign_id}">Retour au concours</a>` : `<a class="btn ghost" href="#/cagnotte/${x.pot_id}">Retour à la cagnotte</a>`;
  const body = x.status === 'confirme' ? `<h2>${ic('check')} Paiement confirmé</h2><p>Merci ${esc(x.buyer_name)} ! ${x.kind === 'vote' ? 'Vos votes sont comptabilisés.' : 'Votre contribution est enregistrée.'}</p>${back}`
    : x.status === 'a_rembourser' ? `<h2>Remboursement en cours</h2><p>Votre paiement a été reçu mais n'a pas pu être pris en compte (montant inattendu). FATIGLOBAL vous rembourse.</p>${back}`
    : x.status === 'annule' ? `<h2>Paiement annulé</h2>${back}`
    : `<h2>${x.pay_started ? ic('clock') + ' Paiement en attente' : 'Paiement'}</h2><p>${x.pay_started ? 'Si vous avez payé, la confirmation arrive dans un instant : cette page se met à jour automatiquement.' : 'Finalisez votre paiement en ligne par Orange Money, MTN MoMo ou carte.'}</p><button class="btn xl" data-a="payPurchase" data-id="${x.id}">${ic('phone')} Payer ${money(x.amount, x.currency)}</button><div class="row"><button class="btn ghost" data-a="refresh">Actualiser</button>${back}</div>`;
  return `<div class="wrap sec"><div class="card pad stack" style="max-width:520px;margin:0 auto">${body}<div class="note"><b>${esc(x.label || '')}</b><br>Montant : ${money(x.amount, x.currency)} · Réf. ${esc(x.id.slice(0, 8).toUpperCase())}</div></div></div>`;
};

/* ---------- inscriptions ---------- */
VIEWS.inscriptions = async () => {
  const F0 = await q(sb.from('forms').select('*').order('ends_at')), now = Date.now(), tr = UI.track;
  return head('Inscriptions et candidatures', 'Concours, recrutements, formations : déposez votre dossier en ligne et suivez son statut.') + `<div class="wrap sec"><div class="cols"><div class="stack">${F0.length ? F0.map(f => { const open = !f.closed && ts(f.ends_at) > now; return `<div class="card pad"><div class="row between"><h3 style="margin:0">${esc(f.title)}</h3>${badge(open ? ['Ouvertes', 'green'] : ['Clôturées', 'gray'])}</div><p class="sm mut">${esc(f.org_name || '')} · jusqu'au ${dFmt(f.ends_at)}</p><p class="sm">${esc(f.description || '')}</p>${open ? `<a class="btn s" href="#/inscription/${f.id}">Déposer ma candidature</a>` : ''}</div>`; }).join('') : '<div class="empty"><b>Aucune inscription ouverte pour le moment.</b></div>'}</div>
  <aside class="card pad stack sticky"><h3>Suivre ma candidature</h3><form class="stack" data-f="track"><label class="f">Numéro de dossier<input name="num" required placeholder="CAND-…"></label><label class="f">E-mail utilisé<input name="email" type="email" required></label><button class="btn s">Suivre</button></form>${tr ? (tr.found ? `<div class="note"><b>${esc(tr.number)}</b> — ${esc(tr.title)}<br>Déposée le ${dtFmt(tr.created_at)}<br>Statut : ${badge(aStatus(tr.status))}</div>` : '<div class="note">Aucun dossier ne correspond à ce numéro et cet e-mail.</div>') : ''}</aside></div></div>`;
};
const aStatus = s => s === 'acceptee' ? ['Acceptée', 'green'] : s === 'refusee' ? ['Refusée', 'red'] : ['En attente', 'orange'];
VIEWS.inscription = async p => {
  const f = await q(sb.from('forms').select('*').eq('id', p[1]).maybeSingle()); if (!f) return vNotFound();
  const s = f.sections || {};
  if (f.closed || ts(f.ends_at) < Date.now()) return box('Inscriptions clôturées', `<a class="btn" href="#/inscriptions">Voir les autres inscriptions</a>`);
  return head(esc(f.title), esc(f.org_name || '') + ' · jusqu\'au ' + dFmt(f.ends_at)) + `<div class="wrap sec"><form class="card pad stack" data-f="apply" data-form="${f.id}" style="max-width:820px"><p class="mut" style="margin:0">${esc(f.description || '')}</p>
  <h3>Identité et coordonnées</h3><div class="g2"><label class="f">Nom complet<input name="name" required minlength="3" value="${esc(ME?.full_name || '')}"></label><label class="f">Date de naissance<input name="Date de naissance" type="date" required></label><label class="f">Téléphone<input name="phone" required pattern="[+0-9 ]{8,}" value="${esc(ME?.phone || '')}"></label><label class="f">E-mail<input name="email" type="email" required value="${esc(ME?.email || '')}"></label><label class="f">Région<input name="Région" required></label><label class="f">Ville ou localité<input name="Ville" required></label></div>
  ${s.academic ? `<h3>Parcours académique</h3><div class="g2"><label class="f">Niveau<select name="Niveau académique" required><option value="">Choisir…</option><option>Baccalauréat ou niveau bac</option><option>BTS / BUT / Licence 2</option><option>Licence / Bachelor (Bac+3)</option><option>Master / DEA / DESS (Bac+5)</option><option>Doctorat (Bac+8)</option><option>Autre niveau</option></select></label><label class="f">Établissement d'origine<input name="Établissement"></label><label class="f">Domaine ou spécialité<input name="Spécialité" required></label></div>` : ''}
  ${s.skills ? `<h3>Compétences et expériences</h3><label class="f">Compétences techniques<textarea name="Compétences" rows="2"></textarea></label><label class="f">Stages, emplois, projets, certifications<textarea name="Expériences" rows="3"></textarea></label><label class="f">Langues parlées<input name="Langues"></label>` : ''}
  ${s.motivation ? `<h3>Disponibilité et motivations</h3><label class="f">Disponibilité<select name="Disponibilité"><option>Immédiatement disponible</option><option>Disponible sous une à deux semaines</option><option>Disponible sous un mois</option><option>Disponibilité à convenir</option></select></label><label class="f">Motivation<textarea name="Motivation" rows="4" required minlength="20"></textarea></label><label class="f">Informations complémentaires<textarea name="Informations complémentaires" rows="2"></textarea></label>` : ''}
  <button class="btn xl">SOUMETTRE MA CANDIDATURE</button></form></div>`;
};

/* ---------- mon compte : activité du participant ---------- */
const puStatus = s => ({ en_attente: ['En attente de paiement', 'orange'], confirme: ['Confirmé', 'green'], annule: ['Annulé', 'gray'], a_rembourser: ['Remboursement en cours', 'red'] }[s] || [s, 'gray']);
VIEWS.compte = async () => {
  const base = vAccount(); if (!ME) return base;
  let a = null; try { a = await rpc2('my_activity'); } catch (e) { /* base pas encore à jour */ }
  if (!a || (!a.purchases.length && !a.applications.length)) return base;
  return base + `<div class="wrap" style="padding-bottom:34px"><div class="cols"><div class="card pad"><h2>Mes votes et contributions</h2>${a.purchases.length ? a.purchases.map(p => `<a href="#/paiement/${p.id}" style="display:block;color:inherit;padding:9px 0;border-bottom:1px solid var(--line)"><div class="row between"><b>${esc(p.label || '')}</b>${badge(puStatus(p.status))}</div><div class="xs mut">${money(p.amount, p.currency)} · ${dtFmt(p.created_at)}</div></a>`).join('') : '<p class="mut sm">Aucun vote ni contribution.</p>'}</div>
  <div class="card pad"><h2>Mes candidatures</h2>${a.applications.length ? a.applications.map(x => `<div style="padding:9px 0;border-bottom:1px solid var(--line)"><div class="row between"><b>${esc(x.title)}</b>${badge(aStatus(x.status))}</div><div class="xs mut">${esc(x.number)} · ${dtFmt(x.created_at)}</div></div>`).join('') : '<p class="mut sm">Aucune candidature.</p>'}</div></div></div>`;
};

/* ---------- vente au guichet (vendeur) ---------- */
VIEWS.vente = async () => {
  if (!ME) return needLogin(); if (role() !== 'vendeur') return denied();
  const [ids, D] = await Promise.all([rpc2('my_seller_events'), loadData(true)]), now = Date.now();
  const evs = D.events.filter(e => ids.includes(e.id) && !e.cancelled && e.dates.some(d => d.end > now));
  const S = UI.sell || (UI.sell = { ev: '', date: '', sel: {} });
  if (!evs.some(e => e.id === S.ev)) { S.ev = evs[0]?.id || ''; S.date = ''; S.sel = {}; }
  const ev = evs.find(e => e.id === S.ev), up = ev ? ev.dates.filter(d => d.end > now) : [];
  if (ev && !up.some(d => d.id === S.date)) { S.date = up[0].id; S.sel = {}; }
  const d = up.find(x => x.id === S.date); let total = 0, n = 0;
  if (!ev) return head('Vente au guichet', 'Vendez les billets des événements qui vous sont attribués.') + box('Aucun événement attribué', '<p class="mut">Votre organisateur doit vous affecter à un événement.</p>');
  const tiers = d.tiers.map(t => { if ((S.sel[t.id] || 0) > t.avail) S.sel[t.id] = t.avail; const k = S.sel[t.id] || 0; total += k * t.price; n += k; return `<div class="tier ${t.avail === 0 ? 'out' : ''}"><div class="t-i"><b>${esc(t.name)}</b><div class="sm" style="color:var(--o-d);font-weight:700">${fmt(t.price, ev.currency)}</div><div class="xs mut">${t.avail === 0 ? 'SOLD OUT' : num(t.avail) + ' places disponibles'}</div></div>${t.avail > 0 ? `<div class="step"><button data-a="sellQty" data-t="${t.id}" data-d="-1" ${k === 0 ? 'disabled' : ''}>−</button><span>${k}</span><button data-a="sellQty" data-t="${t.id}" data-d="1" ${k >= Math.min(t.avail, 20) ? 'disabled' : ''}>+</button></div>` : ''}</div>`; }).join('');
  return head('Vente au guichet', 'Vous ne voyez que les événements que votre organisateur vous a attribués.') + `<div class="wrap sec"><div class="card pad stack" style="max-width:620px;margin:0 auto"><label class="f">Événement<select data-i="sellEv">${evs.map(e => `<option value="${e.id}" ${e.id === S.ev ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
  <div class="dates">${up.map(x => `<button class="date ${x.id === S.date ? 'on' : ''}" data-a="sellDate" data-d="${x.id}"><b>${dFmt(x.start)}</b><span class="xs mut">${hFmt(x.start)}</span></button>`).join('')}</div><div>${tiers}</div>
  <div class="total"><span>Total à encaisser</span><span>${n ? fmt(total, ev.currency) : '—'}</span></div>
  <form class="stack" data-f="sell"><div class="g2"><label class="f">Nom de l'acheteur<input name="name" required minlength="3"></label><label class="f">Téléphone (facultatif)<input name="phone" inputmode="tel"></label></div><label class="f">Moyen d'encaissement<select name="method"><option>Espèces</option><option>Orange Money</option><option>MTN MoMo</option></select></label><button class="btn xl" ${n ? '' : 'disabled'}>Encaisser et émettre ${n || ''} billet${n > 1 ? 's' : ''}</button></form></div></div>`;
};

/* ---------- espace organisateur : onglets ---------- */
let XC = null; // petit cache des données organisateur
async function extras(force) { if (!XC || force || Date.now() - XC.at > 8000) XC = { at: Date.now(), d: await rpc2('org_extras') }; return XC.d; }
ORG_TABS.push(['votes', 'Votes'], ['cagnottes', 'Cagnottes'], ['inscriptions', 'Inscriptions'], ['vendeurs', 'Vendeurs'], ['finances', 'Finances']);
const next30 = () => local(Date.now() + 30 * DAY);
ORG_R.votes = async () => {
  const X = await extras();
  return `<div class="wrap sec stack" style="padding-top:22px">${X.campaigns.map(c => `<div class="card pad"><div class="row between"><h2>${esc(c.name)}</h2><div class="row">${badge(cStatus({ ...c, starts_at: 0 }))}<a class="btn s ghost" href="#/vote/${c.id}">Voir la page</a><button class="btn s ghost" data-a="suspend" data-kind="vote" data-id="${c.id}" data-on="${c.suspended ? 0 : 1}">${c.suspended ? 'Rouvrir' : 'Suspendre'}</button></div></div><p class="sm mut">Recettes : <b>${money(c.revenue, c.currency)}</b> · ${money(c.price, c.currency)} par vote · clôture ${dFmt(c.ends_at)}</p>
  <div class="tw"><table><tr><th>Rang</th><th>Candidat</th><th class="n">Votes</th><th class="r">Annulation ciblée (fraude, anomalie)</th></tr>${c.results.map((x, i) => `<tr><td><span class="rank ${i === 0 ? 'r1' : ''}">${i + 1}</span></td><td><b>${esc(x.name)}</b></td><td class="n">${num(x.votes)}</td><td class="r">${x.votes > 0 ? `<button class="btn s ghost" data-a="cancelVotes" data-cand="${x.id}" data-name="${esc(x.name)}" data-max="${x.votes}">Annuler un lot</button>` : ''}</td></tr>`).join('')}</table></div>
  ${c.cancellations.length ? `<p class="sm" style="margin:12px 0 4px"><b>Historique des annulations</b></p>${c.cancellations.map(k => `<div class="xs mut">${dtFmt(k.at)} · ${esc(k.name)} : −${k.qty} vote(s) · rang ${k.before} → ${k.after} · « ${esc(k.reason)} »</div>`).join('')}<p class="xs mut">Une annulation ne déclenche aucun remboursement automatique.</p>` : ''}</div>`).join('')}
  <form class="card pad stack" data-f="newCampaign" style="max-width:820px"><h2>Créer un concours</h2><div class="g2"><label class="f">Nom du concours<input name="name" required minlength="3"></label><label class="f">Prix par vote (GNF, 0 = gratuit)<input name="price" type="number" min="0" step="100" required value="1000"></label><label class="f">Date de clôture<input name="end" type="date" required value="${next30()}"></label></div><label class="f">Description et conditions<textarea name="description" rows="2"></textarea></label><label class="f">Candidats (un par ligne : Nom — Ville)<textarea name="candidates" rows="4" required placeholder="Aïssatou Diallo — Conakry&#10;Mamadou Camara — Kindia"></textarea></label><div><button class="btn">Publier le concours</button></div></form></div>`;
};
ORG_R.cagnottes = async () => {
  const X = await extras();
  return `<div class="wrap sec stack" style="padding-top:22px">${X.pots.map(p => `<div class="card pad"><div class="row between"><h2>${esc(p.name)}</h2><div class="row">${badge(pStatus(p, +p.collected))}${p.is_public ? '' : badge(['Privée', 'gray'])}<a class="btn s ghost" href="#/cagnotte/${p.id}">Voir la page</a><button class="btn s ghost" data-a="suspend" data-kind="pot" data-id="${p.id}" data-on="${p.suspended ? 0 : 1}">${p.suspended ? 'Rouvrir' : 'Suspendre'}</button></div></div>
  <div class="row between sm"><b>${money(p.collected, p.currency)}</b><span class="mut">sur ${money(p.goal, p.currency)} · ${num(p.contributors)} contributeur(s)</span></div><div class="bar ${+p.collected >= p.goal ? 'done' : ''}" style="margin:6px 0 12px"><i style="width:${Math.min(100, p.collected / p.goal * 100)}%"></i></div>
  ${p.last.length ? `<div class="tw"><table><tr><th>Contributeur</th><th class="n">Montant</th><th>Date</th></tr>${p.last.map(l => `<tr><td>${esc(l.name)}</td><td class="n">${money(l.amount, p.currency)}</td><td class="sm">${dtFmt(l.at)}</td></tr>`).join('')}</table></div>` : '<p class="sm mut">Aucune contribution pour le moment.</p>'}${p.is_public ? '' : `<p class="xs mut">Cagnotte privée : elle n'apparaît pas dans la liste publique, partagez le lien de sa page.</p>`}</div>`).join('')}
  <form class="card pad stack" data-f="newPot" style="max-width:820px"><h2>Créer une cagnotte</h2><div class="g2"><label class="f">Nom<input name="name" required minlength="3"></label><label class="f">Objectif (GNF)<input name="goal" type="number" min="1000" step="1000" required></label><label class="f">Contribution minimum (GNF)<input name="min" type="number" min="0" step="500" value="5000"></label><label class="f">Date de fin<input name="end" type="date" required value="${next30()}"></label></div><label class="f">Description<textarea name="description" rows="2" required></textarea></label><label class="f">Visibilité<select name="public"><option value="1">Publique (visible dans la liste)</option><option value="0">Privée (accessible par lien uniquement)</option></select></label><div><button class="btn">Publier la cagnotte</button></div></form></div>`;
};
ORG_R.inscriptions = async () => {
  const X = await extras(); window.__apps = X.forms;
  return `<div class="wrap sec stack" style="padding-top:22px">${X.forms.map((f, fi) => `<div class="card pad"><div class="row between"><h2>${esc(f.title)}</h2><div class="row">${badge(!f.closed && ts(f.ends_at) > Date.now() ? ['Ouvertes', 'green'] : ['Clôturées', 'gray'])}<button class="btn s ghost" data-a="closeForm" data-id="${f.id}" data-on="${f.closed ? 0 : 1}">${f.closed ? 'Rouvrir' : 'Clôturer'}</button>${f.applications.length ? `<button class="btn s ghost" data-a="csvApps" data-i="${fi}">Exporter (Excel/CSV)</button>` : ''}</div></div><p class="sm mut">${f.applications.length} candidature(s) · jusqu'au ${dFmt(f.ends_at)}</p>
  ${f.applications.map((a, ai) => `<div style="padding:10px 0;border-top:1px solid var(--line)"><div class="row between"><span><b>${esc(a.name)}</b> <span class="xs mut">${esc(a.number)} · ${dFmt(a.created_at)}</span></span>${badge(aStatus(a.status))}</div><div class="xs mut">${esc(a.email)} · ${esc(a.phone)}</div><div class="row" style="margin-top:6px"><button class="btn s ghost" data-a="viewApp" data-f="${fi}" data-i="${ai}">Voir le dossier</button>${[['acceptee', 'Accepter'], ['en_attente', 'En attente'], ['refusee', 'Refuser']].map(([s, l]) => `<button class="chip ${a.status === s ? 'on' : ''}" data-a="appStatus" data-id="${a.id}" data-v="${s}">${l}</button>`).join('')}</div></div>`).join('')}</div>`).join('')}
  <form class="card pad stack" data-f="newForm" style="max-width:820px"><h2>Créer un formulaire d'inscription</h2><div class="g2"><label class="f">Titre<input name="title" required minlength="3" placeholder="Ex. Concours Jeunes Talents 2027"></label><label class="f">Date limite<input name="end" type="date" required value="${next30()}"></label></div><label class="f">Description<textarea name="description" rows="2"></textarea></label><div class="sm" style="font-weight:650">Rubriques à inclure (identité et coordonnées sont toujours demandées)</div><div class="row"><label class="row sm"><input type="checkbox" name="academic" checked> Parcours académique</label><label class="row sm"><input type="checkbox" name="skills" checked> Compétences et expériences</label><label class="row sm"><input type="checkbox" name="motivation" checked> Disponibilité et motivations</label></div><div><button class="btn">Publier le formulaire</button></div></form></div>`;
};
ORG_R.vendeurs = async () => {
  const [X, D] = await Promise.all([extras(), rpc('org_dashboard')]), evs = D.events.filter(e => !e.cancelled);
  return `<div class="wrap sec stack" style="padding-top:22px"><div class="card pad"><h2>Vendeurs et points de vente</h2>${X.sellers.length ? `<div class="tw"><table><tr><th>Vendeur</th><th>Point de vente</th><th>Événements autorisés</th><th class="n">Billets</th><th class="n">Ventes</th><th class="n">Remb.</th><th></th></tr>${X.sellers.map(s => `<tr><td><b>${esc(s.name || '—')}</b><div class="xs mut">${esc(s.email)}</div></td><td>${esc(s.pos)}</td><td class="sm">${s.events.map(esc).join(', ') || '—'}</td><td class="n">${num(s.sold)}</td><td class="n">${money(s.amount)}</td><td class="n">${s.refunds}</td><td class="r"><button class="btn s ${s.active ? 'ghost' : 'ok'}" data-a="sellerActive" data-id="${s.id}" data-on="${s.active ? 0 : 1}">${s.active ? 'Suspendre' : 'Réactiver'}</button></td></tr>`).join('')}</table></div>` : '<p class="mut sm">Aucun vendeur pour le moment.</p>'}</div>
  ${evs.length ? `<form class="card pad stack" data-f="newSeller" style="max-width:620px"><h2>Ajouter un vendeur</h2><label class="f">E-mail du compte du vendeur<input name="email" type="email" required></label><label class="f">Point de vente<input name="pos" required minlength="2" placeholder="Ex. Kaloum Centre"></label><label class="f">Événement autorisé<select name="event">${evs.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label><div><button class="btn">Affecter le vendeur</button></div><p class="xs mut" style="margin:0">La personne doit d'abord créer son compte sur le site. Pour autoriser plusieurs événements, répétez l'opération. Un vendeur ne voit jamais les événements qui ne lui sont pas attribués.</p></form>` : '<div class="note">Créez d\'abord un événement pour pouvoir y affecter un vendeur.</div>'}</div>`;
};
ORG_R.finances = async () => {
  const X = await extras(), b = X.balance;
  return `<div class="wrap sec stack" style="padding-top:22px"><div class="kpis"><div class="kpi hot"><small>Disponible au retrait</small><b>${money(b.available)}</b></div><div class="kpi"><small>Billets payés en ligne</small><b>${money(b.tickets)}</b></div><div class="kpi"><small>Votes</small><b>${money(b.votes)}</b></div><div class="kpi"><small>Cagnottes</small><b>${money(b.contributions)}</b></div><div class="kpi"><small>Commission FATIGLOBAL (${commLabel()})</small><b>${b.commission == null ? '—' : money(b.commission)}</b></div><div class="kpi"><small>Déjà versé</small><b>${money(b.paid)}</b></div><div class="kpi"><small>Demandes en cours</small><b>${money(b.pending)}</b></div></div>
  ${RATE == null ? '<div class="note">Le taux de commission n\'a pas encore été fixé par la Direction FATIGLOBAL : les demandes de paiement seront possibles dès qu\'il le sera.</div>' : ''}
  <p class="xs mut" style="margin:0">Le solde porte sur les encaissements en ligne (LengoPay) en GNF. Les ventes au guichet et les paiements reçus directement par vous n'y figurent pas.</p>
  <div class="cols"><form class="card pad stack" data-f="payout"><h2>Demande de paiement</h2><label class="f">Activité concernée<input name="activity" required minlength="2" placeholder="Ex. Billetterie du concert du 21 novembre"></label><label class="f">Montant demandé (GNF)<input name="amount" type="number" min="1" max="${b.available}" required></label><label class="f">Coordonnées de paiement<textarea name="details" rows="2" required minlength="6" placeholder="Ex. Orange Money 6XX XX XX XX — Nom du titulaire"></textarea></label><div><button class="btn" ${+b.available > 0 ? '' : 'disabled'}>Envoyer à la Direction</button></div></form>
  <div class="card pad"><h2>Mes demandes</h2>${X.payouts.length ? X.payouts.map(p => `<div style="padding:9px 0;border-bottom:1px solid var(--line)"><div class="row between"><b>${esc(p.ref)} · ${money(p.amount, p.currency)}</b>${badge(payStatus(p.status))}</div><div class="xs mut">${esc(p.activity)} · ${dFmt(p.created_at)}${p.reason ? ' · « ' + esc(p.reason) + ' »' : ''}</div></div>`).join('') : '<p class="mut sm">Aucune demande.</p>'}</div></div></div>`;
};
const payStatus = s => ({ en_attente: ['En attente', 'orange'], approuvee: ['Approuvée', 'green'], rejetee: ['Rejetée', 'red'], info: ['Informations demandées', 'blue'] }[s] || [s, 'gray']);

/* ---------- Direction : onglets ---------- */
ADMIN_TABS.push(['transactions', 'Transactions'], ['paiements', 'Paiements'], ['activites', 'Votes et cagnottes'], ['pays', 'Pays et devises'], ['parametres', 'Paramètres']);
const txStatus = s => ({ en_attente: ['En attente', 'orange'], a_verifier: ['À vérifier', 'blue'], confirme: ['Confirmé', 'green'], expire: ['Expiré', 'gray'], annule: ['Annulé', 'gray'], a_rembourser: ['À rembourser', 'red'] }[s] || [s, 'gray']);
ADMIN_R.transactions = async () => {
  const T = await rpc2('admin_transactions', { p_limit: 300 }); window.__tx = T;
  return `<div class="card pad"><div class="row between"><h2>Transactions</h2>${T.length ? '<button class="btn s ghost" data-a="csvTx">Exporter (Excel/CSV)</button>' : ''}</div>${T.length ? `<div class="tw"><table><tr><th>Date</th><th>Type · Objet</th><th>Payeur</th><th>Organisateur</th><th>Moyen · Canal</th><th class="n">Montant</th><th class="n">Commission</th><th>Statut</th></tr>${T.map(t => `<tr><td class="sm nowrap">${dtFmt(t.at)}</td><td><b>${esc(t.kind)}</b><div class="xs mut">${esc(t.label || '')}</div></td><td class="sm">${esc(t.buyer_name || '')}</td><td class="sm">${esc(t.org || '')}</td><td class="sm">${esc(t.method || '—')}<div class="xs mut">${esc(t.channel === 'vendeur' ? 'Guichet' : 'En ligne')}${t.ref ? ' · réf. ' + esc(String(t.ref).slice(0, 10)) + '…' : ''}</div></td><td class="n"><b>${money(t.amount, t.currency)}</b></td><td class="n">${t.status === 'confirme' ? commValue(t.amount, t.currency) : '—'}</td><td>${badge(txStatus(t.status))}</td></tr>`).join('')}</table></div><p class="xs mut">Les 300 opérations les plus récentes : commandes de billets, votes et contributions. La commission est indicative, calculée au taux en vigueur (${commLabel()}).</p>` : '<p class="mut sm">Aucune transaction.</p>'}</div>`;
};
ADMIN_R.parametres = async () => {
  const S = (await loadData(true)).settings || {}, pct = typeof S.commission_rate === 'number' ? S.commission_rate * 100 : '';
  return `<div class="cols"><form class="card pad stack" data-f="setting" data-key="commission_rate"><h2>Commission de la plateforme</h2>${pct === '' ? '<div class="note">Aucun taux n\'est défini. Tant qu\'il ne l\'est pas, aucune commission n\'est calculée et les organisateurs ne peuvent pas demander de paiement.</div>' : ''}<label class="f">Taux de commission (%)<input name="value" type="number" min="0" max="50" step="0.1" required value="${pct}"></label><label class="f">Motif (journalisé)<input name="reason" required minlength="4" placeholder="Ex. Décision de la Direction du …"></label><div><button class="btn">Enregistrer le taux</button></div><p class="xs mut" style="margin:0">Le taux s'applique aux billets payés en ligne, aux votes et aux cagnottes. Il sert au calcul du solde retirable des organisateurs.</p></form>
  <form class="card pad stack" data-f="scanWindow"><h2>Contrôle de la date au scan</h2><div class="g2"><label class="f">Entrée possible avant le début (heures)<input name="early" type="number" min="0" max="72" required value="${S.scan_early_hours ?? 12}"></label><label class="f">Entrée possible après la fin (heures)<input name="late" type="number" min="0" max="72" required value="${S.scan_late_hours ?? 6}"></label></div><label class="f">Motif (journalisé)<input name="reason" required minlength="4"></label><div><button class="btn">Enregistrer</button></div><p class="xs mut" style="margin:0">En dehors de cette plage, le scanner affiche « BILLET POUR UNE AUTRE DATE » et le billet reste valide.</p></form></div>`;
};
ADMIN_R.paiements = async () => {
  const X = await rpc2('admin_extras');
  return `<div class="stack"><div class="card pad"><h2>Demandes de paiement des organisateurs</h2>${X.payouts.length ? `<div class="tw"><table><tr><th>Réf.</th><th>Organisateur</th><th>Activité · Coordonnées</th><th class="n">Montant</th><th>Statut</th><th></th></tr>${X.payouts.map(p => `<tr><td class="tk-code">${esc(p.ref)}</td><td><b>${esc(p.org || '')}</b><div class="xs mut">${dtFmt(p.created_at)}</div></td><td>${esc(p.activity)}<div class="xs mut">${esc(p.details)}</div>${p.reason ? `<div class="xs mut">« ${esc(p.reason)} »</div>` : ''}</td><td class="n"><b>${money(p.amount, p.currency)}</b></td><td>${badge(payStatus(p.status))}</td><td class="r nowrap">${['en_attente', 'info'].includes(p.status) ? `<button class="btn s ok" data-a="payoutDecide" data-id="${p.id}" data-v="approuvee">Approuver</button> <button class="btn s ghost" data-a="payoutDecide" data-id="${p.id}" data-v="info">Demander des infos</button> <button class="btn s danger" data-a="payoutDecide" data-id="${p.id}" data-v="rejetee">Rejeter</button>` : ''}</td></tr>`).join('')}</table></div><p class="xs mut">Approuver enregistre la décision ; le versement lui-même se fait depuis votre compte LengoPay ou votre banque.</p>` : '<p class="mut sm">Aucune demande.</p>'}</div>
  ${X.refunds.length ? `<div class="card pad"><h2>Votes et contributions à rembourser</h2><div class="tw"><table><tr><th>Payeur</th><th>Objet</th><th class="n">Montant</th><th>Réf. LengoPay</th></tr>${X.refunds.map(r => `<tr><td><b>${esc(r.name)}</b><div class="xs mut">${esc(r.phone)}</div></td><td>${esc(r.label || '')}</td><td class="n">${money(r.amount, r.currency)}</td><td class="tk-code">${esc(r.pay_id || '')}</td></tr>`).join('')}</table></div></div>` : ''}</div>`;
};
ADMIN_R.activites = async () => {
  const X = await rpc2('admin_extras'), row = (k, kind) => `<tr><td><b>${esc(k.name)}</b></td><td>${esc(k.org || '')}</td><td class="sm">${dFmt(k.ends_at)}</td><td>${badge(k.suspended ? ['Suspendu', 'red'] : ['Actif', 'green'])}</td><td class="r"><button class="btn s ${k.suspended ? 'ok' : 'danger'}" data-a="suspend" data-kind="${kind}" data-id="${k.id}" data-on="${k.suspended ? 0 : 1}">${k.suspended ? 'Rouvrir' : 'Suspendre'}</button></td></tr>`;
  return `<div class="stack"><div class="kpis"><div class="kpi"><small>Votes confirmés</small><b>${num(X.votes)}</b></div><div class="kpi"><small>Recettes votes</small><b>${money(X.vote_revenue)}</b></div><div class="kpi"><small>Cagnottes collectées</small><b>${money(X.pot_revenue)}</b></div><div class="kpi"><small>Candidatures</small><b>${num(X.applications)}</b></div></div>
  <div class="card pad"><h2>Concours</h2>${X.campaigns.length ? `<div class="tw"><table><tr><th>Concours</th><th>Organisateur</th><th>Clôture</th><th>Statut</th><th></th></tr>${X.campaigns.map(k => row(k, 'vote')).join('')}</table></div>` : '<p class="mut sm">Aucun concours.</p>'}</div>
  <div class="card pad"><h2>Cagnottes</h2>${X.pots.length ? `<div class="tw"><table><tr><th>Cagnotte</th><th>Organisateur</th><th>Fin</th><th>Statut</th><th></th></tr>${X.pots.map(k => row(k, 'pot')).join('')}</table></div>` : '<p class="mut sm">Aucune cagnotte.</p>'}</div></div>`;
};
ADMIN_R.pays = async () => {
  const [C, M] = await Promise.all([q(sb.from('countries').select('*').order('name')), q(sb.from('currencies').select('*').order('code'))]);
  return `<div class="cols"><div class="card pad"><h2>Pays</h2><div class="tw"><table><tr><th>Pays</th><th>Code</th><th>Indicatif</th><th>Devise</th><th>Statut</th><th></th></tr>${C.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.code)}</td><td>${esc(c.dial || '')}</td><td>${esc(c.currency || '')}</td><td>${badge(c.active ? ['Actif', 'green'] : ['Inactif', 'gray'])}</td><td class="r"><button class="btn s ghost" data-a="toggleRef" data-t="countries" data-id="${esc(c.code)}" data-on="${c.active ? 0 : 1}">${c.active ? 'Désactiver' : 'Activer'}</button></td></tr>`).join('')}</table></div>
  <form class="g3" data-f="newCountry" style="margin-top:14px;align-items:end"><label class="f">Nom<input name="name" required></label><label class="f">Code (2 lettres)<input name="code" required pattern="[A-Za-z]{2}" maxlength="2"></label><label class="f">Indicatif<input name="dial" placeholder="+224"></label><label class="f">Devise<select name="currency">${M.map(m => `<option>${esc(m.code)}</option>`).join('')}</select></label><div><button class="btn s">Ajouter le pays</button></div></form></div>
  <div class="card pad"><h2>Devises</h2><div class="tw"><table><tr><th>Devise</th><th>ISO</th><th>Déc.</th><th>Statut</th><th></th></tr>${M.map(c => `<tr><td><b>${esc(c.name)}</b> ${esc(c.symbol || '')}</td><td>${esc(c.code)}</td><td>${c.decimals}</td><td>${badge(c.active ? ['Active', 'green'] : ['Inactive', 'gray'])}</td><td class="r"><button class="btn s ghost" data-a="toggleRef" data-t="currencies" data-id="${esc(c.code)}" data-on="${c.active ? 0 : 1}">${c.active ? 'Désactiver' : 'Activer'}</button></td></tr>`).join('')}</table></div>
  <form class="g3" data-f="newCurrency" style="margin-top:14px;align-items:end"><label class="f">Nom<input name="name" required></label><label class="f">Code ISO<input name="code" required pattern="[A-Za-z]{3}" maxlength="3"></label><label class="f">Symbole<input name="symbol"></label><label class="f">Décimales<input name="decimals" type="number" min="0" max="3" value="0"></label><div><button class="btn s">Ajouter la devise</button></div></form>
  <p class="xs mut">Activer une devise n'active pas les moyens de paiement correspondants : le paiement en ligne LengoPay doit aussi l'accepter.</p></div></div>`;
};

/* ---------- export ---------- */
function download(name, rows) {
  const csv = '﻿' + rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- actions ---------- */
Object.assign(A, {
  forgot() { const e = $('[data-f="signin"] [name="email"]').value.trim(); if (!e) return toast('Saisissez d\'abord votre e-mail ci-dessus.'); act(async () => { const { error } = await sb.auth.resetPasswordForEmail(e, { redirectTo: location.origin + location.pathname }); if (error) throw new Error(error.message); }, 'Si ce compte existe, un lien de réinitialisation vient d\'être envoyé par e-mail.'); },
  csv() { download('billets-fatibillets.csv', [['Code', 'Événement', 'Catégorie', 'Titulaire', 'Statut', 'Prix', 'Devise'], ...(window.__csv || []).map(k => [k.code, k.event, k.tier, k.holder, tkBadge(k.status)[0], k.price, k.currency])]); },
  csvTx() { download('transactions-fatibillets.csv', [['Date', 'Type', 'Objet', 'Payeur', 'Organisateur', 'Moyen', 'Canal', 'Montant', 'Devise', 'Statut', 'Référence externe'], ...(window.__tx || []).map(t => [dtFmt(t.at), t.kind, t.label, t.buyer_name, t.org, t.method, t.channel, t.amount, t.currency, txStatus(t.status)[0], t.ref])]); },
  csvApps(el) { const f = window.__apps[el.dataset.i], keys = [...new Set(f.applications.flatMap(a => Object.keys(a.data || {})))]; download('candidatures.csv', [['Numéro', 'Nom', 'E-mail', 'Téléphone', 'Statut', 'Date', ...keys], ...f.applications.map(a => [a.number, a.name, a.email, a.phone, aStatus(a.status)[0], dtFmt(a.created_at), ...keys.map(k => a.data[k])])]); },
  viewApp(el) { const a = window.__apps[el.dataset.f].applications[el.dataset.i]; modal(`<h2>${esc(a.name)}</h2><p class="sm mut">${esc(a.number)} · ${esc(a.email)} · ${esc(a.phone)}</p><div class="stack" style="max-height:60vh;overflow:auto">${Object.entries(a.data || {}).filter(([, v]) => v).map(([k, v]) => `<div><div class="xs mut" style="font-weight:700;text-transform:uppercase">${esc(k)}</div><div style="white-space:pre-wrap">${esc(v)}</div></div>`).join('')}</div><div class="row" style="margin-top:16px"><button class="btn ghost" data-a="close">Fermer</button></div>`); },
  appStatus(el) { act(async () => { await rpc2('set_application_status', { p_id: el.dataset.id, p_status: el.dataset.v }); XC = null; }); },
  closeForm(el) { act(async () => { await rpc2('close_form', { p_id: el.dataset.id, p_closed: el.dataset.on === '1' }); XC = null; }); },
  vote(el) {
    const price = +el.dataset.price, sel = $('#vn-' + el.dataset.cand), qty = sel ? +sel.value : 1, total = qty * price;
    buyerModal(`${qty} vote${qty > 1 ? 's' : ''} pour ${el.dataset.name}`, price ? `Montant : <b style="color:var(--o-d)">${money(total, el.dataset.cur)}</b>` : 'Vote gratuit', async b => {
      const id = await rpc2('buy_votes', { p_candidate: el.dataset.cand, p_qty: qty, p_name: b.name, p_phone: b.phone, p_email: b.email });
      if (total > 0) await startPay(id); else { toast('Merci ! Votre vote est enregistré.'); await render(); }
    });
  },
  payPurchase(el) { if (el.disabled) return; el.disabled = true; el.textContent = 'Redirection vers le paiement…'; startPay(el.dataset.id).catch(e => { toast(e.message); render(); }); },
  cancelVotes(el) { askQty('Annuler un lot de votes — ' + el.dataset.name, el.dataset.max, (qty, m) => act(async () => { await rpc2('cancel_votes', { p_candidate: el.dataset.cand, p_qty: qty, p_reason: m }); XC = null; }, 'Votes annulés, classement recalculé.')); },
  suspend(el) { const on = el.dataset.on === '1'; askReason(on ? 'Suspendre cette activité' : 'Rouvrir cette activité', m => act(async () => { await rpc2('set_suspended', { p_kind: el.dataset.kind, p_id: el.dataset.id, p_suspended: on, p_reason: m }); XC = null; }, on ? 'Activité suspendue.' : 'Activité rouverte.')); },
  sellerActive(el) { act(async () => { await rpc2('set_seller_active', { p_seller: el.dataset.id, p_active: el.dataset.on === '1' }); XC = null; }); },
  sellDate(el) { UI.sell.date = el.dataset.d; UI.sell.sel = {}; render(); },
  sellQty(el) { const s = UI.sell.sel; s[el.dataset.t] = Math.max(0, (s[el.dataset.t] || 0) + +el.dataset.d); render(); },
  payoutDecide(el) { const v = el.dataset.v, go = m => act(() => rpc2('decide_payout', { p_id: el.dataset.id, p_status: v, p_reason: m || '' }), 'Décision enregistrée.'); if (v === 'approuvee') go(''); else askReason(v === 'rejetee' ? 'Rejeter cette demande' : 'Demander des informations complémentaires', go); },
  toggleRef(el) { act(async () => { await q(sb.from(el.dataset.t).update({ active: el.dataset.on === '1' }).eq('code', el.dataset.id)); }); },
});
function askQty(title, max, cb) { askQty.cb = cb; modal(`<h2>${esc(title)}</h2><form data-f="qtyReason" class="stack"><label class="f">Nombre de votes à annuler (maximum ${num(max)})<input name="qty" type="number" min="1" max="${max}" value="1" required></label><label class="f">Motif (obligatoire, journalisé)<textarea name="motif" required minlength="4" rows="3"></textarea></label><p class="xs mut" style="margin:0">L'annulation ne déclenche aucun remboursement automatique.</p><div class="row"><button class="btn" style="flex:1">Confirmer</button><button type="button" class="btn ghost" data-a="close">Annuler</button></div></form>`); }

Object.assign(F, {
  async buyer(f) { const b = { name: f.get('name').trim(), phone: f.get('phone').trim(), email: (f.get('email') || '').trim() }; await buyerModal.cb(b); closeModal(); },
  async qtyReason(f) { closeModal(); await askQty.cb(+f.get('qty'), f.get('motif').trim()); },
  async newPassword(f) { const { error } = await sb.auth.updateUser({ password: f.get('password') }); if (error) throw new Error(error.message); closeModal(); toast('Mot de passe mis à jour.'); },
  async contrib(f, form) {
    const amount = +f.get('amount');
    buyerModal('Contribution — ' + form.dataset.name, `Montant : <b style="color:var(--o-d)">${money(amount, form.dataset.cur)}</b>`, async b => { const id = await rpc2('contribute', { p_pot: form.dataset.pot, p_amount: amount, p_name: b.name, p_phone: b.phone, p_email: b.email }); await startPay(id); });
  },
  async track(f) { const r = await rpc2('track_application', { p_number: f.get('num'), p_email: f.get('email') }); UI.track = r ? { ...r, found: true } : { found: false }; await render(); },
  async apply(f, form) {
    const data = {}; for (const [k, v] of f.entries()) if (typeof v === 'string' && v.trim()) data[k] = v.trim();
    const n = await rpc2('submit_application', { p_form: form.dataset.form, p_data: data });
    location.hash = '#/inscriptions';
    setTimeout(() => modal(`<h2>${ic('check')} Candidature enregistrée</h2><p>Votre numéro de dossier :</p><p class="tk-code" style="font-size:1.4rem;color:var(--o-d)">${esc(n)}</p><p class="sm mut">Notez ce numéro : avec votre e-mail, il vous permet de suivre votre candidature dans « Suivre ma candidature ».</p><button class="btn" data-a="close">Compris</button>`), 300);
  },
  async sell(f) {
    const S = UI.sell, items = Object.entries(S.sel).filter(([, k]) => k > 0).map(([tier_id, qty]) => ({ tier_id, qty }));
    const id = await rpc2('sell_tickets', { p_date: S.date, p_items: items, p_name: f.get('name'), p_phone: f.get('phone'), p_method: f.get('method') });
    S.sel = {}; DATA = null; toast('Billets émis. Vous pouvez les imprimer.'); location.hash = '#/commande/' + id;
  },
  async newCampaign(f) {
    const candidates = f.get('candidates').split('\n').map(l => l.split(/\s+[—-]\s+/)).filter(a => a[0].trim()).map(a => ({ name: a[0].trim(), city: (a[1] || '').trim() }));
    await rpc2('create_campaign', { p: { name: f.get('name'), description: f.get('description').trim(), price: +f.get('price') || 0, ends_at: endOfDay(f.get('end')), candidates } });
    XC = null; toast('Concours publié.'); await render();
  },
  async newPot(f) { await rpc2('create_pot', { p: { name: f.get('name'), description: f.get('description').trim(), goal: +f.get('goal'), min_amount: +f.get('min') || 0, ends_at: endOfDay(f.get('end')), is_public: f.get('public') === '1' } }); XC = null; toast('Cagnotte publiée.'); await render(); },
  async newForm(f) { await rpc2('create_form', { p: { title: f.get('title'), description: f.get('description').trim(), ends_at: endOfDay(f.get('end')), sections: { academic: !!f.get('academic'), skills: !!f.get('skills'), motivation: !!f.get('motivation') } } }); XC = null; toast('Formulaire publié.'); await render(); },
  async newSeller(f) { await rpc2('assign_seller', { p_email: f.get('email'), p_pos: f.get('pos'), p_event: f.get('event') }); XC = null; toast('Vendeur affecté.'); await render(); },
  async payout(f) { const ref = await rpc2('request_payout', { p_activity: f.get('activity'), p_amount: +f.get('amount'), p_details: f.get('details') }); XC = null; toast('Demande ' + ref + ' transmise à la Direction.'); await render(); },
  async profile(f) { await rpc2('update_profile', { p_name: f.get('name'), p_phone: f.get('phone') }); await loadMe(); toast('Profil mis à jour.'); await render(); },
  async setting(f) { await rpc2('set_setting', { p_key: 'commission_rate', p_value: +f.get('value') / 100, p_reason: f.get('reason') }); DATA = null; XC = null; toast('Taux de commission enregistré.'); await render(); },
  async scanWindow(f) { await rpc2('set_setting', { p_key: 'scan_early_hours', p_value: +f.get('early'), p_reason: f.get('reason') }); await rpc2('set_setting', { p_key: 'scan_late_hours', p_value: +f.get('late'), p_reason: f.get('reason') }); DATA = null; toast('Plage de contrôle enregistrée.'); await render(); },
  async newCountry(f) { await q(sb.from('countries').insert({ name: f.get('name').trim(), code: f.get('code').toUpperCase(), dial: f.get('dial').trim(), currency: f.get('currency') })); DATA = null; await render(); },
  async newCurrency(f) { await q(sb.from('currencies').insert({ name: f.get('name').trim(), code: f.get('code').toUpperCase(), symbol: f.get('symbol').trim(), decimals: +f.get('decimals') || 0 })); DATA = null; await render(); },
});
Object.assign(I, {
  vq(v) { UI.vq = v; const el = document.activeElement, pos = el.selectionStart; render().then(() => { const n = $('[data-i="vq"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }); },
  sellEv(v) { UI.sell.ev = v; UI.sell.date = ''; UI.sell.sel = {}; render(); },
});
// boot() est appelé à la fin de modules2.js, chargé après ce fichier.
