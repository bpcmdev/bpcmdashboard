import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NotificationRow {
  id: string;
  message: string | null;
  entity_title: string | null;
  entity_type: string | null;
  from_status?: string | null;
  to_status?: string | null;
  is_read?: boolean | null;
  created_at: string | null;
}

const relativeDate = (iso: string | null) => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
};

const prettyStatus = (s?: string | null) => (s ? s.replace(/_/g, ' ') : '');

const NotificationBell = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.rpc('notifications_inbox', {
      p_recipient_id: userId,
      p_unread_only: true,
      p_limit: 30,
    });
    setItems((data as NotificationRow[]) ?? []);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const handleOpen = async (open: boolean) => {
    if (!open) return;
    await load();
    const ids = items.filter(i => !i.is_read).map(i => i.id);
    if (ids.length) {
      await supabase.rpc('notifications_mark_read', { p_notification_ids: ids });
    }
  };

  const unread = items.length;

  return (
    <DropdownMenu onOpenChange={(o) => void handleOpen(o)}>
      <DropdownMenuTrigger asChild>
        <button className="header-chip relative" aria-label="Notifications">
          <Bell className="w-3.5 h-3.5" />
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[hsl(0_75%_55%)] text-white text-[9px] font-semibold leading-4 text-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto bg-card border-border p-0">
        <div className="px-3 py-2 border-b border-border font-mono-ui text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
          Notifications
        </div>
        {items.length === 0 ? (
          <div className="px-3 py-6 text-xs text-muted-foreground text-center">You're all caught up.</div>
        ) : (
          <div className="divide-y divide-border">
            {items.map(n => (
              <div key={n.id} className="px-3 py-2.5">
                <div className="text-xs font-semibold truncate">{n.entity_title ?? 'Update'}</div>
                {n.message && <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>}
                {(n.from_status || n.to_status) && (
                  <div className="text-[10px] font-mono-ui tracking-wider uppercase text-muted-foreground mt-1">
                    {prettyStatus(n.from_status) || '—'} → {prettyStatus(n.to_status) || '—'}
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground mt-1">{relativeDate(n.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
