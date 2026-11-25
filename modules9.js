'use strict';
/* FatiBillets — connexion par téléphone, formulaires d'inscription complets (champs à cocher, documents, dates),
   localisation en temps réel des lieux, cagnottes modifiables, suppression de comptes, retour direct au compte admin.
   Chargé après modules8.js ; nécessite la base v11 et les fonctions serveur login-phone et admin-delete-user. */

/* =====================================================================
   1. CONNEXION AVEC LE NUMÉRO DE TÉLÉPHONE
   ===================================================================== */
VIEWS.connexion = async () => {
  let h = vAuth();
  if (UI.authTab === 'up') return h.replace('<label class="f">Téléphone<input name="phone"', '<label class="f">Téléphone (il vous servira à vous connecter)<input name="phone"');
  return h.replace('<label class="f">E-mail<input name="email" type="email" required autocomplete="email"></label>', '<label class="f">Numéro de téléphone ou e-mail<input name="email" required autocomplete="username" placeholder="Ex. 620 00 00 00"></label>');
};
const landing = () => ({ admin: '#/admin', admin_secondaire: '#/admin', organisateur: '#/org', vendeur: '#/vente', transporteur: '#/transporteur', chauffeur: '#/chauffeur', scanner: '#/scan' }[role()] || (ME && ME.org_requested ? '#/org' : ME && ME.carrier_request ? '#/transporteur' : '#/'));
const _signin9 = F.signin;
F.signin = async f => {
  const id = (f.get('email') || '').trim();
  if (id.includes('@')) return _signin9(f);
  const r = await fn('login-phone', { phone: id, password: f.get('password') });
  const { error } = await sb.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token }); if (error) throw new Error(error.message);
  await loadMe(); location.hash = landing(); await render();
};
const _signup9 = F.signup;
F.signup = async (f, form) => {
  let used = false; try { used = await rpc2('phone_in_use', { p_phone: f.get('phone') }); } catch (e) { /* base pas à jour : on continue */ }
  if (used) throw new Error('Ce numéro de téléphone est déjà utilisé par un autre compte. Connectez-vous, ou utilisez un autre numéro.');
  return _signup9(f, form);
};
A.forgot = () => {
  const e = ($('[data-f="signin"] [name="email"]') || {}).value || '';
  if (!e.includes('@')) return toast('Pour recevoir le lien de réinitialisation, saisissez votre adresse e-mail (pas le numéro) puis recliquez.');
  act(async () => { const { error } = await sb.auth.resetPasswordForEmail(e.trim(), { redirectTo: location.origin + location.pathname }); if (error) throw new Error(error.message); }, 'Si ce compte existe, un lien de réinitialisation vient d\'être envoyé par e-mail.');
};

/* =====================================================================
   2. FORMULAIRES D'INSCRIPTION : CHAMPS À COCHER, DOCUMENTS, DATE DE DÉBUT ET DE FIN
   ===================================================================== */
