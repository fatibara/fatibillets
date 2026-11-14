'use strict';
/* FatiBillets — application de billetterie (données et sécurité gérées par Supabase). */
const CFG = window.FB_CONFIG || {}, READY = /^https:\/\/.+\..+/.test(CFG.url || '') && (CFG.anonKey || '').length > 20;
const sb = READY ? supabase.createClient(CFG.url, CFG.anonKey) : null;
const COMM = 0.05, DAY = 864e5, GUEST_KEY = 'fatibillets-commandes';
const UI = { q: '', cat: '', when: '', sort: 'date', sel: {}, selDate: {}, authTab: 'in', adminTab: 'vue' };
let ME = null, DATA = null, seq = 0, cam = { on: false, last: '' };

/* ---------- utilitaires ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => new Intl.NumberFormat('fr-FR').format(Math.round(n));
const fmt = (n, cur = 'GNF') => +n === 0 ? 'Gratuit' : num(n) + ' ' + cur;
const money = (n, cur = 'GNF') => num(n) + ' ' + cur;
const ts = v => typeof v === 'number' ? v : Date.parse(v);
const dFmt = v => new Date(ts(v)).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const hFmt = v => new Date(ts(v)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dtFmt = v => new Date(ts(v)).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const day0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return +d; };
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const initials = s => String(s).split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
function lev(a, b) { const m = [...Array(a.length + 1)].map((_, i) => [i]); for (let j = 1; j <= b.length; j++) m[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return m[a.length][b.length]; }
function qrSvg(code) { try { const q = qrcode(0, 'M'); q.addData(code); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (e) { return '<div class="xs mut">QR indisponible</div>'; } }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 4200); }
const badge = ([l, c]) => `<span class="badge b-${c}">${esc(l)}</span>`;
const role = () => ME ? ME.role : null;
async function rpc(name, args) { const { data, error } = await sb.rpc(name, args); if (error) throw new Error(error.message); return data; }
async function fn(name, body) {
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) { let m = null; try { m = (await error.context.json()).error; } catch (e) { /* pas de détail */ } throw new Error(m || 'Le service de paiement est indisponible. Réessayez dans un instant.'); }
  if (data && data.error) throw new Error(data.error);
  return data;
}
async function act(fn, okMsg) { try { await fn(); if (okMsg) toast(okMsg); DATA = null; await render(); } catch (e) { toast(e.message || 'Une erreur est survenue.'); } }
function guestOrders() { try { return JSON.parse(localStorage.getItem(GUEST_KEY)) || []; } catch (e) { return []; } }
function rememberOrder(id) { try { localStorage.setItem(GUEST_KEY, JSON.stringify([id, ...guestOrders().filter(x => x !== id)].slice(0, 50))); } catch (e) { /* stockage indisponible */ } }

const ICONS = {
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  cam: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  grid: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

/* ---------- données ---------- */
async function loadData(force) {
  if (DATA && !force && Date.now() - DATA.at < 30000) return DATA;
  const [ev, av, cats] = await Promise.all([
    sb.from('events').select('*, event_dates!event_dates_event_id_fkey(*, tiers!tiers_date_id_fkey(*))'),
    sb.rpc('availability'), sb.from('categories').select('*').order('position')]);
  for (const r of [ev, av, cats]) if (r.error) throw new Error(r.error.message);
  const A = Object.fromEntries(av.data.map(a => [a.tier_id, a.available]));
  const events = ev.data.map(e => ({ ...e, colors: [e.color1, e.color2], keywords: e.keywords || [], artists: e.artists || [],
    dates: (e.event_dates || []).map(d => ({ id: d.id, start: ts(d.starts_at), end: ts(d.ends_at), tiers: (d.tiers || []).sort((a, b) => a.position - b.position).map(t => ({ ...t, avail: A[t.id] ?? 0 })) })).sort((a, b) => a.start - b.start) })).filter(e => e.dates.length);
  return DATA = { at: Date.now(), events, cats: cats.data };
}
async function loadMe() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { ME = null; return; }
  const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  ME = data ? data : { id: session.user.id, email: session.user.email, role: 'participant', status: 'actif' };
  if (ME.status !== 'actif') ME.role = 'participant';
}
function evStatus(ev) {
  const now = Date.now();
  if (ev.cancelled) return ['Annulé', 'gray'];
  if (ev.dates.every(d => d.end < now)) return ['Terminé', 'gray'];
  if (ev.dates.filter(d => d.end > now).reduce((a, d) => a + d.tiers.reduce((x, t) => x + t.avail, 0), 0) === 0) return ['SOLD OUT', 'red'];
  if (ev.dates.some(d => d.start <= now && d.end > now)) return ['En cours', 'green'];
  return ['Billetterie ouverte', 'orange'];
}
const minPrice = ev => Math.min(...ev.dates.flatMap(d => d.tiers.map(t => +t.price)));
function matchQ(ev, q) {
  const toks = norm(q).split(/\s+/).filter(Boolean); if (!toks.length) return true;
  const hay = norm([ev.name, ev.slogan, ev.description, ev.category, ev.city, ev.country, ev.venue, ev.org_name, ...ev.keywords].join(' ')), words = hay.split(/[^a-z0-9]+/);
  return toks.every(t => hay.includes(t) || (t.length >= 4 && words.some(w => Math.abs(w.length - t.length) <= 2 && lev(w, t) <= (t.length > 6 ? 2 : 1))));
}
function inWhen(ev, w) {
  if (!w) return true; const d = day0(), x = new Date(d), dow = (x.getDay() + 6) % 7; let a = d, b;
  if (w === 'today') b = d + DAY; else if (w === 'tomorrow') { a = d + DAY; b = d + 2 * DAY; } else if (w === 'week') b = d + (7 - dow) * DAY; else if (w === 'nextweek') { a = d + (7 - dow) * DAY; b = a + 7 * DAY; } else if (w === 'month') b = +new Date(x.getFullYear(), x.getMonth() + 1, 1); else { a = +new Date(x.getFullYear(), x.getMonth() + 1, 1); b = +new Date(x.getFullYear(), x.getMonth() + 2, 1); }
  return ev.dates.some(dt => dt.start < b && dt.end > a);
}

