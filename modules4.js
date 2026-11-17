'use strict';
/* FatiBillets — impression personnalisée (billets, souches, bracelets, badges), statistiques par date et participants,
   prix promotionnel, réglages du site (maintenance, contacts, accueil, événements à la une), corbeille, blog.
   Chargé après modules3.js ; nécessite la base v6 (supabase/schema_v6.sql). */

Object.assign(TAB_PERM, { stats: 'evenements', blog: 'contenus' });

/* ---------- réglages du site chargés avec les données ---------- */
const _loadData4 = loadData;
loadData = async function (force) {
  const D = await _loadData4(force);
  if (!D.site || force) { const r = await sb.from('site_settings').select('key,value'); D.site = Object.fromEntries((r.error ? [] : r.data).map(x => [x.key, x.value])); }
  return D;
};
function footSync() {
  const S = DATA && DATA.site, box = document.querySelector('.foot-in > div'); if (!S || !box) return;
  let el = $('#footContact'); if (!el) { el = document.createElement('div'); el.id = 'footContact'; el.className = 'xs'; el.style.marginTop = '4px'; box.appendChild(el); }
  el.innerHTML = [S.contact_phone, S.contact_email, S.contact_address].filter(Boolean).map(esc).join(' · ') + Object.entries(S.socials || {}).map(([k, u]) => ` · <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(SOCIAL_L[k] || k)}</a>`).join('');
}
const _render4 = render;
render = async function () {
  try {
    const D = await loadData(), S = D.site || {};
    if (S.maintenance === true && !isStaff() && !/^#\/connexion/.test(location.hash)) {
      nav((location.hash || '#/').slice(2).split('/'), location.hash || '#/');
      $('#app').innerHTML = `<div class="wrap sec"><div class="empty" style="max-width:620px;margin:40px auto"><h1 style="font-size:1.8rem">Maintenance en cours</h1><p>${esc(S.maintenance_message || 'FatiBillets est momentanément indisponible pour une opération de maintenance. Merci de revenir dans quelques instants.')}</p><a class="btn s ghost" href="#/connexion">Connexion de l'équipe</a></div></div>`;
      footSync(); return;
    }
  } catch (e) { /* on affiche le site normalement */ }
  await _render4(); footSync();
};

