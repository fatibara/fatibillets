'use strict';
/* FatiBillets — v20 : annonces glissantes sur mobile, application installable (invitation régulière mais discrète),
   FATI-TRANSPORT complété côté voyageur : prochains départs, lignes populaires, compagnies et leur page,
   comment ça marche, devenir transporteur partenaire, transport vers un événement.
   Chargé après modules14.js. */

/* =====================================================================
   1. ANNONCES : CARROUSEL GLISSANT SUR MOBILE (les cartes 3D de l'accueil ne changent pas)
   ===================================================================== */
const SWIPE_MQ = matchMedia('(max-width:720px)');
function swipeEnhance() {
  document.querySelectorAll('#app .grid').forEach(g => {
    const n = g.querySelectorAll(':scope > .ev').length, nav = g.nextElementSibling && g.nextElementSibling.classList.contains('sw-nav') ? g.nextElementSibling : null;
    const on = n >= 2;
    g.classList.toggle('swipe', on);
    if (!on) { if (nav) nav.remove(); return; }
    if (!nav) {
      g.insertAdjacentHTML('afterend', `<div class="sw-nav"><button type="button" class="sw-b" data-sw="-1" aria-label="Précédent">‹</button><span class="sw-c"></span><button type="button" class="sw-b" data-sw="1" aria-label="Suivant">›</button></div>`);
      g.addEventListener('scroll', () => swipeCount(g), { passive: true });
    }
    swipeCount(g);
  });
}
function swipeCount(g) {
  const nav = g.nextElementSibling; if (!nav || !nav.classList.contains('sw-nav')) return;
  const cards = g.querySelectorAll(':scope > .ev'), w = cards[0] ? cards[0].getBoundingClientRect().width + 12 : 1;
  const i = Math.min(cards.length, Math.round(g.scrollLeft / w) + 1);
  nav.querySelector('.sw-c').textContent = i + ' / ' + cards.length + ' · glissez';
  nav.querySelector('[data-sw="-1"]').disabled = g.scrollLeft < 8;
  nav.querySelector('[data-sw="1"]').disabled = g.scrollLeft + g.clientWidth >= g.scrollWidth - 8;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-sw]'); if (!b) return;
  const g = b.closest('.sw-nav').previousElementSibling, c = g && g.querySelector(':scope > .ev');
  if (c) g.scrollBy({ left: +b.dataset.sw * (c.getBoundingClientRect().width + 12), behavior: 'smooth' });
});
let swT = null;
new MutationObserver(() => { clearTimeout(swT); swT = setTimeout(swipeEnhance, 60); }).observe($('#app'), { childList: true, subtree: true });
SWIPE_MQ.addEventListener && SWIPE_MQ.addEventListener('change', swipeEnhance);

/* =====================================================================
   2. APPLICATION INSTALLABLE
   ===================================================================== */
