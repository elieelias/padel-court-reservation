import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const usernamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication is required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration is incomplete." }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authorization.slice("Bearer ".length);
  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !callerData.user) return json({ error: "Authentication is required." }, 401);

  const { data: callerProfile, error: profileError } = await admin
    .from("profiles")
    .select("role, is_main_administrator, full_name, username")
    .eq("id", callerData.user.id)
    .maybeSingle();
  if (profileError) return json({ error: "Administrator authorization could not be checked." }, 500);
  if (callerProfile?.role !== "administrator" || !callerProfile.is_main_administrator) {
    return json({ error: "Main administrator access is required." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Administrator account details are required." }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";

  if (!email || !email.includes("@")) return json({ error: "A valid email address is required." }, 400);
  if (password.length < 12) return json({ error: "The temporary password must contain at least 12 characters." }, 400);
  if (!usernamePattern.test(username)) {
    return json({ error: "Username must be 3–30 characters using letters, numbers, dots, dashes, or underscores." }, 400);
  }
  if (fullName.length < 2) return json({ error: "The administrator’s full name is required." }, 400);

  const { data: existingUsername } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (existingUsername) return json({ error: "That username is already in use." }, 409);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      full_name: fullName,
      phone_number: phoneNumber || null,
    },
    app_metadata: {
      court_role: "administrator",
      created_by: callerData.user.id,
    },
  });

  if (createError || !created.user) {
    const duplicate = createError?.message.toLowerCase().includes("already") ?? false;
    return json({ error: duplicate ? "An account with that email already exists." : "The administrator account could not be created." }, duplicate ? 409 : 500);
  }

  // The auth trigger normally creates this profile from app_metadata. Explicitly
  // set the privileged role after the main-administrator check so a profile can
  // never remain a player if Auth metadata was not visible to the trigger yet.
  const { data: administratorProfile, error: administratorProfileError } = await admin
    .from("profiles")
    .update({
      username,
      full_name: fullName,
      phone_number: phoneNumber || null,
      role: "administrator",
      is_main_administrator: false,
    })
    .eq("id", created.user.id)
    .select("id")
    .maybeSingle();

  if (administratorProfileError || !administratorProfile) {
    // Avoid leaving behind an unusable or incorrectly privileged account when
    // profile provisioning fails for a newly created Auth user.
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: "The administrator profile could not be created." }, 500);
  }

  // The insert trigger may have emitted a player notification before the role
  // correction above. Keep the existing notification while correcting its type.
  await admin
    .from("admin_account_notifications")
    .update({ event_type: "administrator_account_created" })
    .eq("account_id", created.user.id)
    .eq("event_type", "player_account_created");

  const { error: auditError } = await admin.from("administrative_audit_log").insert({
    actor_id: callerData.user.id,
    actor_name: callerProfile.full_name,
    actor_username: callerProfile.username,
    action: "create_administrator",
    entity_type: "profiles",
    entity_id: created.user.id,
    new_values: {
      id: created.user.id,
      email: created.user.email,
      username,
      full_name: fullName,
      phone_number: phoneNumber || null,
      role: "administrator",
      is_main_administrator: false,
    },
  });
  if (auditError) console.error("Administrator audit entry failed", auditError.message);

  return json({
    administrator: {
      id: created.user.id,
      email: created.user.email,
      username,
      fullName,
    },
  }, 201);
});