/* ---------- gabarits communs ---------- */
const poster = (ev, big) => `<div class="poster ${big ? 'big' : ''}" style="background:linear-gradient(135deg,${esc(ev.colors[0])},${esc(ev.colors[1])})">${badge(evStatus(ev))}<span class="p-cat">${esc(ev.category || '')} · ${esc(ev.city || '')}</span><span class="p-name">${esc(ev.name)}</span></div>`;
function evCard(ev) { const p = minPrice(ev); return `<a class="card ev" href="#/e/${ev.id}">${poster(ev)}<div class="ev-b"><b>${esc(ev.slogan || ev.name)}</b><span class="sm mut">${ic('cal')} ${dFmt(ev.dates[0].start)}${ev.dates.length > 1 ? ` · ${ev.dates.length} dates` : ' · ' + hFmt(ev.dates[0].start)}</span><span class="sm mut">${ic('pin')} ${esc(ev.venue || '')}, ${esc(ev.city || '')}</span><span class="price">${p === 0 ? 'Gratuit' : 'Dès ' + money(p, ev.currency)}</span></div></a>`; }
function ring(list) {
  const l = list.filter(e => !['Terminé', 'Annulé'].includes(evStatus(e)[0])).slice(0, 8), n = l.length; if (n < 3) return '';
  return `<div class="ring" style="--n:${n};--k:${(1 / (2 * Math.tan(Math.PI / n))).toFixed(4)}" aria-label="Événements à l'affiche"><div class="ring-spin">${l.map((e, i) => `<a class="ring-card poster" href="#/e/${e.id}" style="--i:${i};background:linear-gradient(160deg,${esc(e.colors[0])},${esc(e.colors[1])})">${badge(evStatus(e))}<span class="p-cat">${esc(e.category || '')} · ${esc(e.city || '')}</span><span class="p-name">${esc(e.name)}</span><span class="ring-meta">${ic('cal')} ${dFmt(e.dates[0].start)}</span></a>`).join('')}</div></div>`;
}
const tkBadge = s => s === 'valide' ? ['Valide', 'green'] : s === 'utilise' ? ['Utilisé', 'gray'] : ['Remboursé', 'red'];
function ticketCard(k, o, actions = true) {
  return `<div class="tk ${k.status !== 'valide' ? 'used' : ''}"><div class="tk-l"><div class="row between"><span class="xs mut">BILLET D'ENTRÉE</span>${badge(tkBadge(k.status))}</div>
  <h3>${esc(o.event.name)}</h3><span class="sm">${ic('cal')} ${dFmt(o.starts_at)} · ${hFmt(o.starts_at)}</span><span class="sm">${ic('pin')} ${esc(o.event.venue || '')}, ${esc(o.event.city || '')}</span><span class="sm"><b>${esc(k.tier)}</b> · ${fmt(k.price, o.currency)}</span><span class="sm mut">Titulaire : ${esc(o.buyer_name)}</span>
  <span class="xs mut">Créé le ${dtFmt(k.created_at)}${k.scanned_at ? ' · scanné le ' + dtFmt(k.scanned_at) : ''}</span>
  ${actions ? `<div class="row noprint" style="margin-top:8px"><button class="btn s" data-a="showTicket" data-order="${o.id}" data-code="${esc(k.code)}">Afficher / Imprimer</button></div>` : ''}</div>
  <div class="tk-r">${qrSvg(k.code)}<span class="tk-code">${esc(k.code)}</span></div></div>`;
}
function modal(html) { const d = $('#dlg'); d.innerHTML = `<div class="dlg">${html}</div>`; if (!d.open) d.showModal(); }
function closeModal() { const d = $('#dlg'); if (d.open) d.close(); }
function askReason(title, cb) { askReason.cb = cb; modal(`<h2>${esc(title)}</h2><form data-f="reason" class="stack"><label class="f">Motif (obligatoire, journalisé)<textarea name="motif" required minlength="4" rows="3"></textarea></label><div class="row"><button class="btn" style="flex:1">Confirmer</button><button type="button" class="btn ghost" data-a="close">Annuler</button></div></form>`); }
const head = (t, sub) => `<div class="pagehead"><div class="wrap"><h1 style="font-size:2rem">${t}</h1><p class="mut" style="margin:0">${sub}</p></div></div>`;
const box = (t, body) => `<div class="wrap sec"><div class="empty"><h2>${t}</h2>${body}</div></div>`;
const needLogin = () => box('Connexion requise', `<p>Connectez-vous pour accéder à cette page.</p><a class="btn" href="#/connexion">Se connecter</a>`);
const denied = () => box('Accès refusé', `<p>Votre compte n'a pas accès à cet espace.</p><a class="btn" href="#/">Retour à l'accueil</a>`);