const INST = { evt: null, key: 'fatibillets-install' };
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
function instState() { try { return JSON.parse(localStorage.getItem(INST.key)) || {}; } catch (e) { return {}; } }
function instSave(s) { try { localStorage.setItem(INST.key, JSON.stringify(s)); } catch (e) { /* stockage indisponible */ } }
if ('serviceWorker' in navigator && location.protocol === 'https:') addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* pas d'installation possible */ }));
addEventListener('beforeinstallprompt', e => { e.preventDefault(); INST.evt = e; instPlan(); });
addEventListener('appinstalled', () => { instSave({ ...instState(), installed: true }); instHide(); toast('FatiBillets est installée sur votre téléphone.'); });
// L'invitation revient régulièrement (1 jour, puis 3, puis 7 jours après chaque « Plus tard »), jamais pendant un paiement ou un scan.
function instPlan() {
  clearTimeout(INST.t);
  if (standalone() || $('#inst')) return;
  const s = instState(); if (s.installed) return;
  if (!INST.evt && !isIOS()) return;
  const wait = [0, 1, 3, 7][Math.min(s.n || 0, 3)] * 864e5;
  if (s.at && Date.now() - s.at < wait) return;
  INST.t = setTimeout(() => {
    if (/^#\/(paiement|commande|controle|scan|vente)/.test(location.hash) || ($('#dlg') && $('#dlg').open) || $('#inst')) return instPlan();
    document.body.insertAdjacentHTML('beforeend', `<div id="inst" class="inst" role="dialog" aria-label="Installer l'application"><img src="icon-192.png" alt="" width="46" height="46"><div class="inst-t"><b>Installez l'application FatiBillets</b><span>${INST.evt ? 'Vos billets toujours à portée de main, même sans connexion. Gratuit et léger.' : 'Touchez <b>Partager</b> <span class="inst-sh">⎙</span> puis <b>« Sur l\'écran d\'accueil »</b>.'}</span></div><div class="inst-a">${INST.evt ? '<button class="btn s" data-a="instGo">Installer</button>' : ''}<button class="btn s ghost" data-a="instLater">Plus tard</button></div></div>`);
    requestAnimationFrame(() => { const el = $('#inst'); if (el) el.classList.add('on'); });
  }, 12000);
}
function instHide() { const el = $('#inst'); if (el) { el.classList.remove('on'); setTimeout(() => el.remove(), 300); } }
Object.assign(A, {
  async instGo() {
    if (!INST.evt) return instHide();
    INST.evt.prompt(); const r = await INST.evt.userChoice.catch(() => ({})); INST.evt = null; instHide();
    if (r && r.outcome === 'accepted') instSave({ ...instState(), installed: true }); else A.instLater();
  },
  instLater() { const s = instState(); instSave({ ...s, at: Date.now(), n: (s.n || 0) + 1 }); instHide(); },
  instNow() { if (INST.evt) return A.instGo(); if (isIOS()) return modal('<h2>Installer FatiBillets</h2><p>Dans Safari, touchez <b>Partager</b> (le carré avec une flèche), puis <b>« Sur l\'écran d\'accueil »</b>.</p><button class="btn" data-a="close">Compris</button>'); modal('<h2>Installer FatiBillets</h2><p>Ouvrez le menu de votre navigateur (⋮) puis choisissez <b>« Installer l\'application »</b> ou <b>« Ajouter à l\'écran d\'accueil »</b>.</p><button class="btn" data-a="close">Compris</button>'); },
});
if (isIOS()) setTimeout(instPlan, 0);
// Lien permanent dans le pied de page.
const _foot15 = $('.foot-links'); if (_foot15 && !standalone()) _foot15.insertAdjacentHTML('afterbegin', '<a href="#" data-a="instNow">📲 Installer l\'application</a>');

/* =====================================================================
   3. FATI-TRANSPORT CÔTÉ VOYAGEUR
   ===================================================================== */
const TR15 = { carriers: null, at: 0 };
async function trCarriers() {
  if (TR15.carriers && Date.now() - TR15.at < 3e5) return TR15.carriers;
  try { TR15.carriers = await q(sb.from('carriers').select('id,name,kind,logo_url,description,phone,email').eq('status', 'actif').order('kind').order('name')); } catch (e) { TR15.carriers = []; }
  TR15.at = Date.now(); return TR15.carriers;
}
async function trUpcoming(from, to, limit = 12) {
  let qy = sb.from('trips').select(TRIP_SEL).eq('status', 'programme').gt('departs_at', new Date(Date.now() + 15 * 6e4).toISOString()).lt('departs_at', new Date(Date.now() + 30 * DAY).toISOString()).order('departs_at');
  if (from) qy = qy.ilike('from_city', from.trim()); if (to) qy = qy.ilike('to_city', to.trim());
  try { return await q(qy.limit(limit)); } catch (e) { return []; }
}
const carLogo = c => safeUrl(c && c.logo_url) ? `<img src="${esc(c.logo_url)}" alt="" class="car-logo">` : `<span class="car-logo ph">${esc(initials((c && c.name) || '?'))}</span>`;
const miniTrip = t => `<button type="button" class="card mini-trip" data-a="trGo" data-id="${t.id}" data-from="${esc(t.from_city)}" data-to="${esc(t.to_city)}" data-day="${isoDay(t.departs_at)}"><span class="mt-d"><b>${hFmt(t.departs_at)}</b><small>${dFmt(t.departs_at)}</small></span><span class="mt-m"><b>${esc(t.from_city)} → ${esc(t.to_city)}</b><small>${esc(t.carrier?.name || '')} · ${VT[t.vehicle?.type] || ''}</small></span><span class="mt-p">${fmt(t.price, t.currency)}</span></button>`;

const _tr15 = VIEWS.transport;
VIEWS.transport = async p => {
  let h = await _tr15(p); const T = UI.tr;
  if (T.pick) return h;
  const [C, U] = await Promise.all([trCarriers(), trUpcoming(T.step === 'ret' ? T.to : T.from, '', 40)]);
  // Aucun départ ce jour-là : on propose aussitôt les prochains départs disponibles.
  if (h.includes('Aucun départ trouvé.')) {
    const next = (await trUpcoming(T.step === 'ret' ? T.to : T.from, T.step === 'ret' ? T.from : T.to, 8));
    h = h.replace(/<div class="empty"><b>Aucun départ trouvé\.<\/b>[\s\S]*?<\/div>/, `<div class="empty"><b>Aucun départ ce jour-là.</b><br>${next.length ? 'Voici les prochains départs disponibles :' : 'Aucun départ programmé prochainement sur ce trajet. Essayez une autre destination.'}</div>${next.length ? `<div class="mini-trips">${next.map(miniTrip).join('')}</div>` : ''}`);
  }
  const pairs = {}; U.forEach(t => { const k = t.from_city + '|' + t.to_city; (pairs[k] = pairs[k] || { from: t.from_city, to: t.to_city, n: 0, min: Infinity, cur: t.currency }); pairs[k].n++; pairs[k].min = Math.min(pairs[k].min, +t.price); });
  const pop = Object.values(pairs).sort((a, b) => b.n - a.n).slice(0, 8);
  const popH = pop.length ? pop.map(x => `<button type="button" class="route" data-a="trRoute" data-from="${esc(x.from)}" data-to="${esc(x.to)}"><b>${esc(x.from)} → ${esc(x.to)}</b><small>${x.n} départ(s) · dès ${fmt(x.min, x.cur)}</small></button>`).join('')
    : LINE_EX.map(([a, b]) => `<button type="button" class="route" data-a="trRoute" data-from="${a}" data-to="${b}"><b>${a} → ${b}</b><small>Voir les départs</small></button>`).join('');
  const extra = `<div class="wrap sec stack tr-extra">
    <div><h2>Lignes populaires</h2><div class="routes">${popH}</div></div>
    ${U.length ? `<div><div class="row between"><h2 style="margin:0">Prochains départs${T.from ? ' depuis ' + esc(T.step === 'ret' ? T.to : T.from) : ''}</h2></div><div class="mini-trips" style="margin-top:12px">${U.slice(0, 6).map(miniTrip).join('')}</div></div>` : ''}
    <div class="tr-svc">${[['bus', 'Voyages entre villes', 'Bus, minibus, taxis collectifs et bateaux, avec choix du siège.', '#/transport'], ['box', 'Envoi de colis', 'Suivez votre colis avec son code et votre téléphone.', '#/colis'], ['cal', 'Transport vers les événements', 'Allez au concert ou au festival en toute sécurité.', '#/'], ['ticket', 'Mes billets de transport', 'Retrouvez vos billets à QR code.', '#/billets']].map(([i, t, s, u]) => `<a class="card pad tr-s" href="${u}"><span class="ic-box">${ic(i)}</span><b>${t}</b><span class="sm mut">${s}</span></a>`).join('')}</div>
    ${C.length ? `<div><h2>Nos compagnies de transport</h2><div class="cars">${C.map(c => `<a class="card car" href="#/compagnie/${c.id}">${carLogo(c)}<span><b>${esc(c.name)}</b>${c.kind === 'fatiglobal' ? badge(['Flotte FATIGLOBAL', 'orange']) : badge(['Partenaire', 'gray'])}<small class="mut">${esc((c.description || 'Voir les lignes et les départs').slice(0, 90))}</small></span></a>`).join('')}</div></div>` : ''}
    <div class="card pad"><h2>Comment ça marche ?</h2><div class="steps4">${[['1', 'Cherchez', 'Choisissez la ville de départ, la destination et la date.'], ['2', 'Choisissez votre siège', 'Sur le plan du véhicule, en temps réel.'], ['3', 'Payez en ligne', 'Orange Money, MTN MoMo ou carte, en toute sécurité.'], ['4', 'Embarquez', 'Présentez votre billet à QR code à l\'agent.']].map(([n, t, s]) => `<div><span class="ev-n">${n}</span><b>${t}</b><span class="sm mut">${s}</span></div>`).join('')}</div></div>
    <div class="card pad tr-partner"><div><h2 style="margin:0">Vous êtes une compagnie de transport ?</h2><p class="sm" style="margin:6px 0 0">Vendez vos billets en ligne, gérez vos départs, vos véhicules, vos chauffeurs et contrôlez l'embarquement avec FATI-TRANSPORT SCANNER.</p></div><a class="btn" href="${ME ? '#/compte' : '#/connexion/transport'}">Devenir partenaire</a></div>
  </div>`;
  return h + extra;
};

/* ---------- page d'une compagnie ---------- */
VIEWS.compagnie = async p => {
  let c = null; try { c = await q(sb.from('carriers').select('id,name,kind,logo_url,description,phone,email').eq('id', p[1]).maybeSingle()); } catch (e) { /* introuvable */ }
  if (!c) return box('Compagnie introuvable', '<p class="mut">Cette compagnie n\'existe pas ou n\'est plus active.</p><a class="btn" href="#/transport">Fati-Transport</a>');
  const [L, U, S] = await Promise.all([
    q(sb.from('transport_lines').select('*').eq('carrier_id', c.id).eq('active', true).order('from_city')).catch(() => []),
    q(sb.from('trips').select(TRIP_SEL).eq('carrier_id', c.id).eq('status', 'programme').gt('departs_at', new Date(Date.now() + 15 * 6e4).toISOString()).order('departs_at').limit(30)).catch(() => []),
    q(sb.from('stations').select('city,name,address,kind').eq('carrier_id', c.id).eq('active', true).order('city')).catch(() => []),
  ]);
  return `<section class="pagehead"><div class="wrap car-head">${carLogo(c)}<div><h1 style="margin:0">${esc(c.name)}</h1><div class="row" style="gap:6px;margin-top:6px">${c.kind === 'fatiglobal' ? badge(['Flotte FATIGLOBAL', 'orange']) : badge(['Transporteur partenaire', 'gray'])}${c.phone ? `<a class="badge b-gray" href="tel:${esc(c.phone)}">${ic('phone')} ${esc(c.phone)}</a>` : ''}</div></div></div></section>
  <div class="wrap sec stack">${c.description ? `<p style="margin:0;max-width:760px">${esc(c.description)}</p>` : ''}
  ${L.length ? `<div><h2>Lignes</h2><div class="routes">${L.map(l => `<button type="button" class="route" data-a="trRoute" data-from="${esc(l.from_city)}" data-to="${esc(l.to_city)}"><b>${esc(l.from_city)} → ${esc(l.to_city)}</b><small>${[(l.stops || []).length ? 'via ' + l.stops.join(', ') : '', l.duration_min ? Math.floor(l.duration_min / 60) + ' h ' + String(l.duration_min % 60).padStart(2, '0') : '', l.price != null ? fmt(l.price) : ''].filter(Boolean).map(esc).join(' · ')}</small></button>`).join('')}</div></div>` : ''}
  <div><h2>Prochains départs</h2>${U.length ? `<div class="mini-trips">${U.map(miniTrip).join('')}</div>` : '<p class="sm mut">Aucun départ programmé pour le moment.</p>'}</div>
  ${S.length ? `<div><h2>Gares et points d'embarquement</h2><div class="cars">${S.map(s => `<div class="card car">${`<span class="car-logo ph">${ic('pin')}</span>`}<span><b>${esc(s.city)} — ${esc(s.name)}</b><small class="mut">${esc(s.address || '')}</small></span></div>`).join('')}</div></div>` : ''}
  <div><a class="btn ghost" href="#/transport">← Tous les transports</a></div></div>`;
};

/* ---------- transport vers un événement ---------- */
const _ev15 = VIEWS.e;
VIEWS.e = async p => {
  const h = await _ev15(p); let T = [];
  try { T = await q(sb.from('trips').select(TRIP_SEL).eq('event_id', p[1]).eq('status', 'programme').gt('departs_at', new Date().toISOString()).order('departs_at').limit(12)); } catch (e) { return h; }
  if (!T.length) return h;
  return h + `<div class="wrap sec"><div class="card pad stack"><h2 style="margin:0">${ic('bus')} Se rendre à l'événement avec Fati-Transport</h2><p class="sm mut" style="margin:0">Réservez votre place dans un véhicule qui vous dépose sur le lieu de l'événement.</p><div class="mini-trips">${T.map(miniTrip).join('')}</div></div></div>`;
};

Object.assign(A, {
  trGo(el) { Object.assign(UI.tr, { from: el.dataset.from, to: el.dataset.to, date: el.dataset.day, back: '', step: 'out', legs: [], pick: el.dataset.id, seats: [], pass: [] }); if (location.hash === '#/transport') render().then(() => scrollTo(0, 0)); else location.hash = '#/transport'; },
  trRoute(el) { Object.assign(UI.tr, { from: el.dataset.from, to: el.dataset.to, back: '', step: 'out', legs: [], pick: null }); if (location.hash === '#/transport') render().then(() => scrollTo(0, 0)); else location.hash = '#/transport'; },
});
Object.assign(EN, { 'Lignes populaires': 'Popular routes', 'Nos compagnies de transport': 'Our transport companies', 'Comment ça marche ?': 'How it works', 'Prochains départs': 'Next departures', 'Devenir partenaire': 'Become a partner', 'Installer': 'Install', 'Plus tard': 'Later' });

boot();
