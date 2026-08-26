// Checks the signed-in user's administrator access and renders the correct starting screen.

import type { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminDashboard } from '@/components/admin-dashboard';
import { AccessDeniedScreen, LoadingScreen, LoginScreen, SetupScreen } from '@/components/auth-screens';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { indexStyles as styles } from '@/stylesheets/index.styles';

type AccessState = 'loading' | 'signed-out' | 'administrator' | 'denied';

export default function IndexScreen() {
  const [accessState, setAccessState] = useState<AccessState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [administratorName, setAdministratorName] = useState<string | null>(null);
  const [isMainAdministrator, setIsMainAdministrator] = useState(false);

  const verifyAccess = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setUser(null);
      setAdministratorName(null);
      setIsMainAdministrator(false);
      setAccessState('signed-out');
      return;
    }

    setUser(nextUser);
    setAccessState('loading');
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, is_main_administrator, role')
      .eq('id', nextUser.id)
      .single();

    if (error || data?.role !== 'administrator') {
      setAdministratorName(null);
      setIsMainAdministrator(false);
      setAccessState('denied');
      return;
    }

    setAdministratorName(data.full_name);
    setIsMainAdministrator(data.is_main_administrator);
    setAccessState('administrator');
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) void verifyAccess(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      // Defer the profile lookup until Supabase finishes processing the auth event.
      setTimeout(() => {
        if (active) void verifyAccess(session?.user ?? null);
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [verifyAccess]);

  let content;
  if (!isSupabaseConfigured) content = <SetupScreen />;
  else if (accessState === 'loading') content = <LoadingScreen />;
  else if (accessState === 'signed-out') content = <LoginScreen />;
  else if (accessState === 'denied') content = <AccessDeniedScreen email={user?.email} />;
  else content = <AdminDashboard administratorName={administratorName} isMainAdministrator={isMainAdministrator} />;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {accessState === 'administrator' ? content : <SafeAreaView style={styles.authContent}>{content}</SafeAreaView>}
    </SafeAreaView>
  );
}
