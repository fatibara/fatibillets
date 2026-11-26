'use strict';
/* FatiBillets — « Mes événements », nouveau formulaire de création d'événement (dates début/fin, public multiple,
   billets complets : gratuit/payant, prix promotionnel, plan de salle, période de vente), vendeurs et points de vente
   modifiables et supprimables, lieux localisés automatiquement avec carte.
   Chargé après modules11.js ; nécessite la base v14 et la fonction org-create-seller mise à jour. */

/* =====================================================================
   1. MES ÉVÉNEMENTS
   ===================================================================== */
ORG_TABS.splice(1, 0, ['evenements', 'Mes événements']);
ORG_R.evenements = async () => {
  let O; try { O = await rpc2('org_overview'); } catch (e) { return box('Événements indisponibles', `<p class="mut">${esc(e.message)}</p>`); }
  const f = UI.evF || 'avenir', s = (UI.evQ || '').toLowerCase(), now = Date.now();
  const kind = e => e.cancelled ? 'annule' : !e.published ? 'brouillon' : e.next_at ? 'avenir' : 'passe';
  const L = O.events.filter(e => (f === 'tous' || kind(e) === f) && (!s || e.name.toLowerCase().includes(s)));
  const cnt = k => O.events.filter(e => k === 'tous' || kind(e) === k).length;
  return `<div class="wrap sec stack" style="padding-top:22px"><div class="row between"><h2 style="margin:0">Mes événements</h2><a class="btn" href="#/org/nouveau">+ Créer un événement</a></div>
  <div class="row between" style="gap:10px"><div class="chips">${[['avenir', 'À venir'], ['brouillon', 'Brouillons'], ['passe', 'Passés'], ['annule', 'Annulés'], ['tous', 'Tous']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="evF" data-v="${k}">${l} <span class="mut">${cnt(k)}</span></button>`).join('')}</div><input class="in" style="margin:0;max-width:260px" data-i="evQ" value="${esc(UI.evQ || '')}" placeholder="Rechercher un événement…"></div>
  ${L.length ? `<div class="ev-list">${L.map(e => `<div class="card ev-item">${safeUrl(e.image_url) ? `<img src="${esc(e.image_url)}" alt="" class="thumb">` : `<div class="thumb ph">${ic('cal')}</div>`}<div class="ev-main"><div class="row between" style="align-items:flex-start"><div><a href="#/e/${e.id}"><h3 style="margin:0">${esc(e.name)}</h3></a><div class="xs mut">${esc(e.city || '')} · ${e.dates} date(s) · ${e.next_at ? 'prochaine le ' + dFmt(e.next_at) + ' à ' + hFmt(e.next_at) : e.starts_at ? 'le ' + dFmt(e.starts_at) : ''}</div></div>${badge(e.cancelled ? ['Annulé', 'gray'] : !e.published ? ['Brouillon', 'gray'] : e.next_at ? ['En vente', 'green'] : ['Terminé', 'gray'])}</div>
    <div class="ev-nums"><span><small>Billets vendus</small><b>${num(e.sold)} / ${num(e.capacity)}</b>${bar(+e.sold, +e.capacity)}</span><span><small>Recettes</small><b>${money(e.revenue, e.currency)}</b></span><span><small>Commandes</small><b>${num(e.orders)}</b> <span class="xs mut">${num(e.paid)} payées</span></span><span><small>Entrées</small><b>${num(e.scanned)}</b></span></div>
    <div class="row" style="gap:6px"><a class="btn s" href="#/org/modifier/${e.id}">Modifier</a><a class="btn s ghost" href="#/org/stats/${e.id}">Statistiques</a><a class="btn s ghost" href="#/org/impression/${e.id}">Imprimer les billets</a><a class="btn s ghost" href="#/e/${e.id}">Voir la page</a><button class="btn s ghost" data-a="shareLink" data-url="${esc(location.origin + location.pathname + '#/e/' + e.id)}" data-title="${esc(e.name)}">Lien</button></div></div></div>`).join('')}</div>` : `<div class="empty"><b>Aucun événement ${f === 'tous' ? '' : 'dans cette catégorie'}.</b><br><a class="btn" style="margin-top:12px" href="#/org/nouveau">Créer un événement</a></div>`}</div>`;
};
A.evF = el => { UI.evF = el.dataset.v; render(); };
I.evQ = v => { UI.evQ = v; clearTimeout(I.evQ.t); I.evQ.t = setTimeout(() => render().then(() => { const i = $('[data-i="evQ"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }), 350); };

/* =====================================================================
   2. CRÉER UN ÉVÉNEMENT — formulaire en étapes, aligné
   ===================================================================== */
const AUD = ['Tout public', 'Enfants', 'Adolescents', 'Jeunes', 'Adultes', 'Famille', 'Groupe', 'Professionnels'];
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const evDateRow = (first, d0) => { const d = d0 || new Date(day0() + 7 * DAY); return `<div class="ev-date"><label class="f">Date de début<input data-k="ds" type="date" required value="${ymd(d)}"></label><label class="f">Heure de début<input data-k="hs" type="time" required value="19:00"></label><label class="f">Date de fin<input data-k="de" type="date" required value="${ymd(d)}"></label><label class="f">Heure de fin<input data-k="he" type="time" required value="23:00"></label>${first ? '<span class="dyn-del"></span>' : delBtn.replace('dyn-del"', 'dyn-del" data-row=".ev-date"')}</div>`; };
const tkRow = (first, n = '', p = '', q = '') => `<div class="tk-row"><div class="tk-head"><b>Billet</b>${first ? '' : '<button type="button" class="btn s ghost" data-a="tkDel">− Retirer ce billet</button>'}</div>
  <div class="tk-grid"><label class="f">Nom du billet<input data-k="name" required value="${esc(n)}" placeholder="Ex. VIP"></label><label class="f">Type<select data-k="type" onchange="tkType(this)"><option value="paid">Payant</option><option value="free">Gratuit</option></select></label><label class="f">Prix<input data-k="price" type="number" min="0" step="500" value="${p}" required></label><label class="f">Prix promotionnel <span class="xs mut">(facultatif)</span><input data-k="promo" type="number" min="0" step="500"></label>
  <label class="f">Quantité (places)<input data-k="qty" type="number" min="1" value="${q}" required></label><label class="f">Billets max. par commande<input data-k="max" type="number" min="1" max="50" value="10"></label><label class="f">Début de la vente <span class="xs mut">(facultatif)</span><input data-k="ss" type="datetime-local"></label><label class="f">Fin de la vente <span class="xs mut">(facultatif)</span><input data-k="se" type="datetime-local"></label></div>
  <label class="f">Description du billet <span class="xs mut">(facultatif — ex. accès backstage, boisson offerte)</span><input data-k="desc" maxlength="300"></label>
  <label class="row sm"><input type="checkbox" data-k="seat" onchange="this.closest('.tk-row').querySelector('.tk-seat').hidden=!this.checked;tkSeat(this)"> Places numérotées (plan de salle) : l'acheteur choisit sa place</label>
  <div class="tk-seat" hidden><div class="g3"><label class="f">Rangées (ex. A-J ou A,B,C)<input data-k="rows" placeholder="A-J" oninput="tkSeat(this)"></label><label class="f">Places par rangée<input data-k="seats" type="number" min="1" max="200" oninput="tkSeat(this)"></label><label class="f">Allées après les places n° <span class="xs mut">(facultatif)</span><input data-k="aisles" placeholder="Ex. 5,15"></label></div><p class="xs mut tk-seat-n" style="margin:0"></p></div></div>`;
window.tkType = s => { const p = s.closest('.tk-row').querySelector('[data-k="price"]'), pr = s.closest('.tk-row').querySelector('[data-k="promo"]'), free = s.value === 'free'; p.readOnly = pr.disabled = free; if (free) { p.value = 0; pr.value = ''; } else if (+p.value === 0) { p.value = ''; p.focus(); } };
window.tkSeat = el => { const r = el.closest('.tk-row'), on = r.querySelector('[data-k="seat"]').checked, rows = parseRows(r.querySelector('[data-k="rows"]').value || ''), n = +r.querySelector('[data-k="seats"]').value || 0, q = r.querySelector('[data-k="qty"]'); q.readOnly = on; if (on && rows.length && n) q.value = rows.length * n; r.querySelector('.tk-seat-n').textContent = on && rows.length && n ? `${rows.length} rangée(s) × ${n} places = ${rows.length * n} places numérotées.` : ''; };
async function vNewEvent2() {
  if (!ME) return needLogin(); if (role() !== 'organisateur') return denied();
  const D = await loadData(); let V = []; try { V = await myVenues(); } catch (e) { /* base pas à jour */ }
  const sec = (n, t, body, sub = '') => `<section class="card pad stack ev-sec"><div class="ev-sec-h"><span class="ev-n">${n}</span><div><h2 style="margin:0">${t}</h2>${sub ? `<p class="xs mut" style="margin:2px 0 0">${sub}</p>` : ''}</div></div>${body}</section>`;
  return head('Créer un événement', 'Remplissez les étapes ci-dessous, puis enregistrez une seule fois.') + `<div class="wrap sec"><form class="ev-form stack" data-f="newEvent2" data-map="1">
  ${sec(1, 'Informations générales', `<div class="g2"><label class="f">Nom de l'événement<input name="name" required minlength="3" placeholder="Ex. Festival Kaloum Live"></label><label class="f">Catégorie<select name="category" required>${D.cats.filter(c => c.active).map(c => `<option>${esc(c.name)}</option>`).join('')}</select></label></div>
    <label class="f">Slogan <span class="xs mut">(facultatif)</span><input name="slogan" maxlength="120"></label><label class="f">Description<textarea name="description" rows="4" required></textarea></label>
    <div><div class="sm" style="font-weight:650;margin-bottom:6px">Public concerné <span class="xs mut">(un ou plusieurs)</span></div><div class="aud">${AUD.map((a, i) => `<label class="chip-ck"><input type="checkbox" name="aud" value="${a}" ${i === 0 ? 'checked' : ''}><span>${a}</span></label>`).join('')}</div></div>
    <div class="g2"><label class="f">Mots-clés <span class="xs mut">(séparés par des virgules)</span><input name="keywords" placeholder="Concert, Afrobeat, Live"></label><label class="f">Affiche (JPG, PNG ou WebP, 3 Mo max.)<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label></div>`)}
  ${sec(2, 'Lieu', `<div class="lieu-grid"><div class="stack"><label class="f">Lieu enregistré <span class="xs mut">(facultatif)</span><select name="venue_id" onchange="venuePick(this)"><option value="">— Nouveau lieu (saisie ci-dessous) —</option>${V.map(v => `<option value="${v.id}" data-name="${esc(v.name)}" data-city="${esc(v.city || '')}">${esc(v.name)}${v.city ? ' — ' + esc(v.city) : ''}</option>`).join('')}</select></label><label class="f">Nom du lieu<input name="venue" required placeholder="Ex. Palais du Peuple"></label>
    <label class="f">Adresse<input name="address" placeholder="Quartier, rue, repère"></label><div class="g2"><label class="f">Pays<select name="country">${D.countries.filter(c => c.active).map(c => `<option ${c.name === 'Guinée' ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><label class="f">Ville<input name="city" required value="Conakry"></label></div>
    <div class="geo-bar"><button type="button" class="btn s ghost geo-btn" data-a="geo">${ic('pin')} Utiliser ma position actuelle</button><span class="xs mut geo-msg">ou saisissez le nom et l'adresse : la carte se met à jour.</span><input type="hidden" name="lat"><input type="hidden" name="lng"></div>
    <label class="row sm"><input type="checkbox" name="save_venue" checked> Enregistrer ce lieu dans « Mes lieux »</label></div><div data-map-slot></div></div>`, 'Le lieu est localisé automatiquement et affiché sur la carte.')}
  ${sec(3, 'Dates', `<div class="dyn-list" data-list="evd">${evDateRow(true)}</div><div><button type="button" class="btn s ghost" data-a="evdAdd">+ Ajouter une date</button></div>`, 'Une ligne par date (ex. festival sur 3 jours). Chaque date a ses propres places.')}
  ${sec(4, 'Billets', `<div class="row between"><label class="f" style="margin:0;max-width:260px">Devise des billets<select name="currency">${D.currencies.filter(c => c.active).map(c => `<option value="${esc(c.code)}">${esc(c.code)} — ${esc(c.name)}</option>`).join('')}</select></label><button type="button" class="btn s" data-a="tkAdd">+ Ajouter un billet</button></div><div class="stack" data-list="tk">${tkRow(true, 'Standard', 50000, 500)}${tkRow(false, 'VIP', 150000, 100)}</div>`, 'Gratuit ou payant, prix promotionnel, quantité, période de vente et plan de salle pour chaque billet.')}
  ${sec(5, 'Accès et artistes', `<label class="f">Conditions d'accès <span class="xs mut">(facultatif)</span><input name="access" placeholder="Ex. pièce d'identité exigée, ouverture des portes à 17 h"></label><label class="f">Artistes et invités <span class="xs mut">(un par ligne : Nom — Rôle)</span><textarea name="artists" rows="3" placeholder="Nom de l'artiste — Artiste principal"></textarea></label>`)}
  ${sec(6, 'Publication', `<div class="pub-opt"><label class="chip-ck big"><input type="radio" name="pub" value="now" checked><span><b>Publier maintenant</b><br><small>L'événement est visible et la vente ouvre aussitôt.</small></span></label><label class="chip-ck big"><input type="radio" name="pub" value="draft"><span><b>Enregistrer en brouillon</b><br><small>Invisible du public ; vous publierez plus tard.</small></span></label></div>`)}
  <div class="ev-save"><button class="btn xl">Enregistrer l'événement</button><a class="btn ghost" href="#/org/evenements">Annuler</a></div></form></div>`;
}
// Choix d'un lieu enregistré : nom et ville repris, carte mise à jour.
window.venuePick = s => { const o = s.selectedOptions[0], f = s.closest('form'); if (!o || !o.value) return; f.elements.venue.value = o.dataset.name || ''; if (o.dataset.city) f.elements.city.value = o.dataset.city; f.elements.save_venue.checked = false; f.elements.venue.dispatchEvent(new Event('input')); };
const _org12 = VIEWS.org;
VIEWS.org = async p => (p[1] === 'nouveau' && ME && role() === 'organisateur' ? vNewEvent2() : _org12(p));
GEO_FORMS.newEvent2 = 'event';
Object.assign(A, {
  evdAdd(el) { const L = el.closest('form').querySelector('[data-list="evd"]'); if (L.children.length >= 60) return toast('60 dates maximum.'); const last = L.lastElementChild, d = last ? new Date(last.querySelector('[data-k="ds"]').value + 'T12:00') : null; L.insertAdjacentHTML('beforeend', evDateRow(false, d ? new Date(+d + DAY) : null)); },
  tkAdd(el) { const L = el.closest('form').querySelector('[data-list="tk"]'); if (L.children.length >= 30) return toast('30 billets maximum.'); L.insertAdjacentHTML('beforeend', tkRow(false)); L.lastElementChild.querySelector('input').focus(); },
  tkDel(el) { el.closest('.tk-row').remove(); },
});
const _rowDel12 = A.rowDel;
A.rowDel = el => { const r = el.closest(el.dataset.row || '.dyn-row'); if (r) r.remove(); else if (_rowDel12) _rowDel12(el); };
F.newEvent2 = async (f, form) => {
  const val = (r, k) => (r.querySelector(`[data-k="${k}"]`) || {}).value || '';
  // Dates
  const dates = [...form.querySelectorAll('.ev-date')].map((r, i) => {
    const s = new Date(val(r, 'ds') + 'T' + val(r, 'hs')), e = new Date(val(r, 'de') + 'T' + val(r, 'he'));
    if (isNaN(+s) || isNaN(+e)) throw new Error('Date ' + (i + 1) + ' incomplète.');
    if (+s <= Date.now()) throw new Error('La date ' + (i + 1) + ' doit être dans le futur.');
    if (+e <= +s) throw new Error('Date ' + (i + 1) + ' : la fin doit être après le début.');
    return { starts_at: s.toISOString(), ends_at: e.toISOString() };
  });
  if (!dates.length) throw new Error('Ajoutez au moins une date.');
  if (new Set(dates.map(d => d.starts_at)).size !== dates.length) throw new Error('Deux dates identiques ont été saisies.');
  // Billets
  const T = [...form.querySelectorAll('.tk-row')].map(r => {
    const name = val(r, 'name').trim(), free = val(r, 'type') === 'free', price = free ? 0 : +val(r, 'price'), promo = val(r, 'promo') === '' ? null : +val(r, 'promo');
    const seat = r.querySelector('[data-k="seat"]').checked, rows = seat ? parseRows(val(r, 'rows')) : [], seats = seat ? +val(r, 'seats') : 0;
    const aisles = seat ? String(val(r, 'aisles')).split(/[\s,;]+/).filter(Boolean).map(Number) : [];
    if (!name) throw new Error('Donnez un nom à chaque billet.');
    if (!free && !(price > 0)) throw new Error('Indiquez le prix du billet « ' + name + ' », ou choisissez « Gratuit ».');
    if (promo !== null && !(promo < price)) throw new Error('Billet « ' + name + ' » : le prix promotionnel doit être inférieur au prix normal.');
    if (seat && (!rows.length || !(seats > 0))) throw new Error('Billet « ' + name + ' » : indiquez les rangées et le nombre de places par rangée du plan de salle.');
    const qty = seat ? rows.length * seats : +val(r, 'qty');
    if (!(qty > 0)) throw new Error('Billet « ' + name + ' » : indiquez la quantité.');
    const ss = val(r, 'ss'), se = val(r, 'se'); if (ss && se && new Date(ss) >= new Date(se)) throw new Error('Billet « ' + name + ' » : la fin de la vente doit être après son début.');
    return { name, price, promo, qty, max: +val(r, 'max') || 10, ss, se, desc: val(r, 'desc').trim(), seat, rows, seats, aisles };
  });
  if (!T.length) throw new Error('Ajoutez au moins un billet.');
  if (new Set(T.map(t => t.name.toLowerCase())).size !== T.length) throw new Error('Deux billets portent le même nom.');
  // Création
  const image_url = await uploadImage(f.get('image')), pal = [['#FF8A1F', '#C2185B'], ['#F59E0B', '#D4500A'], ['#EA580C', '#7C2D12'], ['#B45309', '#E11D48'], ['#FB923C', '#9A3412'], ['#F97316', '#4C1D95']], c = pal[Math.floor(Math.random() * pal.length)];
  const venueName = f.get('venue').trim(), address = (f.get('address') || '').trim();
  const id = await rpc('create_event', { p: { name: f.get('name').trim(), slogan: f.get('slogan').trim(), description: f.get('description').trim(), category: f.get('category'), country: f.get('country'), city: f.get('city').trim(),
    venue: address ? venueName + ', ' + address : venueName, audience: f.getAll('aud').join(', ') || 'Tout public', access: f.get('access').trim(), payment_info: '',
    keywords: f.get('keywords').split(',').map(s => s.trim()).filter(Boolean), artists: f.get('artists').split('\n').map(l => l.split(/\s+[—-]\s+/)).filter(a => a[0].trim()).map(a => ({ name: a[0].trim(), role: (a[1] || 'Invité').trim() })),
    color1: c[0], color2: c[1], starts_at: dates[0].starts_at, ends_at: dates[0].ends_at, dates, currency: f.get('currency') || 'GNF', image_url, tiers: T.map(t => ({ name: t.name, price: t.price, quota: t.qty })) } });
  // Réglages de chaque billet (toutes les dates).
  const notes = [], step = async (label, fn0) => { try { await fn0(); } catch (e) { notes.push(label + ' : ' + e.message); } };
  const TT = await q(sb.from('tiers').select('id,name').eq('event_id', id)).catch(() => []);
  for (const t of T) for (const x of TT.filter(y => y.name === t.name)) {
    if (t.desc || t.max !== 10 || t.ss || t.se) await step('billet ' + t.name, () => rpc2('update_tier', { p_id: x.id, p: { description: t.desc, max_per_order: t.max, sales_start: t.ss ? fromLocalInput(t.ss) : '', sales_end: t.se ? fromLocalInput(t.se) : '' } }));
    if (t.promo !== null) await step('prix promotionnel ' + t.name, () => rpc2('set_tier_promo', { p_id: x.id, p_promo: t.promo }));
    if (t.seat) await step('plan de salle ' + t.name, () => rpc2('set_tier_seating', { p_id: x.id, p_rows: t.rows, p_seats: t.seats, p_aisles: t.aisles }));
  }
  // Lieu
  let vid = f.get('venue_id');
  if (!vid && f.get('save_venue') && venueName) await step('lieu', async () => {
    const V = await q(sb.from('venues').select('id,name,city').eq('organizer_id', ME.id));
    vid = (V.find(v => v.name.toLowerCase() === venueName.toLowerCase() && (v.city || '').toLowerCase() === f.get('city').trim().toLowerCase()) || {}).id;
    if (!vid) { vid = await rpc2('save_venue', { p: { name: venueName, address: address || venueName, city: f.get('city').trim(), country: f.get('country'), listed: false } }); await saveGeo('venue', vid, form); }
  });
  if (vid) await step('lieu', () => rpc2('set_event_venue', { p_event: id, p_venue: vid }));
  await saveGeo('event', id, form);
  if (f.get('pub') === 'draft') await step('brouillon', () => rpc2('set_event_flags', { p_event: id, p: { published: false } }));
  DATA = null; XC = null;
  location.hash = f.get('pub') === 'draft' ? '#/org/modifier/' + id : '#/e/' + id;
  toast(notes.length ? 'Événement enregistré. À vérifier — ' + notes.join(' ; ') : f.get('pub') === 'draft' ? 'Événement enregistré en brouillon.' : 'Événement publié.');
};

/* =====================================================================
   3. VENDEURS ET POINTS DE VENTE
   ===================================================================== */
ORG_R.vendeurs = async () => {
  let P; try { P = await rpc2('org_pos'); } catch (e) { return box('Vendeurs indisponibles', `<p class="mut">${esc(e.message)}</p>`); }
  const EV = (await q(sb.from('events').select('id,name,cancelled,archived').eq('organizer_id', ME.id).order('created_at', { ascending: false }))).filter(e => !e.cancelled && !e.archived);
  const pe = UI.posEdit === '' ? {} : P.pos.find(x => x.id === UI.posEdit), se = UI.selEdit === '' ? {} : P.sellers.find(x => x.id === UI.selEdit);
  const posOpt = sel => `<option value="">— Aucun —</option>${P.pos.map(x => `<option value="${x.id}" ${sel === x.id ? 'selected' : ''}>${esc(x.name)}${x.active ? '' : ' (fermé)'}</option>`).join('')}`;
  const evChecks = (sel = []) => EV.length ? `<div class="feat-list">${EV.map(e => `<label class="row sm"><input type="checkbox" name="events" value="${e.id}" ${sel.includes(e.id) ? 'checked' : ''}> ${esc(e.name)}</label>`).join('')}</div>` : '<p class="sm mut">Aucun événement actif.</p>';
  const posForm = pe ? `<form class="card pad stack" data-f="pos" data-id="${pe.id || ''}" style="max-width:760px"><h2 style="margin:0">${pe.id ? 'Modifier le point de vente' : 'Nouveau point de vente'}</h2><div class="g2"><label class="f">Nom<input name="name" required minlength="2" value="${esc(pe.name || '')}" placeholder="Ex. Guichet Kaloum"></label><label class="f">Téléphone<input name="phone" value="${esc(pe.phone || '')}"></label><label class="f">Adresse<input name="address" value="${esc(pe.address || '')}"></label><label class="f">Ville<input name="city" value="${esc(pe.city || 'Conakry')}"></label></div>${pe.id ? `<label class="row sm"><input type="checkbox" name="active" ${pe.active ? 'checked' : ''}> Ouvert</label>` : ''}<div class="row"><button class="btn">Enregistrer</button><button type="button" class="btn ghost" data-a="posEdit" data-id="x">Annuler</button></div></form>` : '';
  const selForm = se && se.id ? `<form class="card pad stack" data-f="sellerSave" data-id="${se.id}" style="max-width:760px"><h2 style="margin:0">Modifier le vendeur « ${esc(se.name || se.email)} »</h2><div class="g2"><label class="f">Nom<input name="name" required minlength="2" value="${esc(se.name || '')}" ${se.role === 'vendeur' ? '' : 'readonly'}></label><label class="f">Téléphone<input name="phone" value="${esc(se.phone || '')}" ${se.role === 'vendeur' ? '' : 'readonly'}></label><label class="f">Point de vente<select name="pos_id">${posOpt(se.pos_id)}</select></label>${se.role === 'vendeur' ? '<label class="f">Nouveau mot de passe <span class="xs mut">(vide = inchangé)</span><input name="password" type="text" minlength="8" autocomplete="new-password"></label>' : '<span></span>'}</div><div><div class="sm" style="font-weight:650;margin-bottom:6px">Événements qu\'il peut vendre</div>${evChecks(se.events)}</div><div class="row"><button class="btn">Enregistrer</button><button type="button" class="btn ghost" data-a="selEdit" data-id="x">Annuler</button></div></form>` : '';
  const newSel = se && !se.id ? `<form class="card pad stack" data-f="sellerCreate" style="max-width:760px"><h2 style="margin:0">Nouveau compte vendeur</h2><p class="sm mut" style="margin:0">Vous choisissez l'identifiant (e-mail) et le mot de passe, puis vous les remettez au vendeur. Ce compte sert uniquement à vendre les billets des événements cochés.</p><div class="g2"><label class="f">Nom du vendeur<input name="name" required minlength="2"></label><label class="f">Téléphone<input name="phone" inputmode="tel"></label><label class="f">E-mail (identifiant de connexion)<input name="email" type="email" required autocomplete="off"></label><label class="f">Mot de passe (8 caractères minimum)<input name="password" type="text" required minlength="8" autocomplete="new-password"></label><label class="f">Point de vente<select name="pos_id">${posOpt('')}</select></label></div><div><div class="sm" style="font-weight:650;margin-bottom:6px">Événements qu'il peut vendre</div>${evChecks()}</div><div class="row"><button class="btn">Créer le compte</button><button type="button" class="btn ghost" data-a="selEdit" data-id="x">Annuler</button></div></form>` : '';
  const sold = P.sellers.reduce((a, s) => a + +s.sold, 0), amt = P.sellers.reduce((a, s) => a + +s.amount, 0);
  return `<div class="wrap sec stack" style="padding-top:22px"><div class="kpis"><div class="kpi"><small>Points de vente</small><b>${P.pos.length}</b><span class="xs mut">${P.pos.filter(x => x.active).length} ouverts</span></div><div class="kpi"><small>Vendeurs</small><b>${P.sellers.length}</b><span class="xs mut">${P.sellers.filter(x => x.active).length} actifs</span></div><div class="kpi"><small>Billets vendus au guichet</small><b>${num(sold)}</b></div><div class="kpi hot"><small>Ventes au guichet</small><b>${money(amt)}</b></div></div>
  <div class="card pad stack"><div class="row between"><h2 style="margin:0">Points de vente</h2><button class="btn s" data-a="posEdit" data-id="">+ Nouveau point de vente</button></div>${posForm}
  ${P.pos.length ? `<div class="tw"><table><tr><th>Point de vente</th><th class="n">Vendeurs</th><th class="n">Billets</th><th class="n">Ventes</th><th>Statut</th><th></th></tr>${P.pos.map(x => `<tr><td><b>${esc(x.name)}</b><div class="xs mut">${esc([x.address, x.city, x.phone].filter(Boolean).join(' · '))}</div></td><td class="n">${x.sellers}</td><td class="n">${num(x.sold)}</td><td class="n">${money(x.amount)}</td><td>${badge(x.active ? ['Ouvert', 'green'] : ['Fermé', 'gray'])}</td>
    <td class="r nowrap"><button class="btn s ghost" data-a="posEdit" data-id="${x.id}">Modifier</button> <button class="btn s ghost" data-a="posToggle12" data-id="${x.id}">${x.active ? 'Fermer' : 'Ouvrir'}</button> <button class="btn s danger" data-a="posDel12" data-id="${x.id}" data-name="${esc(x.name)}">Supprimer</button></td></tr>`).join('')}</table></div>` : '<p class="sm mut">Aucun point de vente.</p>'}</div>
  <div class="card pad stack"><div class="row between"><h2 style="margin:0">Vendeurs</h2><button class="btn s" data-a="selEdit" data-id="">+ Nouveau vendeur</button></div>${newSel}${selForm}
  ${P.sellers.length ? `<div class="tw"><table><tr><th>Vendeur</th><th>Point de vente</th><th class="n">Événements</th><th class="n">Billets</th><th class="n">Ventes</th><th>Dernière vente</th><th>Statut</th><th></th></tr>${P.sellers.map(s => `<tr><td><b>${esc(s.name || '—')}</b><div class="xs mut">${esc([s.phone, s.email].filter(Boolean).join(' · '))}</div></td><td class="sm">${esc((P.pos.find(x => x.id === s.pos_id) || {}).name || '—')}</td><td class="n">${s.events.length}</td><td class="n">${num(s.sold)}</td><td class="n">${money(s.amount)}</td><td class="sm">${s.last_at ? dtFmt(s.last_at) : '—'}</td><td>${badge(s.active ? ['Actif', 'green'] : ['Suspendu', 'gray'])}</td>
    <td class="r nowrap"><button class="btn s ghost" data-a="selEdit" data-id="${s.id}">Modifier</button> <button class="btn s ghost" data-a="selToggle" data-id="${s.id}" data-on="${s.active ? 0 : 1}">${s.active ? 'Suspendre' : 'Réactiver'}</button> <button class="btn s danger" data-a="selDel" data-id="${s.id}" data-name="${esc(s.name || s.email)}">Supprimer</button></td></tr>`).join('')}</table></div>` : '<p class="sm mut">Aucun vendeur.</p>'}</div></div>`;
};
Object.assign(A, {
  posEdit(el) { UI.posEdit = el.dataset.id === 'x' ? null : el.dataset.id; render(); },
  selEdit(el) { UI.selEdit = el.dataset.id === 'x' ? null : el.dataset.id; render(); },
  async posToggle12(el) { const P = await rpc2('org_pos'), x = P.pos.find(y => y.id === el.dataset.id); if (!x) return; act(() => rpc2('save_pos', { p: { id: x.id, name: x.name, address: x.address, city: x.city, phone: x.phone, active: !x.active } }), x.active ? 'Point de vente fermé.' : 'Point de vente ouvert.'); },
  posDel12(el) { if (!confirm('Supprimer le point de vente « ' + el.dataset.name + ' » ?\n\nSes vendeurs restent (sans point de vente) et leurs ventes restent dans l\'historique.')) return; act(() => rpc2('delete_pos', { p_id: el.dataset.id }), 'Point de vente supprimé.'); },
  selToggle(el) { act(() => rpc2('org_seller_save', { p_seller: el.dataset.id, p: { active: el.dataset.on === '1' } }), el.dataset.on === '1' ? 'Vendeur réactivé.' : 'Vendeur suspendu : il ne peut plus vendre vos billets.'); },
  selDel(el) {
    if (!confirm('Supprimer le vendeur « ' + el.dataset.name + ' » ?\n\nSes accès sont retirés. S\'il a déjà vendu des billets, son compte est fermé et l\'historique des ventes est conservé.')) return;
    act(async () => { const r = await fn('org-create-seller', { action: 'delete', seller_id: el.dataset.id }); XC = null; if (r.mode === 'ferme') toast('Compte fermé : l\'historique de ses ventes est conservé.'); }, 'Vendeur supprimé.');
  },
});
F.sellerSave = async (f, form) => {
  const id = form.dataset.id;
  await rpc2('org_seller_save', { p_seller: id, p: { name: f.get('name'), phone: f.get('phone') } });
  await rpc2('set_seller_events', { p_seller: id, p_events: f.getAll('events'), p_pos: f.get('pos_id') || null });
  if (f.get('password')) await fn('org-create-seller', { action: 'password', seller_id: id, password: f.get('password') });
  UI.selEdit = null; XC = null; toast('Vendeur mis à jour.'); await render();
};
const _sellerCreate12 = F.sellerCreate;
F.sellerCreate = async (f, form) => { await _sellerCreate12(f, form); UI.selEdit = null; await render(); };

/* =====================================================================
   4. LIEUX : LOCALISATION AUTOMATIQUE ET CARTE
   ===================================================================== */
const mapSrc = (lat, lng) => { const d = 0.006; return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`; };
async function geoSearch(qs) {
  try { const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=fr&q=' + encodeURIComponent(qs), { headers: { Accept: 'application/json' } }); const L = r.ok ? await r.json() : []; return L[0] || null; } catch (e) { return null; }
}
function mapAttach(form) {
  if (form.querySelector('.map-box')) return;
  const slot = form.querySelector('[data-map-slot]');
  if (!slot) form.classList.add('has-map');
  (slot || form).insertAdjacentHTML('beforeend', `<div class="map-box"><div class="map-frame"><div class="map-empty">${ic('pin')}<span>Saisissez le nom ou l'adresse du lieu : il apparaît ici sur la carte.</span></div></div><p class="xs mut map-msg" style="margin:6px 0 0"></p></div>`);
  if (!form.elements.lat) form.insertAdjacentHTML('beforeend', '<input type="hidden" name="lat"><input type="hidden" name="lng">');
  const box = form.querySelector('.map-box'), frame = box.querySelector('.map-frame'), msg = box.querySelector('.map-msg');
  const show = (lat, lng, label) => { frame.innerHTML = `<iframe title="Carte du lieu" loading="lazy" src="${mapSrc(+lat, +lng)}"></iframe>`; msg.innerHTML = `${esc(label || '')} — <a href="${mapLink(lat, lng)}" target="_blank" rel="noopener noreferrer">ouvrir la carte en grand</a>`; };
  const pick = n => (form.elements[n] && form.elements[n].value || '').trim();
  let t = null, last = '';
  const run = async () => {
    const qs = [pick('venue') || pick('name'), pick('address'), pick('neighborhoods'), pick('city'), pick('country') || 'Guinée'].filter(Boolean).join(', ');
    if (qs.length < 6 || qs === last) return; last = qs; msg.textContent = 'Recherche du lieu sur la carte…';
    const g = await geoSearch(qs) || await geoSearch([pick('address'), pick('city'), pick('country') || 'Guinée'].filter(Boolean).join(', ')) || await geoSearch([pick('city'), pick('country') || 'Guinée'].filter(Boolean).join(', '));
    if (!g) { msg.textContent = 'Lieu introuvable sur la carte : précisez l\'adresse ou utilisez « Utiliser ma position actuelle ».'; return; }
    form.elements.lat.value = (+g.lat).toFixed(6); form.elements.lng.value = (+g.lon).toFixed(6); show(g.lat, g.lon, g.display_name);
  };
  ['venue', 'name', 'address', 'city', 'neighborhoods', 'country'].forEach(n => { const i = form.elements[n]; if (i && !(n === 'name' && form.dataset.f === 'newEvent2')) i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => { clearTimeout(t); t = setTimeout(run, 1100); }); });
  // La position fixée par « Utiliser ma position actuelle » met aussi la carte à jour.
  new MutationObserver(() => { const la = form.elements.lat.value, ln = form.elements.lng.value; if (la && ln && !frame.querySelector('iframe[src*="' + la + '"]')) show(la, ln, 'Position enregistrée'); }).observe(form.querySelector('.geo-msg') || box, { childList: true, subtree: true, characterData: true });
  if (form.dataset.lat && form.dataset.lng) { form.elements.lat.value = form.dataset.lat; form.elements.lng.value = form.dataset.lng; show(form.dataset.lat, form.dataset.lng, 'Position enregistrée'); }
}
// Formulaire de lieu : position déjà connue affichée tout de suite.
const _lieux12 = ORG_R.lieux;
ORG_R.lieux = async () => {
  const h = await _lieux12(); if (!UI.venueEdit) return h;
  let v = null; try { v = await q(sb.from('venues').select('lat,lng').eq('id', UI.venueEdit).maybeSingle()); } catch (e) { return h; }
  return v && v.lat ? h.replace(`data-f="venue" data-id="${UI.venueEdit}"`, `data-f="venue" data-id="${UI.venueEdit}" data-lat="${v.lat}" data-lng="${v.lng}"`) : h;
};
const _render12 = render;
render = async function () { await _render12(); document.querySelectorAll('form[data-f="venue"], form[data-f="newEvent2"]').forEach(mapAttach); };

Object.assign(EN, { 'Mes événements': 'My events', 'Créer un événement': 'Create an event', 'Informations générales': 'General information', 'Lieu': 'Venue', 'Dates': 'Dates', 'Billets': 'Tickets', 'Publication': 'Publishing', 'Enregistrer l\'événement': 'Save event', '+ Ajouter une date': '+ Add a date', '+ Ajouter un billet': '+ Add a ticket' });

// boot() est appelé à la fin de modules13.js, chargé après ce fichier.
