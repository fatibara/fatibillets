// FatiBillets — paiement LengoPay (fonction serveur Supabase).
// Appelée par le site : { action: "create" | "check", order_id }.
// Secrets requis (Supabase > Edge Functions > Secrets) :
//   LENGOPAY_LICENSE_KEY, LENGOPAY_WEBSITE_ID, SITE_URL (ex. https://votre-domaine.com)
//   LENGOPAY_BASE_URL (facultatif ; par défaut https://portal.lengopay.com)
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const BASE = (Deno.env.get("LENGOPAY_BASE_URL") ?? "https://portal.lengopay.com").replace(/\/$/, "");
// Les espaces et retours à la ligne glissés lors d'un copier-coller sont retirés.
const KEY = (Deno.env.get("LENGOPAY_LICENSE_KEY") ?? "").replace(/\s+/g, "");
const WEBSITE = (Deno.env.get("LENGOPAY_WEBSITE_ID") ?? "").replace(/\s+/g, "");
// Aucun message renvoyé au navigateur ne doit contenir la clé.
const safe = (s: string) => {
  let out = String(s).replace(/Basic\s+[^"\\]*/gi, "Basic ***");
  if (KEY) out = out.split(KEY).join("***");
  return out;
};
const SITE = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function lengo(path: string, body: unknown) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  let r: Response;
  try {
    r = await fetch(BASE + path, {
      method: "POST",
      headers: { Authorization: `Basic ${KEY}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
  } catch (e) {
    // LengoPay injoignable (réseau, délai dépassé) : on renvoie une réponse lisible au lieu de planter.
    return { ok: false, status: 0, data: {} as Record<string, unknown>, text: "Connexion à LengoPay impossible : " + safe(String((e as Error)?.message ?? e)) };
  } finally {
    clearTimeout(timer);
  }
  const text = await r.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(text); } catch { /* réponse non JSON */ }
  return { ok: r.ok, status: r.status, data, text };
}

// Interroge LengoPay (source de vérité) puis confirme la commande si le paiement est réussi.
async function settle(order: { id: string; pay_id: string }) {
  const r = await lengo("/api/v1/transaction/status", { pay_id: order.pay_id, websiteid: WEBSITE });
  const status = String(r.data.status ?? "").toUpperCase();
  if (!r.ok) console.error("LengoPay status", r.status, r.text);
  if (status !== "SUCCESS") return { payment: status || "INCONNU" };
  const amount = Number(r.data.amount);
  const { data, error } = await db.rpc("lengopay_paid", {
    p_order: order.id,
    p_amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null,
  });
  if (error) { console.error("lengopay_paid", error.message); return { payment: status, error: error.message }; }
  return { payment: status, order: data };
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error("lengopay-pay", e);
    return json({ error: "Erreur interne du paiement.", detail: safe(String((e as Error)?.message ?? e)).slice(0, 300) }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  // Adresse du site : le secret SITE_URL s'il existe, sinon l'adresse d'où vient l'appel (le site lui-même).
  const origin = (req.headers.get("origin") ?? "").replace(/\/$/, "");
  const site = SITE || (/^https?:\/\/[^\s/]+$/.test(origin) ? origin : "");
  const missing = [!KEY && "LENGOPAY_LICENSE_KEY", !WEBSITE && "LENGOPAY_WEBSITE_ID", !site && "SITE_URL"].filter(Boolean);
  if (missing.length) return json({ error: "Paiement en ligne non configuré. Secret(s) manquant(s) : " + missing.join(", ") }, 500);
  let body: { action?: string; order_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Requête invalide" }, 400); }
  if (!body.order_id || !/^[0-9a-f-]{36}$/i.test(body.order_id)) return json({ error: "Commande invalide" }, 400);

  const { data: o } = await db.from("orders").select("*").eq("id", body.order_id).maybeSingle();
  if (!o) return json({ error: "Commande introuvable" }, 404);

  if (body.action === "check") {
    if (!o.pay_id || o.status === "confirme") return json({ order: o.status });
    return json(await settle(o));
  }

  // action "create"
  if (o.status !== "en_attente" || new Date(o.expires_at) < new Date()) return json({ error: "Réservation expirée ou déjà traitée." }, 409);
  if (Number(o.total) <= 0) return json({ error: "Rien à payer pour cette commande." }, 400);
  const r = await lengo("/api/v1/payments", {
    websiteid: WEBSITE,
    amount: Number(o.total),
    currency: o.currency,
    return_url: `${site}/#/commande/${o.id}`,
    callback_url: `${SB_URL}/functions/v1/lengopay-webhook`,
  });
  const payId = (r.data.pay_id ?? r.data.payId) as string | undefined;
  const url = (r.data.payment_url ?? r.data.paymentUrl) as string | undefined;
  if (!r.ok || !payId || !url) {
    console.error("LengoPay create", r.status, r.text);
    // Le détail (code et début de la réponse LengoPay, sans aucune clé) aide au diagnostic.
    return json({ error: "Le service de paiement n'a pas répondu correctement. Réessayez dans un instant.", detail: safe(`LengoPay ${r.status} : ${r.text.replace(/\s+/g, " ").slice(0, 300)}`) }, 502);
  }
  const { error } = await db.from("orders").update({ pay_id: payId, payment_method: "LengoPay", payment_ref: payId }).eq("id", o.id);
  if (error) { console.error("orders update", error.message); return json({ error: "Enregistrement du paiement impossible." }, 500); }
  return json({ payment_url: url });
}
