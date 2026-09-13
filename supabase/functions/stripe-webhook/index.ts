import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.44.0";
import Stripe from "npm:stripe@^15.0.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") as string;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("[Webhook] Missing stripe-signature header.");
    return new Response("Missing signature", { status: 401 });
  }

  let event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
  } catch (err) {
    console.error(`[Webhook] Error verifying webhook signature: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`[Webhook] Event received: ${event.type}`);

  // We are interested in checkout session completions and subscription updates
  const supportedEvents = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted"
  ];

  if (!supportedEvents.includes(event.type)) {
    return new Response(`Event ${event.type} ignored`, { status: 200 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[Webhook] Database configuration error: missing credentials.");
    return new Response("Database configuration error", { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let targetUserId = null;
  let updatePayload: Record<string, unknown> | null = null;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // The client_reference_id is our Supabase user ID passed from the frontend
    targetUserId = session.client_reference_id;
    const customerEmail = session.customer_details?.email;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!targetUserId && customerEmail) {
      console.log(`[Webhook] No client_reference_id. Searching for user by email: ${customerEmail}`);
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      if (!userError && userData?.users) {
        const matched = userData.users.find(
          (u) => u.email?.toLowerCase() === customerEmail.toLowerCase()
        );
        if (matched) {
          targetUserId = matched.id;
          console.log(`[Webhook] Found matching Supabase user ID: ${targetUserId}`);
        }
      }
    }

    if (!targetUserId) {
      console.error(`[Webhook] Cannot associate purchase to a user. Email: ${customerEmail}`);
      return new Response("User not found for this purchase", { status: 200 }); 
    }

    if (session.mode === "payment") {
      // One-time payment (Lifetime access or similar)
      const endsAt = new Date();
      endsAt.setFullYear(endsAt.getFullYear() + 100); // effectively lifetime
      updatePayload = {
        user_id: targetUserId,
        subscription_status: "active",
        subscription_ends_at: endsAt.toISOString(),
        stripe_customer_id: customerId,
      };
    } else if (session.mode === "subscription") {
      // Subscription started
      // The actual end date will come from the customer.subscription.created/updated event,
      // but we can set it to active immediately.
      updatePayload = {
        user_id: targetUserId,
        subscription_status: "active",
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      };
    }

  } else if (event.type.startsWith("customer.subscription.")) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    // Find the user by stripe_customer_id, with retry logic for race conditions
    let userSettings = null;
    let retries = 0;
    while (retries < 3) {
      const { data, error: lookupError } = await supabase
        .from("user_settings")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      if (lookupError) {
        console.error(`[Webhook] DB Error looking up stripe_customer_id ${customerId}:`, lookupError.message || lookupError);
      } else if (data) {
        userSettings = data;
        break;
      }
      
      console.log(`[Webhook] User with stripe_customer_id ${customerId} not found yet. Retrying in 2s... (${retries + 1}/3)`);
      await new Promise((res) => setTimeout(res, 2000));
      retries++;
    }

    if (!userSettings) {
      console.error(`[Webhook] Gave up looking for stripe_customer_id: ${customerId} after 3 retries.`);
      return new Response("User not found", { status: 200 });
    }

    targetUserId = userSettings.user_id;

    const status = subscription.status; // 'active', 'past_due', 'canceled', 'unpaid'
    const currentPeriodEnd = subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000).toISOString() 
      : null;

    updatePayload = {
      user_id: targetUserId,
      subscription_status: status,
      stripe_subscription_id: subscription.id,
    };
    
    // Only update ends_at if we have a valid date from Stripe
    if (currentPeriodEnd) {
      updatePayload.subscription_ends_at = currentPeriodEnd;
    }
  }

  if (!updatePayload || !targetUserId) {
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