/* ---------- vues publiques ---------- */
async function vHome() {
  const D = await loadData(), cats = D.cats.filter(c => c.active && D.events.some(e => e.category === c.name));
  return `<section class="hero"><div class="wrap hero-in"><div><span class="eyebrow">Guinée · Afrique · International</span><h1>Vos événements, vos billets, <br>une seule plateforme.</h1><p class="lead">Concerts, festivals, spectacles, conférences : réservez en quelques secondes et recevez votre billet sécurisé par QR code.</p>
  <div class="search"><input id="q" data-i="q" value="${esc(UI.q)}" placeholder="Rechercher : nom, ville, mot-clé…" aria-label="Rechercher un événement"><button class="btn" data-a="goResults">Rechercher</button></div></div>${ring(D.events)}</div></section>
  <section class="sec" id="results-sec"><div class="wrap stack"><div class="row between"><h2>Découvrir les événements</h2><label class="row sm mut">Trier par <select class="in" data-i="sort" style="width:auto;margin:0"><option value="date">Date</option><option value="price">Prix</option></select></label></div>
  <div class="chips">${[['', 'Toutes les dates'], ['today', "Aujourd'hui"], ['tomorrow', 'Demain'], ['week', 'Cette semaine'], ['nextweek', 'Semaine prochaine'], ['month', 'Ce mois'], ['nextmonth', 'Mois prochain']].map(([v, l]) => `<button class="chip ${UI.when === v ? 'on' : ''}" data-a="when" data-v="${v}">${l}</button>`).join('')}</div>
  ${cats.length ? `<div class="chips"><button class="chip ${UI.cat === '' ? 'on' : ''}" data-a="cat" data-v="">Toutes catégories</button>${cats.map(c => `<button class="chip ${UI.cat === c.name ? 'on' : ''}" data-a="cat" data-v="${esc(c.name)}">${esc(c.name)}</button>`).join('')}</div>` : ''}
  <div id="results">${results()}</div></div></section>`;
}
function results() {
  if (!DATA) return '';
  const done = ev => evStatus(ev)[0] === 'Terminé' ? 1 : 0;
  const l = DATA.events.filter(e => (!UI.cat || e.category === UI.cat) && inWhen(e, UI.when) && matchQ(e, UI.q)).sort((a, b) => done(a) - done(b) || (UI.sort === 'price' ? minPrice(a) - minPrice(b) : a.dates[0].start - b.dates[0].start));
  if (!DATA.events.length) return `<div class="empty"><b>Aucun événement n'est encore publié.</b><br>Revenez bientôt, ou créez un compte organisateur pour publier le vôtre.</div>`;
  return l.length ? `<p class="sm mut">${l.length} événement${l.length > 1 ? 's' : ''}</p><div class="grid">${l.map(evCard).join('')}</div>` : `<div class="empty"><b>Aucun événement ne correspond.</b><br>Essayez un autre mot-clé, une autre date ou retirez un filtre.</div>`;
}
async function vEvent(id) {
  const D = await loadData(), ev = D.events.find(e => e.id === id); if (!ev) return vNotFound();
  const now = Date.now(), st = evStatus(ev), cur = ev.currency, up = ev.dates.filter(d => d.end > now);
  let dId = UI.selDate[id]; if (!up.some(d => d.id === dId)) dId = UI.selDate[id] = up[0]?.id;
  const d = ev.dates.find(x => x.id === dId), sel = UI.sel[dId] || (UI.sel[dId] = {}), closed = st[0] === 'Terminé' || st[0] === 'Annulé';
  let total = 0, count = 0;
  const tiers = d ? d.tiers.map(t => { const a = t.avail; if ((sel[t.id] || 0) > a) sel[t.id] = a; const q = sel[t.id] || 0; total += q * t.price; count += q; return `<div class="tier ${a === 0 ? 'out' : ''}"><div class="t-i"><b>${esc(t.name)}</b><div class="sm" style="color:var(--o-d);font-weight:700">${fmt(t.price, cur)}</div><div class="xs ${a === 0 ? '' : 'mut'}" ${a === 0 ? 'style="color:var(--red);font-weight:800"' : ''}>${a === 0 ? 'SOLD OUT — PLACES ÉPUISÉES' : a <= 10 ? `Plus que ${a} place${a > 1 ? 's' : ''} !` : num(a) + ' places disponibles'}</div></div>${a > 0 && !closed ? `<div class="step"><button data-a="qty" data-t="${t.id}" data-d="-1" ${q === 0 ? 'disabled' : ''} aria-label="Moins">−</button><span>${q}</span><button data-a="qty" data-t="${t.id}" data-d="1" ${q >= Math.min(a, 10) ? 'disabled' : ''} aria-label="Plus">+</button></div>` : ''}</div>`; }).join('') : '';
  const A = ev.artists;
  return `<div class="wrap sec"><p class="sm"><a href="#/">← Tous les événements</a></p><div class="cols"><div class="stack">${poster(ev, true)}
  <div><h2>${esc(ev.slogan || ev.name)}</h2><p>${esc(ev.description || '')}</p><div class="chips">${ev.keywords.map(k => `<span class="badge b-orange">#${esc(k)}</span>`).join(' ')}</div></div>
  <div class="facts"><div class="fact"><small>Lieu</small><b>${esc(ev.venue || '—')}</b></div><div class="fact"><small>Ville · Pays</small><b>${esc(ev.city || '')} · ${esc(ev.country || '')}</b></div><div class="fact"><small>Organisateur</small><b>${esc(ev.org_name || '—')}</b></div><div class="fact"><small>Public</small><b>${esc(ev.audience || 'Tout public')}</b></div></div>
  ${ev.access ? `<div class="note"><b>Conditions d'accès :</b> ${esc(ev.access)}</div>` : ''}
  ${A.length ? `<div><h2>Artistes et invités à l'affiche</h2><div class="artists">${A.map(a => `<div class="artist"><div class="av">${esc(initials(a.name))}</div><div><b>${esc(a.name)}</b><div class="xs" style="color:var(--o-d);font-weight:700">${esc(a.role || '')}</div></div></div>`).join('')}</div></div>` : ''}</div>
  <aside class="card pad sticky stack" id="book"><div class="row between"><h3 style="margin:0">Réserver</h3>${badge(st)}</div>
  ${st[0] === 'Terminé' ? '<p class="mut">Cet événement est terminé.</p>' : st[0] === 'Annulé' ? '<p class="mut">Cet événement a été annulé.</p>' : ''}
  ${d && !closed ? `<div><div class="sm mut" style="font-weight:650;margin-bottom:6px">1. Choisissez la date</div><div class="dates">${up.map(x => `<button class="date ${x.id === dId ? 'on' : ''}" data-a="pickDate" data-ev="${ev.id}" data-d="${x.id}"><b>${dFmt(x.start)}</b><span class="xs mut">${hFmt(x.start)}</span></button>`).join('')}</div></div>
  <div><div class="sm mut" style="font-weight:650">2. Choisissez la catégorie</div>${tiers}</div>
  ${st[0] === 'SOLD OUT' ? '<div class="soldout">SOLD OUT – PLACES ÉPUISÉES</div>' : `<div class="total"><span>Total</span><span>${count ? fmt(total, cur) : '—'}</span></div>
  ${count ? `<form class="stack" data-f="reserve" data-date="${dId}"><div class="sm mut" style="font-weight:650">3. Vos coordonnées</div><label class="f">Nom complet<input name="name" required minlength="3" autocomplete="name" value="${esc(ME?.full_name || '')}"></label><label class="f">Téléphone<input name="phone" required pattern="[+0-9 ]{8,}" inputmode="tel" autocomplete="tel" value="${esc(ME?.phone || '')}" placeholder="+224 6XX XX XX XX"></label><label class="f">E-mail<input name="email" type="email" required autocomplete="email" value="${esc(ME?.email || '')}"></label><button class="btn xl">Réserver ${count} billet${count > 1 ? 's' : ''}</button></form>` : '<button class="btn xl" disabled>Réserver</button>'}
  <p class="xs mut" style="text-align:center;margin:0">Vos places sont bloquées 30 minutes le temps du paiement.${ME ? '' : ' Aucun compte n\'est nécessaire.'}</p>`}` : ''}</aside></div></div>
  ${d && !closed && st[0] !== 'SOLD OUT' ? `<button class="btn m-cta" data-a="toBook">${ic('ticket')} Réserver · ${(p => p === 0 ? 'Gratuit' : 'dès ' + money(p, cur))(Math.min(...d.tiers.filter(t => t.avail > 0).map(t => +t.price)))}</button>` : ''}`;
}
const oStatus = s => ({ en_attente: ['En attente de paiement', 'orange'], a_verifier: ['Paiement en vérification', 'blue'], confirme: ['Confirmée', 'green'], expire: ['Expirée', 'gray'], annule: ['Annulée', 'red'], a_rembourser: ['Remboursement en cours', 'red'] }[s] || [s, 'gray']);
function orderBody(o) {
  const lines = o.items.map(l => `<div class="row between sm" style="padding:6px 0"><span>${l.qty} × ${esc(l.name)}</span><b>${fmt(l.qty * l.unit_price, o.currency)}</b></div>`).join('');
  const recap = `<div class="card pad"><div class="row between"><h3 style="margin:0">${esc(o.event.name)}</h3>${badge(oStatus(o.status))}</div><p class="sm mut">${ic('cal')} ${dFmt(o.starts_at)} · ${hFmt(o.starts_at)}<br>${ic('pin')} ${esc(o.event.venue || '')}, ${esc(o.event.city || '')}</p>${lines}<div class="total"><span>Total</span><span>${fmt(o.total, o.currency)}</span></div><p class="xs mut" style="margin:0">Commande ${esc(o.id.slice(0, 8).toUpperCase())} · ${esc(o.buyer_name)}</p></div>`;
  const manual = `<form class="stack" data-f="pay" data-order="${o.id}">
    <div class="note"><b>Envoyez ${money(o.total, o.currency)} à l'organisateur (${esc(o.event.org_name || '')}) :</b><br>${esc(o.event.payment_info || 'Contactez l\'organisateur pour les modalités de paiement.')}</div>
    <p class="sm mut" style="margin:0">Une fois le transfert effectué, indiquez la référence de la transaction. L'organisateur vérifie le paiement puis vos billets apparaissent sur cette page.</p>
    <label class="f">Moyen de paiement<select name="method"><option>Orange Money</option><option>MTN MoMo</option><option>Espèces / point de vente</option><option>Autre</option></select></label>
    <label class="f">Référence de la transaction<input name="ref" required minlength="4" placeholder="Ex. numéro de transaction reçu par SMS"></label>
    <button class="btn ${CFG.lengopay ? 'ghost' : 'xl'}">J'ai payé — envoyer pour vérification</button></form>`;
  if (o.status === 'en_attente') return `<div class="cols"><div class="card pad stack"><h2>Paiement</h2>
    ${CFG.lengopay ? `<p style="margin:0">Payez <b>${money(o.total, o.currency)}</b> en ligne par Orange Money, MTN MoMo ou carte. Vos billets sont émis automatiquement dès que le paiement est confirmé.</p>
    <button class="btn xl" data-a="lengopay" data-order="${o.id}">${ic('phone')} Payer ${money(o.total, o.currency)}</button>
    <p class="xs mut" style="margin:0;text-align:center">Paiement sécurisé par LengoPay. Vous serez redirigé puis ramené sur cette page.</p>
    ${o.pay_started ? `<div class="note">Un paiement a déjà été lancé pour cette commande. S'il a abouti, vos billets vont apparaître ici. <button class="link" data-a="refresh">Actualiser</button></div>` : ''}
    ${o.event.payment_info ? `<details><summary class="sm" style="cursor:pointer;font-weight:650;color:var(--o-d)">Autre moyen : payer directement l'organisateur</summary><div style="margin-top:14px">${manual}</div></details>` : ''}` : manual}</div>
    <aside class="stack sticky"><div class="cd" id="cdbox"><div><div class="xs" style="opacity:.8">Places bloquées pendant</div><b data-cd="${ts(o.expires_at)}">--:--</b></div><div class="sm" style="opacity:.85">Passé ce délai, les places sont remises en vente automatiquement.</div></div>${recap}<button class="link sm" data-a="cancelOrder" data-order="${o.id}">Annuler et libérer les places</button></aside></div>`;
  if (o.status === 'a_verifier') return `<div class="cols"><div class="card pad stack"><h2>${ic('clock')} Paiement en cours de vérification</h2><p>Votre référence <b>${esc(o.payment_ref || '')}</b> (${esc(o.payment_method || '')}) a été transmise à l'organisateur. Vos places restent réservées pendant la vérification.</p><p class="sm mut">Gardez le lien de cette page : vos billets s'y afficheront dès la confirmation. La page se met à jour automatiquement.</p><button class="btn ghost" data-a="refresh">Actualiser</button></div><aside>${recap}</aside></div>`;
  if (o.status === 'confirme') return `<div class="cols"><div class="stack"><div class="note">${ic('check')} Commande confirmée. Présentez le QR code à l'entrée — chaque billet n'est valable qu'une seule fois.</div>${o.tickets.map(k => ticketCard(k, o)).join('')}</div><aside>${recap}</aside></div>`;
  if (o.status === 'a_rembourser') return `<div class="cols"><div class="card pad stack"><h2>Remboursement en cours</h2><p>Votre paiement a bien été reçu, mais il est arrivé après l'expiration de la réservation et les places n'étaient plus disponibles (ou le montant ne correspondait pas). FATIGLOBAL vous rembourse : conservez le numéro de commande ci-contre.</p></div><aside>${recap}</aside></div>`;
  return `<div class="cols"><div class="card pad stack"><h2>${o.status === 'expire' ? 'Réservation expirée' : 'Commande annulée'}</h2><p class="mut">Les places ont été remises en vente.</p><a class="btn" href="#/e/${o.event.id}">Relancer une réservation</a></div><aside>${recap}</aside></div>`;
}
async function vOrder(id) {
  let o = await rpc('get_order', { p_id: id }); if (!o) return vNotFound();
  // Retour de LengoPay : on demande au serveur de vérifier le paiement (au cas où la notification tarde).
  if (CFG.lengopay && o.pay_started && ['en_attente', 'expire', 'annule'].includes(o.status)) {
    try { await fn('lengopay-pay', { action: 'check', order_id: id }); o = await rpc('get_order', { p_id: id }); } catch (e) { /* on réessaiera à l'actualisation */ }
  }
  vOrder.poll = o.status === 'a_verifier' || (o.pay_started && o.status === 'en_attente') ? id : null;
  return `<div class="wrap sec"><p class="sm"><a href="#/billets">← Mes billets</a></p>${orderBody(o)}</div>`;
}
async function vTickets() {
  const mine = ME ? await rpc('my_orders') : [], seen = new Set(mine.map(o => o.id));
  const guests = (await Promise.all(guestOrders().filter(id => !seen.has(id)).map(id => rpc('get_order', { p_id: id }).catch(() => null)))).filter(o => o && o.status !== 'annule' && o.status !== 'expire');
  const all = [...mine, ...guests].sort((a, b) => ts(b.created_at) - ts(a.created_at));
  return head('Mes billets', ME ? 'Vos commandes et billets. Un billet payé n\'est jamais supprimé.' : 'Commandes passées sur cet appareil. Créez un compte pour les retrouver partout.') + `<div class="wrap sec">${all.length ? `<div class="stack" style="max-width:720px">${all.map(o => o.status === 'confirme' ? o.tickets.map(k => ticketCard(k, o)).join('') : `<a class="card pad" href="#/commande/${o.id}" style="display:block;color:inherit"><div class="row between"><b>${esc(o.event.name)}</b>${badge(oStatus(o.status))}</div><div class="sm mut">${dFmt(o.starts_at)} · ${fmt(o.total, o.currency)} · ouvrir la commande →</div></a>`).join('')}</div>` : `<div class="empty"><b>Vous n'avez pas encore de billet.</b><br><a class="btn" style="margin-top:14px" href="#/">Découvrir les événements</a></div>`}</div>`;
}
function vAuth() {
  if (ME) return box('Vous êtes connecté', `<p>${esc(ME.email)}</p><a class="btn" href="#/compte">Mon compte</a>`);
  const up = UI.authTab === 'up';
  return `<div class="wrap sec"><div class="card pad stack" style="max-width:440px;margin:0 auto"><div class="tabs" style="margin-bottom:6px"><a href="#" data-a="authTab" data-v="in" class="${up ? '' : 'on'}">Connexion</a><a href="#" data-a="authTab" data-v="up" class="${up ? 'on' : ''}">Créer un compte</a></div>
  <form class="stack" data-f="${up ? 'signup' : 'signin'}">${up ? `<label class="f">Nom complet<input name="name" required minlength="3" autocomplete="name"></label><label class="f">Téléphone<input name="phone" required pattern="[+0-9 ]{8,}" inputmode="tel" autocomplete="tel"></label>` : ''}
  <label class="f">E-mail<input name="email" type="email" required autocomplete="email"></label><label class="f">Mot de passe<input name="password" type="password" required minlength="8" autocomplete="${up ? 'new-password' : 'current-password'}"></label>
  <button class="btn xl">${up ? 'Créer mon compte' : 'Se connecter'}</button>${up ? '<p class="xs mut" style="margin:0">Le compte est gratuit. Il n\'est pas obligatoire pour acheter un billet.</p>' : ''}</form></div></div>`;
}
const ROLE_L = { participant: 'Participant', organisateur: 'Organisateur', scanner: 'Scanner', admin: 'Administrateur général' };
function vAccount() {
  if (!ME) return needLogin();
  return head('Mon compte', esc(ME.email)) + `<div class="wrap sec"><div class="cols"><div class="card pad stack"><h2>Profil</h2><div class="facts"><div class="fact"><small>Nom</small><b>${esc(ME.full_name || '—')}</b></div><div class="fact"><small>Téléphone</small><b>${esc(ME.phone || '—')}</b></div><div class="fact"><small>Rôle</small><b>${ROLE_L[ME.role]}</b></div><div class="fact"><small>Statut</small><b>${ME.status === 'actif' ? 'Actif' : 'Suspendu'}</b></div></div><div><button class="btn ghost" data-a="signout">Se déconnecter</button></div></div>
  <div class="card pad stack"><h2>Devenir organisateur</h2>${ME.role === 'organisateur' ? `<p class="mut">Votre compte organisateur <b>${esc(ME.org_name || '')}</b> est actif.</p><a class="btn" href="#/org">Ouvrir mon espace</a>` : ME.role !== 'participant' ? '<p class="mut">Non disponible pour ce type de compte.</p>' : ME.org_requested ? `<div class="note">Votre demande pour « ${esc(ME.org_name || '')} » est en cours d'examen par la Direction.</div>` : `<p class="sm mut">Publiez vos événements et vendez vos billets. Chaque demande est validée par la Direction FATIGLOBAL.</p><form class="stack" data-f="orgRequest"><label class="f">Nom de votre organisation<input name="org" required minlength="2"></label><button class="btn">Envoyer la demande</button></form>`}</div></div></div>`;
}
const vNotFound = () => box('Page introuvable', `<a class="btn" href="#/">Retour à l'accueil</a>`);

