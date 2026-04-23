import { supabase } from '@/lib/supabase';

export type ActivityAction = 'created' | 'updated' | 'deleted' | 'invited' | 'approved';
export type ActivityEntityType =
  | 'key_win'
  | 'placement'
  | 'pipeline_moment'
  | 'partnership'
  | 'product_launch'
  | 'user'
  | 'weekly_snapshot'
  | 'narrative_watch';

interface LogActivityArgs {
  client_id?: string | null;
  action: ActivityAction;
  entity_type: ActivityEntityType;
  entity_id?: string | null;
  entity_title?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Insert a row into activity_log. Best-effort — never throws.
 * Resolves the current user's id and full_name automatically.
 */
export async function logActivity(args: LogActivityArgs): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[activityLog] no auth user — skipping log');
      return;
    }

    let userName = user.email ?? 'Unknown';
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.full_name) userName = profile.full_name;

    const payload = {
      client_id: args.client_id ?? null,
      user_id: user.id,
      user_name: userName,
      action: args.action,
      entity_type: args.entity_type,
      entity_id: args.entity_id ?? null,
      entity_title: args.entity_title ?? null,
      metadata: args.metadata ?? null,
    };

    const { error } = await supabase.from('activity_log').insert(payload);
    if (error) console.error('[activityLog] insert error:', error, payload);
  } catch (err) {
    console.error('[activityLog] unexpected error:', err);
  }
}
