import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role, is_main_administrator, full_name, username")
    .eq("id", callerData.user.id)
    .maybeSingle();
  if (callerProfile?.role !== "administrator" || !callerProfile.is_main_administrator) {
    return json({ error: "Main administrator access is required to delete player accounts." }, 403);
  }

  let body: { playerId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "A player ID is required." }, 400);
  }
  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  if (!uuidPattern.test(playerId)) return json({ error: "A valid player ID is required." }, 400);

  const { data: player } = await admin
    .from("profiles")
    .select("id, role, full_name, phone_number, username")
    .eq("id", playerId)
    .maybeSingle();
  if (!player || player.role !== "player") return json({ error: "Player account not found." }, 404);

  // Soft deletion disables the login and obfuscates Auth data while preserving
  // the stable user ID required by historical reservation and payment records.
  const { error: deleteError } = await admin.auth.admin.deleteUser(playerId, true);
  if (deleteError) return json({ error: "The player login could not be deleted." }, 500);

  const anonymizedUsername = `deleted_${playerId.replaceAll("-", "")}`.slice(0, 30);
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: null,
      phone_number: null,
      role: "deleted",
      username: anonymizedUsername,
    })
    .eq("id", playerId);
  if (profileError) return json({ error: "The login was deleted, but the profile could not be anonymized." }, 500);

  const { error: auditError } = await admin.from("administrative_audit_log").insert({
    actor_id: callerData.user.id,
    actor_name: callerProfile.full_name,
    actor_username: callerProfile.username,
    action: "delete_player",
    entity_type: "profiles",
    entity_id: playerId,
    old_values: player,
    new_values: {
      id: playerId,
      full_name: null,
      phone_number: null,
      role: "deleted",
      username: anonymizedUsername,
    },
  });
  if (auditError) console.error("Player deletion audit entry failed", auditError.message);

  return json({ playerId });
});
