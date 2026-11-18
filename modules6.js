'use strict';
/* FatiBillets — plan de salle (places numérotées), connexion de l'administrateur en tant qu'utilisateur,
   villes par pays dans les formulaires et gestion des villes.
   Chargé après modules5.js ; nécessite la base v8 (supabase/schema_v8.sql) et la fonction serveur admin-impersonate. */

/* =====================================================================
   1. CONNEXION DE L'ADMINISTRATEUR EN TANT QU'UTILISATEUR
   ===================================================================== */
const IMP_KEY = 'fatibillets-connexion-en-tant-que';
const impGet = () => { try { return JSON.parse(sessionStorage.getItem(IMP_KEY)); } catch (e) { return null; } };
function impSync() {
  const imp = impGet(), bar = $('#impbar');
  if (!imp || !ME || ME.email === imp.admin) { if (bar) bar.remove(); if (imp && ME && ME.email === imp.admin) sessionStorage.removeItem(IMP_KEY); return; }
  const html = `<span>${ic('shield')} Vous êtes connecté en tant que <b>${esc(imp.name)}</b> (mode assistance FATIGLOBAL). Chaque action est faite au nom de ce compte.</span><button class="btn s" data-a="impBack">Revenir à mon compte administrateur</button>`;
  if (bar) bar.innerHTML = html; else document.body.insertAdjacentHTML('afterbegin', `<div id="impbar" class="impbar">${html}</div>`);
}
const _comptes6 = ADMIN_R.comptes;
ADMIN_R.comptes = async (D, me) => {
  const h = await _comptes6(D, me); if (me.role !== 'admin') return h;
  const users = D.user_list || [];
  return h.replace(/<button class="btn s (?:danger|ok)" data-a="setStatus" data-id="([0-9a-f-]{36})"/g, (m, id) => {
    const u = users.find(x => x.id === id);
    return (u && !['admin', 'admin_secondaire'].includes(u.role) ? `<button class="btn s ghost" data-a="impersonate" data-id="${id}" data-name="${esc(u.org_name || u.full_name || u.email)}">Se connecter en tant que</button> ` : '') + m;
  }).replace('Un administrateur secondaire ne reçoit aucune permission par défaut', '« Se connecter en tant que » ouvre le compte choisi sans son mot de passe : l\'action est journalisée et l\'utilisateur en est notifié. Un administrateur secondaire ne reçoit aucune permission par défaut');
};

/* =====================================================================
   2. VILLES PAR PAYS DANS LES FORMULAIRES
   ===================================================================== */
