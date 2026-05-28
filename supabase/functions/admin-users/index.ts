// admin-users edge function v2
// manages users (list/invite/update/delete)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authenticate the caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY")!;

  // Verify the caller is an admin
  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await callerClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const callerId = claims.claims.sub as string;

  // Check admin role via user_profiles
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return jsonResponse({ error: "Forbidden: admin only" }, 403);
  }

  const body = await req.json();
  const { action } = body;

  try {
    if (action === "list") {
      const { data, error } = await adminClient
        .from("user_profiles")
        .select("id, full_name, email, role, client_id, invited_at, clients(name)")
        .order("full_name");
      if (error) throw error;

      // Enrich with auth.users data (email_confirmed_at, last_sign_in_at)
      const authMap: Record<string, { email_confirmed_at: string | null; last_sign_in_at: string | null }> = {};
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data: authData, error: authErr } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (authErr) break;
        for (const u of authData.users) {
          authMap[u.id] = {
            email_confirmed_at: (u as any).email_confirmed_at ?? null,
            last_sign_in_at: (u as any).last_sign_in_at ?? null,
          };
        }
        if (authData.users.length < perPage) break;
        page++;
      }

      const enriched = (data ?? []).map((u: any) => ({
        ...u,
        client_name: u.clients?.name ?? null,
        email_confirmed_at: authMap[u.id]?.email_confirmed_at ?? null,
        last_sign_in_at: authMap[u.id]?.last_sign_in_at ?? null,
      }));

      return jsonResponse({ users: enriched });
    }

    if (action === "invite") {
      const { email, full_name, role, client_id } = body;
      if (!email || !full_name || !role) {
        return jsonResponse({ error: "Missing required fields" }, 400);
      }
      if (role !== "admin" && !client_id) {
        return jsonResponse({ error: "client_id required for non-admin users" }, 400);
      }

      // Send invite email — user sets their own password via the link
      const { data: authUser, error: authErr } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        { data: { full_name, password_set: false } },
      );
      if (authErr) throw authErr;

      // Insert profile
      const { error: profileErr } = await adminClient
        .from("user_profiles")
        .insert({
          id: authUser.user.id,
          full_name,
          email,
          role,
          client_id: role === "admin" ? null : client_id,
        });
      if (profileErr) throw profileErr;

      return jsonResponse({ success: true, userId: authUser.user.id });
    }

    if (action === "update") {
      const { user_id, role, client_id } = body;
      if (!user_id) return jsonResponse({ error: "Missing user_id" }, 400);

      const updates: Record<string, string> = {};
      if (role) updates.role = role;
      if (client_id) updates.client_id = client_id;

      const { error } = await adminClient
        .from("user_profiles")
        .update(updates)
        .eq("id", user_id);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    if (action === "set_password") {
      const { userId, password } = body;
      if (!userId || !password) {
        return jsonResponse({ error: "userId and password required" }, 400);
      }
      if (typeof password !== "string" || password.length < 8) {
        return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
      }
      const { error } = await adminClient.auth.admin.updateUserById(userId, { password });
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ success: true });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return jsonResponse({ error: "Missing user_id" }, 400);

      // Delete profile first (or let cascade handle it)
      await adminClient.from("user_profiles").delete().eq("id", user_id);
      // Delete auth user
      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err: any) {
    console.error("[admin-users]", err);
    return jsonResponse({ error: err.message || "Internal error" }, 500);
  }
});
