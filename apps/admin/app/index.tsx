import type { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminDashboard } from '@/components/admin-dashboard';
import { AccessDeniedScreen, LoadingScreen, LoginScreen, SetupScreen } from '@/components/auth-screens';
import { colors, layout } from '@/constants/admin-theme';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  authContent: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
  },
});