/* ---------- accueil : textes et événements à la une ---------- */
const _ring4 = ring;
ring = function (list) {
  const f = DATA && DATA.site && DATA.site.featured_events;
  if (Array.isArray(f) && f.length) { const sel = f.map(id => list.find(e => e.id === id)).filter(Boolean); if (sel.length >= 3) return _ring4(sel); }
  return _ring4(list);
};
const _home4 = VIEWS[''];
VIEWS[''] = async p => {
  let h = await _home4(p); const S = (DATA && DATA.site) || {};
  if (S.home_title) h = h.replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${esc(S.home_title)}</h1>`);
  if (S.home_subtitle) h = h.replace(/<p class="lead">[\s\S]*?<\/p>/, `<p class="lead">${esc(S.home_subtitle)}</p>`);
  return h;
};

/* ---------- statistiques par date et participants ---------- */
async function statsView(id, isAdmin) {
  const S = await rpc2('event_stats', { p_event: id }), cur = S.event.currency; window.__parts = S.participants; window.__statsEv = S.event;
  const T = S.dates.flatMap(d => d.tiers), sold = T.reduce((a, t) => a + +t.sold, 0), rev = T.reduce((a, t) => a + +t.revenue, 0), scanned = T.reduce((a, t) => a + +t.scanned, 0), quota = T.reduce((a, t) => a + +t.quota, 0);
  const chan = { en_ligne: 'En ligne', vendeur: 'Guichet' };
  return `<div class="stack"><div class="row between"><h2 style="margin:0">${esc(S.event.name)}</h2><div class="row">${isAdmin ? '' : `<a class="btn s" href="#/org/impression/${id}">Imprimer billets et bracelets</a><a class="btn s ghost" href="#/org/modifier/${id}">Modifier</a>`}</div></div>
  <div class="kpis"><div class="kpi hot"><small>Recettes</small><b>${money(rev, cur)}</b></div><div class="kpi"><small>Billets vendus</small><b>${num(sold)} / ${num(quota)}</b></div><div class="kpi"><small>Taux de remplissage</small><b>${quota ? Math.round(sold / quota * 100) : 0} %</b></div><div class="kpi"><small>Entrées scannées</small><b>${num(scanned)}</b></div>${S.channels.map(c => `<div class="kpi"><small>Commandes ${esc(chan[c.channel] || c.channel)}</small><b>${num(c.orders)} · ${money(c.amount, cur)}</b></div>`).join('')}</div>
  ${S.dates.map(d => `<div class="card pad"><h3>${dFmt(d.start)} · ${hFmt(d.start)}</h3><div class="tw"><table><tr><th>Catégorie</th><th class="n">Prix</th><th class="n">Places</th><th class="n">Vendus</th><th class="n">Scannés</th><th class="n">Remboursés</th><th class="n">Disponibles</th><th class="n">Recettes</th><th style="min-width:110px">Remplissage</th></tr>${d.tiers.map(t => `<tr><td><b>${esc(t.name)}</b></td><td class="n">${t.promo != null && +t.promo < +t.price ? `<s class="mut">${money(t.price, cur)}</s> ${money(t.promo, cur)}` : money(t.price, cur)}</td><td class="n">${num(t.quota)}</td><td class="n">${num(t.sold)}</td><td class="n">${num(t.scanned)}</td><td class="n">${num(t.refunded)}</td><td class="n">${num(t.available)}</td><td class="n"><b>${money(t.revenue, cur)}</b></td><td><div class="bar"><i style="width:${t.quota ? Math.min(100, t.sold / t.quota * 100) : 0}%"></i></div></td></tr>`).join('')}</table></div></div>`).join('')}
  <div class="card pad"><div class="row between"><h2 style="margin:0">Participants (${S.participants.length})</h2><div class="row"><input class="in" style="max-width:260px;margin:0" data-i="pq" placeholder="Nom, code, téléphone…"><button class="btn s ghost" data-a="csvParts">Exporter (Excel/CSV)</button></div></div>${S.participants.length ? `<div class="tw"><table><tr><th>Code</th><th>Titulaire</th><th>Catégorie</th><th>Date</th><th>Contact</th><th>Canal</th><th>Statut</th></tr>${S.participants.map(k => `<tr data-row="${esc(norm([k.code, k.holder, k.phone, k.email, k.tier].join(' ')))}"><td class="tk-code">${esc(k.code)}</td><td>${esc(k.holder || '')}</td><td>${esc(k.tier)}</td><td class="sm nowrap">${dFmt(k.date)}</td><td class="xs">${esc(k.phone || '')}<br>${esc(k.email || '')}</td><td class="sm">${esc(chan[k.channel] || k.channel || '')}</td><td>${badge(tkBadge(k.status))}${k.scanned_at ? `<div class="xs mut">${dtFmt(k.scanned_at)}</div>` : ''}</td></tr>`).join('')}</table></div>` : '<p class="mut sm">Aucun billet émis.</p>'}<p class="xs mut">Les coordonnées des participants ne doivent servir qu'à l'organisation de l'événement.</p></div></div>`;
}
ORG_R.stats = async () => `<div class="wrap sec" style="padding-top:22px">${await statsView(location.hash.split('/')[3], false)}</div>`;
ADMIN_R.stats = async () => statsView(location.hash.split('/')[3], true);