let CITIES = null;
async function citiesLoad() { if (!CITIES) { try { CITIES = await q(sb.from('cities').select('country_code,name,region').eq('active', true).order('position')); } catch (e) { CITIES = []; } } return CITIES; }
async function citySync() {
  const forms = [...document.querySelectorAll('form')].filter(f => f.elements.city && f.elements.country); if (!forms.length || !DATA) return;
  const C = await citiesLoad(), byName = Object.fromEntries((DATA.countries || []).map(c => [c.name, c.code]));
  forms.forEach((f, i) => {
    const id = 'dl-city-' + i, fill = () => {
      let dl = document.getElementById(id); if (!dl) { dl = document.createElement('datalist'); dl.id = id; document.body.appendChild(dl); }
      const code = byName[f.elements.country.value] || f.elements.country.value;
      dl.innerHTML = C.filter(c => c.country_code === code).map(c => `<option value="${esc(c.name)}">${c.region ? esc(c.region) : ''}</option>`).join('');
      f.elements.city.setAttribute('list', id); f.elements.city.setAttribute('autocomplete', 'off');
    };
    fill(); if (!f.dataset.cityBound) { f.elements.country.addEventListener('change', fill); f.dataset.cityBound = '1'; }
  });
}
const _pays6 = ADMIN_R.pays;
ADMIN_R.pays = async (D, me) => {
  const h = await _pays6(D, me), C = await q(sb.from('countries').select('code,name').order('name')), cc = UI.cityCountry || 'GN';
  const L = await q(sb.from('cities').select('*').eq('country_code', cc).order('region').order('position'));
  return h + `<div class="card pad" style="margin-top:20px"><div class="row between"><h2 style="margin:0">Villes</h2><select class="in" style="width:auto;margin:0" data-i="cityCountry">${C.map(c => `<option value="${esc(c.code)}" ${c.code === cc ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
  ${L.length ? `<div class="chips" style="margin-top:12px">${L.map(c => `<button class="chip ${c.active ? 'on' : ''}" data-a="cityToggle" data-id="${c.id}" data-v="${c.active ? 0 : 1}" title="${c.region ? esc(c.region) + ' — ' : ''}cliquer pour ${c.active ? 'désactiver' : 'activer'}">${esc(c.name)}</button>`).join('')}</div>` : '<p class="sm mut">Aucune ville enregistrée pour ce pays.</p>'}
  <form class="row" data-f="cityAdd" data-cc="${esc(cc)}" style="margin-top:12px"><input class="in" style="flex:2;margin:0" name="name" required minlength="2" placeholder="Nouvelle ville"><input class="in" style="flex:1;margin:0" name="region" placeholder="Région (facultatif)"><button class="btn s">Ajouter</button></form><p class="xs mut">Les villes proposées dans les formulaires de création d'événement et de lieu. La saisie libre reste possible.</p></div>`;
};

/* =====================================================================
   3. PLAN DE SALLE
   ===================================================================== */
UI.seats = UI.seats || {};
const findTier = id => { for (const ev of (DATA ? DATA.events : [])) for (const d of ev.dates) { const t = d.tiers.find(x => x.id === id); if (t) return { ev, d, t }; } return null; };
function parseRows(s) {
  s = String(s || '').trim().toUpperCase(); const m = s.match(/^([A-Z])\s*-\s*([A-Z])$/) || s.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (m) { const a = isNaN(m[1]) ? m[1].charCodeAt(0) : +m[1], b = isNaN(m[2]) ? m[2].charCodeAt(0) : +m[2], out = []; for (let x = a; x <= b; x++) out.push(isNaN(m[1]) ? String.fromCharCode(x) : String(x)); return out; }
  return s.split(/[\s,;]+/).filter(Boolean);
}

// Page événement : catégories à plan de salle → bouton « Choisir mes places » à la place des quantités.
const _vEvent6 = VIEWS.e;
VIEWS.e = async p => {
  let h = await _vEvent6(p); const ev = DATA && DATA.events.find(e => e.id === p[1]); if (!ev) return h;
  const d = ev.dates.find(x => x.id === UI.selDate[ev.id]); if (!d) return h;
  for (const t of d.tiers.filter(x => x.seating)) {
    const s = UI.seats[t.id] || [];
    h = h.replace(new RegExp(`<div class="step"><button data-a="qty" data-t="${t.id}"[\\s\\S]*?</div>`), `<button type="button" class="btn s ${s.length ? '' : 'ghost'}" data-a="seatPick" data-t="${t.id}">${s.length ? s.length + ' place(s) : ' + s.map(esc).join(', ') : 'Choisir mes places'}</button>`);
  }
  return h;
};
function seatMap(t, taken, mine) {
  const S = t.seating, aisles = new Set(S.aisles || []), max = Math.min(t.max_per_order || 10, t.avail + mine.length);
  return `<h2>${esc(t.name)} — choisissez vos places</h2><p class="sm mut">${mine.length} / ${max} place(s) sélectionnée(s) · ${fmt(t.price, findTier(t.id)?.ev.currency)} par place</p>
  <div class="seatmap-wrap"><div class="seatmap"><div class="stage">SCÈNE</div>${S.rows.map(r => `<div class="seat-row"><span class="seat-lbl">${esc(r)}</span>${Array.from({ length: S.seats }, (_, i) => { const n = i + 1, id = r + '-' + n, tk = taken.includes(id) && !mine.includes(id), on = mine.includes(id); return `<button type="button" class="st ${on ? 'on' : ''}" data-a="seatToggle" data-t="${t.id}" data-s="${esc(id)}" ${tk ? 'disabled' : ''} title="Place ${esc(id)}${tk ? ' (prise)' : ''}">${n}</button>${aisles.has(n) ? '<span class="aisle"></span>' : ''}`; }).join('')}<span class="seat-lbl">${esc(r)}</span></div>`).join('')}</div></div>
  <div class="row sm" style="gap:14px;margin:10px 0"><span><i class="st-k"></i> Libre</span><span><i class="st-k on"></i> Votre choix</span><span><i class="st-k tk"></i> Prise</span></div>
  <div class="row"><button class="btn" style="flex:1" data-a="seatOk" data-t="${t.id}">Valider ${mine.length ? mine.length + ' place(s)' : ''}</button><button type="button" class="btn ghost" data-a="close">Annuler</button></div>`;
}
let SEAT_TAKEN = {};
Object.assign(A, {
  async seatPick(el) {
    const f = findTier(el.dataset.t); if (!f) return;
    try { SEAT_TAKEN[f.t.id] = await rpc2('seat_taken', { p_tier: f.t.id }); } catch (e) { return toast(e.message); }
    UI.seatDraft = [...(UI.seats[f.t.id] || [])]; modal(seatMap(f.t, SEAT_TAKEN[f.t.id], UI.seatDraft));
  },
  seatToggle(el) {
    const f = findTier(el.dataset.t), s = el.dataset.s, cur = UI.seatDraft || [], max = Math.min(f.t.max_per_order || 10, f.t.avail + (UI.seats[f.t.id] || []).length);
    if (cur.includes(s)) UI.seatDraft = cur.filter(x => x !== s); else if (cur.length >= max) return toast(`Maximum ${max} place(s) pour cette catégorie.`); else UI.seatDraft = [...cur, s];
    $('#dlg .dlg').innerHTML = seatMap(f.t, SEAT_TAKEN[f.t.id] || [], UI.seatDraft);
  },
  seatOk(el) {
    const f = findTier(el.dataset.t); UI.seats[f.t.id] = [...(UI.seatDraft || [])].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    (UI.sel[f.d.id] = UI.sel[f.d.id] || {})[f.t.id] = UI.seats[f.t.id].length; closeModal(); render();
  },
  async impersonate(el) {
    askReason('Se connecter en tant que ' + el.dataset.name, async m => {
      try {
        const adminEmail = ME.email, r = await fn('admin-impersonate', { user_id: el.dataset.id, reason: m });
        sessionStorage.setItem(IMP_KEY, JSON.stringify({ admin: adminEmail, name: r.name }));
        const { error } = await sb.auth.verifyOtp({ type: 'magiclink', token_hash: r.token_hash }); if (error) throw new Error(error.message);
        await loadMe(); DATA = null; XC = null; location.hash = role() === 'organisateur' ? '#/org' : role() === 'vendeur' ? '#/vente' : '#/compte'; await render(); toast('Connecté en tant que ' + r.name);
      } catch (e) { sessionStorage.removeItem(IMP_KEY); toast(e.message); }
    });
  },
  async impBack() {
    const imp = impGet(); await sb.auth.signOut(); sessionStorage.removeItem(IMP_KEY); ME = null; DATA = null; UI.authTab = 'in'; location.hash = '#/connexion'; await render();
    const i = $('[data-f="signin"] [name="email"]'); if (i && imp) i.value = imp.admin; toast('Reconnectez-vous avec votre compte administrateur.');
  },
  cityToggle(el) { act(async () => { await q(sb.from('cities').update({ active: el.dataset.v === '1' }).eq('id', el.dataset.id)); CITIES = null; }); },
});
const _addCart6 = A.addCart;
A.addCart = el => {
  const form = el.closest('form'), date = form && form.dataset.date, f = date && DATA.events.flatMap(e => e.dates).find(d => d.id === date);
  if (f && f.tiers.some(t => t.seating && (UI.sel[date] || {})[t.id] > 0)) return toast('Les billets à place numérotée se réservent directement, sans passer par le panier.');
  return _addCart6(el);
};
F.reserve = async (f, form) => {
  const date = form.dataset.date, sel = UI.sel[date] || {}, d = DATA.events.flatMap(e => e.dates).find(x => x.id === date);
  const items = Object.entries(sel).filter(([, q]) => q > 0).map(([tier_id, qty]) => ({ tier_id, qty }));
  const seated = (d ? d.tiers : []).filter(t => t.seating && sel[t.id] > 0);
  for (const t of seated) if ((UI.seats[t.id] || []).length !== sel[t.id]) throw new Error('Choisissez vos places pour la catégorie ' + t.name + '.');
  const args = { p_date: date, p_items: items, p_name: f.get('name'), p_phone: f.get('phone'), p_email: f.get('email') };
  const id = seated.length ? await rpc('reserve_seats', { ...args, p_seats: seated.map(t => ({ tier_id: t.id, seats: UI.seats[t.id] })) }) : await rpc('reserve', args);
  rememberOrder(id); UI.sel[date] = {}; seated.forEach(t => delete UI.seats[t.id]); DATA = null; location.hash = '#/commande/' + id;
};

// Organisateur : définir le plan de salle d'une catégorie.
const _modifier6 = ORG_R.modifier;
ORG_R.modifier = async () => {
  const h = await _modifier6(), ev = window.__evEdit; if (!ev || ev.organizer_id !== ME.id) return h;
  return h + `<div class="wrap" style="padding-bottom:34px"><div class="card pad stack" style="max-width:900px"><h2 style="margin:0">Plan de salle</h2><p class="sm mut" style="margin:0">Pour les places numérotées : indiquez les rangées et le nombre de places par rangée. L'acheteur choisit ses places sur le plan ; le nombre de places de la catégorie devient rangées × places. Le plan se règle avant la première vente de la catégorie.</p>
  ${ev.dates.map(d => d.tiers.map(t => { const S = t.seating; return `<form class="tier-edit" data-f="seating" data-id="${t.id}"><div class="row between"><b>${esc(t.name)} · ${dFmt(d.start)}</b>${S ? badge([S.rows.length + ' rangées × ' + S.seats + ' places', 'green']) : badge(['Placement libre', 'gray'])}</div><div class="g3"><label class="f">Rangées (ex. A-J ou A,B,C)<input name="rows" value="${S ? esc(S.rows.join(',')) : ''}" placeholder="A-J"></label><label class="f">Places par rangée<input name="seats" type="number" min="1" max="200" value="${S ? S.seats : ''}"></label><label class="f">Allées après les places n° (facultatif)<input name="aisles" value="${S ? esc((S.aisles || []).join(',')) : ''}" placeholder="Ex. 5,15"></label></div><div class="row"><button class="btn s">Enregistrer le plan</button>${S ? `<button type="button" class="btn s ghost" data-a="seatingOff" data-id="${t.id}">Revenir au placement libre</button>` : ''}</div></form>`; }).join('')).join('')}</div></div>`;
};
A.seatingOff = el => act(() => rpc2('set_tier_seating', { p_id: el.dataset.id, p_rows: null, p_seats: null, p_aisles: null }), 'Placement libre rétabli.');
Object.assign(F, {
  async seating(f, form) {
    const rows = parseRows(f.get('rows')), seats = +f.get('seats'), aisles = String(f.get('aisles') || '').split(/[\s,;]+/).filter(Boolean).map(Number);
    if (!rows.length || !seats) throw new Error('Indiquez les rangées et le nombre de places par rangée.');
    await rpc2('set_tier_seating', { p_id: form.dataset.id, p_rows: rows, p_seats: seats, p_aisles: aisles }); DATA = null; toast(`Plan enregistré : ${rows.length * seats} places.`); await render();
  },
  async cityAdd(f, form) { await q(sb.from('cities').insert({ country_code: form.dataset.cc, name: f.get('name').trim(), region: f.get('region').trim() || null, position: 999 })); CITIES = null; await render(); },
});
Object.assign(I, { cityCountry(v) { UI.cityCountry = v; render(); } });

// Création d'événement : la Guinée est proposée par défaut (la liste des pays est alphabétique).
const _org6 = VIEWS.org;
VIEWS.org = async p => { const h = await _org6(p); return p[1] === 'nouveau' ? h.replace('<option>Guinée</option>', '<option selected>Guinée</option>') : h; };

/* ---------- après chaque affichage : bandeau « connecté en tant que », villes ---------- */
const _render6 = render;
render = async function () { await _render6(); impSync(); citySync(); };

Object.assign(EN, { 'Choisir mes places': 'Choose my seats', 'Plan de salle': 'Seating plan', 'Revenir à mon compte administrateur': 'Back to my administrator account', 'Se connecter en tant que': 'Sign in as', 'Libre': 'Free', 'Votre choix': 'Your choice', 'Prise': 'Taken', 'Villes': 'Cities' });

boot();
