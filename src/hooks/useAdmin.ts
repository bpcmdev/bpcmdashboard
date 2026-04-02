import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface ClientInfo {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
}

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [clientLogo, setClientLogo] = useState<string | null>(null);
  const [clientColor, setClientColor] = useState<string | null>(null);
  const [allClients, setAllClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userClientId, setUserClientId] = useState<string | null>(null);

  // Allow admin to override active client
  const switchClient = useCallback((newClientId: string) => {
    const client = allClients.find(c => c.id === newClientId);
    if (client) {
      setClientId(newClientId);
      setClientName(client.name);
      setClientLogo(client.logo_url);
      setClientColor(client.primary_color);
    }
  }, [allClients]);

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
        const admin = data.role === 'admin';
        setIsAdmin(admin);
        setClientId(data.client_id);
        setUserClientId(data.client_id);
        console.log('[useAdmin] role:', data.role, '| isAdmin:', admin);

        if (data.client_id) {
          const { data: client } = await supabase
            .from('clients')
            .select('name, logo_url, primary_color')
            .eq('id', data.client_id)
            .maybeSingle();
          if (client) {
            setClientName(client.name);
            setClientLogo(client.logo_url ?? null);
            setClientColor(client.primary_color ?? null);
          }
        }

        // If admin, fetch all clients for switcher
        if (admin) {
          const { data: clients } = await supabase
            .from('clients')
            .select('id, name, logo_url, primary_color')
            .order('name');
          setAllClients(clients ?? []);
        }
      }
      setLoading(false);
    };
    check();
  }, []);

  return { isAdmin, clientId, clientName, clientLogo, clientColor, allClients, switchClient, userClientId, loading };
}