/* ---------- impression personnalisée ---------- */
const PRINT_PRESETS = {
  classique: { l: 'Ticket classique', w: 150, h: 60 },
  souche: { l: 'Ticket avec souche', w: 180, h: 65, stub: true },
  bracelet: { l: 'Bracelet Standard', w: 250, h: 25, band: true, bg: '#F26A0F', fg: '#ffffff', accent: '#ffffff' },
  bracelet_vip: { l: 'Bracelet VIP', w: 250, h: 25, band: true, bg: '#C9A227', fg: '#1a1a1a', accent: '#1a1a1a' },
  bracelet_vvip: { l: 'Bracelet VVIP', w: 250, h: 25, band: true, bg: '#111111', fg: '#E8C766', accent: '#E8C766' },
  badge: { l: 'Badge', w: 54, h: 86, vertical: true },
  cinema: { l: 'Ticket cinéma', w: 80, h: 50 },
  transport: { l: 'Ticket de transport', w: 80, h: 120, vertical: true },
};
const PD_DEFAULT = { format: 'classique', w: 150, h: 60, bg: '#ffffff', fg: '#22150D', accent: '#F26A0F', title: '', subtitle: '', showLogo: true, showQR: true, showCode: true, showHolder: true, showDates: true, tier: '', status: 'valide' };
function ticketHTML(k, d, ev) {
  const P = PRINT_PRESETS[d.format] || {}, W = +d.w || 150, H = +d.h || 60, band = P.band || H < 35, vert = P.vertical || H > W;
  const qr = d.showQR ? Math.max(10, Math.min(band ? H - 4 : vert ? W - 10 : H - 8, 34)) : 0, fs = band ? 2.6 : Math.max(2.4, Math.min(4.2, H / 16));
  const logo = d.showLogo && safeUrl(ev.image_url) ? `<img src="${esc(ev.image_url)}" alt="" style="height:${band ? H - 6 : Math.min(H * 0.3, 16)}mm;max-width:${band ? 20 : 34}mm;object-fit:cover;border-radius:1mm">` : '';
  const info = [d.title || ev.name, d.subtitle, k.tier + (d.showHolder && k.holder ? ' · ' + k.holder : ''), d.showDates ? 'Événement : ' + dFmt(k.date) + ' à ' + hFmt(k.date) : '', [ev.venue, ev.city].filter(Boolean).join(', '), d.showCode ? 'N° ' + k.code : '', d.showDates ? 'Émis le ' + dFmt(k.created_at) + ' · imprimé le ' + dFmt(Date.now()) : ''].filter(Boolean);
  const qrBox = qr ? `<div style="width:${qr}mm;height:${qr}mm;flex:none;background:#fff;padding:1mm;border-radius:1mm">${qrSvg(k.code).replace('<svg', '<svg style="width:100%;height:100%;display:block"')}</div>` : '';
  const text = band ? `<div style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b style="color:${esc(d.accent)}">${esc(info[0])}</b> · ${esc(info.slice(1).join(' · '))}</div>`
    : `<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:.6mm;overflow:hidden"><b style="font-size:${fs * 1.35}mm;color:${esc(d.accent)};line-height:1.1">${esc(info[0])}</b>${info.slice(1).map(x => `<span>${esc(x)}</span>`).join('')}</div>`;
  const stub = P.stub ? `<div style="width:38mm;flex:none;border-left:.4mm dashed ${esc(d.fg)};padding-left:3mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1mm;font-size:${fs * .85}mm">${qrBox}<span>${esc(k.code)}</span><span>${esc(k.tier)}</span></div>` : '';
  return `<div class="print-tk" style="width:${W}mm;height:${H}mm;background:${esc(d.bg)};color:${esc(d.fg)};font-size:${fs}mm;display:flex;flex-direction:${vert && !band ? 'column' : 'row'};align-items:${vert ? 'stretch' : 'center'};gap:3mm;padding:${band ? 1.5 : 4}mm;border:.3mm solid #ccc;border-radius:${band ? 0 : 2}mm;overflow:hidden;box-sizing:border-box">${logo}${text}${P.stub ? stub : qrBox}</div>`;
}
function pdFiltered() { const d = UI.pd; return (window.__parts || []).filter(k => k.status !== 'rembourse' && (d.status === 'tous' || k.status === d.status) && (!d.tier || k.tier === d.tier)); }
function pdPreview() {
  const box = $('#pdPreview'); if (!box) return; const L = pdFiltered(), ev = window.__statsEv;
  const sample = L[0] || { code: 'FB-EXEMPLE00000', holder: 'Nom du titulaire', tier: 'Standard', date: Date.now() + 7 * DAY, created_at: Date.now(), status: 'valide' };
  box.innerHTML = `<div class="pd-scale">${ticketHTML(sample, UI.pd, ev)}</div><p class="sm mut" style="margin:10px 0 0">${L.length} billet(s) correspondant(s) à imprimer${L.length ? '' : ' — l\'aperçu montre un exemple fictif'}.</p>`;
}
ORG_R.impression = async () => {
  const id = location.hash.split('/')[3], S = await rpc2('event_stats', { p_event: id }); window.__parts = S.participants; window.__statsEv = S.event;
  UI.pd = Object.assign({}, PD_DEFAULT, S.event.print_design || {}, UI.pdFor === id ? UI.pd : {}); UI.pdFor = id; const d = UI.pd;
  const tiers = [...new Set(S.participants.map(k => k.tier))];
  setTimeout(pdPreview, 0);
  return `<div class="wrap sec stack" style="padding-top:22px"><div class="row between"><h2 style="margin:0">Impression — ${esc(S.event.name)}</h2><a class="btn s ghost" href="#/org/stats/${id}">Statistiques</a></div><div class="cols"><form class="card pad stack" id="pdForm" data-f="pdSave" data-id="${id}">
  <label class="f">Format<select name="format" data-i="pdFormat">${Object.entries(PRINT_PRESETS).map(([k, p]) => `<option value="${k}" ${d.format === k ? 'selected' : ''}>${p.l} (${p.w} × ${p.h} mm)</option>`).join('')}</select></label>
  <div class="g2"><label class="f">Largeur (mm)<input name="w" type="number" min="20" max="300" value="${d.w}" data-i="pd"></label><label class="f">Hauteur (mm)<input name="h" type="number" min="15" max="300" value="${d.h}" data-i="pd"></label><label class="f">Fond<input name="bg" type="color" value="${esc(d.bg)}" data-i="pd"></label><label class="f">Texte<input name="fg" type="color" value="${esc(d.fg)}" data-i="pd"></label><label class="f">Couleur d'accent<input name="accent" type="color" value="${esc(d.accent)}" data-i="pd"></label></div>
  <label class="f">Titre (vide = nom de l'événement)<input name="title" maxlength="80" value="${esc(d.title)}" data-i="pd"></label><label class="f">Sous-titre<input name="subtitle" maxlength="120" value="${esc(d.subtitle)}" data-i="pd"></label>
  <div class="row">${[['showLogo', 'Affiche'], ['showQR', 'QR code'], ['showCode', 'Numéro du billet'], ['showHolder', 'Titulaire'], ['showDates', 'Dates']].map(([k, l]) => `<label class="row sm"><input type="checkbox" name="${k}" ${d[k] ? 'checked' : ''} data-i="pd"> ${l}</label>`).join('')}</div>
  <div class="g2"><label class="f">Catégorie à imprimer<select name="tier" data-i="pd"><option value="">Toutes</option>${tiers.map(t => `<option ${d.tier === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label><label class="f">Billets<select name="status" data-i="pd"><option value="valide" ${d.status === 'valide' ? 'selected' : ''}>Valides (non utilisés)</option><option value="tous" ${d.status === 'tous' ? 'selected' : ''}>Valides et utilisés</option></select></label></div>
  <div class="row"><button type="button" class="btn" data-a="pdPrint">Imprimer / PDF</button><button class="btn ghost">Enregistrer le modèle</button></div><p class="xs mut" style="margin:0">Pour obtenir un PDF, choisissez « Enregistrer au format PDF » dans la fenêtre d'impression. Désactivez les marges et en-têtes du navigateur pour respecter les dimensions. Les billets remboursés ne sont jamais imprimés.</p></form>
  <div class="card pad sticky"><h3>Aperçu</h3><div id="pdPreview" class="pd-preview"></div></div></div></div>`;
};
function pdRead() {
  const f = $('#pdForm'); if (!f) return; const g = n => f.elements[n];
  Object.assign(UI.pd, { format: g('format').value, w: +g('w').value, h: +g('h').value, bg: g('bg').value, fg: g('fg').value, accent: g('accent').value, title: g('title').value, subtitle: g('subtitle').value, tier: g('tier').value, status: g('status').value, showLogo: g('showLogo').checked, showQR: g('showQR').checked, showCode: g('showCode').checked, showHolder: g('showHolder').checked, showDates: g('showDates').checked });
}

/* ---------- organisateur : prix promotionnels, liens vers statistiques et impression ---------- */
const _modifier4 = ORG_R.modifier;
ORG_R.modifier = async () => {
  const h = await _modifier4(), ev = window.__evEdit; if (!ev || ev.organizer_id !== ME.id) return h;
  return h + `<div class="wrap" style="padding-bottom:34px"><div class="stack" style="max-width:900px"><div class="card pad stack"><div class="row between"><h2 style="margin:0">Prix promotionnels</h2><div class="row"><a class="btn s ghost" href="#/org/stats/${ev.id}">Statistiques</a><a class="btn s ghost" href="#/org/impression/${ev.id}">Imprimer billets et bracelets</a></div></div><p class="sm mut" style="margin:0">Le prix promotionnel remplace le prix normal tant qu'il est renseigné. Les billets déjà vendus gardent le prix réellement payé.</p>${ev.dates.map(d => d.tiers.map(t => `<form class="row" data-f="promo" data-id="${t.id}"><span style="flex:1;min-width:160px"><b>${esc(t.name)}</b> · ${dFmt(d.start)} · prix normal ${fmt(t.base_price, ev.currency)}</span><input class="in" style="margin:0;max-width:170px" name="promo" type="number" min="0" max="${t.base_price - 1}" value="${t.promo_price ?? ''}" placeholder="Aucun"><button class="btn s ghost">Appliquer</button></form>`).join('')).join('')}</div></div></div>`;
};

/* ---------- Direction : événements avec corbeille, réglages du site, blog ---------- */
ADMIN_R.evenements = async D => {
  const E = await q(sb.from('events').select('id,name,org_name,city,cancelled,archived,published,created_at').order('created_at', { ascending: false }));
  const sold = Object.fromEntries((D.event_list || []).map(e => [e.id, e.sold])), starts = Object.fromEntries((D.event_list || []).map(e => [e.id, e.starts_at])), f = UI.ef || 'actifs';
  const L = E.filter(e => f === 'tous' || (f === 'corbeille' ? e.archived : f === 'brouillons' ? !e.published && !e.archived : !e.archived));
  return `<div class="card pad"><div class="chips" style="margin-bottom:12px">${[['actifs', 'Actifs'], ['brouillons', 'Brouillons'], ['corbeille', 'Corbeille'], ['tous', 'Tous']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="ef" data-v="${k}">${l}</button>`).join('')}</div>${L.length ? `<div class="tw"><table><tr><th>Événement</th><th>Organisateur</th><th>Date</th><th class="n">Vendus</th><th>Statut</th><th></th></tr>${L.map(e => `<tr><td><a href="#/e/${e.id}"><b>${esc(e.name)}</b></a><div class="xs mut">${esc(e.city || '')}</div></td><td>${esc(e.org_name || '')}</td><td class="sm nowrap">${starts[e.id] ? dFmt(starts[e.id]) : '—'}</td><td class="n">${num(sold[e.id] || 0)}</td><td>${badge(e.archived ? ['Corbeille', 'red'] : e.cancelled ? ['Annulé', 'gray'] : !e.published ? ['Brouillon', 'blue'] : ['Publié', 'green'])}</td><td class="r nowrap"><a class="btn s ghost" href="#/admin/stats/${e.id}">Statistiques</a> ${e.cancelled || e.archived ? '' : `<button class="btn s ghost" data-a="cancelEvent" data-id="${e.id}">Annuler</button> `}<button class="btn s ${e.archived ? 'ok' : 'danger'}" data-a="archive" data-id="${e.id}" data-v="${e.archived ? 0 : 1}">${e.archived ? 'Restaurer' : 'Corbeille'}</button></td></tr>`).join('')}</table></div>` : '<p class="mut sm">Aucun événement dans cette liste.</p>'}<p class="xs mut" style="margin-top:10px">La corbeille retire l'événement du site sans rien supprimer : billets, commandes et historique sont conservés, et il peut être restauré.</p></div>`;
};
const _param4 = ADMIN_R.parametres;
ADMIN_R.parametres = async (D, me) => {
  const h = await _param4(D, me), Dt = await loadData(true), S = Dt.site || {}, so = S.socials || {}, feat = Array.isArray(S.featured_events) ? S.featured_events : [];
  const upcoming = Dt.events.filter(e => !['Terminé', 'Annulé'].includes(evStatus(e)[0]));
  return h + `<div class="cols" style="margin-top:20px"><form class="card pad stack" data-f="siteMaint"><h2>Mode maintenance</h2><label class="row sm"><input type="checkbox" name="maintenance" ${S.maintenance === true ? 'checked' : ''}> Activer : le site affiche une page de maintenance aux visiteurs (l'équipe d'administration garde l'accès)</label><label class="f">Message affiché<textarea name="message" rows="2" maxlength="400">${esc(S.maintenance_message || '')}</textarea></label><label class="f">Motif (journalisé)<input name="reason" required minlength="4"></label><div><button class="btn">Enregistrer</button></div></form>
  <form class="card pad stack" data-f="siteContact"><h2>Contacts et réseaux sociaux</h2><div class="g2"><label class="f">Téléphone<input name="contact_phone" value="${esc(S.contact_phone || '')}"></label><label class="f">E-mail<input name="contact_email" type="email" value="${esc(S.contact_email || '')}"></label></div><label class="f">Adresse<input name="contact_address" value="${esc(S.contact_address || '')}"></label><div class="g2">${Object.entries(SOCIAL_L).map(([k, l]) => `<label class="f">${l}<input name="s_${k}" type="url" value="${esc(so[k] || '')}" placeholder="https://"></label>`).join('')}</div><label class="f">Motif (journalisé)<input name="reason" required minlength="4"></label><div><button class="btn">Enregistrer</button></div><p class="xs mut" style="margin:0">Affichés en pied de page sur tout le site.</p></form></div>
  <form class="card pad stack" data-f="siteHome" style="margin-top:20px"><h2>Page d'accueil</h2><div class="g2"><label class="f">Titre (vide = texte par défaut)<input name="home_title" maxlength="120" value="${esc(S.home_title || '')}"></label><label class="f">Sous-titre<input name="home_subtitle" maxlength="300" value="${esc(S.home_subtitle || '')}"></label></div><div class="sm" style="font-weight:650">Événements à la une dans le carrousel (3 à 12 ; sans sélection, les prochains événements sont affichés)</div><div class="feat-list">${upcoming.map(e => `<label class="row sm"><input type="checkbox" name="featured" value="${e.id}" ${feat.includes(e.id) ? 'checked' : ''}> ${esc(e.name)} <span class="mut">· ${dFmt(e.dates[0].start)}</span></label>`).join('') || '<p class="sm mut">Aucun événement à venir.</p>'}</div><label class="f">Motif (journalisé)<input name="reason" required minlength="4"></label><div><button class="btn">Enregistrer</button></div></form>`;
};
ADMIN_TABS.push(['blog', 'Blog']);
ADMIN_R.blog = async () => {
  const B = await q(sb.from('blog_posts').select('*').order('created_at', { ascending: false })), cur = B.find(x => x.id === UI.blogEdit) || {};
  return `<div class="cols"><div class="card pad"><div class="row between"><h2>Articles (${B.length})</h2><button class="btn s" data-a="blogEdit" data-v="">+ Nouvel article</button></div>${B.length ? B.map(b => `<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--line)"><span><b>${esc(b.title)}</b><div class="xs mut">${b.published ? 'Publié le ' + dFmt(b.published_at) : 'Brouillon'} · #/blog/${esc(b.slug)}</div></span><button class="btn s ghost" data-a="blogEdit" data-v="${b.id}">Modifier</button></div>`).join('') : '<p class="mut sm">Aucun article.</p>'}</div>
  <form class="card pad stack" data-f="blog" data-id="${cur.id || ''}"><h2>${cur.id ? 'Modifier l\'article' : 'Nouvel article'}</h2><label class="f">Titre<input name="title" required minlength="3" value="${esc(cur.title || '')}"></label><label class="f">Adresse (vide = générée depuis le titre)<input name="slug" value="${esc(cur.slug || '')}" pattern="[a-z0-9-]*"></label><label class="f">Résumé<textarea name="excerpt" rows="2" maxlength="400">${esc(cur.excerpt || '')}</textarea></label><label class="f">Texte (une ligne vide sépare les paragraphes)<textarea name="body" rows="12">${esc(cur.body || '')}</textarea></label><label class="f">Image${cur.image_url ? ' (choisir un fichier pour la remplacer)' : ''}<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="row sm"><input type="checkbox" name="published" ${cur.published ? 'checked' : ''}> Publié</label><div><button class="btn">Enregistrer</button></div></form></div>`;
};
VIEWS.blog = async p => {
  if (p[1]) {
    const b = await q(sb.from('blog_posts').select('*').eq('slug', p[1]).maybeSingle()); if (!b) return vNotFound();
    return `<div class="wrap sec"><p class="sm"><a href="#/blog">← Tous les articles</a></p><article class="card pad prose" style="max-width:820px;margin:0 auto">${safeUrl(b.image_url) ? `<img src="${esc(b.image_url)}" alt="" style="width:100%;border-radius:12px;margin-bottom:16px">` : ''}<h1 style="font-size:2rem">${esc(b.title)}</h1><p class="sm mut">${b.published_at ? dFmt(b.published_at) : ''}</p>${paras(b.body)}</article></div>`;
  }
  const B = await q(sb.from('blog_posts').select('id,slug,title,excerpt,image_url,published_at').eq('published', true).order('published_at', { ascending: false }));
  return head('Blog', 'Actualités et conseils de FatiBillets.') + `<div class="wrap sec">${B.length ? `<div class="grid">${B.map(b => `<a class="card ev" href="#/blog/${esc(b.slug)}"><div class="poster" style="${imgBg(b.image_url)}"><span class="p-cat">${b.published_at ? dFmt(b.published_at) : ''}</span><span class="p-name">${esc(b.title)}</span></div><div class="ev-b"><span class="sm mut">${esc(b.excerpt || '')}</span></div></a>`).join('')}</div>` : '<div class="empty">Aucun article publié pour le moment.</div>'}</div>`;
};

/* ---------- actions ---------- */
Object.assign(A, {
  csvParts() { download('participants.csv', [['Code', 'Titulaire', 'Catégorie', 'Date', 'Téléphone', 'E-mail', 'Canal', 'Statut', 'Scanné le', 'Prix payé'], ...(window.__parts || []).map(k => [k.code, k.holder, k.tier, dtFmt(k.date), k.phone, k.email, k.channel, tkBadge(k.status)[0], k.scanned_at ? dtFmt(k.scanned_at) : '', k.price])]); },
  pdPrint() {
    pdRead(); const L = pdFiltered().slice(0, 500), ev = window.__statsEv;
    if (!L.length) return toast('Aucun billet à imprimer avec ces critères.');
    modal(`<style>@page{margin:8mm}</style><div class="noprint row between" style="margin-bottom:12px"><b>${L.length} billet(s)</b><div class="row"><button class="btn s" data-a="print">Imprimer</button><button class="btn s ghost" data-a="close">Fermer</button></div></div><div class="print-sheet">${L.map(k => ticketHTML(k, UI.pd, ev)).join('')}</div>`);
    setTimeout(() => window.print(), 300);
  },
  ef(el) { UI.ef = el.dataset.v; render(); },
  archive(el) { const on = el.dataset.v === '1'; askReason(on ? 'Placer cet événement dans la corbeille' : 'Restaurer cet événement', m => act(() => rpc2('archive_event', { p_event: el.dataset.id, p_archived: on, p_reason: m }), on ? 'Événement placé dans la corbeille.' : 'Événement restauré.')); },
  blogEdit(el) { UI.blogEdit = el.dataset.v; render(); },
});
Object.assign(I, {
  pq(v) { const f = norm(v); document.querySelectorAll('[data-row]').forEach(tr => { tr.hidden = !!f && !tr.dataset.row.includes(f); }); },
  pd() { pdRead(); pdPreview(); },
  pdFormat(v) { const P = PRINT_PRESETS[v] || {}; pdRead(); Object.assign(UI.pd, { format: v, w: P.w, h: P.h }, P.bg ? { bg: P.bg, fg: P.fg, accent: P.accent } : {}); const f = $('#pdForm'); ['w', 'h', 'bg', 'fg', 'accent'].forEach(k => { f.elements[k].value = UI.pd[k]; }); pdPreview(); },
});
document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.i; if ((k === 'pd') && I.pd) I.pd(); });
Object.assign(F, {
  async promo(f, form) { const v = f.get('promo'); await rpc2('set_tier_promo', { p_id: form.dataset.id, p_promo: v === '' ? null : +v }); DATA = null; toast(v === '' ? 'Prix promotionnel retiré.' : 'Prix promotionnel appliqué.'); await render(); },
  async pdSave(f, form) { pdRead(); const d = UI.pd; await rpc2('save_print_design', { p_event: form.dataset.id, p: { format: d.format, w: d.w, h: d.h, bg: d.bg, fg: d.fg, accent: d.accent, title: d.title, subtitle: d.subtitle, showLogo: d.showLogo, showQR: d.showQR, showCode: d.showCode, showHolder: d.showHolder, showDates: d.showDates } }); toast('Modèle enregistré pour cet événement.'); },
  async siteMaint(f) { await rpc2('set_site_setting', { p_key: 'maintenance', p_value: !!f.get('maintenance'), p_reason: f.get('reason') }); await rpc2('set_site_setting', { p_key: 'maintenance_message', p_value: f.get('message') || null, p_reason: f.get('reason') }); DATA = null; toast(f.get('maintenance') ? 'Mode maintenance activé.' : 'Mode maintenance désactivé.'); await render(); },
  async siteContact(f) { const r = f.get('reason'); for (const k of ['contact_phone', 'contact_email', 'contact_address']) await rpc2('set_site_setting', { p_key: k, p_value: f.get(k) || null, p_reason: r }); await rpc2('set_site_setting', { p_key: 'socials', p_value: Object.fromEntries(Object.keys(SOCIAL_L).map(k => [k, f.get('s_' + k)])), p_reason: r }); DATA = null; toast('Contacts enregistrés.'); await render(); },
  async siteHome(f) { const r = f.get('reason'), feat = f.getAll('featured'); if (feat.length && feat.length < 3) throw new Error('Sélectionnez au moins 3 événements, ou aucun.'); await rpc2('set_site_setting', { p_key: 'home_title', p_value: f.get('home_title') || null, p_reason: r }); await rpc2('set_site_setting', { p_key: 'home_subtitle', p_value: f.get('home_subtitle') || null, p_reason: r }); await rpc2('set_site_setting', { p_key: 'featured_events', p_value: feat, p_reason: r }); DATA = null; toast('Page d\'accueil enregistrée.'); await render(); },
  async blog(f, form) { const img = await uploadImage(f.get('image')); const id = await rpc2('save_blog_post', { p: { id: form.dataset.id || null, title: f.get('title'), slug: f.get('slug'), excerpt: f.get('excerpt'), body: f.get('body'), image_url: img, published: !!f.get('published') } }); UI.blogEdit = id; toast('Article enregistré.'); await render(); },
});
// boot() est appelé à la fin de modules5.js, chargé après ce fichier.
