'use strict';
/* FatiBillets — FATI-TRANSPORT SCANNER (cahier des charges v1.0).
   Écran de contrôle (#/controle) pour la compagnie, les responsables de gare, les agents et les chauffeurs :
   départ contrôlé, bouton SCANNER UN BILLET, compteurs, raison claire de chaque refus, fiche du passager,
   mode hors connexion avec synchronisation. Espace transporteur : suivi en temps réel, départs (statuts, retards,
   véhicule), lignes, fiches véhicules et chauffeurs, agents et appareils, historique des scans.
   Direction : supervision des compagnies, des agents et des anomalies.
   Chargé après modules13.js ; nécessite la base v16 et la fonction serveur carrier-agent. */

/* ---------- références ---------- */
const TST = { programme: ['Programmé', 'blue'], embarquement: ['Embarquement', 'orange'], en_route: ['En route', 'green'], suspendu: ['Suspendu', 'red'], termine: ['Clôturé', 'gray'], annule: ['Annulé', 'red'] };
const VST = { disponible: ['Disponible', 'green'], affecte: ['Affecté', 'blue'], en_route: ['En route', 'green'], embarquement: ['En embarquement', 'orange'], maintenance: ['En maintenance', 'orange'], hors_service: ['Hors service', 'red'] };
const BST = { confirme: 'Valide', embarque: 'Embarqué', annule: 'Annulé', rembourse: 'Remboursé', en_attente: 'Non payé', non_paye: 'Non payé' };
const ACC_L = { owner: 'Responsable de compagnie', responsable: 'Responsable de gare', agent: 'Agent de contrôle', driver: 'Chauffeur', admin: 'Administrateur FATIGLOBAL' };
const FRAUD = ['DEJA_UTILISE', 'INCONNU', 'AUTRE_COMPAGNIE', 'APPAREIL_NON_AUTORISE', 'AGENT_NON_AUTORISE'];
const LINE_EX = [['Conakry', 'Kindia'], ['Conakry', 'Mamou'], ['Conakry', 'Labé'], ['Conakry', 'Kankan'], ['Conakry', 'Boké'], ['Conakry', 'Faranah']];
const ls14 = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
  keys(pre) { try { return Object.keys(localStorage).filter(k => k.startsWith(pre)); } catch (e) { return []; } },
};
function devId() { let d = ls14.get('fatibillets-device', null); if (!d) { d = 'APP-' + Math.random().toString(16).slice(2, 10).toUpperCase(); ls14.set('fatibillets-device', d); } return d; }
const netErr = e => /fetch|network|load failed|internet|timeout|offline/i.test(String((e && e.message) || e));
const tBadge = t => badge(TST[t.status] || [t.status, 'gray']) + (+t.delay_min ? ' ' + badge(['Retard ' + t.delay_min + ' min', 'orange']) : '');
const tWhen = t => `${dFmt(t.departs_at)} ${hFmt(t.departs_at)}`;
const v16Err = e => `<div class="card pad"><h2>Fonction indisponible</h2><p class="mut">${esc(e.message)}</p><p class="sm">Si le message parle d'une fonction introuvable, la base <b>v16</b> (supabase/schema_v16.sql) n'est pas encore installée.</p></div>`;
const carShell = (C, tab, body) => head(esc(C.name), (C.kind === 'fatiglobal' ? 'Flotte FATIGLOBAL' : 'Transporteur partenaire') + (C.status === 'suspendu' ? ' · ESPACE SUSPENDU PAR FATIGLOBAL' : '')) + `<div class="wrap" style="padding-top:18px"><div class="tabs admin-tabs">${CAR_TABS.map(([k, l]) => `<a class="${tab === k ? 'on' : ''}" href="#/transporteur${k ? '/' + k : ''}">${l}</a>`).join('')}</div></div><div class="wrap sec" style="padding-top:8px">${body}</div>`;
const opt14 = (L, sel, lab, val = x => x.id) => L.map(x => `<option value="${esc(val(x))}" ${sel != null && String(sel) === String(val(x)) ? 'selected' : ''}>${esc(lab(x))}</option>`).join('');

/* =====================================================================
   1. AGENT CONNECTÉ, MENU ET NAVIGATION
   ===================================================================== */