/* ---------- organisateur ---------- */
async function vOrg() {
  if (!ME) return needLogin(); if (role() !== 'organisateur') return denied();
  const D = await rpc('org_dashboard'), ev = D.events, rev = ev.reduce((a, e) => a + +e.revenue, 0), now = Date.now();
  const st = e => e.cancelled ? ['Annulé', 'gray'] : ts(e.ends_at) < now ? ['Terminé', 'gray'] : +e.available === 0 ? ['SOLD OUT', 'red'] : ['Billetterie ouverte', 'orange'];
  return head('Tableau de bord — ' + esc(ME.org_name || ME.full_name || ''), 'Vous ne voyez que vos propres activités et données.') + `<div class="wrap sec stack">
  <div class="kpis"><div class="kpi hot"><small>Recettes billetterie</small><b>${money(rev)}</b></div><div class="kpi"><small>Billets vendus</small><b>${num(ev.reduce((a, e) => a + +e.sold, 0))}</b></div><div class="kpi"><small>Billets disponibles</small><b>${num(ev.reduce((a, e) => a + +e.available, 0))}</b></div><div class="kpi"><small>Paiements à vérifier</small><b>${D.pending.length}</b></div><div class="kpi"><small>Commission FATIGLOBAL (5 %)</small><b>${money(rev * COMM)}</b></div></div>
  <div class="card pad"><h2>Paiements à vérifier</h2>${D.pending.length ? `<div class="tw"><table><tr><th>Acheteur</th><th>Événement</th><th class="n">Billets</th><th class="n">Montant</th><th>Moyen · Référence</th><th></th></tr>${D.pending.map(o => `<tr><td><b>${esc(o.name)}</b><div class="xs mut">${esc(o.phone)} · ${dtFmt(o.created_at)}</div></td><td>${esc(o.event)}</td><td class="n">${o.n}</td><td class="n"><b>${money(o.total, o.currency)}</b></td><td>${esc(o.method || '')}<div class="tk-code">${esc(o.ref || '')}</div></td><td class="r nowrap"><button class="btn s ok" data-a="confirmOrder" data-id="${o.id}">Confirmer</button> <button class="btn s danger" data-a="rejectOrder" data-id="${o.id}">Rejeter</button></td></tr>`).join('')}</table></div><p class="xs mut">Vérifiez la référence sur votre compte Orange Money / MTN avant de confirmer : la confirmation émet les billets.</p>` : '<p class="mut sm">Aucun paiement en attente.</p>'}</div>
  <div class="card pad"><div class="row between"><h2>Mes événements</h2><a class="btn s" href="#/org/nouveau">+ Créer un événement</a></div>${ev.length ? `<div class="tw"><table><tr><th>Événement</th><th>Statut</th><th>Date</th><th class="n">Vendus</th><th class="n">Disponibles</th><th class="n">Recettes</th><th></th></tr>${ev.map(e => `<tr><td><a href="#/e/${e.id}"><b>${esc(e.name)}</b></a><div class="xs mut">${esc(e.category || '')} · ${esc(e.city || '')}</div></td><td>${badge(st(e))}</td><td class="sm nowrap">${dFmt(e.starts_at)}</td><td class="n">${num(e.sold)}</td><td class="n">${num(e.available)}</td><td class="n"><b>${money(e.revenue, e.currency)}</b></td><td class="r">${e.cancelled || ts(e.ends_at) < now ? '' : `<button class="btn s ghost" data-a="cancelEvent" data-id="${e.id}">Annuler</button>`}</td></tr>`).join('')}</table></div>` : '<p class="mut sm">Vous n\'avez pas encore d\'événement.</p>'}</div>
  <div class="cols"><div class="card pad"><h2>Billets émis</h2>${D.tickets.length ? `<div class="tw"><table><tr><th>Code</th><th>Événement</th><th>Catégorie</th><th>Titulaire</th><th>Statut</th><th></th></tr>${D.tickets.map(k => `<tr><td class="tk-code">${esc(k.code)}</td><td>${esc(k.event)}</td><td>${esc(k.tier)}</td><td>${esc(k.holder || '')}</td><td>${badge(tkBadge(k.status))}</td><td class="r">${k.status === 'valide' ? `<button class="btn s ghost" data-a="refund" data-code="${esc(k.code)}">Rembourser</button>` : ''}</td></tr>`).join('')}</table></div><p class="xs mut">Un billet n'est jamais supprimé : le remboursement est une procédure tracée qui remet la place en stock.</p>` : '<p class="mut sm">Aucun billet émis pour le moment.</p>'}</div>
  <div class="card pad stack"><h2>Scanners</h2>${D.scanners.length ? D.scanners.map(s => `<div class="row between sm" style="padding:6px 0;border-bottom:1px solid var(--line)"><span><b>${esc(s.name || s.email)}</b><br><span class="xs mut">${esc(s.email)}</span></span><span class="xs">${esc(s.event)}</span></div>`).join('') : '<p class="mut sm">Aucun scanner affecté.</p>'}
  ${ev.length ? `<form class="stack" data-f="scanner"><label class="f">E-mail du compte à affecter<input name="email" type="email" required></label><label class="f">Événement<select name="event">${ev.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label><button class="btn s">Affecter le scanner</button><p class="xs mut" style="margin:0">La personne doit d'abord créer son compte sur le site. Vous pouvez aussi scanner vous-même vos événements.</p></form>` : ''}</div></div></div>`;
}
async function vNewEvent() {
  if (!ME) return needLogin(); if (role() !== 'organisateur') return denied();
  const D = await loadData(), tm = new Date(day0() + 7 * DAY), iso = `${tm.getFullYear()}-${String(tm.getMonth() + 1).padStart(2, '0')}-${String(tm.getDate()).padStart(2, '0')}`;
  return head('Créer un événement', 'Le nombre de places est obligatoire pour chaque catégorie de billets.') + `<div class="wrap sec"><form class="card pad stack" data-f="newEvent" style="max-width:820px"><div class="g2"><label class="f">Nom de l'événement<input name="name" required minlength="3"></label><label class="f">Catégorie<select name="category" required>${D.cats.filter(c => c.active).map(c => `<option>${esc(c.name)}</option>`).join('')}</select></label>
  <label class="f">Pays<input name="country" required value="Guinée"></label><label class="f">Ville<input name="city" required value="Conakry"></label><label class="f">Lieu et adresse<input name="venue" required></label><label class="f">Slogan<input name="slogan"></label><label class="f">Date<input name="date" type="date" required value="${iso}"></label><div class="g2"><label class="f">Début<input name="time" type="time" required value="19:00"></label><label class="f">Durée (heures)<input name="dur" type="number" min="1" max="72" required value="5"></label></div></div>
  <label class="f">Description<textarea name="description" rows="3" required></textarea></label>
  <div class="g2"><label class="f">Public concerné<select name="audience"><option>Tout public</option><option>Enfant</option><option>Adolescent</option><option>Jeune</option><option>Adulte</option><option>Famille</option></select></label><label class="f">Mots-clés (séparés par des virgules)<input name="keywords" placeholder="KIF, LOVE, AFRICA"></label></div>
  <label class="f">Conditions d'accès<input name="access" placeholder="Ex. pièce d'identité exigée, ouverture des portes à 17 h"></label>
  <label class="f">${CFG.lengopay ? 'Paiement direct à l\'organisateur (facultatif, en plus du paiement en ligne)' : 'Instructions de paiement affichées à l\'acheteur'}<textarea name="payment_info" rows="2" ${CFG.lengopay ? '' : 'required'} placeholder="Ex. Orange Money : 6XX XX XX XX (Nom du compte) — MTN MoMo : 6XX XX XX XX"></textarea></label>
  <div><h3>Catégories de billets et quotas</h3>${[['Standard', 50000, 1000], ['VIP', 150000, 100], ['', '', '']].map(([n, p, q], i) => `<div class="g3" style="margin-bottom:10px"><label class="f">Catégorie<input name="tn${i}" value="${n}" ${i === 0 ? 'required' : ''}></label><label class="f">Prix (GNF, 0 = gratuit)<input name="tp${i}" type="number" min="0" step="1000" value="${p}" ${i === 0 ? 'required' : ''}></label><label class="f">Nombre de places<input name="tq${i}" type="number" min="1" value="${q}" ${i === 0 ? 'required' : ''}></label></div>`).join('')}</div>
  <label class="f">Artistes et invités (un par ligne : Nom — Rôle)<textarea name="artists" rows="3" placeholder="Nom de l'artiste — Artiste principal"></textarea></label>
  <div class="row"><button class="btn">Publier l'événement</button><a class="btn ghost" href="#/org">Annuler</a></div></form></div>`;
}

