// Deno Edge Function for handling Lemon Squeezy Webhooks
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // 1. Check request method
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // 2. Extract signature header
  const signature = req.headers.get("x-signature");
  if (!signature) {
    console.error("[Webhook] Missing x-signature header.");
    return new Response("Missing signature", { status: 401 });
  }

  // 3. Get raw body for verification
  const rawBody = await req.arrayBuffer();

  // 4. Get signing secret from environment variables
  // (Set this in Supabase via CLI: `supabase secrets set LEMON_SQUEEZY_SIGNING_SECRET=your_secret`)
  const secret = Deno.env.get("LEMON_SQUEEZY_SIGNING_SECRET");
  if (!secret) {
    console.error("[Webhook] Server error: LEMON_SQUEEZY_SIGNING_SECRET environment variable is not set.");
    return new Response("Server configuration error", { status: 500 });
  }

  // 5. Verify signature using Web Crypto API
  try {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Convert hex signature string to Uint8Array
    const sigBuffer = new Uint8Array(
      signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      sigBuffer,
      rawBody
    );

    if (!isValid) {
      console.warn("[Webhook] Invalid signature verification attempt.");
      return new Response("Invalid signature", { status: 401 });
    }
  } catch (err) {
    console.error("[Webhook] Signature verification threw an error:", err);
    return new Response("Signature verification error", { status: 500 });
  }

  // 6. Signature verified, parse body
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch (err) {
    console.error("[Webhook] Failed to parse payload JSON:", err);
    return new Response("Malformed JSON", { status: 400 });
  }

  const eventName = payload.meta?.event_name;
  console.log(`[Webhook] Event received: ${eventName}`);

  // We are only interested in subscription and order events
  if (!eventName || (!eventName.startsWith("subscription_") && !eventName.startsWith("order_"))) {
    return new Response(`Event ${eventName} ignored`, { status: 200 });
  }

  // Initialize Supabase Client with Service Role Key to bypass RLS policies
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[Webhook] Database configuration error: missing credentials.");
    return new Response("Database configuration error", { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 7. Extract custom data user_id OR look up by email (for website purchases)
  let targetUserId = payload.meta?.custom_data?.user_id;
  const customerEmail = payload.data.attributes?.user_email || payload.data.attributes?.customer_email;

  if (!targetUserId && customerEmail) {
    console.log(`[Webhook] No user_id in custom_data. Searching for user by email: ${customerEmail}`);
    try {
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      if (!userError && userData?.users) {
        const matched = userData.users.find(
          (u: { email?: string }) => u.email?.toLowerCase() === customerEmail.toLowerCase()
        );
        if (matched) {
          targetUserId = matched.id;
          console.log(`[Webhook] Found matching Supabase user ID: ${targetUserId}`);
        }
      }
    } catch (searchErr) {
      console.warn("[Webhook] User search by email threw:", searchErr);
    }
  }

  if (!targetUserId) {
    console.error(`[Webhook] Cannot associate purchase to a user. Email: ${customerEmail}, UserID: ${targetUserId}`);
    return new Response("User not found for this purchase", { status: 200 }); // Return 200 so Lemon Squeezy does not retry endlessly
  }

  // 8. Extract data attributes
  const data = payload.data;
  const attrs = data.attributes ?? {};
  const subscriptionId = data.id;
  const customerId = attrs.customer_id;

  let updatePayload: Record<string, unknown> | null = null;

  if (eventName === "order_created" || eventName === "order_refunded") {
    const orderStatus = attrs.status; // "paid" | "refunded" | "pending" | "failed" | "void"
    if (orderStatus === "paid") {
      // One-time purchase: grant 30 days of active access from purchase timestamp
      const purchasedAt = attrs.created_at ? new Date(attrs.created_at) : new Date();
      const endsAt = new Date(purchasedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      updatePayload = {
        user_id: targetUserId,
        subscription_status: "active",
        subscription_ends_at: endsAt,
        lemon_squeezy_customer_id: customerId ? String(customerId) : null,
      };
    } else if (orderStatus === "refunded") {
      updatePayload = {
        user_id: targetUserId,
        subscription_status: "refunded",
        subscription_ends_at: null,
        lemon_squeezy_customer_id: customerId ? String(customerId) : null,
      };
    }
  } else if (eventName.startsWith("subscription_")) {
    updatePayload = {
      user_id: targetUserId,
      subscription_status: attrs.status,
      subscription_ends_at: attrs.ends_at || attrs.renews_at || null,
      lemon_squeezy_customer_id: customerId ? String(customerId) : null,
      lemon_squeezy_subscription_id: subscriptionId ? String(subscriptionId) : null,
    };
  }

  if (!updatePayload) {
    console.log(`[Webhook] Skipped event ${eventName} with status ${attrs.status}`);
    return new Response("Ignored", { status: 200 });
  }

  updatePayload.updated_at = new Date().toISOString();
  console.log(`[Webhook] Processing update for User ID: ${targetUserId}, Payload:`, updatePayload);

  try {
    const { data: updateData, error } = await supabase
      .from("user_settings")
      .upsert(updatePayload, { onConflict: 'user_id' })
      .select();

    if (error) {
      console.error("[Webhook] Database update failed:", error.message);
      return new Response("Database update failed", { status: 500 });
    }

    console.log(`[Webhook] Database updated successfully for user ${targetUserId}. Rows affected:`, updateData?.length);
  } catch (err) {
    console.error("[Webhook] Unexpected error during database update:", err);
    return new Response("Unexpected database error", { status: 500 });
  }

  return new Response("Webhook processed successfully", { status: 200 });
});
