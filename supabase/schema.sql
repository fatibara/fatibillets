-- FatiBillets — base de données v1 (billetterie, comptes, rôles, scan, administration)
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Le script peut être relancé sans danger.

-- ============ TABLES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text, full_name text, phone text,
  role text not null default 'participant' check (role in ('participant','organisateur','scanner','admin')),
  org_name text, org_requested boolean not null default false,
  status text not null default 'actif' check (status in ('actif','suspendu')),
  created_at timestamptz not null default now());

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, active boolean not null default true, position int not null default 0);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles,
  org_name text, name text not null, slogan text, description text, category text,
  country text default 'Guinée', city text, venue text, audience text, access text, payment_info text,
  keywords text[] not null default '{}', artists jsonb not null default '[]',
  color1 text not null default '#FF8A1F', color2 text not null default '#B91C1C',
  currency text not null default 'GNF', cancelled boolean not null default false,
  created_at timestamptz not null default now());

create table if not exists public.event_dates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null);

create table if not exists public.tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  date_id uuid not null references public.event_dates on delete cascade,
  name text not null, price bigint not null check (price >= 0), quota int not null check (quota > 0),
  position int not null default 0);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events,
  date_id uuid not null references public.event_dates,
  buyer_id uuid references public.profiles,
  buyer_name text not null, buyer_phone text not null, buyer_email text not null,
  total bigint not null default 0, currency text not null,
  status text not null default 'en_attente' check (status in ('en_attente','a_verifier','confirme','annule')),
  expires_at timestamptz, payment_method text, payment_ref text,
  created_at timestamptz not null default now(), confirmed_at timestamptz, confirmed_by uuid);

-- Paiement en ligne LengoPay : identifiant de paiement + statut « à rembourser » (paiement reçu sans place disponible).
alter table public.orders add column if not exists pay_id text;
create unique index if not exists orders_pay_id_idx on public.orders (pay_id) where pay_id is not null;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('en_attente','a_verifier','confirme','annule','a_rembourser'));

create table if not exists public.order_items (
  order_id uuid not null references public.orders on delete cascade,
  tier_id uuid not null references public.tiers,
  qty int not null check (qty > 0), unit_price bigint not null,
  primary key (order_id, tier_id));

-- Un billet émis n'est jamais supprimé : il change seulement de statut.
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  order_id uuid not null references public.orders,
  event_id uuid not null references public.events,
  date_id uuid not null, tier_id uuid not null references public.tiers,
  holder_name text,
  status text not null default 'valide' check (status in ('valide','utilise','rembourse')),
  scanned_at timestamptz, scanned_by uuid,
  created_at timestamptz not null default now());
create index if not exists tickets_tier_idx on public.tickets (tier_id);
create index if not exists tickets_event_idx on public.tickets (event_id);
create index if not exists orders_event_idx on public.orders (event_id, status);

create table if not exists public.scanner_assignments (
  scanner_id uuid not null references public.profiles on delete cascade,
  event_id uuid not null references public.events on delete cascade,
  primary key (scanner_id, event_id));

create table if not exists public.scans (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(), code text, ok boolean, result text, scanner_id uuid, event_id uuid);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(), actor uuid, actor_email text, action text not null, reason text);

-- ============ FONCTIONS DE BASE ============
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, phone)
  values (new.id, lower(new.email), new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and status = 'actif' $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false) $$;

create or replace function public.org_active(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p and status = 'actif') $$;

create or replace function public.log_action(p_action text, p_reason text default null) returns void
language sql security definer set search_path = public as $$
  insert into audit_log (actor, actor_email, action, reason)
  values (auth.uid(), (select email from profiles where id = auth.uid()), p_action, p_reason) $$;

-- Places restantes = quota - billets émis non remboursés - réservations encore actives.
create or replace function public.tier_available(t uuid) returns int
language sql stable security definer set search_path = public as $$
  select (select quota from tiers where id = t)
    - (select count(*) from tickets where tier_id = t and status <> 'rembourse')::int
    - coalesce((select sum(oi.qty) from order_items oi join orders o on o.id = oi.order_id
        where oi.tier_id = t and (o.status = 'a_verifier' or (o.status = 'en_attente' and o.expires_at > now()))), 0)::int $$;

create or replace function public.availability() returns table (tier_id uuid, available int)
language sql stable security definer set search_path = public as $$
  select id, greatest(0, public.tier_available(id)) from tiers $$;