const FIELDS = [
  ['Identité et coordonnées', [['birth_date', 'Date de naissance', 'date'], ['gender', 'Sexe', 'select', ['Femme', 'Homme']], ['nationality', 'Nationalité', 'text'], ['region', 'Région', 'text'], ['city', 'Ville ou localité', 'text'], ['address', 'Adresse', 'text']]],
  ['Parcours académique', [['level', 'Niveau d\'études', 'select', ['Baccalauréat / niveau bac', 'BTS / BUT / Licence 2', 'Licence / Bachelor (Bac+3)', 'Master / DEA / DESS (Bac+5)', 'Doctorat (Bac+8)', 'Autre niveau']], ['institution', 'Établissement d\'origine', 'text'], ['field_of_study', 'Domaine ou spécialité', 'text']]],
  ['Compétences et expériences', [['skills', 'Compétences techniques', 'area'], ['internships', 'Stages', 'area'], ['jobs', 'Emplois', 'area'], ['projects', 'Projets réalisés', 'area'], ['certifications', 'Certifications', 'area'], ['languages', 'Langues parlées', 'text']]],
  ['Documents', [['photo', 'Photo', 'file', 'image/jpeg,image/png,image/webp'], ['cv', 'CV (PDF, DOC ou DOCX)', 'file', '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['id_type', 'Type de pièce d\'identité', 'select', ['Carte nationale d\'identité', 'Passeport', 'Permis de conduire', 'Autre document']], ['id_doc', 'Pièce d\'identité (photo ou PDF)', 'file', 'image/jpeg,image/png,image/webp,application/pdf'], ['video', 'Vidéo de présentation (50 Mo max.)', 'file', 'video/mp4,video/quicktime,video/webm']]],
  ['Disponibilité et motivations', [['availability', 'Disponibilité', 'select', ['Immédiatement disponible', 'Disponible sous une à deux semaines', 'Disponible sous un mois', 'Disponibilité à convenir']], ['aspirations', 'Aspirations professionnelles', 'area'], ['motivation', 'Motivation', 'area'], ['extra', 'Informations complémentaires', 'area']]],
];
const FIELD_L = Object.fromEntries(FIELDS.flatMap(([, L]) => L.map(x => [x[0], x[1]])));
const FILE_KEYS = ['photo', 'cv', 'id_doc', 'video'];
// Ancien format (rubriques) → nouveau format (champ par champ).
function formCfg(f) {
  if (f.fields && Object.keys(f.fields).length) return f.fields;
  const s = f.sections || {}, c = {}, set = (keys, v) => keys.forEach(k => { c[k] = v; });
  set(['birth_date', 'region', 'city'], 'req');
  if (s.academic) set(['level', 'field_of_study'], 'req'), set(['institution'], 'opt');
  if (s.skills) set(['skills', 'internships', 'jobs', 'certifications', 'languages'], 'opt');
  if (s.motivation) set(['availability', 'extra'], 'opt'), set(['motivation'], 'req');
  return c;
}
const formOpen = f => !f.closed && ts(f.ends_at) > Date.now() && ts(f.starts_at || f.created_at) <= Date.now();
const formBadge = f => f.closed || ts(f.ends_at) < Date.now() ? ['Clôturées', 'gray'] : ts(f.starts_at || 0) > Date.now() ? ['À venir', 'blue'] : ['Ouvertes', 'green'];
function fieldMatrix(cfg) {
  return `<div class="field-matrix">${FIELDS.map(([sec, L]) => `<div class="fm-sec"><b>${sec}</b>${L.map(([k, l]) => { const v = cfg[k] || 'off'; return `<div class="fm-row"><span>${l}</span><div class="fm-opts">${[['off', 'Non'], ['opt', 'Facultatif'], ['req', 'Obligatoire']].map(([o, ol]) => `<label class="${v === o ? 'on' : ''}"><input type="radio" name="f_${k}" value="${o}" ${v === o ? 'checked' : ''} onchange="this.closest('.fm-opts').querySelectorAll('label').forEach(x=>x.classList.toggle('on',x.contains(this)))"> ${ol}</label>`).join('')}</div></div>`; }).join('')}</div>`).join('')}<p class="xs mut" style="margin:6px 0 0">Nom, téléphone et e-mail sont toujours demandés. Les documents sont stockés de façon protégée : seuls vous et la Direction FATIGLOBAL pouvez les ouvrir.</p></div>`;
}
const readMatrix = f => Object.fromEntries(Object.keys(FIELD_L).map(k => [k, f.get('f_' + k) || 'off']));
const ALL_OPT = Object.fromEntries(Object.keys(FIELD_L).map(k => [k, 'opt']));

