import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('user_profiles')
        .select('role, client_id')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setIsAdmin(data.role === 'admin');
        setClientId(data.client_id);
      }
      setLoading(false);
    };
    check();
  }, []);

  return { isAdmin, clientId, loading };
}
