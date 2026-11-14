// FatiBillets — notification de paiement LengoPay (appelée par LengoPay, pas par le site).
// IMPORTANT : désactiver « Verify JWT » pour cette fonction, car LengoPay n'envoie pas de jeton Supabase.
// Le contenu de la notification n'est jamais cru sur parole : on redemande le statut à LengoPay.
// Secrets requis : LENGOPAY_LICENSE_KEY, LENGOPAY_WEBSITE_ID (LENGOPAY_BASE_URL facultatif).
import { createClient } from "jsr:@supabase/supabase-js@2";

const BASE = (Deno.env.get("LENGOPAY_BASE_URL") ?? "https://portal.lengopay.com").replace(/\/$/, "");
const KEY = (Deno.env.get("LENGOPAY_LICENSE_KEY") ?? "").replace(/\s+/g, "");
const WEBSITE = (Deno.env.get("LENGOPAY_WEBSITE_ID") ?? "").replace(/\s+/g, "");
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("OK");
  let payId = "";
  try {
    const raw = await req.text();
    try { payId = String(JSON.parse(raw).pay_id ?? ""); } catch { payId = new URLSearchParams(raw).get("pay_id") ?? ""; }
  } catch { /* corps illisible */ }
  if (!payId) return new Response("OK");

  try {
    const { data: o } = await db.from("orders").select("id, pay_id, status").eq("pay_id", payId).maybeSingle();
    if (!o || o.status === "confirme") return new Response("OK");
    const r = await fetch(BASE + "/api/v1/transaction/status", {
      method: "POST",
      headers: { Authorization: `Basic ${KEY}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ pay_id: o.pay_id, websiteid: WEBSITE }),
    });
    const data = await r.json().catch(() => ({}));
    if (String(data.status ?? "").toUpperCase() === "SUCCESS") {
      const amount = Number(data.amount);
      const { error } = await db.rpc("lengopay_paid", {
        p_order: o.id,
        p_amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null,
      });
      if (error) console.error("lengopay_paid", error.message);
    }
  } catch (e) {
    console.error("webhook", e);
  }
  return new Response("OK"); // toujours 200 : LengoPay renvoie la notification sinon
});