-- ============ SÉCURITÉ (RLS) ============
-- Les tables sensibles n'ont aucune règle d'accès direct : on n'y touche que par les fonctions ci-dessous.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.events enable row level security;
alter table public.event_dates enable row level security;
alter table public.tiers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tickets enable row level security;
alter table public.scanner_assignments enable row level security;
alter table public.scans enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);
drop policy if exists categories_admin on public.categories;
create policy categories_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (public.org_active(organizer_id) or public.is_admin());
drop policy if exists dates_read on public.event_dates;
create policy dates_read on public.event_dates for select using (true);
drop policy if exists tiers_read on public.tiers;
create policy tiers_read on public.tiers for select using (true);

-- ============ COMPTES ============
create or replace function public.request_organizer(p_org_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if length(trim(coalesce(p_org_name, ''))) < 2 then raise exception 'Nom de l''organisation requis'; end if;
  update profiles set org_requested = true, org_name = trim(p_org_name) where id = auth.uid();
end $$;

create or replace function public.admin_set_user(p_id uuid, p_role text, p_status text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  if not is_admin() then raise exception 'Réservé à la Direction'; end if;
  if p_id = auth.uid() then raise exception 'Vous ne pouvez pas modifier votre propre compte'; end if;
  if length(trim(coalesce(p_reason, ''))) < 4 then raise exception 'Motif obligatoire'; end if;
  select * into p from profiles where id = p_id;
  if not found then raise exception 'Compte introuvable'; end if;
  update profiles set role = p_role, status = p_status,
    org_requested = case when p_role = 'organisateur' then false else org_requested end where id = p_id;
  perform log_action('Compte ' || coalesce(p.email, '') || ' : rôle ' || p.role || ' → ' || p_role || ', statut ' || p.status || ' → ' || p_status, p_reason);
end $$;

-- ============ ÉVÉNEMENTS ============
create or replace function public.create_event(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare pr profiles; v_id uuid; v_date uuid; t jsonb; i int := 0;
begin
  select * into pr from profiles where id = auth.uid() and status = 'actif';
  if not found or pr.role <> 'organisateur' then raise exception 'Réservé aux organisateurs'; end if;
  if length(trim(coalesce(p->>'name', ''))) < 3 then raise exception 'Nom de l''événement requis'; end if;
  if (p->>'starts_at')::timestamptz <= now() then raise exception 'La date doit être dans le futur'; end if;
  if (p->>'ends_at')::timestamptz <= (p->>'starts_at')::timestamptz then raise exception 'Heure de fin invalide'; end if;
  if jsonb_array_length(coalesce(p->'tiers', '[]'::jsonb)) = 0 then raise exception 'Ajoutez au moins une catégorie de billets'; end if;
  insert into events (organizer_id, org_name, name, slogan, description, category, country, city, venue, audience, access, payment_info, keywords, artists, color1, color2)
  values (pr.id, coalesce(pr.org_name, pr.full_name), trim(p->>'name'), p->>'slogan', p->>'description', p->>'category',
    coalesce(p->>'country', 'Guinée'), p->>'city', p->>'venue', p->>'audience', p->>'access', p->>'payment_info',
    array(select upper(x) from jsonb_array_elements_text(coalesce(p->'keywords', '[]'::jsonb)) x),
    coalesce(p->'artists', '[]'::jsonb), coalesce(p->>'color1', '#FF8A1F'), coalesce(p->>'color2', '#B91C1C'))
  returning id into v_id;
  insert into event_dates (event_id, starts_at, ends_at)
  values (v_id, (p->>'starts_at')::timestamptz, (p->>'ends_at')::timestamptz) returning id into v_date;
  for t in select * from jsonb_array_elements(p->'tiers') loop
    insert into tiers (event_id, date_id, name, price, quota, position)
    values (v_id, v_date, trim(t->>'name'), (t->>'price')::bigint, (t->>'quota')::int, i);
    i := i + 1;
  end loop;
  perform log_action('Événement créé : ' || trim(p->>'name'));
  return v_id;
end $$;

create or replace function public.cancel_event(p_event uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare e events;
begin
  select * into e from events where id = p_event;
  if not found then raise exception 'Événement introuvable'; end if;
  if my_role() is null or not (e.organizer_id = auth.uid() or is_admin()) then raise exception 'Non autorisé'; end if;
  if length(trim(coalesce(p_reason, ''))) < 4 then raise exception 'Motif obligatoire'; end if;
  update events set cancelled = true where id = p_event;
  perform log_action('Événement annulé : ' || e.name, p_reason);
end $$;

-- ============ RÉSERVATION ET BILLETS ============
create or replace function public.issue_tickets(p_order uuid, p_by uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o orders; r record; i int;
begin
  select * into o from orders where id = p_order for update;
  if o.status = 'confirme' then return; end if;  -- idempotent : jamais deux émissions pour une commande
  for r in select * from order_items where order_id = p_order loop
    for i in 1..r.qty loop
      insert into tickets (code, order_id, event_id, date_id, tier_id, holder_name)
      values ('FB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)), o.id, o.event_id, o.date_id, r.tier_id, o.buyer_name);
    end loop;
  end loop;
  update orders set status = 'confirme', confirmed_at = now(), confirmed_by = p_by, expires_at = null where id = p_order;
end $$;

-- Bloque les places 30 minutes. L'heure du serveur fait foi. Le verrou sur la catégorie empêche la survente.
create or replace function public.reserve(p_date uuid, p_items jsonb, p_name text, p_phone text, p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare d event_dates; e events; it jsonb; t tiers; q int; n int := 0; v_total bigint := 0; v_order uuid;
begin
  select * into d from event_dates where id = p_date;
  if not found then raise exception 'Date introuvable'; end if;
  select * into e from events where id = d.event_id;
  if e.cancelled then raise exception 'Cet événement est annulé'; end if;
  if not org_active(e.organizer_id) then raise exception 'Événement indisponible'; end if;
  if d.ends_at < now() then raise exception 'Cet événement est terminé'; end if;
  if length(trim(coalesce(p_name, ''))) < 3 or length(trim(coalesce(p_phone, ''))) < 8 or position('@' in coalesce(p_email, '')) < 2 then
    raise exception 'Nom, téléphone et e-mail sont obligatoires'; end if;
  insert into orders (event_id, date_id, buyer_id, buyer_name, buyer_phone, buyer_email, currency, expires_at)
  values (e.id, d.id, auth.uid(), trim(p_name), trim(p_phone), lower(trim(p_email)), e.currency, now() + interval '30 minutes')
  returning id into v_order;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it->>'qty')::int;
    if q is null or q < 1 or q > 10 then raise exception 'Quantité invalide (1 à 10 par catégorie)'; end if;
    select * into t from tiers where id = (it->>'tier_id')::uuid and date_id = d.id for update;
    if not found then raise exception 'Catégorie introuvable'; end if;
    if tier_available(t.id) < q then raise exception 'SOLD OUT : plus assez de places en %', t.name; end if;
    insert into order_items (order_id, tier_id, qty, unit_price) values (v_order, t.id, q, t.price);
    v_total := v_total + q * t.price; n := n + q;
  end loop;
  if n = 0 then raise exception 'Aucun billet sélectionné'; end if;
  update orders set total = v_total where id = v_order;
  if v_total = 0 then
    update orders set payment_method = 'Gratuit' where id = v_order;
    perform issue_tickets(v_order, null);
  end if;
  return v_order;
end $$;

create or replace function public.submit_payment(p_order uuid, p_method text, p_ref text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_ref, ''))) < 4 then raise exception 'Référence de paiement requise'; end if;
  update orders set status = 'a_verifier', payment_method = p_method, payment_ref = trim(p_ref), expires_at = null
  where id = p_order and status = 'en_attente' and expires_at > now();
  if not found then raise exception 'Réservation expirée ou déjà traitée'; end if;
end $$;

create or replace function public.cancel_order(p_order uuid) returns void
language sql security definer set search_path = public as $$
  update orders set status = 'annule' where id = p_order and status = 'en_attente' $$;

create or replace function public.confirm_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o orders; e events;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Commande introuvable'; end if;
  select * into e from events where id = o.event_id;
  if my_role() is null or not (e.organizer_id = auth.uid() or is_admin()) then raise exception 'Non autorisé'; end if;
  if o.status <> 'a_verifier' then raise exception 'Cette commande n''est pas en attente de vérification'; end if;
  perform issue_tickets(p_order, auth.uid());
  perform log_action('Paiement confirmé : ' || o.total || ' ' || o.currency || ' — ' || o.buyer_name || ' (' || e.name || ')', 'Réf. ' || coalesce(o.payment_ref, '—'));
end $$;

create or replace function public.reject_order(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare o orders; e events;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Commande introuvable'; end if;
  select * into e from events where id = o.event_id;
  if my_role() is null or not (e.organizer_id = auth.uid() or is_admin()) then raise exception 'Non autorisé'; end if;
  if o.status <> 'a_verifier' then raise exception 'Cette commande n''est pas en attente de vérification'; end if;
  if length(trim(coalesce(p_reason, ''))) < 4 then raise exception 'Motif obligatoire'; end if;
  update orders set status = 'annule' where id = p_order;
  perform log_action('Paiement rejeté : ' || o.buyer_name || ' (' || e.name || ')', p_reason);
end $$;

-- Appelée uniquement par les fonctions serveur LengoPay, après vérification du paiement auprès de LengoPay.
-- Idempotente : plusieurs notifications pour le même paiement n'émettent les billets qu'une fois.
create or replace function public.lengopay_paid(p_order uuid, p_amount bigint default null) returns text
language plpgsql security definer set search_path = public as $$
declare o orders; r record; ok boolean := true;
begin
  select * into o from orders where id = p_order for update;
  if not found then return 'introuvable'; end if;
  if o.status in ('confirme', 'a_rembourser') then return o.status; end if;
  if p_amount is not null and p_amount <> o.total then
    update orders set status = 'a_rembourser' where id = p_order;
    perform log_action('Paiement LengoPay de montant inattendu (' || p_amount || ' au lieu de ' || o.total || ' ' || o.currency || ') — ' || o.buyer_name, 'Commande ' || o.id);
    return 'a_rembourser';
  end if;
  if not (o.status = 'a_verifier' or (o.status = 'en_attente' and o.expires_at > now())) then
    -- Paiement arrivé après l'expiration : on n'émet les billets que si les places sont encore libres.
    for r in select tier_id, qty from order_items where order_id = p_order loop
      perform 1 from tiers where id = r.tier_id for update;
      if tier_available(r.tier_id) < r.qty then ok := false; end if;
    end loop;
    if not ok then
      update orders set status = 'a_rembourser' where id = p_order;
      perform log_action('Paiement LengoPay reçu hors délai, places épuisées : ' || o.total || ' ' || o.currency || ' à rembourser — ' || o.buyer_name || ' (' || o.buyer_phone || ')', 'Réf. ' || coalesce(o.pay_id, ''));
      return 'a_rembourser';
    end if;
  end if;
  perform issue_tickets(p_order, null);
  perform log_action('Paiement LengoPay confirmé : ' || o.total || ' ' || o.currency || ' — ' || o.buyer_name, 'Réf. ' || coalesce(o.pay_id, ''));
  return 'confirme';
end $$;

create or replace function public.order_json(o public.orders) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'total', o.total, 'currency', o.currency, 'expires_at', o.expires_at, 'created_at', o.created_at,
    'status', case when o.status = 'en_attente' and o.expires_at < now() then 'expire' else o.status end,
    'pay_started', o.pay_id is not null,
    'buyer_name', o.buyer_name, 'buyer_email', o.buyer_email, 'payment_method', o.payment_method, 'payment_ref', o.payment_ref,
    'event', (select jsonb_build_object('id', e.id, 'name', e.name, 'venue', e.venue, 'city', e.city, 'payment_info', e.payment_info, 'org_name', e.org_name) from events e where e.id = o.event_id),
    'starts_at', (select starts_at from event_dates where id = o.date_id),
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'qty', oi.qty, 'unit_price', oi.unit_price)) from order_items oi join tiers t on t.id = oi.tier_id where oi.order_id = o.id), '[]'::jsonb),
    'tickets', coalesce((select jsonb_agg(jsonb_build_object('code', k.code, 'tier', t.name, 'price', t.price, 'status', k.status, 'scanned_at', k.scanned_at, 'created_at', k.created_at) order by k.created_at, k.code)
       from tickets k join tiers t on t.id = k.tier_id where k.order_id = o.id), '[]'::jsonb)) $$;

