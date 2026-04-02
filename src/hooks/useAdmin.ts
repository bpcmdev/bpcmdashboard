import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[useAdmin] auth user:', user?.id ?? 'none');
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('role, client_id')
        .eq('id', user.id)
        .maybeSingle();

      console.log('[useAdmin] user_profiles result:', { data, error });

      if (data) {
        setIsAdmin(data.role === 'admin');
        setClientId(data.client_id);
        console.log('[useAdmin] role:', data.role, '| isAdmin:', data.role === 'admin');

        if (data.client_id) {
          const { data: client } = await supabase
            .from('clients')
            .select('name')
            .eq('id', data.client_id)
            .maybeSingle();
          if (client) setClientName(client.name);
        }
      }
      setLoading(false);
    };
    check();
  }, []);

  return { isAdmin, clientId, clientName, loading };
}
