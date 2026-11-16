'use strict';
/* FatiBillets — fonctionnalités reprises de fatibarabilletterie.com :
   lieux, avis, favoris, abonnements, profil public de l'organisateur, pages du site, centre d'aide, contact,
   publication en brouillon, réglages des billets, votes et dons anonymes, images, commissions par service.
   Chargé après modules2.js ; nécessite la base v5 (supabase/schema_v5.sql). */

const stars = n => '★'.repeat(Math.round(n || 0)) + '☆'.repeat(5 - Math.round(n || 0));
const paras = s => esc(s || '').split(/\n{2,}/).map(x => `<p>${x.replace(/\n/g, '<br>')}</p>`).join('');
const toLocalInput = v => { if (!v) return ''; const d = new Date(ts(v)); const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
const fromLocalInput = v => v ? new Date(v).toISOString() : '';
const imgBg = (url, a, b) => safeUrl(url) ? `background:linear-gradient(180deg,rgba(0,0,0,.05) 40%,rgba(0,0,0,.7)),url('${safeUrl(url)}') center/cover` : `background:linear-gradient(135deg,${esc(a || '#FF8A1F')},${esc(b || '#9A3412')})`;
const SOCIAL_L = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', x: 'X (Twitter)', linkedin: 'LinkedIn' };
let SOCIAL = { at: 0, d: null };
async function social(force) { if (!ME) return null; if (force || !SOCIAL.d || Date.now() - SOCIAL.at > 15000) { try { SOCIAL = { at: Date.now(), d: await rpc2('my_social') }; } catch (e) { return null; } } return SOCIAL.d; }

/* ---------- fenêtre de paiement avec anonymat et message ---------- */
function payerModal(title, sub, withMessage, cb) {
  payerModal.cb = cb;
  modal(`<h2>${esc(title)}</h2><p class="mut">${sub}</p><form data-f="payer" class="stack"><label class="f">Nom complet<input name="name" required minlength="3" autocomplete="name" value="${esc(ME?.full_name || '')}"></label><label class="f">Téléphone<input name="phone" required pattern="[+0-9 ]{8,}" inputmode="tel" autocomplete="tel" value="${esc(ME?.phone || '')}"></label><label class="f">E-mail (facultatif)<input name="email" type="email" autocomplete="email" value="${esc(ME?.email || '')}"></label>${withMessage ? '<label class="f">Message (facultatif)<textarea name="message" rows="2" maxlength="500"></textarea></label>' : ''}<label class="row sm"><input type="checkbox" name="anon"> Rester anonyme : mon nom${withMessage ? ' et mon message' : ''} ne seront pas affichés publiquement</label><div class="row"><button class="btn" style="flex:1">Continuer vers le paiement</button><button type="button" class="btn ghost" data-a="close">Annuler</button></div></form>`);
}

/* ---------- accueil : filtres avancés ---------- */
function weekendOf(e) {
  const d = new Date(day0()), dow = d.getDay(), sat = day0() + ((6 - dow + 7) % 7) * DAY - (dow === 0 ? DAY : 0), end = sat + 2 * DAY;
  return e.dates.some(x => x.start < end && x.end > sat);
}
const _results = results;
results = function () {
  if (!DATA) return '';
  const F = UI.adv || {}, all = DATA.events, when = UI.when;
  const list = all.filter(e => (!F.country || e.country === F.country) && (!F.city || norm(e.city || '').includes(norm(F.city))) && (!F.free || minPrice(e) === 0)
    && (!F.pmin || minPrice(e) >= +F.pmin) && (!F.pmax || minPrice(e) <= +F.pmax) && (when !== 'weekend' || weekendOf(e)));
  if (all.length && !list.length) return '<div class="empty"><b>Aucun événement ne correspond à ces filtres.</b><br><button class="link" data-a="advReset">Retirer les filtres</button></div>';
  DATA.events = list; if (when === 'weekend') UI.when = '';
  try { return _results(); } finally { DATA.events = all; UI.when = when; }
};
VIEWS[''] = async () => {
  let h = await vHome(); const D = DATA, F = UI.adv || {};
  const countries = [...new Set([...D.countries.filter(c => c.active).map(c => c.name), ...D.events.map(e => e.country).filter(Boolean)])];
  h = h.replace('data-v="week">Cette semaine</button>', `data-v="week">Cette semaine</button><button class="chip ${UI.when === 'weekend' ? 'on' : ''}" data-a="when" data-v="weekend">Ce week-end</button>`);
  const adv = `<details class="adv" ${Object.values(F).some(Boolean) ? 'open' : ''}><summary>Plus de filtres</summary><form class="adv-in" data-f="adv"><label class="f">Pays<select name="country"><option value="">Tous</option>${countries.map(c => `<option ${F.country === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><label class="f">Ville<input name="city" value="${esc(F.city || '')}" placeholder="Ex. Conakry"></label><label class="f">Prix minimum<input name="pmin" type="number" min="0" value="${esc(F.pmin || '')}"></label><label class="f">Prix maximum<input name="pmax" type="number" min="0" value="${esc(F.pmax || '')}"></label><label class="row sm" style="align-self:end"><input type="checkbox" name="free" ${F.free ? 'checked' : ''}> Gratuits uniquement</label><div class="row" style="align-self:end"><button class="btn s">Appliquer</button><button type="button" class="btn s ghost" data-a="advReset">Réinitialiser</button></div></form></details>`;
  return h.replace('<div id="results">', adv + '<div id="results">');
};

/* ---------- page d'un événement : favoris, partage, calendrier, lieu, organisateur, avis ---------- */
VIEWS.e = async p => {
  let h = await vEvent(p[1]); const ev = DATA && DATA.events.find(e => e.id === p[1]); if (!ev) return h;
  const [R, O, V, S] = await Promise.all([rpc2('event_reviews', { p_event: ev.id }).catch(() => null), rpc2('organizer_public', { p_id: ev.organizer_id }).catch(() => null),
    ev.venue_id ? q(sb.from('venues').select('*').eq('id', ev.venue_id).maybeSingle()).catch(() => null) : null, social()]);
  const fav = S && S.favorites.includes(ev.id);
  const bar = `<div class="row ev-actions"><button class="btn s ${fav ? '' : 'ghost'}" data-a="fav" data-id="${ev.id}">${fav ? '♥ Dans mes favoris' : '♡ Ajouter aux favoris'}</button><button class="btn s ghost" data-a="share" data-title="${esc(ev.name)}">Partager</button><button class="btn s ghost" data-a="ics" data-id="${ev.id}">${ic('cal')} Ajouter au calendrier</button></div>`;
  const venue = V ? `<div class="card pad"><div class="row between"><h3 style="margin:0">${ic('pin')} Lieu</h3><a class="btn s ghost" href="#/lieu/${V.id}">Fiche du lieu</a></div><p style="margin:8px 0 0"><b>${esc(V.name)}</b>${V.type ? ' · ' + esc(V.type) : ''}<br><span class="sm mut">${esc([V.address, V.city, V.country].filter(Boolean).join(', '))}</span>${V.seated || V.standing ? `<br><span class="sm mut">Capacité : ${[V.seated ? num(V.seated) + ' assis' : '', V.standing ? num(V.standing) + ' debout' : ''].filter(Boolean).join(' · ')}</span>` : ''}</p></div>` : '';
  const org = O ? `<div class="card pad row" style="gap:14px">${safeUrl(O.logo) ? `<img class="av" src="${esc(O.logo)}" alt="">` : `<div class="av">${esc(initials(O.name))}</div>`}<div style="flex:1;min-width:150px"><div class="xs mut">Organisé par</div><b>${esc(O.name)}</b><div class="xs mut">${num(O.followers)} abonné(s)</div></div><a class="btn s ghost" href="#/organisateur/${O.id}">Voir le profil</a></div>` : '';
  const rev = R && R.enabled ? `<div><h2>Avis des participants ${R.count ? `<span class="sm mut" style="font-weight:600">${stars(R.avg)} ${R.avg}/5 · ${R.count} avis</span>` : ''}</h2>${R.list.length ? R.list.map(r => `<div class="review"><div class="row between"><b>${esc(r.name)}</b><span class="stars">${stars(r.rating)}</span></div>${r.comment ? `<div class="sm">${esc(r.comment)}</div>` : ''}<div class="xs mut">${dFmt(r.at)}</div></div>`).join('') : '<p class="sm mut">Aucun avis pour le moment.</p>'}
    ${R.can ? `<form class="card pad stack" data-f="review" data-ev="${ev.id}" style="margin-top:12px"><b>${R.mine ? 'Modifier mon avis' : 'Donner mon avis'}</b><div class="rate">${[5, 4, 3, 2, 1].map(n => `<input type="radio" name="rating" id="r${n}" value="${n}" ${R.mine && R.mine.rating === n ? 'checked' : ''} required><label for="r${n}" title="${n}/5">★</label>`).join('')}</div><textarea class="in" name="comment" rows="2" maxlength="1500" placeholder="Votre commentaire (facultatif)">${esc(R.mine?.comment || '')}</textarea><div><button class="btn s">Publier mon avis</button></div></form>` : ME ? '' : '<p class="xs mut">Les participants ayant acheté un billet peuvent laisser un avis après connexion.</p>'}</div>` : '';
  h = h.replace('<div class="facts">', bar + '<div class="facts">');
  return h.replace(/<\/div>\s*<aside class="card pad sticky stack" id="book">/, venue + org + rev + '</div>\n  <aside class="card pad sticky stack" id="book">');
};

/* ---------- lieux ---------- */
VIEWS.lieux = async () => {
  const [Vn, T] = await Promise.all([q(sb.from('venues').select('*').eq('listed', true).order('name')), q(sb.from('venue_types').select('*').eq('active', true).order('position'))]);
  const F = UI.vf || {}, f = norm(F.q || '');
  const L = Vn.filter(v => (!f || norm([v.name, v.city, v.description].join(' ')).includes(f)) && (!F.type || v.type === F.type) && (!F.country || v.country === F.country) && (!+F.cap || Math.max(v.seated || 0, v.standing || 0) >= +F.cap));
  const countries = [...new Set(Vn.map(v => v.country).filter(Boolean))];
  return head('Lieux', 'Salles, espaces et sites pour vos événements.') + `<div class="wrap sec stack"><form class="card pad adv-in" data-f="vfilter"><label class="f">Rechercher<input name="q" value="${esc(F.q || '')}" placeholder="Nom, ville…"></label><label class="f">Type<select name="type"><option value="">Tous</option>${T.map(t => `<option ${F.type === t.name ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label><label class="f">Pays<select name="country"><option value="">Tous</option>${countries.map(c => `<option ${F.country === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><label class="f">Capacité minimum<input name="cap" type="number" min="0" value="${esc(F.cap || '')}"></label><div style="align-self:end"><button class="btn s">Filtrer</button></div></form>
  <p class="sm mut">${L.length} lieu(x)</p>${L.length ? `<div class="grid">${L.map(v => `<a class="card ev" href="#/lieu/${v.id}"><div class="poster" style="${imgBg(v.image_url)}"><span class="p-cat">${esc(v.type || 'Lieu')}</span><span class="p-name">${esc(v.name)}</span></div><div class="ev-b"><span class="sm mut">${ic('pin')} ${esc([v.city, v.country].filter(Boolean).join(', '))}</span>${v.seated || v.standing ? `<span class="sm mut">${[v.seated ? num(v.seated) + ' places assises' : '', v.standing ? num(v.standing) + ' debout' : ''].filter(Boolean).join(' · ')}</span>` : ''}</div></a>`).join('')}</div>` : '<div class="empty"><b>Aucun lieu ne correspond.</b></div>'}</div>`;
};
VIEWS.lieu = async p => {
  const v = await q(sb.from('venues').select('*').eq('id', p[1]).maybeSingle()); if (!v) return vNotFound();
  const D = await loadData(), evs = D.events.filter(e => e.venue_id === v.id && evStatus(e)[0] !== 'Terminé');
  const row = (l, x) => x ? `<div class="fact"><small>${l}</small><b>${esc(x)}</b></div>` : '';
  return `<div class="wrap sec"><p class="sm"><a href="#/lieux">← Tous les lieux</a></p><div class="cols"><div class="stack"><div class="poster big" style="${imgBg(v.image_url)}"><span class="p-cat">${esc(v.type || 'Lieu')}</span><span class="p-name">${esc(v.name)}</span></div>
  <div class="facts">${row('Adresse', [v.address, v.city, v.country].filter(Boolean).join(', '))}${row('Places assises', v.seated ? num(v.seated) : '')}${row('Places debout', v.standing ? num(v.standing) : '')}${row('Quartiers', v.neighborhoods)}</div>
  ${v.description ? `<div>${paras(v.description)}</div>` : ''}
  ${v.amenities.length ? `<div><h3>Commodités</h3><div class="chips">${v.amenities.map(a => `<span class="badge b-orange">${esc(a)}</span>`).join(' ')}</div></div>` : ''}
  ${v.pricing ? `<div><h3>Tarifs</h3>${paras(v.pricing)}</div>` : ''}${v.availability ? `<div><h3>Disponibilité</h3>${paras(v.availability)}</div>` : ''}${v.food ? `<div><h3>Restauration et boissons</h3>${paras(v.food)}</div>` : ''}
  <div><h2>Événements à venir dans ce lieu</h2>${evs.length ? `<div class="grid">${evs.map(evCard).join('')}</div>` : '<p class="sm mut">Aucun événement à venir.</p>'}</div></div>
  <aside class="card pad stack sticky">${v.quote_form ? `<h3>Demander un devis</h3><form class="stack" data-f="quote" data-venue="${v.id}" data-name="${esc(v.name)}"><label class="f">Nom<input name="name" required minlength="2" value="${esc(ME?.full_name || '')}"></label><label class="f">E-mail<input name="email" type="email" required value="${esc(ME?.email || '')}"></label><label class="f">Téléphone<input name="phone" inputmode="tel" value="${esc(ME?.phone || '')}"></label><label class="f">Votre projet<textarea name="message" rows="4" required minlength="10" placeholder="Date, nombre d'invités, type d'événement…"></textarea></label><button class="btn">Envoyer la demande</button></form>` : `<h3>Contact</h3><p class="sm mut">${v.contact_email ? esc(v.contact_email) : 'Contact non communiqué.'}</p>`}</aside></div></div>`;
};

/* ---------- profil public de l'organisateur ---------- */
VIEWS.organisateur = async p => {
  const O = await rpc2('organizer_public', { p_id: p[1] }); if (!O) return vNotFound();
  const D = await loadData(), evs = D.events.filter(e => e.organizer_id === O.id && !['Terminé', 'Annulé'].includes(evStatus(e)[0]));
  return `<div class="wrap sec stack"><div class="card pad row" style="gap:18px">${safeUrl(O.logo) ? `<img class="av" style="width:84px;height:84px" src="${esc(O.logo)}" alt="">` : `<div class="av" style="width:84px;height:84px;font-size:1.6rem">${esc(initials(O.name))}</div>`}<div style="flex:1;min-width:200px"><h1 style="font-size:1.8rem;margin:0">${esc(O.name)}</h1><div class="sm mut">${num(O.followers)} abonné(s) · sur FatiBillets depuis ${new Date(ts(O.since)).getFullYear()}</div><div class="row sm" style="margin-top:6px">${O.website ? `<a href="${esc(O.website)}" target="_blank" rel="noopener noreferrer">Site web ↗</a>` : ''}${Object.entries(O.socials || {}).map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${SOCIAL_L[k] || k} ↗</a>`).join('')}${O.email ? `<span>${esc(O.email)}</span>` : ''}${O.phone ? `<span>${esc(O.phone)}</span>` : ''}</div></div>${ME?.id === O.id ? '<a class="btn s ghost" href="#/org/profil">Modifier mon profil</a>' : `<button class="btn ${O.following ? 'ghost' : ''}" data-a="follow" data-id="${O.id}">${O.following ? 'Abonné ✓' : 'Suivre'}</button>`}</div>
  ${O.about ? `<div class="card pad">${paras(O.about)}</div>` : ''}<h2>Événements à venir</h2>${evs.length ? `<div class="grid">${evs.map(evCard).join('')}</div>` : '<div class="empty">Aucun événement à venir.</div>'}</div>`;
};

/* ---------- pages, centre d'aide, contact ---------- */
VIEWS.page = async p => {
  const pg = await q(sb.from('site_pages').select('*').eq('slug', p[1] || '').maybeSingle()); if (!pg) return vNotFound();
  return head(esc(pg.title), pg.updated_at ? 'Mis à jour le ' + dFmt(pg.updated_at) : '') + `<div class="wrap sec"><div class="card pad prose" style="max-width:860px">${pg.body ? paras(pg.body) : '<p class="mut">Cette page est en cours de rédaction.</p>'}</div></div>`;
};
VIEWS.aide = async () => {
  const H = await q(sb.from('help_articles').select('*').eq('published', true).order('position'));
  const sec = (k, t) => { const L = H.filter(a => a.audience === k); return `<div class="card pad stack"><h2>${t}</h2>${L.length ? L.map(a => `<details class="faq"><summary>${esc(a.title)}</summary><div class="sm">${paras(a.body)}</div></details>`).join('') : '<p class="sm mut">Les articles seront bientôt publiés.</p>'}</div>`; };
  return head('Centre d\'aide', 'Organisateurs, participants : les réponses aux questions fréquentes.') + `<div class="wrap sec stack"><div class="cols">${sec('participant', 'Participants')}${sec('organisateur', 'Organisateurs')}</div><div class="card pad row between"><span>Vous n'avez pas trouvé de réponse ?</span><div class="row"><a class="btn s" href="#/contact">Nous contacter</a>${ME ? '<a class="btn s ghost" href="#/assistance">Ouvrir un dossier d\'assistance</a>' : ''}</div></div></div>`;
};
VIEWS.contact = async () => head('Nous contacter', 'Une question sur FatiBillets ? Écrivez-nous.') + `<div class="wrap sec"><div class="cols"><form class="card pad stack" data-f="contact"><div class="g2"><label class="f">Nom<input name="name" required minlength="2" value="${esc(ME?.full_name || '')}"></label><label class="f">E-mail<input name="email" type="email" required value="${esc(ME?.email || '')}"></label></div><label class="f">Objet<input name="subject" required minlength="3" maxlength="150"></label><label class="f">Message<textarea name="message" rows="6" required minlength="10" maxlength="5000"></textarea></label><div><button class="btn">Envoyer</button></div></form>
  <aside class="card pad stack sticky"><h3>Autres moyens</h3><a class="btn s ghost" href="#/aide">Centre d'aide</a>${ME ? '<a class="btn s ghost" href="#/assistance">Mes dossiers d\'assistance</a>' : ''}</aside></div></div>`;

/* ---------- mon compte : profil complet, mot de passe, favoris, abonnements, avis ---------- */
const _compte3 = VIEWS.compte;
VIEWS.compte = async p => {
  const h = await _compte3(p); if (!ME) return h;
  const S = await social(true), D = await loadData();
  const favs = S ? D.events.filter(e => S.favorites.includes(e.id)) : [];
  return h + `<div class="wrap" style="padding-bottom:34px"><div class="cols"><form class="card pad stack" data-f="profile2"><h2>Informations personnelles</h2><input type="hidden" name="full_name" value="${esc(ME.full_name || '')}"><input type="hidden" name="phone" value="${esc(ME.phone || '')}"><div class="g2"><label class="f">Date de naissance<input name="birth_date" type="date" value="${esc(ME.birth_date || '')}"></label><label class="f">Ville<input name="city" value="${esc(ME.city || '')}"></label><label class="f">Pays<select name="country"><option value="">—</option>${D.countries.map(c => `<option ${ME.country === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label></div><div><button class="btn s">Enregistrer</button></div></form>
  <form class="card pad stack" data-f="password"><h2>Changer le mot de passe</h2><label class="f">Mot de passe actuel<input name="current" type="password" required autocomplete="current-password"></label><label class="f">Nouveau mot de passe<input name="next" type="password" required minlength="8" autocomplete="new-password"></label><label class="f">Répéter le nouveau mot de passe<input name="again" type="password" required minlength="8" autocomplete="new-password"></label><div><button class="btn s">Modifier le mot de passe</button></div></form></div>
  <div class="card pad" style="margin-top:20px"><h2>Mes favoris</h2>${favs.length ? `<div class="grid">${favs.map(evCard).join('')}</div>` : '<p class="sm mut">Ajoutez des événements à vos favoris depuis leur page.</p>'}</div>
  <div class="cols" style="margin-top:20px"><div class="card pad"><h2>Organisateurs suivis</h2>${S && S.follows.length ? S.follows.map(o => `<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--line)"><a href="#/organisateur/${o.id}"><b>${esc(o.name)}</b></a><button class="btn s ghost" data-a="follow" data-id="${o.id}">Ne plus suivre</button></div>`).join('') : '<p class="sm mut">Vous ne suivez aucun organisateur.</p>'}</div>
  <div class="card pad"><h2>Mes avis</h2>${S && S.reviews.length ? S.reviews.map(r => `<div style="padding:7px 0;border-bottom:1px solid var(--line)"><a href="#/e/${r.event_id}"><b>${esc(r.event)}</b></a> <span class="stars">${stars(r.rating)}</span>${r.hidden ? ' ' + badge(['Masqué par la modération', 'gray']) : ''}${r.comment ? `<div class="sm">${esc(r.comment)}</div>` : ''}</div>`).join('') : '<p class="sm mut">Aucun avis publié.</p>'}</div></div></div>`;
};

/* ---------- organisateur : création avec lieu et brouillon ---------- */
async function myVenues() { return q(sb.from('venues').select('id,name,city,organizer_id,listed').order('name')); }
VIEWS.org = async p => {
  if (p[1] !== 'nouveau') return vOrg(p[1]);
  let h = await vNewEvent(); if (!ME || role() !== 'organisateur') return h;
  let V = []; try { V = await myVenues(); } catch (e) { /* base pas à jour */ }
  const extra = `<div class="g2"><label class="f">Lieu enregistré (facultatif)<select name="venue_id"><option value="">— Saisie libre ci-dessus —</option>${V.map(v => `<option value="${v.id}">${esc(v.name)}${v.city ? ' — ' + esc(v.city) : ''}${v.organizer_id === ME.id ? ' (mon lieu)' : ''}</option>`).join('')}</select></label><label class="row sm" style="align-self:end"><input type="checkbox" name="draft"> Enregistrer en brouillon (non visible du public)</label></div>`;
  return h.replace('<label class="f">Description<textarea name="description"', extra + '<label class="f">Description<textarea name="description"');
};
const _newEvent = F.newEvent;
F.newEvent = async (f, form) => {
  await _newEvent(f, form);
  const id = (location.hash.match(/#\/e\/([0-9a-f-]{36})/) || [])[1]; if (!id) return;
  try {
    if (f.get('venue_id')) await rpc2('set_event_venue', { p_event: id, p_venue: f.get('venue_id') });
    if (f.get('draft')) { await rpc2('set_event_flags', { p_event: id, p: { published: false } }); toast('Événement enregistré en brouillon.'); location.hash = '#/org/modifier/' + id; }
  } catch (e) { toast(e.message); }
  DATA = null;
};

/* ---------- organisateur : modification (publication, lieu, avis, billets) ---------- */
const _modifier = ORG_R.modifier;
ORG_R.modifier = async () => {
  const h = await _modifier(), ev = window.__evEdit; if (!ev || ev.organizer_id !== ME.id) return h;
  let V = []; try { V = await myVenues(); } catch (e) { return h; }
  return h + `<div class="wrap" style="padding-bottom:34px"><div class="stack" style="max-width:900px">
  <form class="card pad stack" data-f="evFlags" data-id="${ev.id}"><h2>Publication et lieu</h2><div class="g2"><label class="f">Statut<select name="published"><option value="1" ${ev.published !== false ? 'selected' : ''}>Publié (visible du public)</option><option value="0" ${ev.published === false ? 'selected' : ''}>Brouillon (invisible)</option></select></label><label class="f">Avis des participants<select name="reviews"><option value="1" ${ev.reviews_enabled !== false ? 'selected' : ''}>Activés</option><option value="0" ${ev.reviews_enabled === false ? 'selected' : ''}>Désactivés</option></select></label><label class="f">Lieu enregistré<select name="venue_id"><option value="">— Aucun —</option>${V.map(v => `<option value="${v.id}" ${ev.venue_id === v.id ? 'selected' : ''}>${esc(v.name)}${v.city ? ' — ' + esc(v.city) : ''}</option>`).join('')}</select></label></div><div class="row"><button class="btn s">Enregistrer</button><a class="btn s ghost" href="#/org/lieux">Gérer mes lieux</a></div></form>
  <div class="card pad stack"><h2>Billets</h2>${ev.dates.map((d, di) => `<div><h3 style="margin-bottom:6px">${dFmt(d.start)} · ${hFmt(d.start)}</h3>${d.tiers.map(t => `<form class="tier-edit" data-f="tierEdit" data-id="${t.id}"><div class="row between"><b>${esc(t.name)} · ${fmt(t.price, ev.currency)}</b><span class="xs mut">${num(t.avail)} place(s) disponible(s)</span></div><div class="g3"><label class="f">Nombre de places<input name="quota" type="number" min="1" value="${t.quota}"></label><label class="f">Billets max par commande<input name="max_per_order" type="number" min="1" max="50" value="${t.max_per_order || 10}"></label><label class="f">Description<input name="description" maxlength="200" value="${esc(t.description || '')}"></label><label class="f">Début de la vente<input name="sales_start" type="datetime-local" value="${toLocalInput(t.sales_start)}"></label><label class="f">Fin de la vente<input name="sales_end" type="datetime-local" value="${toLocalInput(t.sales_end)}"></label><div style="align-self:end"><button class="btn s">Enregistrer</button></div></div></form>`).join('')}
    <form class="row tier-add" data-f="tierAdd" data-ev="${ev.id}" data-date="${d.id}"><input class="in" style="flex:2;margin:0;min-width:120px" name="name" required minlength="2" placeholder="Nouvelle catégorie (ex. VVIP)"><input class="in" style="flex:1;margin:0;min-width:100px" name="price" type="number" min="0" required placeholder="Prix (${esc(ev.currency)})"><input class="in" style="flex:1;margin:0;min-width:90px" name="quota" type="number" min="1" required placeholder="Places"><button class="btn s ghost">+ Ajouter</button></form></div>`).join('')}<p class="xs mut" style="margin:0">Le prix d'une catégorie ne change pas après publication. Le nombre de places ne peut pas descendre sous les billets déjà vendus ou réservés.</p></div></div></div>`;
};

/* ---------- organisateur : lieux, avis, profil public, images des concours et cagnottes ---------- */
ORG_TABS.push(['lieux', 'Lieux'], ['avis', 'Avis'], ['profil', 'Profil public']);
ORG_R.lieux = async () => {
  const [V, T, C] = await Promise.all([q(sb.from('venues').select('*').eq('organizer_id', ME.id).order('name')), q(sb.from('venue_types').select('*').eq('active', true).order('position')), rpc2('list_contacts').catch(() => [])]);
  const D = await loadData(), cur = V.find(v => v.id === UI.venueEdit) || {};
  return `<div class="wrap sec stack" style="padding-top:22px"><div class="card pad"><div class="row between"><h2>Mes lieux</h2><button class="btn s" data-a="venueEdit" data-id="">+ Nouveau lieu</button></div>${V.length ? `<div class="tw"><table><tr><th>Lieu</th><th>Type</th><th>Ville</th><th>Capacité</th><th>Annuaire</th><th></th></tr>${V.map(v => `<tr><td><a href="#/lieu/${v.id}"><b>${esc(v.name)}</b></a></td><td>${esc(v.type || '')}</td><td>${esc(v.city || '')}</td><td class="sm">${[v.seated ? v.seated + ' assis' : '', v.standing ? v.standing + ' debout' : ''].filter(Boolean).join(' · ')}</td><td>${badge(v.hidden ? ['Masqué par FATIGLOBAL', 'red'] : v.listed ? ['Public', 'green'] : ['Privé', 'gray'])}</td><td class="r"><button class="btn s ghost" data-a="venueEdit" data-id="${v.id}">Modifier</button></td></tr>`).join('')}</table></div>` : '<p class="mut sm">Aucun lieu. Enregistrez vos salles pour les réutiliser dans vos événements.</p>'}</div>
  <form class="card pad stack" data-f="venue" data-id="${cur.id || ''}" style="max-width:900px"><h2>${cur.id ? 'Modifier « ' + esc(cur.name) + ' »' : 'Nouveau lieu'}</h2><div class="g2"><label class="f">Nom<input name="name" required minlength="2" value="${esc(cur.name || '')}"></label><label class="f">Type<select name="type">${T.map(t => `<option ${cur.type === t.name ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label><label class="f">Places assises<input name="seated" type="number" min="0" value="${cur.seated ?? ''}"></label><label class="f">Places debout<input name="standing" type="number" min="0" value="${cur.standing ?? ''}"></label><label class="f">Adresse<input name="address" value="${esc(cur.address || '')}"></label><label class="f">Ville<input name="city" value="${esc(cur.city || '')}"></label><label class="f">Pays<select name="country">${D.countries.map(c => `<option ${(cur.country || 'Guinée') === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><label class="f">Quartiers<input name="neighborhoods" value="${esc(cur.neighborhoods || '')}"></label><label class="f">E-mail de contact<input name="contact_email" type="email" value="${esc(cur.contact_email || '')}"></label><label class="f">Commodités (séparées par des virgules)<input name="amenities" value="${esc((cur.amenities || []).join(', '))}" placeholder="Parking, Climatisation, Sonorisation"></label></div>
  <label class="f">Description<textarea name="description" rows="3">${esc(cur.description || '')}</textarea></label><div class="g3"><label class="f">Tarifs<textarea name="pricing" rows="2">${esc(cur.pricing || '')}</textarea></label><label class="f">Disponibilité<textarea name="availability" rows="2">${esc(cur.availability || '')}</textarea></label><label class="f">Restauration et boissons<textarea name="food" rows="2">${esc(cur.food || '')}</textarea></label></div>
  <label class="f">Photo du lieu${cur.image_url ? ' (choisir un fichier pour la remplacer)' : ''}<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="row"><label class="row sm"><input type="checkbox" name="listed" ${cur.listed !== false ? 'checked' : ''}> Afficher dans l'annuaire public des lieux</label><label class="row sm"><input type="checkbox" name="quote_form" ${cur.quote_form ? 'checked' : ''}> Proposer un formulaire de demande de devis</label></div><div><button class="btn">${cur.id ? 'Enregistrer' : 'Créer le lieu'}</button></div></form>
  <div class="card pad"><h2>Demandes de devis reçues</h2>${C.length ? C.map(m => `<div style="padding:9px 0;border-bottom:1px solid var(--line)"><div class="row between"><b>${esc(m.name)} — ${esc(m.venue || '')}</b>${m.handled ? badge(['Traitée', 'green']) : `<button class="btn s ghost" data-a="contactDone" data-id="${m.id}">Marquer traitée</button>`}</div><div class="xs mut">${esc(m.email)}${m.phone ? ' · ' + esc(m.phone) : ''} · ${dtFmt(m.at)}</div><div class="sm" style="white-space:pre-wrap">${esc(m.message)}</div></div>`).join('') : '<p class="sm mut">Aucune demande.</p>'}</div></div>`;
};
ORG_R.avis = async () => {
  const R = await rpc2('manage_reviews');
  return `<div class="wrap sec" style="padding-top:22px"><div class="card pad"><h2>Avis sur mes événements</h2>${R.length ? `<div class="tw"><table><tr><th>Événement</th><th>Auteur</th><th>Note</th><th>Commentaire</th><th>Date</th><th></th></tr>${R.map(r => `<tr><td>${esc(r.event)}</td><td class="sm">${esc(r.author || '')}</td><td class="stars nowrap">${stars(r.rating)}</td><td class="sm">${esc(r.comment || '')}</td><td class="sm nowrap">${dFmt(r.at)}</td><td class="r"><button class="btn s ghost" data-a="reviewHide" data-id="${r.id}" data-v="${r.hidden ? 0 : 1}">${r.hidden ? 'Rétablir' : 'Masquer'}</button></td></tr>`).join('')}</table></div>` : '<p class="mut sm">Aucun avis pour le moment.</p>'}</div></div>`;
};
ORG_R.profil = async () => {
  const s = ME.org_socials || {};
  return `<div class="wrap sec" style="padding-top:22px"><form class="card pad stack" data-f="orgProfile" style="max-width:820px"><div class="row between"><h2 style="margin:0">Profil public de l'organisateur</h2><a class="btn s ghost" href="#/organisateur/${ME.id}">Voir ma page</a></div><div class="g2"><label class="f">Nom de l'organisation<input name="org_name" required minlength="2" value="${esc(ME.org_name || '')}"></label><label class="f">Site web<input name="org_website" type="url" value="${esc(ME.org_website || '')}" placeholder="https://"></label><label class="f">E-mail public<input name="org_public_email" type="email" value="${esc(ME.org_public_email || '')}"></label><label class="f">Téléphone public<input name="org_public_phone" value="${esc(ME.org_public_phone || '')}"></label></div><label class="f">À propos de l'organisation<textarea name="org_about" rows="4">${esc(ME.org_about || '')}</textarea></label><div class="g3">${Object.entries(SOCIAL_L).map(([k, l]) => `<label class="f">${l}<input name="s_${k}" type="url" value="${esc(s[k] || '')}" placeholder="https://"></label>`).join('')}</div><label class="f">Logo${ME.org_logo ? ' (choisir un fichier pour le remplacer)' : ''}<input name="logo" type="file" accept="image/jpeg,image/png,image/webp"></label><div><button class="btn">Enregistrer le profil</button></div></form></div>`;
};
const _orgVotes = ORG_R.votes;
ORG_R.votes = async () => {
  const h = await _orgVotes(), X = await extras(); if (!X.campaigns.length) return h;
  let C = []; try { C = await q(sb.from('vote_candidates').select('*').in('campaign_id', X.campaigns.map(c => c.id)).order('number')); } catch (e) { return h; }
  return h + `<div class="wrap" style="padding-bottom:34px"><div class="card pad stack"><h2>Images du concours et fiches des candidats</h2>${X.campaigns.map(k => `<div class="stack" style="border-top:1px solid var(--line);padding-top:12px"><form class="row" data-f="actImage" data-kind="vote" data-id="${k.id}"><b style="flex:1">${esc(k.name)}</b><input class="in" style="margin:0;max-width:260px" name="image" type="file" accept="image/jpeg,image/png,image/webp" required><button class="btn s ghost">Changer l'image</button></form>${C.filter(c => c.campaign_id === k.id).map(c => `<form class="tier-edit" data-f="candidate" data-id="${c.id}"><div class="row">${safeUrl(c.photo_url) ? `<img class="av" src="${esc(c.photo_url)}" alt="">` : `<div class="av">${esc(initials(c.name))}</div>`}<div class="g3" style="flex:1"><label class="f">Nom<input name="name" required value="${esc(c.name)}"></label><label class="f">Ville<input name="city" value="${esc(c.city || '')}"></label><label class="f">Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label></div></div><label class="f">Présentation<textarea name="bio" rows="2" maxlength="1500">${esc(c.bio || '')}</textarea></label><div><button class="btn s">Enregistrer</button></div></form>`).join('')}</div>`).join('')}</div></div>`;
};
const _orgPots = ORG_R.cagnottes;
ORG_R.cagnottes = async () => {
  const h = await _orgPots(), X = await extras(); if (!X.pots.length) return h;
  return h + `<div class="wrap" style="padding-bottom:34px"><div class="card pad stack"><h2>Images des cagnottes</h2>${X.pots.map(p => `<form class="row" data-f="actImage" data-kind="pot" data-id="${p.id}"><b style="flex:1">${esc(p.name)}</b><input class="in" style="margin:0;max-width:260px" name="image" type="file" accept="image/jpeg,image/png,image/webp" required><button class="btn s ghost">Changer l'image</button></form>`).join('')}</div></div>`;
};

/* ---------- votes publics : photos, présentations, anonymat ---------- */
VIEWS.vote = async p => {
  const [c, R, Cd] = await Promise.all([q(sb.from('vote_campaigns').select('*').eq('id', p[1]).maybeSingle()), rpc2('vote_results', { p_campaign: p[1] }), q(sb.from('vote_candidates').select('*').eq('campaign_id', p[1]))]);
  if (!c) return vNotFound();
  const info = Object.fromEntries(Cd.map(x => [x.id, x]));
  R.sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
  const st = cStatus(c), open = st[0] === 'Ouvert', top = Math.max(1, R[0]?.votes || 0), tot = R.reduce((a, x) => a + +x.votes, 0), f = norm(UI.vq || '');
  return `<div class="poster big vote-head" style="${imgBg(c.image_url, c.color1, c.color2)};border-radius:0"><div class="wrap"><span class="p-cat">Concours · ${esc(c.org_name || '')}</span><span class="p-name">${esc(c.name)}</span><div class="row" style="margin-top:10px">${badge(st)}<span class="sm" style="color:#fff">${num(tot)} votes · ${+c.price === 0 ? 'vote gratuit' : money(c.price, c.currency) + ' par vote'} · clôture ${dFmt(c.ends_at)} à ${hFmt(c.ends_at)}</span></div></div></div>
  <div class="wrap sec stack">${c.description ? `<div class="card pad">${paras(c.description)}</div>` : ''}<input class="in" style="max-width:320px;margin:0" data-i="vq" value="${esc(UI.vq || '')}" placeholder="Rechercher un candidat">
  <div class="stack">${R.map((x, i) => { const d = info[x.candidate_id] || {}; return !f || norm(x.name).includes(f) ? `<div class="cand"><div class="rank ${i === 0 ? 'r1' : ''}">${i + 1}</div>${safeUrl(d.photo_url) ? `<img class="av" src="${esc(d.photo_url)}" alt="${esc(x.name)}" loading="lazy">` : `<div class="av">${esc(initials(x.name))}</div>`}<div style="flex:1;min-width:140px"><b>${esc(x.name)}</b><div class="xs mut">${esc(x.city || '')}</div>${d.bio ? `<div class="xs" style="margin-top:3px">${esc(d.bio)}</div>` : ''}<div class="bar" style="margin-top:6px"><i style="width:${(x.votes / top * 100).toFixed(1)}%"></i></div></div><div class="r"><b>${num(x.votes)}</b><div class="xs mut">votes</div></div>${open ? `<div class="row">${+c.price === 0 ? '' : `<select class="in" style="width:auto;margin:0" id="vn-${x.candidate_id}" aria-label="Nombre de votes">${[1, 5, 10, 25, 50, 100, 500].filter(n => n <= (c.max_per_purchase || 1000)).map(n => `<option>${n}</option>`).join('')}</select>`}<button class="btn s" data-a="vote3" data-cand="${x.candidate_id}" data-name="${esc(x.name)}" data-price="${c.price}" data-cur="${esc(c.currency)}">Voter</button></div>` : ''}</div>` : ''; }).join('')}</div>
  ${open ? '' : `<div class="note">Les votes ne sont pas ouverts pour ce concours (${st[0].toLowerCase()}).</div>`}</div>`;
};

/* ---------- cagnottes publiques : image, montants proposés, anonymat, message ---------- */
potCard = function (p, t) {
  const s = +(t?.collected || 0), st = pStatus(p, s), open = st[0] === 'En cours' || st[0] === 'Objectif atteint', presets = [5000, 10000, 20000, 50000, 100000].filter(v => v >= (+p.min_amount || 0));
  return `<div class="card ev"><a class="poster" href="#/cagnotte/${p.id}" style="${imgBg(p.image_url, p.color1, p.color2)}">${badge(st)}<span class="p-cat">Cagnotte · ${esc(p.org_name || '')}</span><span class="p-name">${esc(p.name)}</span></a><div class="ev-b stack"><p class="sm mut" style="margin:0">${esc(p.description || '')}</p><div><div class="row between sm"><b>${money(s, p.currency)}</b><span class="mut">sur ${money(p.goal, p.currency)}</span></div><div class="bar ${s >= p.goal ? 'done' : ''}" style="margin:6px 0"><i style="width:${Math.min(100, s / p.goal * 100)}%"></i></div><div class="row between xs mut"><span>${Math.round(s / p.goal * 100)} % · ${num(t?.contributors || 0)} contribution(s)</span><span>Jusqu'au ${dFmt(p.ends_at)}</span></div></div>
  ${open ? `<form class="stack" data-f="contrib3" data-pot="${p.id}" data-name="${esc(p.name)}" data-cur="${esc(p.currency)}"><div class="chips">${presets.map(v => `<button type="button" class="chip" data-a="preset" data-v="${v}">${num(v)}</button>`).join('')}</div><div class="row"><input class="in" style="flex:1;margin:0;min-width:120px" name="amount" type="number" min="${Math.max(1, p.min_amount)}" step="1" required placeholder="Montant (${esc(p.currency)})" aria-label="Montant"><button class="btn">Contribuer</button></div></form>` : ''}</div></div>`;
};
const _cagnotte = VIEWS.cagnotte;
VIEWS.cagnotte = async p => {
  const h = await _cagnotte(p); let L = []; try { L = await rpc2('pot_recent', { p_pot: p[1] }); } catch (e) { return h; }
  return h.replace(/<\/div><\/div>$/, '') + `<div class="card pad" style="max-width:520px;margin-top:16px"><h3>Dernières contributions</h3>${L.length ? L.map(c => `<div style="padding:7px 0;border-bottom:1px solid var(--line)"><div class="row between sm"><b>${esc(c.name)}</b><span>${money(c.amount)}</span></div>${c.message ? `<div class="sm mut">« ${esc(c.message)} »</div>` : ''}<div class="xs mut">${dtFmt(c.at)}</div></div>`).join('') : '<p class="sm mut">Aucune contribution confirmée pour le moment.</p>'}</div></div></div>`;
};

/* ---------- Direction : paramètres, lieux, avis, pages et aide, messages de contact ---------- */
ADMIN_TABS.push(['lieux', 'Lieux'], ['avis', 'Avis'], ['contenus', 'Pages et aide']);
ADMIN_R.parametres = async () => {
  const S = (await loadData(true)).settings || {}, pct = k => typeof S[k] === 'number' ? +(S[k] * 100).toFixed(2) : '';
  const R = [['commission_tickets_online', 'Billets vendus en ligne'], ['commission_tickets_pos', 'Billets vendus au guichet'], ['commission_votes', 'Votes'], ['commission_applications', 'Candidatures'], ['commission_donations', 'Dons (cagnottes)']];
  return `<div class="cols"><form class="card pad stack" data-f="rates"><h2>Commissions de la plateforme</h2><p class="sm mut" style="margin:0">Un taux par service. Les valeurs initiales reprennent les paramètres de fatibarabilletterie.com. La page publique « Prix et frais » y annonce 4,5 % pour les billets alors que 5 % sont appliqués : à harmoniser.</p><div class="g2">${R.map(([k, l]) => `<label class="f">${l} (%)<input name="${k}" type="number" min="0" max="50" step="0.1" required value="${pct(k)}"></label>`).join('')}</div><label class="f">Motif (journalisé)<input name="reason" required minlength="4" placeholder="Ex. Décision de la Direction du …"></label><div><button class="btn">Enregistrer les taux</button></div></form>
  <form class="card pad stack" data-f="scanWindow"><h2>Contrôle de la date au scan</h2><div class="g2"><label class="f">Entrée possible avant le début (heures)<input name="early" type="number" min="0" max="72" required value="${S.scan_early_hours ?? 12}"></label><label class="f">Entrée possible après la fin (heures)<input name="late" type="number" min="0" max="72" required value="${S.scan_late_hours ?? 6}"></label></div><label class="f">Motif (journalisé)<input name="reason" required minlength="4"></label><div><button class="btn">Enregistrer</button></div><p class="xs mut" style="margin:0">Hors de cette plage, le scanner affiche « BILLET POUR UNE AUTRE DATE » et le billet reste valide.</p></form></div>`;
};
ADMIN_R.lieux = async () => {
  const [V, T] = await Promise.all([q(sb.from('venues').select('*').order('created_at', { ascending: false })), q(sb.from('venue_types').select('*').order('position'))]);
  return `<div class="stack"><div class="card pad"><h2>Lieux (${V.length})</h2>${V.length ? `<div class="tw"><table><tr><th>Lieu</th><th>Type</th><th>Ville</th><th>Annuaire</th><th>Statut</th><th></th></tr>${V.map(v => `<tr><td><a href="#/lieu/${v.id}"><b>${esc(v.name)}</b></a></td><td>${esc(v.type || '')}</td><td>${esc(v.city || '')}</td><td>${v.listed ? 'Public' : 'Privé'}</td><td>${badge(v.hidden ? ['Masqué', 'red'] : ['Visible', 'green'])}</td><td class="r"><button class="btn s ${v.hidden ? 'ok' : 'danger'}" data-a="venueHide" data-id="${v.id}" data-v="${v.hidden ? 0 : 1}">${v.hidden ? 'Rétablir' : 'Masquer'}</button></td></tr>`).join('')}</table></div>` : '<p class="mut sm">Aucun lieu enregistré.</p>'}</div>
  <div class="card pad"><h2>Types de lieux</h2><div class="chips">${T.map(t => `<button class="chip ${t.active ? 'on' : ''}" data-a="vtype" data-n="${esc(t.name)}" data-v="${t.active ? 0 : 1}" title="Cliquer pour ${t.active ? 'désactiver' : 'activer'}">${esc(t.name)}</button>`).join('')}</div><form class="row" data-f="vtypeAdd" style="margin-top:12px"><input class="in" style="flex:1;margin:0" name="name" required minlength="2" placeholder="Nouveau type de lieu"><button class="btn s">Ajouter</button></form></div></div>`;
};
ADMIN_R.avis = async () => {
  const R = await rpc2('manage_reviews');
  return `<div class="card pad"><h2>Avis (${R.length})</h2>${R.length ? `<div class="tw"><table><tr><th>Événement</th><th>Auteur</th><th>Note</th><th>Commentaire</th><th>Date</th><th></th></tr>${R.map(r => `<tr><td>${esc(r.event)}</td><td class="sm">${esc(r.author || '')}</td><td class="stars nowrap">${stars(r.rating)}</td><td class="sm">${esc(r.comment || '')}</td><td class="sm nowrap">${dFmt(r.at)}</td><td class="r"><button class="btn s ghost" data-a="reviewHide" data-id="${r.id}" data-v="${r.hidden ? 0 : 1}">${r.hidden ? 'Rétablir' : 'Masquer'}</button></td></tr>`).join('')}</table></div>` : '<p class="mut sm">Aucun avis.</p>'}</div>`;
};
ADMIN_R.contenus = async () => {
  const [P, H] = await Promise.all([q(sb.from('site_pages').select('*').order('title')), q(sb.from('help_articles').select('*').order('audience').order('position'))]);
  const cur = P.find(x => x.slug === UI.pageEdit) || P[0] || {}, ha = H.find(x => x.id === UI.helpEdit) || {};
  return `<div class="stack"><div class="cols"><div class="card pad"><h2>Pages du site</h2>${P.map(x => `<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--line)"><span><b>${esc(x.title)}</b><div class="xs mut">#/page/${esc(x.slug)} · ${x.body ? 'rédigée' : 'à rédiger'}</div></span><button class="btn s ${x.slug === cur.slug ? '' : 'ghost'}" data-a="pageEdit" data-v="${esc(x.slug)}">Modifier</button></div>`).join('')}<p class="xs mut">Les textes juridiques (conditions, confidentialité, cookies) doivent être fournis ou validés par la Direction.</p></div>
  <form class="card pad stack" data-f="page" data-slug="${esc(cur.slug || '')}"><h2>${esc(cur.title || 'Page')}</h2><label class="f">Titre<input name="title" required value="${esc(cur.title || '')}"></label><label class="f">Texte (une ligne vide sépare les paragraphes)<textarea name="body" rows="14">${esc(cur.body || '')}</textarea></label><label class="f">Motif (journalisé)<input name="reason" required minlength="4"></label><div><button class="btn">Publier la page</button></div></form></div>
  <div class="cols"><div class="card pad"><div class="row between"><h2>Centre d'aide</h2><button class="btn s" data-a="helpEdit" data-v="">+ Nouvel article</button></div>${H.length ? H.map(a => `<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--line)"><span><b>${esc(a.title)}</b><div class="xs mut">${a.audience === 'participant' ? 'Participants' : 'Organisateurs'}${a.published ? '' : ' · non publié'}</div></span><button class="btn s ghost" data-a="helpEdit" data-v="${a.id}">Modifier</button></div>`).join('') : '<p class="mut sm">Aucun article.</p>'}</div>
  <form class="card pad stack" data-f="help" data-id="${ha.id || ''}"><h2>${ha.id ? 'Modifier l\'article' : 'Nouvel article'}</h2><div class="g2"><label class="f">Public<select name="audience"><option value="participant" ${ha.audience === 'participant' ? 'selected' : ''}>Participants</option><option value="organisateur" ${ha.audience === 'organisateur' ? 'selected' : ''}>Organisateurs</option></select></label><label class="f">Ordre d'affichage<input name="position" type="number" value="${ha.position ?? 0}"></label></div><label class="f">Question ou titre<input name="title" required minlength="3" value="${esc(ha.title || '')}"></label><label class="f">Réponse<textarea name="body" rows="6" required minlength="10">${esc(ha.body || '')}</textarea></label><label class="row sm"><input type="checkbox" name="published" ${ha.published !== false ? 'checked' : ''}> Publié</label><div><button class="btn">Enregistrer</button></div></form></div></div>`;
};
const _reclam = ADMIN_R.reclamations;
ADMIN_R.reclamations = async (D, me) => {
  const h = await _reclam(D, me); let C = []; try { C = (await rpc2('list_contacts')).filter(m => !m.venue); } catch (e) { return h; }
  return `<div class="card pad" style="margin-bottom:18px"><h2>Messages du formulaire de contact</h2>${C.length ? C.slice(0, 50).map(m => `<div style="padding:9px 0;border-bottom:1px solid var(--line)"><div class="row between"><b>${esc(m.subject)}</b>${m.handled ? badge(['Traité', 'green']) : `<button class="btn s ghost" data-a="contactDone" data-id="${m.id}">Marquer traité</button>`}</div><div class="xs mut">${esc(m.name)} · ${esc(m.email)} · ${dtFmt(m.at)}</div><div class="sm" style="white-space:pre-wrap">${esc(m.message)}</div></div>`).join('') : '<p class="sm mut">Aucun message.</p>'}</div>` + h;
};

/* ---------- actions ---------- */
Object.assign(A, {
  advReset() { UI.adv = {}; UI.when = ''; render(); },
  async fav(el) { try { const on = await rpc2('toggle_favorite', { p_event: el.dataset.id }); SOCIAL.at = 0; toast(on ? 'Ajouté à vos favoris.' : 'Retiré de vos favoris.'); render(); } catch (e) { toast(e.message); } },
  async follow(el) { try { const on = await rpc2('toggle_follow', { p_org: el.dataset.id }); SOCIAL.at = 0; toast(on ? 'Vous suivez cet organisateur.' : 'Abonnement retiré.'); render(); } catch (e) { toast(e.message); } },
  async share(el) { const url = location.href; try { if (navigator.share) await navigator.share({ title: el.dataset.title, url }); else { await navigator.clipboard.writeText(url); toast('Lien copié.'); } } catch (e) { /* partage annulé */ } },
  ics(el) {
    const ev = DATA.events.find(e => e.id === el.dataset.id); if (!ev) return;
    const d = ev.dates.find(x => x.id === UI.selDate[ev.id]) || ev.dates[0], f = t => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), clean = s => String(s || '').replace(/[\r\n,;]/g, ' ');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FatiBillets//FR', 'BEGIN:VEVENT', 'UID:' + d.id + '@fatibillets', 'DTSTAMP:' + f(Date.now()), 'DTSTART:' + f(d.start), 'DTEND:' + f(d.end), 'SUMMARY:' + clean(ev.name), 'LOCATION:' + clean([ev.venue, ev.city].filter(Boolean).join(' ')), 'URL:' + location.origin + '/#/e/' + ev.id, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'evenement.ics'; document.body.appendChild(a); a.click(); a.remove();
  },
  preset(el) { const i = el.closest('form').querySelector('[name="amount"]'); i.value = el.dataset.v; el.closest('.chips').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el)); },
  vote3(el) {
    const price = +el.dataset.price, sel = $('#vn-' + el.dataset.cand), qty = sel ? +sel.value : 1, total = qty * price;
    payerModal(`${qty} vote${qty > 1 ? 's' : ''} pour ${el.dataset.name}`, price ? `Montant : <b style="color:var(--o-d)">${money(total, el.dataset.cur)}</b>` : 'Vote gratuit', false, async b => {
      const id = await rpc2('buy_votes', { p_candidate: el.dataset.cand, p_qty: qty, p_name: b.name, p_phone: b.phone, p_email: b.email, p_anonymous: b.anon });
      if (total > 0) await startPay(id); else { toast('Merci ! Votre vote est enregistré.'); await render(); }
    });
  },
  venueEdit(el) { UI.venueEdit = el.dataset.id; render().then(() => { const f = $('[data-f="venue"]'); if (f) f.scrollIntoView({ behavior: 'smooth' }); }); },
  venueHide(el) { const on = el.dataset.v === '1'; askReason(on ? 'Masquer ce lieu' : 'Rétablir ce lieu', m => act(() => rpc2('admin_set_venue', { p_id: el.dataset.id, p_hidden: on, p_reason: m }), 'Lieu mis à jour.')); },
  vtype(el) { act(async () => { await q(sb.from('venue_types').update({ active: el.dataset.v === '1' }).eq('name', el.dataset.n)); }); },
  reviewHide(el) { act(() => rpc2('set_review_hidden', { p_id: el.dataset.id, p_hidden: el.dataset.v === '1' }), 'Avis mis à jour.'); },
  contactDone(el) { act(() => rpc2('mark_contact', { p_id: el.dataset.id, p_handled: true })); },
  pageEdit(el) { UI.pageEdit = el.dataset.v; render(); },
  helpEdit(el) { UI.helpEdit = el.dataset.v; render(); },
});
Object.assign(F, {
  async payer(f) { const b = { name: f.get('name').trim(), phone: f.get('phone').trim(), email: (f.get('email') || '').trim(), message: (f.get('message') || '').trim(), anon: !!f.get('anon') }; await payerModal.cb(b); closeModal(); },
  async adv(f) { UI.adv = { country: f.get('country'), city: f.get('city').trim(), pmin: f.get('pmin'), pmax: f.get('pmax'), free: !!f.get('free') }; $('#results').innerHTML = results(); },
  async vfilter(f) { UI.vf = { q: f.get('q').trim(), type: f.get('type'), country: f.get('country'), cap: f.get('cap') }; await render(); },
  async contrib3(f, form) {
    const amount = +f.get('amount');
    payerModal('Contribution — ' + form.dataset.name, `Montant : <b style="color:var(--o-d)">${money(amount, form.dataset.cur)}</b>`, true, async b => { const id = await rpc2('contribute', { p_pot: form.dataset.pot, p_amount: amount, p_name: b.name, p_phone: b.phone, p_email: b.email, p_anonymous: b.anon, p_message: b.message || null }); await startPay(id); });
  },
  async review(f, form) { await rpc2('add_review', { p_event: form.dataset.ev, p_rating: +f.get('rating'), p_comment: f.get('comment') }); toast('Merci pour votre avis.'); await render(); },
  async quote(f, form) { await rpc2('submit_contact', { p_name: f.get('name'), p_email: f.get('email'), p_subject: 'Demande de devis — ' + form.dataset.name, p_message: f.get('message'), p_phone: f.get('phone'), p_venue: form.dataset.venue }); form.reset(); toast('Demande envoyée au gestionnaire du lieu.'); },
  async contact(f, form) { await rpc2('submit_contact', { p_name: f.get('name'), p_email: f.get('email'), p_subject: f.get('subject'), p_message: f.get('message') }); form.reset(); toast('Message envoyé. Nous vous répondrons par e-mail.'); },
  async profile2(f) { await rpc2('update_my_profile', { p: { full_name: f.get('full_name'), phone: f.get('phone'), birth_date: f.get('birth_date'), city: f.get('city'), country: f.get('country') } }); await loadMe(); toast('Informations enregistrées.'); await render(); },
  async password(f, form) {
    if (f.get('next') !== f.get('again')) throw new Error('Les deux nouveaux mots de passe ne sont pas identiques.');
    const chk = await sb.auth.signInWithPassword({ email: ME.email, password: f.get('current') }); if (chk.error) throw new Error('Mot de passe actuel incorrect.');
    const { error } = await sb.auth.updateUser({ password: f.get('next') }); if (error) throw new Error(error.message);
    form.reset(); toast('Mot de passe modifié.');
  },
  async evFlags(f, form) { const id = form.dataset.id; await rpc2('set_event_flags', { p_event: id, p: { published: f.get('published') === '1', reviews_enabled: f.get('reviews') === '1' } }); await rpc2('set_event_venue', { p_event: id, p_venue: f.get('venue_id') || null }); DATA = null; toast('Enregistré.'); await render(); },
  async tierEdit(f, form) { await rpc2('update_tier', { p_id: form.dataset.id, p: { quota: f.get('quota'), max_per_order: f.get('max_per_order'), description: f.get('description'), sales_start: fromLocalInput(f.get('sales_start')), sales_end: fromLocalInput(f.get('sales_end')) } }); DATA = null; toast('Catégorie mise à jour.'); await render(); },
  async tierAdd(f, form) { await rpc2('add_tier', { p_event: form.dataset.ev, p_date: form.dataset.date, p_name: f.get('name'), p_price: +f.get('price'), p_quota: +f.get('quota') }); DATA = null; toast('Catégorie ajoutée.'); await render(); },
  async venue(f, form) {
    const img = await uploadImage(f.get('image'));
    const id = await rpc2('save_venue', { p: { id: form.dataset.id || null, name: f.get('name'), type: f.get('type'), seated: f.get('seated'), standing: f.get('standing'), address: f.get('address'), city: f.get('city'), country: f.get('country'), neighborhoods: f.get('neighborhoods'), contact_email: f.get('contact_email'), amenities: f.get('amenities').split(',').map(s => s.trim()).filter(Boolean), description: f.get('description'), pricing: f.get('pricing'), availability: f.get('availability'), food: f.get('food'), listed: !!f.get('listed'), quote_form: !!f.get('quote_form'), image_url: img } });
    UI.venueEdit = id; toast('Lieu enregistré.'); await render();
  },
  async orgProfile(f) {
    const logo = await uploadImage(f.get('logo')), socials = Object.fromEntries(Object.keys(SOCIAL_L).map(k => [k, f.get('s_' + k)]));
    await rpc2('update_org_profile', { p: { org_name: f.get('org_name'), org_website: f.get('org_website'), org_public_email: f.get('org_public_email'), org_public_phone: f.get('org_public_phone'), org_about: f.get('org_about'), org_socials: socials, org_logo: logo } });
    await loadMe(); DATA = null; toast('Profil enregistré.'); await render();
  },
  async actImage(f, form) { const url = await uploadImage(f.get('image')); if (!url) throw new Error('Choisissez une image.'); await rpc2('set_activity_image', { p_kind: form.dataset.kind, p_id: form.dataset.id, p_url: url }); toast('Image mise à jour.'); await render(); },
  async candidate(f, form) { const photo = await uploadImage(f.get('photo')); await rpc2('update_candidate', { p_id: form.dataset.id, p: { name: f.get('name'), city: f.get('city'), bio: f.get('bio'), photo_url: photo } }); toast('Candidat mis à jour.'); await render(); },
  async rates(f) { for (const k of ['commission_tickets_online', 'commission_tickets_pos', 'commission_votes', 'commission_applications', 'commission_donations']) await rpc2('set_setting', { p_key: k, p_value: +f.get(k) / 100, p_reason: f.get('reason') }); DATA = null; XC = null; toast('Taux enregistrés.'); await render(); },
  async vtypeAdd(f) { await q(sb.from('venue_types').insert({ name: f.get('name').trim(), position: 99 })); await render(); },
  async page(f, form) { await rpc2('save_page', { p_slug: form.dataset.slug, p_title: f.get('title'), p_body: f.get('body'), p_reason: f.get('reason') }); toast('Page publiée.'); await render(); },
  async help(f, form) { const id = await rpc2('save_help_article', { p: { id: form.dataset.id || null, audience: f.get('audience'), position: f.get('position'), title: f.get('title'), body: f.get('body'), published: !!f.get('published') } }); UI.helpEdit = id; toast('Article enregistré.'); await render(); },
});
// boot() est appelé à la fin de modules4.js, chargé après ce fichier.