-- Le numéro de commande (UUID) sert de lien secret pour l'achat invité.
create or replace function public.get_order(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.order_json(o) from orders o where o.id = p_id $$;

create or replace function public.my_orders() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.order_json(o) order by o.created_at desc), '[]'::jsonb)
  from orders o where auth.uid() is not null and o.buyer_id = auth.uid() and o.status <> 'annule' $$;

-- ============ SCAN ET REMBOURSEMENT ============
create or replace function public.scan_ticket(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k tickets; v_code text := upper(trim(coalesce(p_code, ''))); v_at timestamptz; res jsonb; info jsonb;
begin
  if coalesce(my_role(), '') not in ('organisateur', 'scanner', 'admin') then raise exception 'Non autorisé'; end if;
  select * into k from tickets where code = v_code;
  if not found then
    res := jsonb_build_object('ok', false, 'title', 'BILLET INCONNU', 'lines', jsonb_build_array('Aucun billet ne correspond à ce code.'));
  elsif not (is_admin() or exists (select 1 from events where id = k.event_id and organizer_id = auth.uid())
        or exists (select 1 from scanner_assignments where scanner_id = auth.uid() and event_id = k.event_id)) then
    res := jsonb_build_object('ok', false, 'title', 'BILLET D''UN AUTRE ÉVÉNEMENT', 'lines', jsonb_build_array('Vous n''êtes pas affecté à cet événement.'));
  else
    select jsonb_build_array(e.name, t.name || ' · ' || coalesce(k.holder_name, '')) into info
    from events e, tiers t where e.id = k.event_id and t.id = k.tier_id;
    if k.status = 'rembourse' then
      res := jsonb_build_object('ok', false, 'title', 'BILLET INVALIDÉ', 'lines', jsonb_build_array('Ce billet a été remboursé.') || info);
    else
      update tickets set status = 'utilise', scanned_at = now(), scanned_by = auth.uid()
      where id = k.id and status = 'valide' returning scanned_at into v_at;
      if found then
        res := jsonb_build_object('ok', true, 'title', 'BILLET VALIDE — ENTRÉE AUTORISÉE', 'at', v_at, 'lines', info);
      else
        select scanned_at into v_at from tickets where id = k.id;
        res := jsonb_build_object('ok', false, 'title', 'TICKET DÉJÀ UTILISÉ', 'at', v_at, 'lines', info);
      end if;
    end if;
  end if;
  insert into scans (code, ok, result, scanner_id, event_id) values (left(v_code, 40), (res->>'ok')::boolean, res->>'title', auth.uid(), k.event_id);
  return res;
end $$;

create or replace function public.refund_ticket(p_code text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare k tickets; e events;
begin
  select * into k from tickets where code = p_code for update;
  if not found then raise exception 'Billet introuvable'; end if;
  select * into e from events where id = k.event_id;
  if my_role() is null or not (e.organizer_id = auth.uid() or is_admin()) then raise exception 'Non autorisé'; end if;
  if k.status <> 'valide' then raise exception 'Seul un billet valide peut être remboursé'; end if;
  if length(trim(coalesce(p_reason, ''))) < 4 then raise exception 'Motif obligatoire'; end if;
  update tickets set status = 'rembourse' where id = k.id;
  perform log_action('Billet remboursé : ' || k.code || ' (' || e.name || ') — place remise en stock', p_reason);
end $$;

create or replace function public.assign_scanner(p_email text, p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e events; p profiles;
begin
  select * into e from events where id = p_event;
  if not found or my_role() is null or e.organizer_id <> auth.uid() then raise exception 'Non autorisé'; end if;
  select * into p from profiles where email = lower(trim(p_email));
  if not found then raise exception 'Cette personne doit d''abord créer un compte FatiBillets avec cet e-mail'; end if;
  if p.role = 'participant' then update profiles set role = 'scanner' where id = p.id; end if;
  insert into scanner_assignments (scanner_id, event_id) values (p.id, p_event) on conflict do nothing;
  perform log_action('Scanner ' || p.email || ' affecté à ' || e.name);
end $$;

-- ============ TABLEAUX DE BORD ============
create or replace function public.org_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(my_role(), '') <> 'organisateur' then raise exception 'Réservé aux organisateurs'; end if;
  return jsonb_build_object(
    'events', coalesce((select jsonb_agg(x order by x->>'starts_at') from (
      select jsonb_build_object('id', e.id, 'name', e.name, 'city', e.city, 'category', e.category, 'cancelled', e.cancelled, 'currency', e.currency,
        'starts_at', (select min(starts_at) from event_dates where event_id = e.id),
        'ends_at', (select max(ends_at) from event_dates where event_id = e.id),
        'sold', (select count(*) from tickets where event_id = e.id and status <> 'rembourse'),
        'revenue', coalesce((select sum(t.price) from tickets k join tiers t on t.id = k.tier_id where k.event_id = e.id and k.status <> 'rembourse'), 0),
        'available', coalesce((select sum(greatest(0, tier_available(id))) from tiers where event_id = e.id), 0)) x
      from events e where e.organizer_id = auth.uid()) s), '[]'::jsonb),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'event', e.name, 'name', o.buyer_name, 'phone', o.buyer_phone, 'total', o.total, 'currency', o.currency,
        'method', o.payment_method, 'ref', o.payment_ref, 'created_at', o.created_at, 'n', (select sum(qty) from order_items where order_id = o.id)) order by o.created_at)
      from orders o join events e on e.id = o.event_id where e.organizer_id = auth.uid() and o.status = 'a_verifier'), '[]'::jsonb),
    'tickets', coalesce((select jsonb_agg(y) from (
      select jsonb_build_object('code', k.code, 'event', e.name, 'tier', t.name, 'holder', k.holder_name, 'status', k.status, 'price', t.price, 'currency', e.currency) y
      from tickets k join events e on e.id = k.event_id join tiers t on t.id = k.tier_id
      where e.organizer_id = auth.uid() order by k.created_at desc limit 200) z), '[]'::jsonb),
    'scanners', coalesce((select jsonb_agg(jsonb_build_object('email', p.email, 'name', p.full_name, 'event', e.name))
      from scanner_assignments a join events e on e.id = a.event_id join profiles p on p.id = a.scanner_id where e.organizer_id = auth.uid()), '[]'::jsonb));