const AG14 = { uid: undefined, v: null };
async function agentSync() {
  const uid = ME ? ME.id : null; if (AG14.uid === uid) return;
  AG14.uid = uid; AG14.v = null;
  if (ME && role() === 'scanner') { try { AG14.v = await rpc2('agent_home'); } catch (e) { AG14.v = null; } }
}
const _nav14 = nav;
nav = function (p, h) {
  _nav14(p, h);
  if (!(['transporteur', 'chauffeur'].includes(role()) || (AG14.v && AG14.v.active))) return;
  const n = $('#nav'); if (!n || n.querySelector('a[href="#/controle"]')) return;
  const a = `<a href="#/controle" class="${p[0] === 'controle' ? 'on' : ''}">${ic('cam')}<span class="n-full">Contrôle transport</span><span class="n-short">Contrôle</span></a>`;
  const acct = n.querySelector('a.m-only'); if (acct) acct.insertAdjacentHTML('beforebegin', a); else n.insertAdjacentHTML('beforeend', a);
};
const _render14 = render;
render = async function () {
  if (!(location.hash || '').startsWith('#/controle')) tcamStop();
  await agentSync();
  // Un compte d'agent de contrôle arrive directement sur l'écran de contrôle.
  if (AG14.v && AG14.v.active && /^(#\/?)?$/.test(location.hash || '')) { location.hash = '#/controle'; return; }
  return _render14.apply(this, arguments);
};

/* =====================================================================
   2. ÉCRAN DE CONTRÔLE (#/controle)
   ===================================================================== */
const CT = { busy: false, alerts: [], seats: 0 };
const tcam = { on: false, stream: null, last: '' };
function tcamStop() {
  tcam.on = false; if (tcam.stream) tcam.stream.getTracks().forEach(t => t.stop()); tcam.stream = null;
  const v = $('#tcam'); if (v) v.style.display = 'none'; const b = $('#tcamBtn'); if (b) b.innerHTML = ic('cam') + ' SCANNER UN BILLET';
}
async function tcamStart() {
  if (!('BarcodeDetector' in window)) { toast('La caméra n\'est pas disponible sur ce navigateur : saisissez le code du billet, ou utilisez Chrome sur Android.'); const i = $('#ctCode'); if (i) i.focus(); return; }
  const v = $('#tcam'); if (!v) return;
  try { tcam.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch (e) { return toast('Caméra inaccessible : autorisez l\'accès dans le navigateur.'); }
  v.srcObject = tcam.stream; v.style.display = 'block'; await v.play(); tcam.on = true; $('#tcamBtn').innerHTML = ic('cam') + ' Arrêter la caméra';
  const det = new BarcodeDetector({ formats: ['qr_code'] });
  while (tcam.on && document.body.contains(v)) {
    try { const r = await det.detect(v); if (r[0] && r[0].rawValue !== tcam.last) { tcam.last = r[0].rawValue; setTimeout(() => { tcam.last = ''; }, 4000); await ctScan(r[0].rawValue); } } catch (e) { /* image suivante */ }
    await new Promise(r => setTimeout(r, 300));
  }
  tcamStop();
}
function ctNet(on) {
  const el = $('#ctNet'); if (!el) return; const ok = on == null ? navigator.onLine !== false : on;
  el.className = 'ct-net ' + (ok ? 'on' : 'off'); el.textContent = ok ? '● En ligne' : '● Hors connexion';
  const q = ctQueued(), qe = $('#ctQueue'); if (qe) qe.textContent = q ? q + ' scan(s) hors connexion à synchroniser' : 'Aucun scan en attente de synchronisation';
}
const ctQueued = () => ls14.keys('ct-q-').reduce((a, k) => a + (ls14.get(k, []) || []).length, 0);
function ctCounts(c) {
  if (!c) return; const set = (id, v) => { const e = $('#' + id); if (e) e.textContent = v; };
  set('ctV', num(c.validated || 0)); set('ctB', num(c.boarded || 0) + ' / ' + num(CT.seats || (c.boarded + c.free) || 0)); set('ctR', num(c.refused || 0)); set('ctF', num(c.free != null ? c.free : 0)); set('ctNB', num(c.not_boarded || 0));
}
function ctHist(e) { const H = ls14.get('ct-hist', []); H.unshift(e); ls14.set('ct-hist', H.slice(0, 300)); }
function ctShow(r) {
  const el = $('#ctRes'); if (!el) return; const i = r.info || {};
  const det = i.passenger ? `<div class="ct-pass">${[['Passager', esc(i.passenger)], ['N° de billet', `<span class="tk-code">${esc(i.code || '')}</span>`], ['N° de réservation', esc(i.booking || '—')], ['Départ', esc(i.from || '') + (i.from_station ? '<br><span class="xs mut">' + esc(i.from_station) + '</span>' : '')], ['Destination', esc(i.to || '')], ['Date et heure', i.departs_at ? tWhen(i) : '—'], ['Compagnie', esc(i.carrier || '')], ['Véhicule', esc(i.vehicle || '')], ['Place', i.seat ? 'Siège ' + i.seat : '—'], ['Type de billet', esc((TK[i.kind] || 'Voyage') + (i.channel === 'guichet' ? ' · guichet' : ' · en ligne'))], ['Statut du billet', esc(BST[i.status] || i.status || '')]].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>` : '';
  el.innerHTML = `<div class="ct-res ${r.ok ? 'ok' : 'ko'}"><big>${r.ok ? '✓' : '✕'} ${esc(r.title || '')}</big><p>${r.ok ? 'Le passager peut embarquer.' : 'Le passager ne peut pas embarquer.'}${r.offline ? (r.ok ? ' <b>Contrôle hors connexion : sera vérifié à la synchronisation.</b>' : ' <b>(contrôle hors connexion)</b>') : ''}</p>${r.prev_at ? `<p class="sm">Déjà utilisé le ${dtFmt(r.prev_at)}${r.prev_by ? ' par ' + esc(r.prev_by) : ''}.</p>` : ''}${(r.lines || []).map(l => `<p class="sm">${esc(l)}</p>`).join('')}${det}</div>`;
  beep(!!r.ok); if (navigator.vibrate) navigator.vibrate(r.ok ? 90 : [150, 70, 150]);
  if (r.counts) ctCounts(r.counts);
  if (r.ok && i.code) { const row = $('#ctp-' + i.code); if (row) row.lastElementChild.innerHTML = badge(['Embarqué', 'gray']); }
  if (!r.ok) {
    CT.alerts.unshift({ at: Date.now(), title: r.title, code: i.code || r.code || '', offline: !!r.offline });
    const a = $('#ctAlerts'); if (a) a.innerHTML = CT.alerts.slice(0, 8).map(x => `<div class="ct-alert"><b>${esc(x.title)}</b> <span class="xs mut">${hFmt(x.at)}${x.code ? ' · ' + esc(x.code) : ''}${x.offline ? ' · hors connexion' : ''}</span></div>`).join('');
  }
}
// Contrôle local quand Internet est coupé : liste téléchargée du départ.
function ctLocal(code) {
  const id = UI.ctTrip, man = ls14.get('ct-man-' + id, null);
  if (!man) return { ok: false, offline: true, code, title: 'PROBLÈME DE SYNCHRONISATION', lines: ['Pas de connexion Internet et les billets de ce départ n\'ont pas été téléchargés.'] };
  const b = (man.bookings || []).find(x => x.code === code), I0 = man.info || {};
  const info = b ? { passenger: b.name, code: b.code, seat: b.seat, from: I0.from, to: I0.to, departs_at: I0.departs_at, carrier: I0.carrier, vehicle: I0.vehicle, kind: I0.kind, channel: b.channel, status: b.status } : {};
  const title = !b ? 'QR CODE INCONNU' : b.status === 'embarque' ? 'BILLET DÉJÀ UTILISÉ' : b.status === 'rembourse' ? 'BILLET REMBOURSÉ' : b.status === 'annule' ? 'BILLET ANNULÉ' : b.status !== 'confirme' ? 'BILLET INVALIDE (NON PAYÉ)' : null;
  const r = { ok: !title, offline: true, code, title: title || 'BILLET VALIDÉ', info, lines: b ? [] : ['Ce billet n\'est pas dans la liste téléchargée pour ce départ : autre départ, autre compagnie ou faux billet.'] };
  if (r.ok) {
    b.status = 'embarque'; b.boarded_at = new Date().toISOString(); info.status = 'embarque'; ls14.set('ct-man-' + id, man);
    const qd = ls14.get('ct-q-' + id, []); qd.push({ code, at: b.boarded_at }); ls14.set('ct-q-' + id, qd);
  } else if (b && b.status === 'embarque') r.prev_at = b.boarded_at;
  if (!r.ok) man.off_refused = (man.off_refused || 0) + 1, ls14.set('ct-man-' + id, man);
  const B = man.bookings || [], boarded = B.filter(x => x.status === 'embarque').length;
  r.counts = { validated: (man.counts?.validated || 0) + (ls14.get('ct-q-' + id, []).length), boarded, refused: (man.counts?.refused || 0) + (man.off_refused || 0), free: man.counts?.free ?? 0, not_boarded: B.filter(x => x.status === 'confirme').length };
  ctHist({ trip: id, label: (I0.from || '') + ' → ' + (I0.to || ''), code, at: new Date().toISOString(), ok: r.ok, title: r.title, synced: !r.ok });
  return r;
}
async function ctScan(raw) {
  if (CT.busy) return; CT.busy = true;
  try {
    let code = String(raw || '').trim().toUpperCase(); const m = code.match(/TR-[0-9A-F]{10}/); if (m) code = m[0]; if (!code) return;
    let r = null;
    if (navigator.onLine !== false) {
      try { r = await rpc2('transport_scan', { p_code: code, p_trip: UI.ctTrip, p_device: devId() }); ctNet(true); }
      catch (e) { if (!netErr(e)) r = { ok: false, code, title: 'ERREUR', lines: [e.message] }; }
    }
    if (!r) { r = ctLocal(code); ctNet(false); }
    else if (r.ok) { const man = ls14.get('ct-man-' + UI.ctTrip, null), b = man && (man.bookings || []).find(x => x.code === code); if (b) { b.status = 'embarque'; b.boarded_at = r.at; ls14.set('ct-man-' + UI.ctTrip, man); } }
    ctShow(r);
  } finally { CT.busy = false; }
}
async function ctSyncRun(trip) {
  const qd = ls14.get('ct-q-' + trip, []); if (!qd.length) return null;
  const r = await rpc2('transport_sync', { p_trip: trip, p_device: devId(), p_scans: qd });
  ls14.set('ct-q-' + trip, []);
  const bad = new Set((r.conflicts || []).map(c => c.code));
  ls14.set('ct-hist', ls14.get('ct-hist', []).map(h => (h.trip === trip && !h.synced ? { ...h, synced: true, conflict: bad.has(h.code) } : h)));
  return r;
}
async function ctSyncAll(show) {
  if (navigator.onLine === false) { if (show) toast('Toujours hors connexion.'); return; }
  let n = 0, C = [];
  for (const k of ls14.keys('ct-q-')) { try { const r = await ctSyncRun(k.slice(5)); if (r) { n += r.synced; C = C.concat(r.conflicts || []); if (k.slice(5) === UI.ctTrip) ctCounts(r.counts); } } catch (e) { if (show) toast(e.message); } }
  ctNet();
  if (C.length) modal(`<h2>${C.length} conflit(s) de synchronisation</h2><p class="sm">Ces billets avaient été acceptés hors connexion, mais le serveur les refuse (déjà utilisés sur un autre appareil, annulés…). Vérifiez ces passagers.</p><div class="tw"><table><tr><th>Billet</th><th>Passager</th><th>Raison</th><th>Premier passage</th></tr>${C.map(c => `<tr><td class="tk-code">${esc(c.code)}</td><td>${esc(c.passenger || '')}</td><td><b>${esc(c.title)}</b></td><td class="sm">${c.prev_at ? dtFmt(c.prev_at) : ''}${c.prev_by ? ' · ' + esc(c.prev_by) : ''}</td></tr>`).join('')}</table></div><button class="btn" data-a="close">J'ai compris</button>`);
  else if (n && show !== false) toast(n + ' scan(s) hors connexion synchronisé(s), aucun conflit.');
}
addEventListener('online', () => { ctNet(true); ctSyncAll(); });
addEventListener('offline', () => ctNet(false));

VIEWS.controle = async p => {
  if (!ME) return needLogin();
  if (p[1] === 'historique') return ctHistory();
  let L, off = false;
  try { L = await rpc2('scan_departures'); ls14.set('ct-deps', L); }
  catch (e) { if (!netErr(e)) return head('Contrôle transport', '') + `<div class="wrap sec">${v16Err(e)}</div>`; L = ls14.get('ct-deps', []); off = true; }
  if (!off && ctQueued()) { try { await ctSyncAll(false); } catch (e) { /* on réessaiera */ } }
  const A0 = AG14.v;
  const top = `<div class="card ct-top"><div class="ct-brand"><span class="ct-logo">${ic('bus')} FATI-TRANSPORT <small>SCANNER</small></span><span id="ctNet" class="ct-net"></span></div><div class="ct-agent"><span class="av-s">${esc(initials(ME.full_name || ME.email || '?'))}</span><div><b>${esc(ME.full_name || ME.email)}</b><div class="xs mut">${esc(A0 ? (A0.kind === 'responsable' ? 'Responsable de gare' : 'Agent de contrôle') + ' · ' + A0.carrier : ACC_L[(L[0] || {}).access] || ROLE_L[role()] || '')}${A0 && A0.stations.length ? ' · ' + esc(A0.stations.join(', ')) : ''}</div></div><a class="btn s ghost" href="#/controle/historique">Mes opérations</a>${role() === 'transporteur' ? '<a class="btn s ghost" href="#/transporteur/suivi">Suivi</a>' : ''}</div></div>`;
  if (A0 && !A0.active) return head('Contrôle transport', '') + `<div class="wrap sec ct-wrap">${top}${box('Compte désactivé', '<p>Votre compte de contrôle a été désactivé par votre compagnie ou par FATIGLOBAL.</p>')}</div>`;
  if (!L.length) return head('Contrôle transport', 'Contrôle des billets et embarquement des passagers.') + `<div class="wrap sec ct-wrap">${top}<div class="empty"><b>Aucun départ à contrôler.</b><br>Les départs d'hier soir à après-demain auxquels vous avez accès apparaissent ici.${role() === 'transporteur' ? '<br><a class="btn s" href="#/transporteur/trajets" style="margin-top:10px">Programmer un départ</a>' : ''}</div></div>`;
  const now = Date.now(), live = L.filter(x => x.status !== 'termine');
  let t = L.find(x => x.id === UI.ctTrip) || L.find(x => x.id === ls14.get('ct-trip', '')) || (live.length ? live : L).slice().sort((a, b) => Math.abs(ts(a.departs_at) - now) - Math.abs(ts(b.departs_at) - now))[0];
  UI.ctTrip = t.id; ls14.set('ct-trip', t.id); CT.seats = t.seats;
  let man = ls14.get('ct-man-' + t.id, null);
  if (!off) { try { const M = await rpc2('transport_manifest', { p_trip: t.id }); M.info = { from: t.from, to: t.to, departs_at: t.departs_at, carrier: t.carrier, vehicle: t.vehicle + (t.plate ? ' · ' + t.plate : ''), kind: t.kind }; man = M; ls14.set('ct-man-' + t.id, M); } catch (e) { /* liste précédente conservée */ } }
  const c = man && man.counts ? man.counts : t, manage = ['owner', 'responsable', 'admin'].includes(t.access);
  const trip = `<div class="card pad ct-trip"><div class="row between" style="align-items:flex-start"><div><div class="xs mut">${esc(t.carrier)}${t.station ? ' · ' + esc(t.station) : ''}</div><h2 style="margin:2px 0">${esc(t.from)} → ${esc(t.to)}</h2>${t.line || (t.stops || []).length ? `<div class="xs mut">Ligne ${esc(t.line || '')}${(t.stops || []).length ? ' · arrêts : ' + esc(t.stops.join(', ')) : ''}</div>` : ''}</div><div class="r"><b class="ct-time">${hFmt(t.departs_at)}</b><div class="xs mut">${dFmt(t.departs_at)}</div></div></div>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">${tBadge(t)}<span class="badge b-gray">${ic('bus')} ${esc(t.vehicle)}${t.plate ? ' · ' + esc(t.plate) : ''}</span>${t.driver ? `<span class="badge b-gray">${ic('user')} ${esc(t.driver)}</span>` : ''}${t.to_station ? `<span class="badge b-gray">${ic('pin')} ${esc(t.to_station)}</span>` : ''}</div></div>`;
  const counts = `<div class="ct-counts"><div class="okc"><small>Billets validés</small><b id="ctV">${num(c.validated || 0)}</b></div><div><small>Passagers embarqués</small><b id="ctB">${num(c.boarded || 0)} / ${num(t.seats)}</b></div><div class="koc"><small>Billets refusés</small><b id="ctR">${num(c.refused || 0)}</b></div><div><small>Non embarqués</small><b id="ctNB">${num(c.not_boarded || 0)}</b></div><div><small>Places libres</small><b id="ctF">${num(c.free || 0)}</b></div></div>`;
  const closed = ['termine', 'suspendu'].includes(t.status);
  const scan = `<div class="ct-scanbox">${closed ? `<div class="note">${t.status === 'termine' ? 'Départ clôturé : les billets seront refusés.' : 'Départ suspendu : les billets seront refusés jusqu\'à la reprise.'}</div>` : ''}<video id="tcam" playsinline muted style="display:none"></video><button class="btn xl ct-scan" id="tcamBtn" data-a="ctCam">${ic('cam')} SCANNER UN BILLET</button><form class="row ct-manual" data-f="ctCode"><input class="in" name="code" id="ctCode" placeholder="Ou saisissez le code du billet (TR-…)" autocomplete="off" style="text-transform:uppercase;font-family:Consolas,monospace"><button class="btn">Valider</button></form><div id="ctRes"></div></div>`;
  const B = (man && man.bookings) || [];
  const offline = `<div class="card pad stack"><div class="row between"><h3 style="margin:0">Mode hors connexion</h3><button class="btn s ghost" data-a="ctSync">Synchroniser</button></div><p class="sm" style="margin:0">${man ? `${ic('check')} ${B.length} billet(s) de ce départ téléchargé(s) le ${dtFmt(man.at)} : le contrôle continue même sans Internet.` : 'Billets non téléchargés : connectez-vous une fois à Internet sur cette page.'}</p><p class="xs mut" style="margin:0" id="ctQueue"></p><p class="xs mut" style="margin:0">Appareil : <span class="tk-code">${esc(devId())}</span>. Hors connexion, un même billet pourrait être accepté sur deux appareils avant synchronisation : affectez un seul appareil par porte d'embarquement.</p></div>`;
  const mg = manage ? `<div class="card pad stack"><h3 style="margin:0">Gestion du départ</h3><div class="row" style="gap:6px;flex-wrap:wrap">${t.status === 'programme' || t.status === 'suspendu' ? `<button class="btn s" data-a="ctStatus" data-id="${t.id}" data-v="embarquement">${t.status === 'suspendu' ? 'Reprendre l\'embarquement' : 'Ouvrir l\'embarquement'}</button>` : ''}${['programme', 'embarquement'].includes(t.status) ? `<button class="btn s ok" data-a="ctStatus" data-id="${t.id}" data-v="en_route">Départ effectué (en route)</button>` : ''}${t.status !== 'termine' ? `<button class="btn s ghost" data-a="ctDelay" data-id="${t.id}" data-v="${t.delay_min || 0}">Annoncer un retard</button>` : ''}${!['suspendu', 'termine'].includes(t.status) ? `<button class="btn s danger" data-a="ctStatus" data-id="${t.id}" data-v="suspendu">Suspendre</button>` : ''}${t.status !== 'termine' ? `<button class="btn s ghost" data-a="ctStatus" data-id="${t.id}" data-v="termine">Clôturer le départ</button>` : `<button class="btn s ghost" data-a="ctStatus" data-id="${t.id}" data-v="embarquement">Rouvrir</button>`}</div></div>` : '';
  const list = B.length ? `<details class="card pad"><summary style="cursor:pointer;font-weight:650">Liste des passagers (${B.length})</summary><div class="tw" style="margin-top:10px;max-height:420px;overflow:auto"><table><tr><th class="n">Siège</th><th>Passager</th><th>Billet</th><th>Statut</th></tr>${B.map(b => `<tr id="ctp-${esc(b.code)}"><td class="n"><b>${b.seat}</b></td><td>${esc(b.name)}</td><td class="tk-code xs">${esc(b.code)}</td><td>${badge(b.status === 'embarque' ? ['Embarqué', 'gray'] : b.status === 'confirme' ? ['À embarquer', 'orange'] : [BST[b.status] || b.status, 'red'])}</td></tr>`).join('')}</table></div></details>` : '';
  setTimeout(() => ctNet(off ? false : null), 0);
  return head('Contrôle transport', 'Un billet. Un passager. Un départ sécurisé.') + `<div class="wrap sec ct-wrap">${top}
    <label class="f">Départ contrôlé<select data-i="ctTrip">${L.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${dFmt(x.departs_at)} ${hFmt(x.departs_at)} — ${esc(x.from)} → ${esc(x.to)} · ${esc((TST[x.status] || [x.status])[0])}${L.some(y => y.carrier !== x.carrier) ? ' · ' + esc(x.carrier) : ''}</option>`).join('')}</select></label>
    ${trip}${counts}${scan}<div class="card pad"><h3 style="margin:0 0 6px">Alertes</h3><div id="ctAlerts"><p class="xs mut" style="margin:0">Les billets refusés pendant cette session s'affichent ici.</p></div></div>${mg}${offline}${list}</div>`;
};

async function ctHistory() {
  let S = [], err = '';
  try { S = await rpc2('transport_scans', { p_trip: null, p_from: null, p_to: null, p_limit: 300 }); } catch (e) { err = e.message; }
  const H = ls14.get('ct-hist', []);
  return head('Mes opérations de contrôle', 'Historique des scans enregistrés et des contrôles faits hors connexion sur cet appareil.') + `<div class="wrap sec stack ct-wrap" style="max-width:1100px"><div><a class="btn s ghost" href="#/controle">← Retour au contrôle</a></div>
  ${H.length ? `<div class="card pad"><h2>Hors connexion (cet appareil)</h2><div class="tw"><table><tr><th>Heure</th><th>Départ</th><th>Billet</th><th>Résultat</th><th>Synchronisation</th></tr>${H.slice(0, 100).map(h => `<tr><td class="sm nowrap">${dtFmt(h.at)}</td><td class="sm">${esc(h.label || '')}</td><td class="tk-code xs">${esc(h.code)}</td><td>${badge(h.ok ? ['Validé', 'green'] : [h.title, 'red'])}</td><td class="sm">${h.ok ? (h.synced ? (h.conflict ? badge(['Conflit', 'red']) : badge(['Synchronisé', 'green'])) : badge(['En attente', 'orange'])) : '<span class="mut">refus local</span>'}</td></tr>`).join('')}</table></div></div>` : ''}
  <div class="card pad"><h2>Scans enregistrés</h2>${err ? `<p class="mut">${esc(err)}</p>` : S.length ? scanTable(S) : '<p class="sm mut">Aucun scan.</p>'}</div></div>`;
}
const scanTable = S => `<div class="tw" style="max-height:560px;overflow:auto"><table><tr><th>Date et heure</th><th>Billet</th><th>Passager</th><th>Résultat</th><th>Départ</th><th>Agent · appareil</th><th>Mode</th></tr>${S.map(s => `<tr><td class="sm nowrap">${dtFmt(s.at)}</td><td class="tk-code xs">${esc(s.code)}</td><td class="sm">${esc(s.passenger || '—')}${s.ticket_status ? `<div class="xs mut">${esc(BST[s.ticket_status] || s.ticket_status)}</div>` : ''}</td><td>${badge(s.ok ? ['Validé', 'green'] : [s.title, 'red'])}${s.conflict ? ' ' + badge(['Conflit', 'red']) : ''}</td><td class="sm">${esc(s.trip || '')}${s.station ? `<div class="xs mut">${esc(s.station)}</div>` : ''}${s.vehicle ? `<div class="xs mut">${esc(s.vehicle)}</div>` : ''}</td><td class="sm">${esc(s.agent || '')}<div class="xs mut">${esc(s.device || '')}</div></td><td class="sm">${s.mode === 'hors_ligne' ? 'Hors ligne' : 'En ligne'}</td></tr>`).join('')}</table></div>`;

/* ---------- chauffeur : accès au scanner ---------- */
const _drv14 = VIEWS.chauffeur;
VIEWS.chauffeur = async p => (await _drv14(p)).replace('<div class="wrap sec stack">', `<div class="wrap sec stack"><a class="btn xl" href="#/controle">${ic('cam')} Ouvrir le scanner FATI-TRANSPORT</a>`);

/* =====================================================================
   3. ESPACE TRANSPORTEUR : NOUVEAUX ONGLETS
   ===================================================================== */
CAR_TABS.splice(0, CAR_TABS.length, ['', 'Tableau de bord'], ['suivi', 'Suivi en temps réel'], ['trajets', 'Départs'], ['lignes', 'Lignes'], ['reservations', 'Réservations'], ['controle', 'Scanner'], ['guichet', 'Vente au guichet'], ['colis', 'Colis'], ['vehicules', 'Véhicules'], ['chauffeurs', 'Chauffeurs'], ['agents', 'Agents et appareils'], ['gares', 'Gares et arrêts'], ['historique', 'Historique des scans'], ['paiements', 'Paiements'], ['profil', 'Profil']);
const CARV = {};
const _car14 = VIEWS.transporteur;
VIEWS.transporteur = async p => {
  const tab = p[1] || '';
  if (!CARV[tab] || !ME || role() !== 'transporteur') return _car14(p);
  if (tab === 'controle') { location.hash = '#/controle'; return ''; }
  let D; try { D = await rpc2('carrier_dashboard'); } catch (e) { return box('Espace transporteur indisponible', `<p class="mut">${esc(e.message)}</p>`); }
  window.__car = D;
  let body; try { body = await CARV[tab](D, p); } catch (e) { body = v16Err(e); }
  return carShell(D.carrier, tab, body);
};
CARV.controle = 1;
const opsWin = (a, b) => rpc2('carrier_ops', { p_from: new Date(a).toISOString(), p_to: new Date(b).toISOString() });
const tripRowCounts = t => `<div class="ct-mini"><span title="Billets vendus"><small>Vendus</small>${t.sold}</span><span title="Billets valides"><small>Valides</small>${t.valid}</span><span title="Billets annulés ou remboursés"><small>Annulés</small>${t.cancelled}</span><span title="Passagers embarqués"><small>Embarqués</small>${t.boarded}</span><span title="Passagers non embarqués"><small>Non emb.</small>${t.not_boarded}</span><span title="Billets refusés au contrôle" class="${+t.refused ? 'ko' : ''}"><small>Refusés</small>${t.refused}</span></div>`;

/* ---------- suivi en temps réel ---------- */
function opsAuto() {
  clearTimeout(UI.opsT);
  UI.opsT = setTimeout(() => {
    if (location.hash !== '#/transporteur/suivi') return;
    const busy = $('#dlg') && $('#dlg').open, foc = document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (busy || foc) opsAuto(); else render();
  }, 30000);
}
CARV.suivi = async D => {
  const day = UI.opsDay || isoDay(Date.now()), a = new Date(day + 'T00:00'), O = await opsWin(+a, +a + DAY), F0 = UI.opsF || {};
  window.__ops = O;
  let T = O.trips.filter(t => t.status !== 'annule');
  if (F0.station) T = T.filter(t => t.from_station === F0.station);
  if (F0.dest) T = T.filter(t => t.to_city === F0.dest);
  if (F0.line) T = T.filter(t => t.line_id === F0.line);
  if (F0.vehicle) T = T.filter(t => t.vehicle_id === F0.vehicle);
  if (F0.agent) T = T.filter(t => (t.agents || []).includes(F0.agent));
  const ids = new Set(T.map(t => t.id)), inc = O.incidents.filter(x => ts(x.at) >= +a && ts(x.at) < +a + DAY && (!Object.values(F0).some(Boolean) || ids.has(x.trip_id)));
  const sum = k => T.reduce((s, t) => s + +t[k], 0), activeAg = O.agents.filter(g => g.active && g.last_scan && Date.now() - ts(g.last_scan) < 3 * 36e5);
  const k = [['Départs programmés', T.filter(t => t.status === 'programme').length], ['En embarquement', T.filter(t => t.status === 'embarquement').length, 'hot'], ['En route', T.filter(t => t.status === 'en_route').length], ['Clôturés', T.filter(t => t.status === 'termine').length], ['Passagers embarqués', sum('boarded'), 'hot'], ['Places disponibles', T.filter(t => !['termine', 'en_route'].includes(t.status)).reduce((s, t) => s + +t.free, 0)], ['Agents actifs', activeAg.length], ['Véhicules affectés', new Set(T.map(t => t.vehicle_id)).size], ['Incidents', inc.length], ['Tentatives de fraude', inc.filter(x => FRAUD.includes(x.reason)).length], ['Billets refusés', sum('refused')], ['Retards', T.filter(t => +t.delay_min > 0).length]];
  const sel = (key, L, lab, val) => `<label class="f">${lab}<select data-i="opsF" data-k="${key}"><option value="">Tous</option>${L}</select></label>`;
  const filt = `<div class="card pad ops-filters"><label class="f">Date<input type="date" data-i="opsDay" value="${esc(day)}"></label>
    ${sel('station', opt14(D.stations, F0.station, s => s.city + ' — ' + s.name), 'Gare')}${sel('dest', opt14([...new Set(O.trips.map(t => t.to_city))].sort().map(c => ({ id: c })), F0.dest, x => x.id), 'Destination')}${sel('line', opt14(O.lines, F0.line, l => l.from_city + ' – ' + l.to_city), 'Ligne')}${sel('vehicle', opt14(D.vehicles, F0.vehicle, v => v.name + (v.plate ? ' · ' + v.plate : '')), 'Véhicule')}${sel('agent', opt14(O.agents.map(g => ({ id: g.name })), F0.agent, x => x.id), 'Agent')}
    <div style="align-self:end" class="row"><button class="btn s ghost" data-a="opsReset">Effacer les filtres</button><span class="xs mut">Mise à jour automatique toutes les 30 s · ${hFmt(Date.now())}</span></div></div>`;
  const cards = T.length ? T.map(t => `<div class="card pad ops-card st-${t.status}"><div class="row between" style="align-items:flex-start"><div><b class="ct-time" style="font-size:1.15rem">${hFmt(t.departs_at)}</b> <b>${esc(t.from_city)} → ${esc(t.to_city)}</b><div class="xs mut">${esc(t.vehicle || '')} · ${esc(t.driver || 'chauffeur à désigner')}${t.station ? ' · ' + esc(t.station) : ''}${t.line ? ' · ligne ' + esc(t.line) : ''}</div></div><div class="r">${tBadge(t)}</div></div>
    <div class="row between sm" style="margin-top:8px"><span><b>${t.boarded}</b> embarqué(s) sur ${t.valid} billet(s) valide(s) · ${t.free} place(s) libre(s) / ${t.seats}</span><div class="bar" style="width:140px"><i style="width:${Math.min(100, t.boarded / Math.max(1, t.seats) * 100)}%"></i></div></div>
    ${tripRowCounts(t)}<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><button class="btn s" data-a="ctGo" data-id="${t.id}">${ic('cam')} Contrôler</button>${t.status !== 'termine' ? `<select class="in" style="width:auto;margin:0" data-i="tripStatus14" data-trip="${t.id}"><option value="">Changer le statut…</option>${['programme', 'embarquement', 'en_route', 'suspendu', 'termine'].filter(s => s !== t.status).map(s => `<option value="${s}">${TST[s][0]}</option>`).join('')}</select><button class="btn s ghost" data-a="ctDelay" data-id="${t.id}" data-v="${t.delay_min || 0}">Retard</button>` : ''}${(t.agents || []).length ? `<span class="xs mut">Agents : ${esc(t.agents.join(', '))}</span>` : ''}</div></div>`).join('') : '<div class="empty">Aucun départ ce jour avec ces filtres.</div>';
  const incH = `<div class="card pad"><h2>Incidents et billets refusés</h2>${inc.length ? `<div class="tw" style="max-height:480px;overflow:auto"><table><tr><th>Heure</th><th>Raison</th><th>Billet</th><th>Départ</th><th>Agent · appareil</th></tr>${inc.map(x => `<tr><td class="sm nowrap">${hFmt(x.at)}</td><td>${badge([x.title, FRAUD.includes(x.reason) ? 'red' : 'orange'])}${x.conflict ? ' ' + badge(['Conflit hors ligne', 'red']) : ''}</td><td class="tk-code xs">${esc(x.code)}${x.passenger ? `<div class="sm" style="font-family:inherit">${esc(x.passenger)}</div>` : ''}</td><td class="sm">${esc(x.trip || '')}</td><td class="sm">${esc(x.agent || '')}<div class="xs mut">${esc(x.device || '')}${x.mode === 'hors_ligne' ? ' · hors ligne' : ''}</div></td></tr>`).join('')}</table></div>` : '<p class="sm mut">Aucun incident.</p>'}</div>`;
  opsAuto();
  return `<div class="stack">${filt}<div class="kpis kpis-s">${k.map(([l, v, c]) => `<div class="kpi ${c || ''}"><small>${l}</small><b>${num(v)}</b></div>`).join('')}</div><div class="cols ops-cols"><div class="stack">${cards}</div>${incH}</div></div>`;
};

/* ---------- départs ---------- */
CARV.trajets = async D => {
  const [O, cities] = await Promise.all([opsWin(Date.now() - 3 * DAY, Date.now() + 90 * DAY), trCities()]);
  const lines = O.lines.filter(l => l.active); window.__lines = O.lines;
  const okV = D.vehicles.filter(v => v.active && !['maintenance', 'hors_service'].includes(v.status));
  const form = `<form class="card pad stack" data-f="carTrip14"><h2 style="margin:0">Programmer un départ</h2><datalist id="trCities">${cities.map(c => `<option value="${esc(c)}">`).join('')}</datalist>${okV.length ? '' : '<div class="note">Ajoutez d\'abord un véhicule disponible (onglet Véhicules).</div>'}
    <div class="g3"><label class="f">Ligne <span class="xs mut">remplit le trajet</span><select name="line_id" data-i="tripLine"><option value="">— Sans ligne —</option>${opt14(lines, '', l => l.from_city + ' – ' + l.to_city + (l.price != null ? ' · ' + money(l.price) : ''))}</select></label><label class="f">Type de trajet<select name="kind">${Object.entries(TK).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label><label class="f">Véhicule<select name="vehicle_id" required>${opt14(okV, '', v => `${v.name}${v.plate ? ' · ' + v.plate : ''} (${VT[v.type]}, ${v.seats} places)`)}</select></label>
    <label class="f">Ville de départ<input name="from_city" list="trCities" required value="Conakry"></label><label class="f">Gare de départ<select name="from_station"><option value="">—</option>${opt14(D.stations.filter(s => s.active), '', s => s.city + ' — ' + s.name)}</select></label><label class="f">Date et heure de départ<input name="departs_at" type="datetime-local" required></label>
    <label class="f">Ville de destination<input name="to_city" list="trCities" required></label><label class="f">Gare d'arrivée<select name="to_station"><option value="">—</option>${opt14(D.stations.filter(s => s.active), '', s => s.city + ' — ' + s.name)}</select></label><label class="f">Arrivée prévue <span class="xs mut">vide = durée de la ligne</span><input name="arrives_at" type="datetime-local"></label>
    <label class="f">Tarif par place (GNF)<input name="price" type="number" min="0" step="500" required></label><label class="f">Capacité mise en vente <span class="xs mut">vide = tout le véhicule</span><input name="seats" type="number" min="1"></label><label class="f">Chauffeur<select name="driver_id"><option value="">— Celui du véhicule / à désigner —</option>${opt14(D.drivers.filter(d => d.active), '', d => d.name)}</select></label>
    <label class="f">Répéter chaque jour pendant<select name="repeat_days">${[1, 2, 3, 5, 7, 14, 30].map(n => `<option value="${n}">${n === 1 ? 'Un seul départ' : n + ' jours'}</option>`).join('')}</select></label></div>
    <label class="f">Informations pour les passagers<input name="notes" maxlength="300" placeholder="Ex. présentez-vous 30 minutes avant le départ ; bagages limités à 20 kg"></label><div><button class="btn">Programmer</button></div></form>`;
  const F0 = UI.trF || 'avenir', now = Date.now();
  const T = O.trips.filter(t => F0 === 'tous' ? true : F0 === 'avenir' ? !['termine', 'annule'].includes(t.status) && ts(t.departs_at) > now - 12 * 36e5 : F0 === 'passes' ? ['termine', 'annule'].includes(t.status) || ts(t.departs_at) <= now - 12 * 36e5 : true);
  const list = `<div class="card pad"><div class="row between"><h2 style="margin:0">Départs</h2><div class="chips" style="margin:0">${[['avenir', 'À venir et en cours'], ['passes', 'Passés et clôturés'], ['tous', 'Tous']].map(([k, l]) => `<button class="chip ${F0 === k ? 'on' : ''}" data-a="trF" data-v="${k}">${l}</button>`).join('')}</div></div>
    ${T.length ? T.map(t => `<div class="dep-row"><div class="dep-h"><div><b>${tWhen(t)}</b> · <b>${esc(t.from_city)} → ${esc(t.to_city)}</b> ${tBadge(t)}<div class="xs mut">${esc(TK[t.kind] || '')}${t.line ? ' · ligne ' + esc(t.line) : ''} · ${money(t.price, t.currency)} · ${t.seats} places</div></div><a class="btn s ghost" data-a="ctGo" data-id="${t.id}">${ic('cam')} Contrôler</a></div>${tripRowCounts(t)}
      ${['annule', 'termine'].includes(t.status) ? '' : `<div class="row dep-act"><label class="f">Statut<select data-i="tripStatus14" data-trip="${t.id}"><option value="">${esc(TST[t.status][0])}</option>${['programme', 'embarquement', 'en_route', 'suspendu', 'termine'].filter(s => s !== t.status).map(s => `<option value="${s}">${TST[s][0]}</option>`).join('')}</select></label><label class="f">Véhicule<select data-i="tripVeh" data-trip="${t.id}">${opt14(D.vehicles.filter(v => v.active && (v.id === t.vehicle_id || !['maintenance', 'hors_service'].includes(v.status))), t.vehicle_id, v => v.name + ' (' + v.seats + ' pl.)')}</select></label><label class="f">Chauffeur<select data-i="tripDriver" data-trip="${t.id}"><option value="">À désigner</option>${opt14(D.drivers.filter(d => d.active), t.driver_id, d => d.name)}</select></label><div class="row" style="align-self:end;gap:6px"><button class="btn s ghost" data-a="ctDelay" data-id="${t.id}" data-v="${t.delay_min || 0}">Retard</button><button class="btn s danger" data-a="tripCancel" data-id="${t.id}">Annuler</button></div></div>`}</div>`).join('') : '<p class="mut sm">Aucun départ.</p>'}</div>`;
  return `<div class="stack">${form}${list}</div>`;
};

/* ---------- lignes ---------- */
CARV.lignes = async D => {
  const O = await opsWin(Date.now(), Date.now() + DAY), cur = O.lines.find(l => l.id === UI.lineEdit) || (UI.lineEdit === 'new' ? {} : null) || {};
  return `<div class="cols"><div class="card pad"><h2>Lignes</h2>${O.lines.length ? O.lines.map(l => `<div class="row between" style="padding:10px 0;border-bottom:1px solid var(--line);gap:10px"><span><b>${esc(l.from_city)} – ${esc(l.to_city)}</b> ${l.active ? '' : badge(['Inactive', 'gray'])}<div class="xs mut">${(l.stops || []).length ? 'Arrêts : ' + esc(l.stops.join(', ')) + ' · ' : ''}${l.distance_km ? l.distance_km + ' km · ' : ''}${l.duration_min ? Math.floor(l.duration_min / 60) + ' h ' + String(l.duration_min % 60).padStart(2, '0') + ' · ' : ''}${l.price != null ? money(l.price) + ' · ' : ''}${l.station ? esc(l.station) + ' · ' : ''}${l.trips} départ(s)</div></span><span class="row" style="gap:6px"><button class="btn s ghost" data-a="lineEdit" data-id="${l.id}">Modifier</button><button class="btn s danger" data-a="lineDel" data-id="${l.id}" data-name="${esc(l.from_city + ' – ' + l.to_city)}">Supprimer</button></span></div>`).join('') : '<p class="mut sm">Aucune ligne. Créez vos lignes régulières pour programmer les départs plus vite.</p>'}</div>
  <form class="card pad stack" data-f="line14" data-id="${cur.id || ''}"><h2 style="margin:0">${cur.id ? 'Modifier la ligne' : 'Nouvelle ligne'}</h2>${cur.id ? '' : `<div class="chips" style="margin:0">${LINE_EX.map(([a, b]) => `<button type="button" class="chip" data-a="lineEx" data-a1="${a}" data-b1="${b}">${a} – ${b}</button>`).join('')}</div>`}
    <div class="g2"><label class="f">Ville de départ<input name="from_city" required value="${esc(cur.from_city || 'Conakry')}"></label><label class="f">Ville de destination<input name="to_city" required value="${esc(cur.to_city || '')}"></label></div>
    <label class="f">Étapes ou arrêts <span class="xs mut">séparés par des virgules</span><input name="stops" value="${esc((cur.stops || []).join(', '))}" placeholder="Ex. Coyah, Kindia, Mamou"></label>
    <div class="g3"><label class="f">Distance (km)<input name="distance_km" type="number" min="0" step="1" value="${cur.distance_km ?? ''}"></label><label class="f">Durée estimée (minutes)<input name="duration_min" type="number" min="1" step="5" value="${cur.duration_min ?? ''}"></label><label class="f">Tarif habituel (GNF)<input name="price" type="number" min="0" step="500" value="${cur.price ?? ''}"></label></div>
    <label class="f">Gare de départ<select name="from_station"><option value="">—</option>${opt14(D.stations.filter(s => s.active || s.id === cur.from_station), cur.from_station, s => s.city + ' — ' + s.name)}</select></label>
    ${cur.id ? `<label class="row sm"><input type="checkbox" name="active" ${cur.active ? 'checked' : ''}> Ligne active</label>` : ''}<div class="row"><button class="btn">Enregistrer</button>${cur.id ? '<button type="button" class="btn ghost" data-a="lineEdit" data-id="">Nouvelle ligne</button>' : ''}</div></form></div>`;
};

/* ---------- véhicules ---------- */
const vehLive = (v, D) => {
  if (['maintenance', 'hors_service'].includes(v.status)) return v.status;
  const T = D.trips.filter(t => t.vehicle_id === v.id);
  if (T.some(t => t.status === 'en_route')) return 'en_route';
  if (T.some(t => t.status === 'embarquement')) return 'embarquement';
  if (T.some(t => t.status === 'programme' && ts(t.departs_at) > Date.now() - 6 * 36e5)) return 'affecte';
  return v.status === 'affecte' || v.status === 'en_route' || v.status === 'embarquement' ? 'disponible' : v.status || 'disponible';
};
CARV.vehicules = async D => {
  const L = await q(sb.from('transport_lines').select('id,from_city,to_city,active').eq('carrier_id', D.carrier.id));
  const cur = D.vehicles.find(v => v.id === UI.vehEdit) || {}, dn = id => (D.drivers.find(d => d.id === id) || {}).name, sn = id => { const s = D.stations.find(x => x.id === id); return s ? s.city + ' — ' + s.name : ''; }, ln = id => { const l = L.find(x => x.id === id); return l ? l.from_city + ' – ' + l.to_city : ''; };
  return `<div class="cols"><div class="card pad"><h2>Véhicules</h2>${D.vehicles.length ? D.vehicles.map(v => { const st = vehLive(v, D), nx = D.trips.filter(t => t.vehicle_id === v.id && ['programme', 'embarquement'].includes(t.status) && ts(t.departs_at) > Date.now() - 6 * 36e5).length;
    return `<div class="veh-card"><div class="row between" style="gap:8px"><span><b>${esc(v.name)}</b>${v.plate ? ' · <span class="tk-code">' + esc(v.plate) + '</span>' : ''} ${badge(VST[st] || [st, 'gray'])} ${v.active ? '' : badge(['Retiré', 'gray'])}</span><button class="btn s ghost" data-a="vehEdit" data-id="${v.id}">Modifier</button></div><div class="xs mut">${VT[v.type]} · capacité ${v.seats} places (${v.per_row} par rangée)${v.comfort ? ' · ' + esc(v.comfort) : ''}</div><div class="xs mut">${[v.driver_id ? 'Chauffeur : ' + esc(dn(v.driver_id) || '') : 'Sans chauffeur attitré', v.line_id ? 'Ligne : ' + esc(ln(v.line_id)) : '', v.station_id ? 'Gare : ' + esc(sn(v.station_id)) : '', nx ? nx + ' départ(s) à venir' : ''].filter(Boolean).join(' · ')}</div></div>`; }).join('') : '<p class="mut sm">Aucun véhicule.</p>'}</div>
  <form class="card pad stack" data-f="vehicle14" data-id="${cur.id || ''}"><h2 style="margin:0">${cur.id ? 'Fiche du véhicule' : 'Ajouter un véhicule'}</h2><div class="g2"><label class="f">Immatriculation<input name="plate" value="${esc(cur.plate || '')}" placeholder="Ex. RC-1234-A"></label><label class="f">Nom<input name="name" required value="${esc(cur.name || '')}" placeholder="Ex. Bus 01 — Yutong"></label><label class="f">Type de véhicule<select name="type">${Object.entries(VT).map(([k, l]) => `<option value="${k}" ${cur.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="f">Statut<select name="status">${Object.entries(VST).map(([k, [l]]) => `<option value="${k}" ${(cur.status || 'disponible') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="f">Capacité totale (places)<input name="seats" type="number" min="1" max="120" required value="${cur.seats || ''}"></label><label class="f">Sièges par rangée<input name="per_row" type="number" min="1" max="6" value="${cur.per_row || 4}"></label><label class="f">Chauffeur attitré<select name="driver_id"><option value="">—</option>${opt14(D.drivers.filter(d => d.active || d.id === cur.driver_id), cur.driver_id, d => d.name)}</select></label><label class="f">Ligne attribuée<select name="line_id"><option value="">—</option>${opt14(L.filter(l => l.active || l.id === cur.line_id), cur.line_id, l => l.from_city + ' – ' + l.to_city)}</select></label><label class="f">Gare de départ<select name="station_id"><option value="">—</option>${opt14(D.stations.filter(s => s.active || s.id === cur.station_id), cur.station_id, s => s.city + ' — ' + s.name)}</select></label><label class="f">Confort<input name="comfort" value="${esc(cur.comfort || '')}" placeholder="Climatisé, Wi-Fi…"></label></div>${cur.id ? `<label class="row sm"><input type="checkbox" name="active" ${cur.active ? 'checked' : ''}> Véhicule dans la flotte</label>` : ''}<p class="xs mut" style="margin:0">Un véhicule « en maintenance » ou « hors service » ne peut pas être affecté à un départ. La capacité ne peut pas descendre sous les places déjà vendues.</p><div class="row"><button class="btn">Enregistrer</button>${cur.id ? '<button type="button" class="btn ghost" data-a="vehEdit" data-id="">Nouveau véhicule</button>' : ''}</div></form></div>`;
};

/* ---------- chauffeurs ---------- */
CARV.chauffeurs = async D => {
  const L = await q(sb.from('transport_lines').select('id,from_city,to_city,active').eq('carrier_id', D.carrier.id));
  const cur = D.drivers.find(v => v.id === UI.drvEdit) || {}, hist = id => D.trips.filter(t => t.driver_id === id);
  const chk = (name, list, sel, lab) => list.length ? `<div class="f"><span>${name === 'veh' ? 'Véhicules autorisés' : 'Lignes affectées'}</span><div class="chk-grid">${list.map(x => `<label class="row sm"><input type="checkbox" name="${name}" value="${x.id}" ${(sel || []).includes(x.id) ? 'checked' : ''}> ${esc(lab(x))}</label>`).join('')}</div></div>` : '';
  return `<div class="cols"><div class="card pad"><h2>Chauffeurs</h2>${D.drivers.length ? D.drivers.map(d => { const H = hist(d.id); return `<div class="veh-card"><div class="row between"><span><b>${esc(d.name)}</b> ${badge(d.active ? ['En service', 'green'] : ['Inactif', 'gray'])}</span><span class="row" style="gap:6px">${H.length ? `<button class="btn s ghost" data-a="drvHist" data-id="${d.id}">Historique (${H.length})</button>` : ''}<button class="btn s ghost" data-a="drvEdit" data-id="${d.id}">Modifier</button></span></div><div class="xs mut">${esc(d.phone || 'sans téléphone')}${d.license ? ' · permis ' + esc(d.license) : ''}${d.email ? ' · compte ' + esc(d.email) : ' · sans compte'}</div><div class="xs mut">${(d.vehicle_ids || []).length ? 'Véhicules : ' + esc(d.vehicle_ids.map(i => (D.vehicles.find(v => v.id === i) || {}).name).filter(Boolean).join(', ')) : 'Tous les véhicules'}${(d.line_ids || []).length ? ' · lignes : ' + esc(d.line_ids.map(i => { const l = L.find(x => x.id === i); return l ? l.from_city + ' – ' + l.to_city : ''; }).filter(Boolean).join(', ')) : ''}</div></div>`; }).join('') : '<p class="mut sm">Aucun chauffeur.</p>'}</div>
  <form class="card pad stack" data-f="driver14" data-id="${cur.id || ''}"><h2 style="margin:0">${cur.id ? 'Profil du chauffeur' : 'Ajouter un chauffeur'}</h2><div class="g2"><label class="f">Nom et prénom<input name="name" required value="${esc(cur.name || '')}"></label><label class="f">Téléphone<input name="phone" inputmode="tel" value="${esc(cur.phone || '')}"></label><label class="f">Permis ou référence administrative<input name="license" value="${esc(cur.license || '')}"></label><label class="f">E-mail de son compte FatiBillets (facultatif)<input name="email" type="email" value="${esc(cur.email || '')}"></label></div>
    ${chk('veh', D.vehicles.filter(v => v.active), cur.vehicle_ids, v => v.name)}${chk('lin', L.filter(l => l.active), cur.line_ids, l => l.from_city + ' – ' + l.to_city)}
    <p class="xs mut" style="margin:0">Avec un compte, le chauffeur voit ses départs, la liste des passagers autorisés et peut contrôler les billets de ses départs.</p>${cur.id ? `<label class="row sm"><input type="checkbox" name="active" ${cur.active ? 'checked' : ''}> En service</label>` : ''}<div class="row"><button class="btn">Enregistrer</button>${cur.id ? '<button type="button" class="btn ghost" data-a="drvEdit" data-id="">Nouveau chauffeur</button>' : ''}</div></form></div>`;
};

/* ---------- agents et appareils ---------- */
CARV.agents = async D => {
  const O = await opsWin(day0(), day0() + DAY), cur = O.agents.find(g => g.id === UI.agEdit);
  const stChk = sel => D.stations.length ? `<div class="f"><span>Gares <span class="xs mut">aucune cochée = toutes les gares</span></span><div class="chk-grid">${D.stations.filter(s => s.active).map(s => `<label class="row sm"><input type="checkbox" name="st" value="${s.id}" ${(sel || []).includes(s.id) ? 'checked' : ''}> ${esc(s.city + ' — ' + s.name)}</label>`).join('')}</div></div>` : '<p class="xs mut" style="margin:0">Ajoutez des gares (onglet Gares et arrêts) pour limiter un agent à une gare précise.</p>';
  const kindSel = k => `<label class="f">Profil<select name="kind"><option value="agent" ${k !== 'responsable' ? 'selected' : ''}>Agent de contrôle — scan et validation des billets</option><option value="responsable" ${k === 'responsable' ? 'selected' : ''}>Responsable de gare — contrôle + gestion des départs de sa gare</option></select></label>`;
  const form = cur ? `<form class="card pad stack" data-f="agentSave" data-id="${cur.id}"><h2 style="margin:0">Modifier ${esc(cur.name)}</h2><div class="g2"><label class="f">Nom<input name="name" required value="${esc(cur.name)}"></label><label class="f">Téléphone (contact)<input name="phone" value="${esc(cur.phone || '')}"></label></div>${kindSel(cur.kind)}${stChk(cur.station_ids)}<label class="f">Nouveau mot de passe <span class="xs mut">laisser vide pour ne pas changer</span><input name="password" type="password" minlength="8" autocomplete="new-password"></label><label class="row sm"><input type="checkbox" name="active" ${cur.active ? 'checked' : ''}> Compte actif</label><div class="row"><button class="btn">Enregistrer</button><button type="button" class="btn ghost" data-a="agEdit" data-id="">Annuler</button></div></form>`
    : `<form class="card pad stack" data-f="agentNew"><h2 style="margin:0">Créer un compte de contrôle</h2><div class="g2"><label class="f">Nom et prénom<input name="name" required minlength="2"></label><label class="f">Téléphone <span class="xs mut">identifiant de connexion</span><input name="phone" required inputmode="tel" pattern="[+0-9 ]{8,}"></label><label class="f">Mot de passe (8 caractères min.)<input name="password" type="password" required minlength="8" autocomplete="new-password"></label><label class="f">E-mail (facultatif)<input name="email" type="email"></label></div>${kindSel('agent')}${stChk([])}<p class="xs mut" style="margin:0">L'agent se connecte avec son téléphone et ce mot de passe, puis arrive directement sur l'écran de contrôle. Il ne peut ni créer de comptes ni obtenir d'autres droits.</p><div><button class="btn">Créer le compte</button></div></form>`;
  const ag = `<div class="card pad"><h2>Agents de contrôle (${O.agents.length})</h2>${O.agents.length ? `<div class="tw"><table><tr><th>Agent</th><th>Profil · gares</th><th>Dernier scan</th><th class="n">Scans aujourd'hui</th><th></th></tr>${O.agents.map(g => `<tr><td><b>${esc(g.name)}</b> ${g.active && g.account === 'actif' ? '' : badge(['Désactivé', 'gray'])}<div class="xs mut">Connexion : ${esc(g.login || '')}</div></td><td class="sm">${g.kind === 'responsable' ? 'Responsable de gare' : 'Agent'}<div class="xs mut">${(g.station_ids || []).length ? esc(g.station_ids.map(i => { const s = D.stations.find(x => x.id === i); return s ? s.name : ''; }).filter(Boolean).join(', ')) : 'Toutes les gares'}</div></td><td class="sm">${g.last_scan ? dtFmt(g.last_scan) : '—'}</td><td class="n">${g.scans_period}${+g.refused_period ? ` <span class="xs" style="color:var(--red)">(${g.refused_period} refus)</span>` : ''}</td><td class="r nowrap"><button class="btn s ghost" data-a="agEdit" data-id="${g.id}">Modifier</button> <button class="btn s ghost" data-a="agToggle" data-id="${g.id}" data-on="${g.active ? 0 : 1}">${g.active ? 'Désactiver' : 'Activer'}</button> <button class="btn s danger" data-a="agDel" data-id="${g.id}" data-name="${esc(g.name)}">Supprimer</button></td></tr>`).join('')}</table></div>` : '<p class="sm mut">Aucun agent. Créez les comptes de vos agents de contrôle et responsables de gare.</p>'}</div>`;
  const dev = `<div class="card pad"><h2>Appareils de contrôle</h2>${O.devices.length ? `<div class="tw"><table><tr><th>Appareil</th><th>Dernier agent</th><th>Dernière utilisation</th><th class="n">Scans</th><th></th></tr>${O.devices.map(d => `<tr><td><b>${esc(d.label || 'Sans nom')}</b> ${d.blocked ? badge(['Bloqué', 'red']) : badge(['Autorisé', 'green'])}<div class="tk-code xs">${esc(d.id)}</div></td><td class="sm">${esc(d.agent || '')}</td><td class="sm">${d.last_seen ? dtFmt(d.last_seen) : '—'}</td><td class="n">${d.scans}</td><td class="r nowrap"><button class="btn s ghost" data-a="devName" data-id="${esc(d.id)}" data-v="${esc(d.label || '')}">Nommer</button> <button class="btn s ${d.blocked ? 'ok' : 'danger'}" data-a="devBlock" data-id="${esc(d.id)}" data-on="${d.blocked ? 0 : 1}">${d.blocked ? 'Autoriser' : 'Bloquer'}</button></td></tr>`).join('')}</table></div>` : '<p class="sm mut">Les téléphones apparaissent ici dès leur premier scan.</p>'}<p class="xs mut">Un appareil bloqué ne peut plus valider aucun billet de votre compagnie (perte, vol, usage non autorisé).</p></div>`;
  return `<div class="stack"><div class="cols">${ag}${form}</div>${dev}</div>`;
};

/* ---------- historique des scans ---------- */
CARV.historique = async D => {
  const a = UI.hFrom || isoDay(Date.now() - 6 * DAY), b = UI.hTo || isoDay(Date.now()), r = UI.hRes || '';
  let S = await rpc2('transport_scans', { p_trip: null, p_from: new Date(a + 'T00:00').toISOString(), p_to: new Date(+new Date(b + 'T00:00') + DAY).toISOString(), p_limit: 2000 });
  if (r === 'ok') S = S.filter(s => s.ok); else if (r === 'ko') S = S.filter(s => !s.ok); else if (r === 'fraude') S = S.filter(s => FRAUD.includes(s.reason)); else if (r === 'hors') S = S.filter(s => s.mode === 'hors_ligne');
  window.__scans = S;
  return `<div class="stack"><div class="card pad ops-filters"><label class="f">Du<input type="date" data-i="hFrom" value="${a}"></label><label class="f">Au<input type="date" data-i="hTo" value="${b}"></label><label class="f">Résultat<select data-i="hRes"><option value="">Tous</option>${[['ok', 'Validés'], ['ko', 'Refusés'], ['fraude', 'Tentatives de fraude'], ['hors', 'Hors ligne']].map(([k, l]) => `<option value="${k}" ${r === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><div style="align-self:end"><button class="btn s ghost" data-a="scanCsv">Exporter (Excel/CSV)</button></div></div>
  <div class="card pad"><h2>${S.length} scan(s)</h2>${S.length ? scanTable(S) : '<p class="sm mut">Aucun scan sur cette période.</p>'}</div></div>`;
};

/* =====================================================================
   4. DIRECTION FATIGLOBAL : SUPERVISION DU CONTRÔLE
   ===================================================================== */
const _adm14 = ADMIN_R.transport;
ADMIN_R.transport = async (D, me) => {
  const h = await _adm14(D, me); let X;
  try { X = await rpc2('admin_transport_ops'); } catch (e) { return h + `<div class="note" style="margin-top:14px">Supervision du scanner indisponible : ${esc(e.message)}</div>`; }
  window.__admOps = X;
  return h + `<div class="stack" style="margin-top:18px"><div class="card pad"><div class="row between"><h2 style="margin:0">FATI-TRANSPORT SCANNER — contrôle des embarquements</h2><button class="btn s ghost" data-a="admScanCsv">Exporter les scans (30 jours)</button></div>${X.carriers.length ? `<div class="tw" style="margin-top:10px"><table><tr><th>Compagnie</th><th class="n">Agents actifs</th><th class="n">Lignes</th><th class="n">Départs en cours</th><th class="n">Scans aujourd'hui</th><th class="n">Refusés aujourd'hui</th><th class="n">Fraudes (7 j)</th><th class="n">Conflits hors ligne (7 j)</th></tr>${X.carriers.map(c => `<tr><td><b>${esc(c.name)}</b> ${c.status === 'actif' ? '' : badge(['Suspendue', 'red'])}</td><td class="n">${c.agents}</td><td class="n">${c.lines}</td><td class="n">${c.boarding}</td><td class="n">${num(c.scans_today)}</td><td class="n">${num(c.refused_today)}</td><td class="n" ${+c.fraud_7d ? 'style="color:var(--red);font-weight:700"' : ''}>${num(c.fraud_7d)}</td><td class="n">${num(c.conflicts_7d)}</td></tr>`).join('')}</table></div>` : '<p class="sm mut">Aucune compagnie.</p>'}</div>
  <div class="cols"><div class="card pad"><h2>Agents de contrôle</h2>${X.agents.length ? `<div class="tw" style="max-height:440px;overflow:auto"><table><tr><th>Agent</th><th>Compagnie</th><th>Dernier scan</th><th></th></tr>${X.agents.map(g => `<tr><td><b>${esc(g.name)}</b> ${g.active ? '' : badge(['Suspendu', 'red'])}<div class="xs mut">${g.kind === 'responsable' ? 'Responsable de gare' : 'Agent'} · ${esc(g.login || '')}</div></td><td class="sm">${esc(g.carrier)}</td><td class="sm">${g.last_scan ? dtFmt(g.last_scan) : '—'}</td><td class="r"><button class="btn s ${g.active ? 'danger' : 'ok'}" data-a="admAgent" data-id="${g.id}" data-on="${g.active ? 0 : 1}">${g.active ? 'Suspendre' : 'Réactiver'}</button></td></tr>`).join('')}</table></div>` : '<p class="sm mut">Aucun agent.</p>'}</div>
  <div class="card pad"><h2>Anomalies (7 jours)</h2>${X.anomalies.length ? `<div class="tw" style="max-height:440px;overflow:auto"><table><tr><th>Date</th><th>Anomalie</th><th>Compagnie · départ</th><th>Agent</th></tr>${X.anomalies.map(a => `<tr><td class="sm nowrap">${dtFmt(a.at)}</td><td>${badge([a.title, FRAUD.includes(a.reason) ? 'red' : 'orange'])}${a.conflict ? ' ' + badge(['Conflit', 'red']) : ''}<div class="tk-code xs">${esc(a.code)}</div></td><td class="sm">${esc(a.carrier || '')}<div class="xs mut">${esc(a.trip || '')}</div></td><td class="sm">${esc(a.agent || '')}<div class="xs mut">${esc(a.device || '')}${a.mode === 'hors_ligne' ? ' · hors ligne' : ''}</div></td></tr>`).join('')}</table></div>` : '<p class="sm mut">Aucune anomalie.</p>'}</div></div></div>`;
};

/* =====================================================================
   5. ACTIONS
   ===================================================================== */
const statusAsk = (id, v) => {
  if (v === 'suspendu') return askReason('Suspendre ce départ (les passagers sont prévenus)', m => act(() => rpc2('set_trip_status', { p_id: id, p_status: 'suspendu', p_delay: null, p_reason: m }), 'Départ suspendu.'));
  if (v === 'termine' && !confirm('Clôturer ce départ ? Les billets non utilisés seront refusés au contrôle.')) return render();
  act(() => rpc2('set_trip_status', { p_id: id, p_status: v, p_delay: null, p_reason: null }), 'Départ : ' + TST[v][0].toLowerCase() + '.');
};
Object.assign(A, {
  ctCam() { if (tcam.on) tcamStop(); else tcamStart(); },
  ctSync() { ctSyncAll(true).then(() => render()); },
  ctStatus(el) { statusAsk(el.dataset.id, el.dataset.v); },
  ctDelay(el) { modal(`<h2>Annoncer un retard</h2><form class="stack" data-f="ctDelay" data-id="${el.dataset.id}"><label class="f">Retard (minutes)<input name="min" type="number" min="0" max="1440" step="5" required value="${+el.dataset.v || 15}"></label><label class="f">Motif (facultatif, envoyé aux passagers)<input name="reason" maxlength="200"></label><p class="xs mut" style="margin:0">Les passagers qui ont un billet valide sont prévenus. Mettez 0 pour supprimer le retard.</p><div class="row"><button class="btn" style="flex:1">Enregistrer</button><button type="button" class="btn ghost" data-a="close">Annuler</button></div></form>`); },
  ctGo(el) { UI.ctTrip = el.dataset.id; ls14.set('ct-trip', el.dataset.id); location.hash = '#/controle'; },
  opsReset() { UI.opsF = {}; render(); },
  trF(el) { UI.trF = el.dataset.v; render(); },
  lineEdit(el) { UI.lineEdit = el.dataset.id || null; render(); },
  lineEx(el) { const f = $('[data-f="line14"]'); if (f) { f.from_city.value = el.dataset.a1; f.to_city.value = el.dataset.b1; f.stops.focus(); } },
  lineDel(el) { if (!confirm('Supprimer la ligne « ' + el.dataset.name + ' » ?\n\nSi des départs l\'utilisent, elle est seulement désactivée (l\'historique reste intact).')) return; act(async () => { const r = await rpc2('delete_line', { p_id: el.dataset.id }); if (r === 'desactivee') toast('Des départs utilisent cette ligne : elle est désactivée.'); UI.lineEdit = null; }, 'Ligne mise à jour.'); },
  drvHist(el) { const D = window.__car, d = D.drivers.find(x => x.id === el.dataset.id), H = D.trips.filter(t => t.driver_id === el.dataset.id); modal(`<h2>Historique de ${esc(d.name)}</h2><div class="tw" style="max-height:60vh;overflow:auto"><table><tr><th>Départ</th><th>Trajet</th><th>Véhicule</th><th class="n">Embarqués</th><th>Statut</th></tr>${H.map(t => `<tr><td class="sm nowrap">${tWhen(t)}</td><td>${esc(t.from_city)} → ${esc(t.to_city)}</td><td class="sm">${esc(t.vehicle || '')}</td><td class="n">${t.boarded} / ${t.booked}</td><td>${badge(TST[t.status] || [t.status, 'gray'])}</td></tr>`).join('')}</table></div><button class="btn ghost" data-a="close">Fermer</button>`); },
  agEdit(el) { UI.agEdit = el.dataset.id || null; render().then(() => { const f = $('[data-f="agentSave"]'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); },
  agToggle(el) { act(() => rpc2('carrier_agent_save', { p_id: el.dataset.id, p: { active: el.dataset.on === '1' } }), el.dataset.on === '1' ? 'Agent activé.' : 'Agent désactivé : il ne peut plus contrôler aucun billet.'); },
  agDel(el) { if (!confirm('Supprimer l\'agent « ' + el.dataset.name + ' » ?\n\nS\'il a déjà contrôlé des billets, son compte est fermé et l\'historique de ses scans est conservé.')) return; act(async () => { const r = await fn('carrier-agent', { action: 'delete', agent_id: el.dataset.id }); if (r.mode === 'ferme') toast('Compte fermé : l\'historique de ses scans est conservé.'); UI.agEdit = null; }, 'Agent supprimé.'); },
  devName(el) { const v = prompt('Nom de cet appareil (ex. Téléphone porte 1 — Madina)', el.dataset.v || ''); if (v == null) return; act(() => rpc2('carrier_device_set', { p_device: el.dataset.id, p_label: v, p_blocked: null }), 'Appareil renommé.'); },
  devBlock(el) { const on = el.dataset.on === '1'; if (on && !confirm('Bloquer cet appareil ? Il ne pourra plus valider aucun billet de votre compagnie.')) return; act(() => rpc2('carrier_device_set', { p_device: el.dataset.id, p_label: null, p_blocked: on }), on ? 'Appareil bloqué.' : 'Appareil autorisé.'); },
  scanCsv() { download('scans-transport.csv', [['Date', 'Billet', 'Passager', 'Résultat', 'Départ', 'Gare', 'Véhicule', 'Agent', 'Appareil', 'Mode', 'Conflit'], ...(window.__scans || []).map(s => [dtFmt(s.at), s.code, s.passenger || '', s.ok ? 'Validé' : s.title, s.trip || '', s.station || '', s.vehicle || '', s.agent || '', s.device || '', s.mode === 'hors_ligne' ? 'Hors ligne' : 'En ligne', s.conflict ? 'Oui' : ''])]); },
  admScanCsv() { rpc2('transport_scans', { p_trip: null, p_from: new Date(Date.now() - 30 * DAY).toISOString(), p_to: null, p_limit: 2000 }).then(S => download('scans-fati-transport.csv', [['Date', 'Compagnie', 'Billet', 'Passager', 'Résultat', 'Départ', 'Agent', 'Appareil', 'Mode'], ...S.map(s => [dtFmt(s.at), s.carrier || '', s.code, s.passenger || '', s.ok ? 'Validé' : s.title, s.trip || '', s.agent || '', s.device || '', s.mode === 'hors_ligne' ? 'Hors ligne' : 'En ligne'])])).catch(e => toast(e.message)); },
  admAgent(el) { const on = el.dataset.on === '1'; askReason(on ? 'Réactiver cet agent' : 'Suspendre cet agent', m => act(() => rpc2('admin_set_agent', { p_id: el.dataset.id, p_active: on, p_reason: m }), on ? 'Agent réactivé.' : 'Agent suspendu.')); },
});
Object.assign(F, {
  async ctCode(f, form) { const v = f.get('code'); form.reset(); form.querySelector('button').disabled = false; await ctScan(v); const i = $('#ctCode'); if (i) i.focus(); },
  async ctDelay(f, form) { await rpc2('set_trip_status', { p_id: form.dataset.id, p_status: null, p_delay: +f.get('min'), p_reason: f.get('reason') }); closeModal(); toast(+f.get('min') ? 'Retard annoncé aux passagers.' : 'Retard supprimé.'); await render(); },
  async carTrip14(f) {
    const n = await rpc2('save_trip', { p: { line_id: f.get('line_id'), kind: f.get('kind'), vehicle_id: f.get('vehicle_id'), driver_id: f.get('driver_id'), from_city: f.get('from_city'), from_station: f.get('from_station'), to_city: f.get('to_city'), to_station: f.get('to_station'), departs_at: fromLocalInput(f.get('departs_at')), arrives_at: fromLocalInput(f.get('arrives_at')), price: f.get('price'), seats: f.get('seats'), repeat_days: f.get('repeat_days'), notes: f.get('notes') } });
    toast(n + ' départ(s) programmé(s).'); TR_CITIES = null; await render();
  },
  async line14(f, form) {
    await rpc2('save_line', { p: { id: form.dataset.id || null, from_city: f.get('from_city'), to_city: f.get('to_city'), stops: String(f.get('stops') || '').split(',').map(s => s.trim()).filter(Boolean), distance_km: f.get('distance_km'), duration_min: f.get('duration_min'), price: f.get('price'), from_station: f.get('from_station'), active: form.dataset.id ? !!f.get('active') : true } });
    UI.lineEdit = null; toast('Ligne enregistrée.'); await render();
  },
  async vehicle14(f, form) {
    await rpc2('save_vehicle', { p: { id: form.dataset.id || null, type: f.get('type'), name: f.get('name'), plate: f.get('plate'), seats: f.get('seats'), per_row: f.get('per_row'), comfort: f.get('comfort'), status: f.get('status'), driver_id: f.get('driver_id'), line_id: f.get('line_id'), station_id: f.get('station_id'), active: form.dataset.id ? !!f.get('active') : true } });
    UI.vehEdit = null; toast('Véhicule enregistré.'); await render();
  },
  async driver14(f, form) {
    await rpc2('save_driver', { p: { id: form.dataset.id || null, name: f.get('name'), phone: f.get('phone'), license: f.get('license'), email: f.get('email'), vehicle_ids: f.getAll('veh'), line_ids: f.getAll('lin'), active: form.dataset.id ? !!f.get('active') : true } });
    UI.drvEdit = null; toast('Chauffeur enregistré.'); await render();
  },
  async agentNew(f, form) {
    const r = await fn('carrier-agent', { action: 'create', name: f.get('name'), phone: f.get('phone'), email: f.get('email'), password: f.get('password'), kind: f.get('kind'), station_ids: f.getAll('st') });
    form.reset(); modal(`<h2>Compte de contrôle créé</h2><p>Transmettez ces informations à l'agent :</p><p>Identifiant : <b class="tk-code">${esc(r.login)}</b><br>Mot de passe : celui que vous venez de saisir.</p><p class="sm mut">Il se connecte sur ${esc(location.origin)} avec « Téléphone » puis arrive sur l'écran de contrôle.</p><button class="btn" data-a="close">Fermer</button>`); await render();
  },
  async agentSave(f, form) {
    await rpc2('carrier_agent_save', { p_id: form.dataset.id, p: { name: f.get('name'), phone: f.get('phone'), kind: f.get('kind'), station_ids: f.getAll('st'), active: !!f.get('active') } });
    if (f.get('password')) await fn('carrier-agent', { action: 'password', agent_id: form.dataset.id, password: f.get('password') });
    UI.agEdit = null; toast('Agent mis à jour.'); await render();
  },
});
Object.assign(I, {
  ctTrip(v) { UI.ctTrip = v; ls14.set('ct-trip', v); tcamStop(); render(); },
  opsDay(v) { UI.opsDay = v; render(); },
  opsF(v) { const k = document.activeElement && document.activeElement.dataset.k; if (!k) return; UI.opsF = { ...(UI.opsF || {}), [k]: v }; render(); },
  tripStatus14(v) { const id = document.activeElement && document.activeElement.dataset.trip; if (v && id) statusAsk(id, v); },
  tripVeh(v) { const id = document.activeElement && document.activeElement.dataset.trip; if (v && id) act(() => rpc2('set_trip_vehicle', { p_trip: id, p_vehicle: v }), 'Véhicule du départ changé.'); },
  tripLine(v) { const l = (window.__lines || []).find(x => x.id === v), f = $('[data-f="carTrip14"]'); if (!l || !f) return; f.from_city.value = l.from_city; f.to_city.value = l.to_city; if (l.price != null) f.price.value = l.price; if (l.from_station) f.from_station.value = l.from_station; },
  hFrom(v) { UI.hFrom = v; render(); }, hTo(v) { UI.hTo = v; render(); }, hRes(v) { UI.hRes = v; render(); },
});

Object.assign(EN, { 'Contrôle transport': 'Transport control', 'SCANNER UN BILLET': 'SCAN A TICKET', 'BILLET VALIDÉ': 'TICKET VALID', 'Suivi en temps réel': 'Live tracking', 'Lignes': 'Routes', 'Agents et appareils': 'Agents and devices', 'Historique des scans': 'Scan history', 'Départs': 'Departures', 'Mes opérations': 'My operations' });

boot();