/* ---------- scanner ---------- */
function vScan() {
  if (!ME) return needLogin(); if (!['organisateur', 'scanner', 'admin'].includes(role())) return denied();
  return head('Contrôle des billets', 'Un billet ne peut être validé qu\'une seule fois.') + `<div class="wrap sec"><div class="scan stack">
  ${'BarcodeDetector' in window ? `<div class="card pad stack"><video id="cam" playsinline muted style="width:100%;border-radius:12px;background:#000;display:none"></video><button class="btn" data-a="camToggle" id="camBtn">${ic('cam')} Scanner avec la caméra</button></div>` : '<div class="note">La lecture par caméra n\'est pas disponible sur ce navigateur : saisissez le code du billet, ou utilisez Chrome sur Android.</div>'}
  <form class="row" data-f="scan"><input class="in" style="flex:1;margin:0;font-family:Consolas,monospace;text-transform:uppercase" name="code" placeholder="Code du billet (FB-…)" required autocomplete="off"><button class="btn">Valider</button></form>
  <div id="scanres"><div class="empty">Scannez un QR code ou saisissez un code de billet.</div></div></div></div>`;
}
async function doScan(raw) {
  const el = $('#scanres'); if (!el) return;
  try { const r = await rpc('scan_ticket', { p_code: raw }); el.innerHTML = `<div class="res ${r.ok ? 'ok' : 'ko'}"><big>${esc(r.title)}</big><div>${[r.at ? (r.ok ? 'Validé le ' : 'Premier scan : ') + dtFmt(r.at) : '', ...(r.lines || [])].filter(Boolean).map(esc).join('<br>')}</div></div>`; }
  catch (e) { el.innerHTML = `<div class="res ko"><big>ERREUR</big><div>${esc(e.message)}</div></div>`; }
}
function camStop() { cam.on = false; if (cam.stream) cam.stream.getTracks().forEach(t => t.stop()); cam.stream = null; }
async function camStart() {
  const v = $('#cam');
  try { cam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch (e) { return toast('Caméra inaccessible : autorisez l\'accès dans le navigateur.'); }
  v.srcObject = cam.stream; v.style.display = 'block'; await v.play(); cam.on = true; $('#camBtn').textContent = 'Arrêter la caméra';
  const det = new BarcodeDetector({ formats: ['qr_code'] });
  while (cam.on && document.body.contains(v)) {
    try { const r = await det.detect(v); if (r[0] && r[0].rawValue !== cam.last) { cam.last = r[0].rawValue; setTimeout(() => { cam.last = ''; }, 4000); await doScan(r[0].rawValue); } } catch (e) { /* image suivante */ }
    await new Promise(r => setTimeout(r, 300));
  }
  camStop();
}

/* ---------- Direction ---------- */
async function vAdmin(tab = 'vue') {
  if (!ME) return needLogin(); if (role() !== 'admin') return denied();
  const D = await rpc('admin_overview'), tabs = [['vue', 'Vue d\'ensemble'], ['comptes', 'Comptes'], ['evenements', 'Événements'], ['categories', 'Catégories'], ['journal', 'Journal d\'audit']];
  let body;
  if (tab === 'comptes') body = `<div class="card pad"><div class="tw"><table><tr><th>Compte</th><th>Organisation</th><th>Rôle</th><th>Statut</th><th></th></tr>${D.user_list.map(u => `<tr><td><b>${esc(u.full_name || '—')}</b><div class="xs mut">${esc(u.email)} · ${esc(u.phone || '')}</div></td><td>${esc(u.org_name || '')} ${u.org_requested ? badge(['Demande organisateur', 'blue']) : ''}</td><td><select class="in" style="margin:0;width:auto" id="role-${u.id}" ${u.id === ME.id ? 'disabled' : ''}>${Object.entries(ROLE_L).map(([k, l]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td><td>${badge(u.status === 'actif' ? ['Actif', 'green'] : ['Suspendu', 'red'])}</td><td class="r nowrap">${u.id === ME.id ? '<span class="xs mut">Vous</span>' : `<button class="btn s" data-a="setRole" data-id="${u.id}" data-status="${u.status}">Enregistrer le rôle</button> <button class="btn s ${u.status === 'actif' ? 'danger' : 'ok'}" data-a="setStatus" data-id="${u.id}" data-role="${u.role}" data-status="${u.status === 'actif' ? 'suspendu' : 'actif'}">${u.status === 'actif' ? 'Suspendre' : 'Réactiver'}</button>`}</td></tr>`).join('')}</table></div><p class="xs mut" style="margin-top:10px">Suspendre un organisateur masque immédiatement ses événements. Chaque action exige un motif et est journalisée.</p></div>`;
  else if (tab === 'evenements') body = `<div class="card pad">${D.event_list.length ? `<div class="tw"><table><tr><th>Événement</th><th>Organisateur</th><th>Date</th><th class="n">Billets vendus</th><th>Statut</th><th></th></tr>${D.event_list.map(e => `<tr><td><a href="#/e/${e.id}"><b>${esc(e.name)}</b></a><div class="xs mut">${esc(e.city || '')}</div></td><td>${esc(e.org_name || '')}</td><td class="sm nowrap">${e.starts_at ? dFmt(e.starts_at) : '—'}</td><td class="n">${num(e.sold)}</td><td>${badge(e.cancelled ? ['Annulé', 'gray'] : ['Publié', 'green'])}</td><td class="r">${e.cancelled ? '' : `<button class="btn s danger" data-a="cancelEvent" data-id="${e.id}">Annuler</button>`}</td></tr>`).join('')}</table></div>` : '<p class="mut sm">Aucun événement.</p>'}</div>`;
  else if (tab === 'categories') { const C = (await loadData(true)).cats; body = `<div class="card pad"><div class="tw"><table><tr><th>Ordre</th><th>Catégorie</th><th>Statut</th><th></th></tr>${C.map(c => `<tr><td>${c.position}</td><td><b>${esc(c.name)}</b></td><td>${badge(c.active ? ['Active', 'green'] : ['Inactive', 'gray'])}</td><td class="r"><button class="btn s ghost" data-a="toggleCat" data-id="${c.id}" data-on="${c.active ? 0 : 1}">${c.active ? 'Désactiver' : 'Activer'}</button></td></tr>`).join('')}</table></div><form class="row" data-f="cat" data-pos="${C.length + 1}" style="margin-top:14px"><input class="in" style="flex:1;margin:0" name="name" required minlength="2" placeholder="Nouvelle catégorie"><button class="btn s">Ajouter</button></form></div>`; }
  else if (tab === 'journal') body = `<div class="card pad">${D.audit.length ? `<div class="tw"><table><tr><th>Date et heure</th><th>Auteur</th><th>Action</th><th>Motif</th></tr>${D.audit.map(a => `<tr><td class="nowrap sm">${dtFmt(a.at)}</td><td class="sm">${esc(a.actor || 'Système')}</td><td>${esc(a.action)}</td><td class="sm mut">${esc(a.reason || '')}</td></tr>`).join('')}</table></div>` : '<p class="mut sm">Aucune opération enregistrée.</p>'}</div>`;
  else body = `<div class="kpis">${D.revenue.map(r => `<div class="kpi hot"><small>Ventes (${esc(r.currency)})</small><b>${money(r.amount, r.currency)}</b></div><div class="kpi hot"><small>Commissions 5 % (${esc(r.currency)})</small><b>${money(r.amount * COMM, r.currency)}</b></div>`).join('')}<div class="kpi"><small>Comptes</small><b>${num(D.users)}</b></div><div class="kpi"><small>Organisateurs</small><b>${num(D.organizers)}</b></div><div class="kpi"><small>Événements</small><b>${num(D.events)}</b></div><div class="kpi"><small>Billets vendus</small><b>${num(D.tickets)}</b></div><div class="kpi"><small>Paiements à vérifier</small><b>${num(D.pending)}</b></div><div class="kpi"><small>Demandes organisateur</small><b>${D.user_list.filter(u => u.org_requested).length}</b></div></div>
  ${(D.refunds || []).length ? `<div class="card pad" style="margin-top:22px"><h2>Paiements à rembourser</h2><div class="tw"><table><tr><th>Acheteur</th><th>Événement</th><th class="n">Montant</th><th>Réf. LengoPay</th></tr>${D.refunds.map(r => `<tr><td><b>${esc(r.name)}</b><div class="xs mut">${esc(r.phone)} · ${dtFmt(r.created_at)}</div></td><td>${esc(r.event)}</td><td class="n"><b>${money(r.total, r.currency)}</b></td><td class="tk-code">${esc(r.pay_id || '')}</td></tr>`).join('')}</table></div><p class="xs mut">Paiements reçus après l'expiration de la réservation, sans place disponible. Le remboursement se fait depuis votre compte LengoPay.</p></div>` : ''}`;
  return head('Direction FATIGLOBAL', 'Administration générale — supervision de toute la plateforme.') + `<div class="wrap sec"><div class="tabs">${tabs.map(([k, l]) => `<a class="${tab === k ? 'on' : ''}" href="#/admin/${k}">${l}</a>`).join('')}</div>${body}</div>`;
}

/* ---------- routeur ---------- */
function nav(p, h) {
  const l = [['#/', 'Événements', 'Événements', 'cal'], ['#/billets', 'Mes billets', 'Billets', 'ticket']];
  if (role() === 'organisateur') l.push(['#/org', 'Espace organisateur', 'Espace', 'grid']);
  if (['organisateur', 'scanner', 'admin'].includes(role())) l.push(['#/scan', 'Scanner', 'Scanner', 'cam']);
  if (role() === 'admin') l.push(['#/admin', 'Administration', 'Admin', 'shield']);
  l.push(ME ? ['#/compte', 'Mon compte', 'Compte', 'user', 'm-only'] : ['#/connexion', 'Connexion', 'Connexion', 'user', 'm-only']);
  $('#nav').innerHTML = l.map(([u, t, s, i, c]) => `<a href="${u}" class="${c || ''} ${(u === '#/' ? ['', 'e'].includes(p[0]) : u === '#/billets' ? ['billets', 'commande'].includes(p[0]) : h.startsWith(u)) ? 'on' : ''}">${ic(i)}<span class="n-full">${t}</span><span class="n-short">${s}</span></a>`).join('');
  $('#auth').innerHTML = ME ? `<a class="btn s ghost" href="#/compte">${ic('user')} ${esc((ME.full_name || ME.email || '').split(' ')[0])}</a>` : `<a class="btn s" href="#/connexion">Connexion</a>`;
}
async function render() {
  const my = ++seq, h = location.hash || '#/', p = h.slice(2).split('/'), app = $('#app');
  if (p[0] !== 'scan') camStop();
  vOrder.poll = null;
  if (!READY) { $('#nav').innerHTML = ''; app.innerHTML = box('Configuration requise', '<p>Renseignez l\'adresse du projet Supabase et la clé publique dans le fichier <b>config.js</b>, puis rechargez la page.</p>'); return; }
  nav(p, h);
  const views = { '': vHome, e: () => vEvent(p[1]), commande: () => vOrder(p[1]), billets: vTickets, connexion: vAuth, compte: vAccount, org: () => p[1] === 'nouveau' ? vNewEvent() : vOrg(), scan: vScan, admin: () => vAdmin(p[1]) };
  if (!app.dataset.v || app.dataset.v !== h) app.innerHTML = '<div class="wrap sec"><div class="empty">Chargement…</div></div>';
  let html;
  try { html = await (views[p[0]] || vNotFound)(); } catch (e) { html = box('Une erreur est survenue', `<p class="mut">${esc(e.message || '')}</p><button class="btn" data-a="refresh">Réessayer</button>`); }
  if (my !== seq) return;
  app.innerHTML = html; app.dataset.v = h;
  const s = $('[data-i="sort"]'); if (s) s.value = UI.sort;
  tick(); ctaSync();
}
function tick() {
  const el = $('[data-cd]'); if (!el) return;
  const left = +el.dataset.cd - Date.now();
  if (left <= 0) { el.removeAttribute('data-cd'); DATA = null; render(); toast('Délai de 30 minutes dépassé : les places ont été libérées.'); return; }
  el.textContent = String(Math.floor(left / 6e4)).padStart(2, '0') + ':' + String(Math.floor(left % 6e4 / 1e3)).padStart(2, '0');
  $('#cdbox').classList.toggle('warn', left < 5 * 6e4);
}

/* ---------- actions ---------- */
const A = {
  close: closeModal,
  refresh() { DATA = null; render(); },
  goResults() { $('#results-sec').scrollIntoView(); },
  toBook() { $('#book').scrollIntoView({ block: 'start', behavior: 'instant' }); ctaSync(); },
  when(el) { UI.when = el.dataset.v; render(); },
  cat(el) { UI.cat = el.dataset.v; render(); },
  authTab(el) { UI.authTab = el.dataset.v; render(); },
  pickDate(el) { UI.selDate[el.dataset.ev] = el.dataset.d; render(); },
  qty(el) { const sel = UI.sel[UI.selDate[location.hash.split('/')[2]]]; sel[el.dataset.t] = Math.max(0, (sel[el.dataset.t] || 0) + +el.dataset.d); render(); },
  cancelOrder(el) { act(async () => { await rpc('cancel_order', { p_order: el.dataset.order }); }, 'Réservation annulée, places libérées.'); },
  async showTicket(el) { try { const o = await rpc('get_order', { p_id: el.dataset.order }), k = o.tickets.find(x => x.code === el.dataset.code); modal(ticketCard(k, o, false) + `<div class="row noprint" style="margin-top:16px"><button class="btn" style="flex:1" data-a="print">Imprimer / PDF</button><button class="btn ghost" data-a="close">Fermer</button></div>`); } catch (e) { toast(e.message); } },
  print() { window.print(); },
  async lengopay(el) {
    if (el.disabled) return; el.disabled = true; el.textContent = 'Redirection vers le paiement…';
    try { const r = await fn('lengopay-pay', { action: 'create', order_id: el.dataset.order }); if (!/^https:\/\//.test(r.payment_url || '')) throw new Error('Lien de paiement invalide.'); location.href = r.payment_url; }
    catch (e) { toast(e.message); render(); }
  },
  signout() { act(async () => { await sb.auth.signOut(); ME = null; location.hash = '#/'; }, 'Vous êtes déconnecté.'); },
  confirmOrder(el) { if (el.disabled) return; el.disabled = true; act(() => rpc('confirm_order', { p_order: el.dataset.id }), 'Paiement confirmé, billets émis.'); },
  rejectOrder(el) { askReason('Rejeter ce paiement', m => act(() => rpc('reject_order', { p_order: el.dataset.id, p_reason: m }), 'Paiement rejeté, places libérées.')); },
  refund(el) { askReason('Rembourser le billet ' + el.dataset.code, m => act(() => rpc('refund_ticket', { p_code: el.dataset.code, p_reason: m }), 'Billet remboursé, place remise en vente.')); },
  cancelEvent(el) { askReason('Annuler cet événement', m => act(() => rpc('cancel_event', { p_event: el.dataset.id, p_reason: m }), 'Événement annulé.')); },
  camToggle() { if (cam.on) { camStop(); $('#cam').style.display = 'none'; $('#camBtn').textContent = 'Scanner avec la caméra'; } else camStart(); },
  setRole(el) { const r = $('#role-' + el.dataset.id).value; askReason('Changer le rôle en « ' + ROLE_L[r] + ' »', m => act(() => rpc('admin_set_user', { p_id: el.dataset.id, p_role: r, p_status: el.dataset.status, p_reason: m }), 'Rôle mis à jour.')); },
  setStatus(el) { askReason(el.dataset.status === 'suspendu' ? 'Suspendre ce compte' : 'Réactiver ce compte', m => act(() => rpc('admin_set_user', { p_id: el.dataset.id, p_role: el.dataset.role, p_status: el.dataset.status, p_reason: m }), 'Statut mis à jour.')); },
  toggleCat(el) { act(async () => { const { error } = await sb.from('categories').update({ active: el.dataset.on === '1' }).eq('id', el.dataset.id); if (error) throw new Error(error.message); }); },
};
const F = {
  async reserve(f, form) {
    const sel = UI.sel[form.dataset.date] || {}, items = Object.entries(sel).filter(([, q]) => q > 0).map(([tier_id, qty]) => ({ tier_id, qty }));
    const id = await rpc('reserve', { p_date: form.dataset.date, p_items: items, p_name: f.get('name'), p_phone: f.get('phone'), p_email: f.get('email') });
    rememberOrder(id); UI.sel[form.dataset.date] = {}; DATA = null; location.hash = '#/commande/' + id;
  },
  async pay(f, form) { await rpc('submit_payment', { p_order: form.dataset.order, p_method: f.get('method'), p_ref: f.get('ref') }); toast('Référence transmise à l\'organisateur.'); await render(); },
  async signin(f) { const { error } = await sb.auth.signInWithPassword({ email: f.get('email').trim(), password: f.get('password') }); if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou mot de passe incorrect.' : error.message === 'Email not confirmed' ? 'Confirmez d\'abord votre e-mail (lien reçu par message).' : error.message); await loadMe(); location.hash = role() === 'admin' ? '#/admin' : role() === 'organisateur' ? '#/org' : '#/'; await render(); },
  async signup(f) { const { data, error } = await sb.auth.signUp({ email: f.get('email').trim(), password: f.get('password'), options: { data: { full_name: f.get('name').trim(), phone: f.get('phone').trim() }, emailRedirectTo: location.origin + location.pathname } }); if (error) throw new Error(error.message); if (!data.session) { modal(`<h2>Vérifiez votre boîte mail</h2><p>Un lien de confirmation a été envoyé à <b>${esc(f.get('email'))}</b>. Cliquez dessus pour activer votre compte.</p><button class="btn" data-a="close">Compris</button>`); return; } await loadMe(); location.hash = '#/compte'; await render(); toast('Bienvenue sur FatiBillets !'); },
  async orgRequest(f) { await rpc('request_organizer', { p_org_name: f.get('org') }); await loadMe(); toast('Demande envoyée à la Direction.'); await render(); },
  async reason(f) { closeModal(); await askReason.cb(f.get('motif').trim()); },
  async scan(f, form) { await doScan(f.get('code')); form.reset(); form.code.focus(); },
  async scanner(f) { await rpc('assign_scanner', { p_email: f.get('email'), p_event: f.get('event') }); toast('Scanner affecté.'); await render(); },
  async cat(f, form) { const { error } = await sb.from('categories').insert({ name: f.get('name').trim(), position: +form.dataset.pos }); if (error) throw new Error(error.message); DATA = null; await render(); },
  async newEvent(f) {
    const start = new Date(f.get('date') + 'T' + f.get('time')), tiers = [], pal = [['#FF8A1F', '#C2185B'], ['#F59E0B', '#D4500A'], ['#EA580C', '#7C2D12'], ['#B45309', '#E11D48'], ['#FB923C', '#9A3412'], ['#F97316', '#4C1D95']];
    for (let i = 0; i < 3; i++) { const n = f.get('tn' + i).trim(), q = +f.get('tq' + i); if (n && q > 0) tiers.push({ name: n, price: +f.get('tp' + i) || 0, quota: q }); }
    if (!tiers.length) throw new Error('Ajoutez au moins une catégorie avec un nombre de places.');
    const c = pal[Math.floor(Math.random() * pal.length)];
    const id = await rpc('create_event', { p: { name: f.get('name'), slogan: f.get('slogan').trim(), description: f.get('description').trim(), category: f.get('category'), country: f.get('country').trim(), city: f.get('city').trim(), venue: f.get('venue').trim(), audience: f.get('audience'), access: f.get('access').trim(), payment_info: f.get('payment_info').trim(), keywords: f.get('keywords').split(',').map(s => s.trim()).filter(Boolean), artists: f.get('artists').split('\n').map(l => l.split(/\s+[—-]\s+/)).filter(a => a[0].trim()).map(a => ({ name: a[0].trim(), role: (a[1] || 'Invité').trim() })), color1: c[0], color2: c[1], starts_at: start.toISOString(), ends_at: new Date(+start + +f.get('dur') * 36e5).toISOString(), tiers } });
    DATA = null; toast('Événement publié.'); location.hash = '#/e/' + id;
  },
};
const I = { q(v) { UI.q = v; $('#results').innerHTML = results(); }, sort(v) { UI.sort = v; $('#results').innerHTML = results(); } };
document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (el && A[el.dataset.a]) { e.preventDefault(); A[el.dataset.a](el); } });
document.addEventListener('submit', async e => {
  const form = e.target.closest('[data-f]'); if (!form || !F[form.dataset.f]) return; e.preventDefault();
  const b = form.querySelector('button:not([type="button"])'); if (b && b.disabled) return; if (b) b.disabled = true;
  try { await F[form.dataset.f](new FormData(form), form); } catch (err) { toast(err.message || 'Une erreur est survenue.'); }
  if (b && document.body.contains(b)) b.disabled = false;
});
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.i; if (k && I[k]) I[k](e.target.value); });
$('#dlg').addEventListener('click', e => { if (e.target.id === 'dlg') closeModal(); });
addEventListener('hashchange', () => { closeModal(); render(); scrollTo(0, 0); });
// Sur mobile, le bouton flottant « Réserver » disparaît dès que le bloc de réservation est à l'écran.
function ctaSync() { const c = $('.m-cta'), b = $('#book'); if (c && b) c.classList.toggle('hide', b.getBoundingClientRect().top < innerHeight - 140); }
document.addEventListener('scroll', ctaSync, { passive: true, capture: true });
setInterval(ctaSync, 500);
setInterval(tick, 1000);
setInterval(() => { if (vOrder.poll && !document.hidden) render(); }, 15000);
(async () => {
  if (READY) { try { await loadMe(); } catch (e) { ME = null; } sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { ME = null; render(); } }); }
  render();
})();