end $$;

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à la Direction'; end if;
  return jsonb_build_object(
    'users', (select count(*) from profiles),
    'organizers', (select count(*) from profiles where role = 'organisateur'),
    'events', (select count(*) from events),
    'tickets', (select count(*) from tickets where status <> 'rembourse'),
    'pending', (select count(*) from orders where status = 'a_verifier'),
    'revenue', coalesce((select jsonb_agg(jsonb_build_object('currency', c, 'amount', a)) from (
      select e.currency c, sum(t.price) a from tickets k join tiers t on t.id = k.tier_id join events e on e.id = k.event_id
      where k.status <> 'rembourse' group by e.currency) r), '[]'::jsonb),
    'user_list', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'email', email, 'full_name', full_name, 'phone', phone, 'role', role, 'status', status,
      'org_name', org_name, 'org_requested', org_requested, 'created_at', created_at) order by created_at desc) from profiles), '[]'::jsonb),
    'event_list', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'org_name', e.org_name, 'city', e.city, 'cancelled', e.cancelled,
      'starts_at', (select min(starts_at) from event_dates where event_id = e.id),
      'sold', (select count(*) from tickets where event_id = e.id and status <> 'rembourse')) order by e.created_at desc) from events e), '[]'::jsonb),
    'refunds', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.buyer_name, 'phone', o.buyer_phone, 'total', o.total, 'currency', o.currency,
      'pay_id', o.pay_id, 'event', e.name, 'created_at', o.created_at) order by o.created_at) from orders o join events e on e.id = o.event_id where o.status = 'a_rembourser'), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('at', at, 'actor', actor_email, 'action', action, 'reason', reason) x from audit_log order by at desc limit 200) s), '[]'::jsonb));
end $$;

-- ============ DROITS ============
revoke execute on function public.issue_tickets(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.log_action(text, text) from public, anon, authenticated;
revoke execute on function public.order_json(public.orders) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.lengopay_paid(uuid, bigint) from public, anon, authenticated;
grant execute on function public.lengopay_paid(uuid, bigint) to service_role;

-- ============ CATÉGORIES DE DÉPART ============
insert into public.categories (name, position) values
  ('Concert', 1), ('Spectacle', 2), ('Festival', 3), ('Conférence', 4), ('Salon professionnel', 5), ('Mode et beauté', 6),
  ('Cinéma', 7), ('Sport', 8), ('Gastronomie', 9), ('Exposition', 10), ('Éducation et formation', 11), ('Culture', 12), ('Tourisme', 13)
on conflict (name) do nothing;

-- ============ PREMIER ADMINISTRATEUR ============
-- Après avoir créé votre compte sur le site, exécutez cette ligne avec VOTRE e-mail :
--   update public.profiles set role = 'admin' where email = 'votre-email@exemple.com';