VIEWS.inscriptions = async () => {
  const F0 = await q(sb.from('forms').select('*').order('ends_at')), tr = UI.track;
  return head('Inscriptions et candidatures', 'Concours, recrutements, formations : déposez votre dossier en ligne et suivez son statut.') + `<div class="wrap sec"><div class="cols"><div class="stack">${F0.length ? F0.map(f => `<div class="card pad"><div class="row between"><h3 style="margin:0">${esc(f.title)}</h3>${badge(formBadge(f))}</div><p class="sm mut">${esc(f.org_name || '')} · du ${dFmt(f.starts_at || f.created_at)} au ${dFmt(f.ends_at)} à ${hFmt(f.ends_at)}</p><p class="sm">${esc(f.description || '')}</p>${formOpen(f) ? `<a class="btn s" href="#/inscription/${f.id}">Déposer ma candidature</a>` : ts(f.starts_at || 0) > Date.now() ? `<span class="sm mut">Ouverture le ${dFmt(f.starts_at)} à ${hFmt(f.starts_at)}</span>` : ''}</div>`).join('') : '<div class="empty"><b>Aucune inscription ouverte pour le moment.</b></div>'}</div>
  <aside class="card pad stack sticky"><h3>Suivre ma candidature</h3><form class="stack" data-f="track"><label class="f">Numéro de dossier<input name="num" required placeholder="CAND-…"></label><label class="f">E-mail utilisé<input name="email" type="email" required></label><button class="btn s">Suivre</button></form>${tr ? (tr.found ? `<div class="note"><b>${esc(tr.number)}</b> — ${esc(tr.title)}<br>Déposée le ${dtFmt(tr.created_at)}<br>Statut : ${badge(aStatus(tr.status))}</div>` : '<div class="note">Aucun dossier ne correspond à ce numéro et cet e-mail.</div>') : ''}</aside></div></div>`;
};
VIEWS.inscription = async p => {
  const f = await q(sb.from('forms').select('*').eq('id', p[1]).maybeSingle()); if (!f) return vNotFound();
  if (!formOpen(f)) return box(ts(f.starts_at || 0) > Date.now() ? 'Inscriptions bientôt ouvertes' : 'Inscriptions clôturées', `<p class="mut">${ts(f.starts_at || 0) > Date.now() ? 'Ouverture le ' + dFmt(f.starts_at) + ' à ' + hFmt(f.starts_at) + '.' : ''}</p><a class="btn" href="#/inscriptions">Voir les autres inscriptions</a>`);
  const cfg = formCfg(f), lab = (l, req) => `${l}${req ? ' <span class="req">*</span>' : ''}`;
  const input = ([k, l, t, x]) => { const v = cfg[k]; if (!v || v === 'off') return ''; const req = v === 'req' ? 'required' : '';
    if (t === 'area') return `<label class="f">${lab(l, req)}<textarea name="${k}" rows="3" ${req} maxlength="3000"></textarea></label>`;
    if (t === 'select') return `<label class="f">${lab(l, req)}<select name="${k}" ${req}><option value="">Choisir…</option>${x.map(o => `<option>${esc(o)}</option>`).join('')}</select></label>`;
    if (t === 'file') return `<label class="f">${lab(l, req)}<input name="${k}" type="file" accept="${x}" ${req}></label>`;
    return `<label class="f">${lab(l, req)}<input name="${k}" type="${t}" ${req}></label>`; };
  const price = +f.price || 0;
  return head(esc(f.title), esc(f.org_name || '') + ' · jusqu\'au ' + dFmt(f.ends_at) + ' à ' + hFmt(f.ends_at)) + `<div class="wrap sec"><form class="card pad stack" data-f="apply" data-form="${f.id}" data-price="${price}" style="max-width:860px">${f.description ? `<p class="mut" style="margin:0">${esc(f.description)}</p>` : ''}
  <div class="row" style="gap:8px">${badge(price ? ['Frais de candidature : ' + money(price, f.currency), 'orange'] : ['Candidature gratuite', 'green'])}${f.max_applicants ? badge([num(f.max_applicants) + ' candidats maximum', 'blue']) : ''}</div>${price ? `<p class="xs mut" style="margin:0">Après l'envoi du dossier, vous serez redirigé vers LengoPay (Orange Money, MTN MoMo, carte) pour payer les frais. Votre candidature n'est prise en compte qu'une fois payée.</p>` : ''}
  <h3>Identité et coordonnées</h3><div class="g2"><label class="f">${lab('Nom complet', 1)}<input name="name" required minlength="3" value="${esc(ME?.full_name || '')}"></label><label class="f">${lab('Téléphone', 1)}<input name="phone" required pattern="[+0-9 ]{8,}" inputmode="tel" value="${esc(ME?.phone || '')}"></label><label class="f">${lab('E-mail', 1)}<input name="email" type="email" required value="${esc(ME?.email || '')}"></label>${FIELDS[0][1].map(input).join('')}</div>
  ${FIELDS.slice(1).map(([sec, L]) => { const inner = L.map(input).join(''); return inner ? `<h3>${sec}</h3><div class="g2">${inner}</div>` : ''; }).join('')}
  <p class="xs mut" style="margin:0"><span class="req">*</span> obligatoire. Vos documents sont transmis de façon protégée et ne sont visibles que par l'organisateur et la Direction FATIGLOBAL.</p><button class="btn xl">SOUMETTRE MA CANDIDATURE</button></form></div>`;
};
F.apply = async (f, form) => {
  const fid = form.dataset.form, folder = fid + '/' + crypto.randomUUID(), data = { files: {} };
  for (const [k, v] of f.entries()) if (typeof v === 'string' && v.trim()) data[k] = v.trim();
  for (const k of FILE_KEYS) {
    const file = f.get(k); if (!file || !file.size) continue;
    if (file.size > 50 * 1024 * 1024) throw new Error('Un document dépasse 50 Mo : ' + FIELD_L[k]);
    toast('Envoi du document : ' + FIELD_L[k] + '…');
    const path = folder + '/' + k + '.' + ((file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin');
    const up = await sb.storage.from('candidatures').upload(path, file, { contentType: file.type || undefined });
    if (up.error) throw new Error('Envoi impossible (' + FIELD_L[k] + ') : ' + up.error.message);
    data.files[k] = path;
  }
  const n = await rpc2('submit_application', { p_form: fid, p_data: data });
  if (+form.dataset.price > 0) {
    let pid = null; try { pid = await rpc2('application_payment', { p_number: n, p_email: f.get('email') }); } catch (e) { toast(e.message); }
    if (pid) { modal(`<h2>${ic('check')} Dossier ${esc(n)} enregistré</h2><p>Notez ce numéro. Redirection vers le paiement des frais de candidature…</p>`); await startPay(pid); return; }
  }
  location.hash = '#/inscriptions';
  setTimeout(() => modal(`<h2>${ic('check')} Candidature enregistrée</h2><p>Votre numéro de dossier :</p><p class="tk-code" style="font-size:1.4rem;color:var(--o-d)">${esc(n)}</p><p class="sm mut">Notez ce numéro : avec votre e-mail, il vous permet de suivre votre candidature.</p><button class="btn" data-a="close">Compris</button>`), 300);
};
const isoLocal = v => v ? toLocalInput(v) : '';
ORG_R.inscriptions = async () => {
  let FF; try { FF = await rpc2('org_forms'); } catch (e) { const X = await extras(); FF = X.forms; }
  const [EV, CP] = await Promise.all([q(sb.from('events').select('id,name').eq('organizer_id', ME.id).eq('cancelled', false).order('created_at', { ascending: false })).catch(() => []), q(sb.from('vote_campaigns').select('id,name').eq('organizer_id', ME.id).order('created_at', { ascending: false })).catch(() => [])]);
  window.__apps = FF; const ed = UI.formEdit === 'new' ? {} : FF.find(f => f.id === UI.formEdit), filt = UI.appFilter || '';
  const link = f => f.event_name ? 'Événement : ' + esc(f.event_name) : f.campaign_name ? 'Concours : ' + esc(f.campaign_name) : 'Candidature indépendante';
  const list = FF.map((f, fi) => { const A0 = (f.applications || []).filter(a => !filt || a.status === filt || (filt === 'impaye' && !a.paid)); return `<div class="card pad stack"><div class="row between" style="align-items:flex-start"><div><h2 style="margin:0">${esc(f.title)}</h2><p class="sm mut" style="margin:4px 0 0">${link(f)} · du ${dFmt(f.starts_at || f.created_at)} au ${dFmt(f.ends_at)} à ${hFmt(f.ends_at)}</p></div><div class="row" style="gap:6px">${badge(f.published === false ? ['Hors ligne', 'gray'] : ['En ligne', 'green'])}${badge(formBadge(f))}${badge(+f.price ? [money(f.price, f.currency), 'orange'] : ['Gratuite', 'blue'])}</div></div>
  <div class="kpis kpis-s"><div class="kpi"><small>Candidatures</small><b>${num(f.count ?? (f.applications || []).length)}${f.max_applicants ? ' / ' + num(f.max_applicants) : ''}</b></div>${+f.price ? `<div class="kpi"><small>Payées</small><b>${num(f.paid_count || 0)}</b></div><div class="kpi hot"><small>Frais encaissés</small><b>${money(f.revenue || 0, f.currency)}</b></div>` : ''}<div class="kpi"><small>Champs actifs</small><b>${Object.values(formCfg(f)).filter(v => v !== 'off').length}</b></div></div>
  <div class="row" style="gap:6px"><button class="btn s ghost" data-a="formEdit" data-id="${f.id}">Modifier</button><button class="btn s ghost" data-a="online13" data-kind="form" data-id="${f.id}" data-on="${f.published === false ? 1 : 0}">${f.published === false ? 'Mettre en ligne' : 'Mettre hors ligne'}</button><button class="btn s ghost" data-a="closeForm" data-id="${f.id}" data-on="${f.closed ? 0 : 1}">${f.closed ? 'Rouvrir' : 'Clôturer'}</button><a class="btn s ghost" href="#/inscription/${f.id}">Voir la page</a>${(f.applications || []).length ? `<button class="btn s ghost" data-a="csvApps" data-i="${fi}">Exporter (Excel/CSV)</button>` : `<button class="btn s danger" data-a="del13" data-kind="form" data-id="${f.id}" data-name="${esc(f.title)}">Supprimer</button>`}</div>
  ${A0.map(a => { const ai = f.applications.indexOf(a); return `<div style="padding:10px 0;border-top:1px solid var(--line)"><div class="row between"><span><b>${esc(a.name)}</b> <span class="xs mut">${esc(a.number)} · ${dFmt(a.created_at)}</span></span><span class="row" style="gap:6px">${+f.price ? badge(a.paid === false ? ['Non payée', 'red'] : ['Payée', 'green']) : ''}${badge(aStatus(a.status))}</span></div><div class="xs mut">${esc(a.email)} · ${esc(a.phone)}${a.data && a.data.files && Object.keys(a.data.files).length ? ' · ' + Object.keys(a.data.files).length + ' document(s)' : ''}</div><div class="row" style="margin-top:6px"><button class="btn s ghost" data-a="viewApp" data-f="${fi}" data-i="${ai}">Voir le dossier</button>${[['acceptee', 'Accepter'], ['en_attente', 'En attente'], ['refusee', 'Refuser']].map(([s, l]) => `<button class="chip ${a.status === s ? 'on' : ''}" data-a="appStatus" data-id="${a.id}" data-v="${s}">${l}</button>`).join('')}</div></div>`; }).join('')}</div>`; }).join('');
  const editor = ed ? `<form class="card pad stack" data-f="formSave" data-id="${ed.id || ''}" style="max-width:960px"><div class="row between"><h2 style="margin:0">${ed.id ? 'Modifier « ' + esc(ed.title) + ' »' : 'Nouvelle candidature'}</h2><label class="switch"><input type="checkbox" name="published" ${ed.published === false ? '' : 'checked'}><span></span> En ligne</label></div>
  <div class="g2"><label class="f">Titre de la candidature ou de la campagne<input name="title" required minlength="3" value="${esc(ed.title || '')}" placeholder="Ex. Casting Miss Guinée 2027"></label><label class="f">Liée à<select name="link"><option value="">Candidature indépendante</option>${EV.length ? `<optgroup label="Un de mes événements">${EV.map(e => `<option value="e:${e.id}" ${ed.event_id === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</optgroup>` : ''}${CP.length ? `<optgroup label="Un de mes concours">${CP.map(c => `<option value="c:${c.id}" ${ed.campaign_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>` : ''}</select></label>
  <label class="f">Candidature<select name="paid" onchange="this.closest('form').querySelector('[name=price]').closest('label').hidden=this.value!=='1'"><option value="0">Gratuite</option><option value="1" ${+ed.price ? 'selected' : ''}>Payante</option></select></label><label class="f" ${+ed.price ? '' : 'hidden'}>Frais de candidature (GNF)<input name="price" type="number" min="0" step="500" value="${+ed.price || ''}"></label>
  <label class="f">Nombre de candidats maximum <span class="xs mut">(vide = illimité)</span><input name="max" type="number" min="1" value="${ed.max_applicants || ''}"></label><span></span>
  <label class="f">Début des inscriptions<input name="starts" type="datetime-local" required value="${ed.id ? isoLocal(ed.starts_at) : isoLocal(Date.now())}"></label><label class="f">Fin des inscriptions<input name="ends" type="datetime-local" required value="${ed.id ? isoLocal(ed.ends_at) : isoLocal(Date.now() + 30 * DAY)}"></label></div><label class="f">Description<textarea name="description" rows="3">${esc(ed.description || '')}</textarea></label>
  <div class="row between"><h3 style="margin:0">Champs du formulaire de candidature</h3><div class="row"><button type="button" class="btn s ghost" data-a="fmAll" data-v="opt">Tout en facultatif</button><button type="button" class="btn s ghost" data-a="fmAll" data-v="req">Tout obligatoire</button><button type="button" class="btn s ghost" data-a="fmAll" data-v="off">Tout désactiver</button></div></div>${fieldMatrix(ed.id ? formCfg(ed) : ALL_OPT)}
  <div class="row"><button class="btn xl">Enregistrer</button><button type="button" class="btn ghost" data-a="formEdit" data-id="">Annuler</button></div></form>` : '';
  return `<div class="wrap sec stack" style="padding-top:22px"><div class="row between"><h2 style="margin:0">Mes candidatures</h2><button class="btn" data-a="formEdit" data-id="new">+ Nouvelle candidature</button></div>${editor}
  ${FF.length ? `<div class="chips">${[['', 'Toutes'], ['en_attente', 'En attente'], ['acceptee', 'Acceptées'], ['refusee', 'Refusées'], ['impaye', 'Non payées']].map(([k, l]) => `<button class="chip ${filt === k ? 'on' : ''}" data-a="appFilter" data-v="${k}">${l}</button>`).join('')}</div>${list}` : (ed ? '' : '<div class="empty"><b>Aucune candidature pour le moment.</b><br>Créez votre première campagne : concours, casting, recrutement, formation…</div>')}</div>`;
};
A.viewApp = el => {
  const a = window.__apps[el.dataset.f].applications[el.dataset.i], d = a.data || {}, files = d.files || {};
  const rows = Object.entries(d).filter(([k, v]) => k !== 'files' && v && typeof v !== 'object').map(([k, v]) => `<div><div class="xs mut" style="font-weight:700;text-transform:uppercase">${esc(FIELD_L[k] || k)}</div><div style="white-space:pre-wrap">${esc(v)}</div></div>`).join('');
  modal(`<h2>${esc(a.name)}</h2><p class="sm mut">${esc(a.number)} · ${esc(a.email)} · ${esc(a.phone)}</p><div class="stack" style="max-height:55vh;overflow:auto">${rows}${Object.keys(files).length ? `<div><div class="xs mut" style="font-weight:700;text-transform:uppercase">Documents</div><div class="row">${Object.entries(files).map(([k, p]) => `<button class="btn s ghost" data-a="openDoc" data-p="${esc(p)}">${esc(FIELD_L[k] || k)}</button>`).join('')}</div><p class="xs mut">Lien d'ouverture valable 10 minutes.</p></div>` : ''}</div><div class="row" style="margin-top:16px"><button class="btn ghost" data-a="close">Fermer</button></div>`);
};

/* =====================================================================
   3. LOCALISATION EN TEMPS RÉEL
   Position du téléphone ou de l'ordinateur, puis adresse retrouvée grâce à OpenStreetMap (Nominatim).
   ===================================================================== */
const GEO_FORMS = { newEvent: 'event', editEvent: 'event', venue: 'venue', station: 'station', pos: 'pos' };
function geoButtons() {
  document.querySelectorAll('form[data-f]').forEach(form => {
    if (!GEO_FORMS[form.dataset.f] || form.querySelector('.geo-btn')) return;
    const h2 = form.querySelector(':scope > h2');
    (h2 || form).insertAdjacentHTML(h2 ? 'afterend' : 'afterbegin', `<div class="geo-bar"><button type="button" class="btn s ghost geo-btn" data-a="geo">${ic('pin')} Utiliser ma position actuelle</button><span class="xs mut geo-msg">Remplit automatiquement l'adresse et la ville, et enregistre la position exacte pour la carte.</span><input type="hidden" name="lat"><input type="hidden" name="lng"></div>`);
  });
}
async function reverseGeo(lat, lng) {
  try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=fr`, { headers: { Accept: 'application/json' } }); return r.ok ? await r.json() : null; } catch (e) { return null; }
}
const mapLink = (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
A.geo = async el => {
  const form = el.closest('form'), msg = form.querySelector('.geo-msg');
  if (!navigator.geolocation) return toast('La localisation n\'est pas disponible sur cet appareil.');
  el.disabled = true; msg.textContent = 'Recherche de votre position…';
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    form.elements.lat.value = lat.toFixed(6); form.elements.lng.value = lng.toFixed(6);
    const g = await reverseGeo(lat, lng), a = (g && g.address) || {};
    const street = [a.house_number, a.road].filter(Boolean).join(' '), quarter = a.suburb || a.neighbourhood || a.quarter || '', city = a.city || a.town || a.village || a.municipality || a.county || '';
    const setv = (n, v) => { const i = form.elements[n]; if (i && v && !(i.value && n === 'name')) i.value = v; };
    setv('address', [street, quarter].filter(Boolean).join(', ') || (g && g.display_name) || '');
    if (form.elements.venue && !form.elements.venue.value) setv('venue', [g && g.name, street, quarter].filter(Boolean).join(', '));
    setv('neighborhoods', quarter); setv('city', city);
    if (form.elements.country && a.country) { const o = [...form.elements.country.options].find(x => x.value === a.country || x.text === a.country); if (o) form.elements.country.value = o.value; }
    msg.innerHTML = `Position enregistrée (précision ${Math.round(accuracy)} m)${city ? ' · ' + esc(city) : ''} — <a href="${mapLink(lat.toFixed(6), lng.toFixed(6))}" target="_blank" rel="noopener noreferrer">vérifier sur la carte</a>`;
    el.disabled = false;
  }, err => { el.disabled = false; msg.textContent = err.code === 1 ? 'Autorisez la localisation dans votre navigateur pour utiliser cette fonction.' : 'Position introuvable. Réessayez à l\'extérieur ou saisissez l\'adresse.'; }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
};
async function saveGeo(kind, id, form) { const lat = form.elements.lat && form.elements.lat.value, lng = form.elements.lng && form.elements.lng.value; if (id && lat && lng) { try { await rpc2('set_geo', { p_kind: kind, p_id: id, p_lat: +lat, p_lng: +lng }); } catch (e) { toast('Position non enregistrée : ' + e.message); } } }
for (const k of ['newEvent', 'editEvent', 'venue']) {
  const orig = F[k];
  F[k] = async (f, form) => { const lat = form.elements.lat && form.elements.lat.value; await orig(f, form); if (!lat) return;
    const id = k === 'newEvent' ? (location.hash.match(/([0-9a-f-]{36})/) || [])[1] : k === 'editEvent' ? form.dataset.id : UI.venueEdit;
    await saveGeo(GEO_FORMS[k], id, form); };
}
F.station = async (f, form) => { const id = await rpc2('save_station', { p: { id: form.dataset.id || null, kind: f.get('kind'), city: f.get('city'), name: f.get('name'), address: f.get('address'), active: form.dataset.id ? !!f.get('active') : true } }); await saveGeo('station', id, form); UI.staEdit = null; TR_CITIES = null; toast('Gare enregistrée.'); await render(); };
F.pos = async (f, form) => { const id = await rpc2('save_pos', { p: { id: form.dataset.id || null, name: f.get('name'), address: f.get('address'), city: f.get('city'), phone: f.get('phone'), active: form.dataset.id ? !!f.get('active') : true } }); await saveGeo('pos', id, form); UI.posEdit = null; toast('Point de vente enregistré.'); await render(); };
// Lien « voir sur la carte » sur la page d'un événement et d'un lieu.
const _ev9 = VIEWS.e;
VIEWS.e = async p => { const h = await _ev9(p), ev = DATA && DATA.events.find(e => e.id === p[1]); return ev && ev.lat ? h.replace('<div class="facts">', `<div class="facts"><div class="fact"><small>Localisation</small><b><a href="${mapLink(ev.lat, ev.lng)}" target="_blank" rel="noopener noreferrer">Voir sur la carte ↗</a></b></div>`) : h; };
const _lieu9 = VIEWS.lieu;
VIEWS.lieu = async p => { const h = await _lieu9(p); let v = null; try { v = await q(sb.from('venues').select('lat,lng').eq('id', p[1]).maybeSingle()); } catch (e) { return h; } return v && v.lat ? h.replace('<div class="facts">', `<div class="facts"><div class="fact"><small>Localisation</small><b><a href="${mapLink(v.lat, v.lng)}" target="_blank" rel="noopener noreferrer">Voir sur la carte ↗</a></b></div>`) : h; };

/* =====================================================================
   4. CAGNOTTES MODIFIABLES : AFFICHE, PHOTOS, OBJECTIF, DATES
   ===================================================================== */
const _pots9 = ORG_R.cagnottes;
ORG_R.cagnottes = async () => {
  const h = await _pots9(); let P = []; try { P = await q(sb.from('pots').select('*').eq('organizer_id', ME.id).order('created_at', { ascending: false })); } catch (e) { return h; }
  const ed = P.find(x => x.id === UI.potEdit);
  return h + `<div class="wrap" style="padding-bottom:34px"><div class="card pad stack"><h2 style="margin:0">Modifier une cagnotte</h2><div class="chips">${P.map(x => `<button class="chip ${ed && ed.id === x.id ? 'on' : ''}" data-a="potEdit" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>
  ${ed ? `<form class="stack" data-f="potSave" data-id="${ed.id}"><div class="g2"><label class="f">Nom<input name="name" required value="${esc(ed.name)}"></label><label class="f">Objectif (${esc(ed.currency)})<input name="goal" type="number" min="1000" step="1000" value="${ed.goal}"></label><label class="f">Contribution minimum<input name="min" type="number" min="0" step="500" value="${ed.min_amount}"></label><label class="f">Fin de la collecte<input name="end" type="datetime-local" value="${isoLocal(ed.ends_at)}"></label></div><label class="f">Description<textarea name="description" rows="4">${esc(ed.description || '')}</textarea></label><label class="row sm"><input type="checkbox" name="public" ${ed.is_public ? 'checked' : ''}> Visible dans la liste publique des cagnottes</label>
  <label class="f">Affiche${ed.image_url ? ' (choisir un fichier pour la remplacer)' : ''}<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label>${safeUrl(ed.image_url) ? `<img src="${esc(ed.image_url)}" alt="" style="max-height:160px;border-radius:12px;object-fit:cover;align-self:flex-start">` : ''}
  <div class="sm" style="font-weight:650">Photos (12 maximum)</div>${(ed.gallery || []).length ? `<div class="gal-edit">${ed.gallery.map((u, i) => `<label><img src="${esc(u)}" alt=""><span class="xs"><input type="checkbox" name="keep" value="${esc(u)}" checked> garder</span></label>`).join('')}</div>` : ''}<label class="f">Ajouter des photos<input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp"></label>
  <div class="row"><button class="btn">Enregistrer</button><a class="btn ghost" href="#/cagnotte/${ed.id}">Voir la page publique</a></div></form>` : '<p class="sm mut">Choisissez une cagnotte à modifier.</p>'}</div></div>`;
};
const _potPage9 = VIEWS.cagnotte;
VIEWS.cagnotte = async p => {
  const h = await _potPage9(p); let x = null; try { x = await q(sb.from('pots').select('gallery,description').eq('id', p[1]).maybeSingle()); } catch (e) { return h; }
  if (!x || !(x.gallery || []).length) return h;
  return h.replace(/<\/div><\/div>$/, '') + `<div class="card pad" style="max-width:820px;margin-top:16px"><h3>Photos</h3><div class="gal">${x.gallery.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join('')}</div></div></div></div>`;
};

/* =====================================================================
   5. ADMINISTRATION : SUPPRESSION DE COMPTE, RETOUR DIRECT AU COMPTE ADMIN
   ===================================================================== */
const _comptes9 = ADMIN_R.comptes;
ADMIN_R.comptes = async (D, me) => {
  let h = await _comptes9(D, me); if (me.role !== 'admin') return h;
  const users = D.user_list || [];
  h = h.replace(/(<button class="btn s (?:danger|ok)" data-a="setStatus" data-id="([0-9a-f-]{36})"[^>]*>[^<]*<\/button>)/g, (m, all, id) => {
    const u = users.find(x => x.id === id); return u && !['admin', 'admin_secondaire'].includes(u.role) && u.status !== 'supprime' ? all + ` <button class="btn s danger" data-a="deleteUser" data-id="${id}" data-name="${esc(u.full_name || u.email || '')}">Supprimer</button>` : all;
  });
  return h.replace(/<span class="badge b-red">Suspendu<\/span>/g, m => m);
};
A.deleteUser = el => {
  askReason('Supprimer le compte de ' + el.dataset.name, async m => {
    try {
      const r = await fn('admin-delete-user', { user_id: el.dataset.id, reason: m });
      toast(r.mode === 'supprime' ? 'Compte supprimé définitivement.' : 'Compte fermé et anonymisé : son historique (achats, ventes, paiements) est conservé comme l\'exige le cahier des charges.');
      await render();
    } catch (e) { toast(e.message); }
  });
  const d = $('#dlg .dlg h2'); if (d) d.insertAdjacentHTML('afterend', '<div class="note" style="margin-bottom:10px"><b>Action définitive.</b> Le compte ne pourra plus se connecter. S\'il a un historique (billets, ventes, paiements), ses données personnelles sont effacées mais l\'historique est conservé. Préférez « Suspendre » pour une mesure temporaire.</div>');
};
A.impersonate = el => {
  askReason('Se connecter en tant que ' + el.dataset.name, async m => {
    try {
      const { data: { session } } = await sb.auth.getSession(); if (!session) throw new Error('Session administrateur introuvable');
      const r = await fn('admin-impersonate', { user_id: el.dataset.id, reason: m });
      sessionStorage.setItem(IMP_KEY, JSON.stringify({ admin: ME.email, name: r.name, at: session.access_token, rt: session.refresh_token }));
      const { error } = await sb.auth.verifyOtp({ type: 'magiclink', token_hash: r.token_hash }); if (error) throw new Error(error.message);
      await loadMe(); DATA = null; XC = null; location.hash = landing() === '#/' ? '#/compte' : landing(); await render(); toast('Connecté en tant que ' + r.name + '. Vous avez accès à tout son compte.');
    } catch (e) { sessionStorage.removeItem(IMP_KEY); toast(e.message); }
  });
};
A.impBack = async () => {
  const imp = impGet();
  try {
    await sb.auth.signOut({ scope: 'local' });
    if (!imp || !imp.rt) throw new Error('session');
    const { error } = await sb.auth.setSession({ access_token: imp.at, refresh_token: imp.rt }); if (error) throw error;
    sessionStorage.removeItem(IMP_KEY); await loadMe(); DATA = null; XC = null; location.hash = '#/admin/comptes'; await render(); toast('Vous êtes revenu sur votre compte administrateur.');
  } catch (e) {
    sessionStorage.removeItem(IMP_KEY); ME = null; DATA = null; UI.authTab = 'in'; location.hash = '#/connexion'; await render();
    const i = $('[data-f="signin"] [name="email"]'); if (i && imp) i.value = imp.admin; toast('Votre session administrateur a expiré : reconnectez-vous.');
  }
};

/* ---------- actions ---------- */
Object.assign(A, {
  formEdit(el) { UI.formEdit = el.dataset.id; render().then(() => { const f = $('[data-f="formSave"]'); if (f && el.dataset.id) f.scrollIntoView({ behavior: 'smooth' }); }); },
  fmAll(el) { el.closest('form').querySelectorAll(`.fm-opts input[value="${el.dataset.v}"]`).forEach(i => { i.checked = true; i.dispatchEvent(new Event('change')); }); },
  async openDoc(el) { const { data, error } = await sb.storage.from('candidatures').createSignedUrl(el.dataset.p, 600); if (error) return toast('Document inaccessible : ' + error.message); window.open(data.signedUrl, '_blank', 'noopener'); },
  potEdit(el) { UI.potEdit = el.dataset.id; render(); },
  // Création d'événement : ajouter / supprimer des dates et des catégories de billets.
  rowAdd(el) {
    const list = el.closest('form').querySelector(`[data-list="${el.dataset.k}"]`); if (!list) return;
    if (list.children.length >= 60) return toast('Nombre maximum atteint.');
    list.insertAdjacentHTML('beforeend', el.dataset.k === 'date' ? dateRow() : tierRow());
    const inp = list.lastElementChild.querySelector('input'); if (inp) inp.focus();
  },
  rowDel(el) { const row = el.closest('.dyn-row'); if (row) row.remove(); },
});
Object.assign(F, {
  async formSave(f, form) {
    const p = { title: f.get('title'), description: f.get('description').trim(), starts_at: fromLocalInput(f.get('starts')), ends_at: fromLocalInput(f.get('ends')), fields: readMatrix(f) };
    if (new Date(p.ends_at) <= new Date(p.starts_at)) throw new Error('La fin des inscriptions doit être après leur début.');
    const paid = f.get('paid') === '1', price = paid ? +f.get('price') : 0, link = f.get('link') || '';
    if (paid && !(price > 0)) throw new Error('Indiquez le montant des frais de candidature.');
    let id = form.dataset.id;
    if (id) await rpc2('update_form', { p_id: id, p }); else id = await rpc2('create_form', { p });
    try { await rpc2('save_form_meta', { p_id: id, p: { price, max_applicants: f.get('max') || '', event_id: link.startsWith('e:') ? link.slice(2) : '', campaign_id: link.startsWith('c:') ? link.slice(2) : '', published: !!f.get('published') } }); }
    catch (e) { toast('Formulaire enregistré, mais : ' + e.message); }
    UI.formEdit = null; XC = null; toast(form.dataset.id ? 'Candidature mise à jour.' : 'Candidature créée.'); await render();
  },
  async potSave(f, form) {
    const img = await uploadImage(f.get('image')), added = [];
    for (const file of f.getAll('photos')) { if (file && file.size) { const u = await uploadImage(file); if (u) added.push(u); } }
    const gallery = [...f.getAll('keep'), ...added].slice(0, 12);
    await rpc2('update_pot', { p_id: form.dataset.id, p: { name: f.get('name'), description: f.get('description'), goal: f.get('goal'), min_amount: f.get('min'), ends_at: fromLocalInput(f.get('end')), is_public: !!f.get('public'), image_url: img, gallery } });
    XC = null; toast('Cagnotte mise à jour.'); await render();
  },
});

/* ---------- après chaque affichage : boutons de localisation ---------- */
const _render9 = render;
render = async function () { await _render9(); geoButtons(); };

Object.assign(EN, { 'Numéro de téléphone ou e-mail': 'Phone number or email', 'Utiliser ma position actuelle': 'Use my current location', 'Champs du formulaire': 'Form fields', 'Non': 'No', 'Facultatif': 'Optional', 'Obligatoire': 'Required', 'Voir sur la carte ↗': 'See on map ↗', 'Supprimer': 'Delete' });

// boot() est appelé à la fin de modules10.js, chargé après ce fichier.
