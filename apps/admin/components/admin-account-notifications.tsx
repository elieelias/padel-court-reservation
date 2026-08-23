import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ActionButton, EmptyState, ModalShell, Notice, StatusChip } from '@/components/admin-ui';
import { Text } from '@/components/branded-text';
import { colors, layout } from '@/constants/admin-theme';
import { formatDateTime } from '@/lib/date';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type AccountNotification = Database['public']['Functions']['admin_list_account_notifications']['Returns'][number];

export function AdminAccountNotifications({ timeZone }: { timeZone: string }) {
  const [items, setItems] = useState<AccountNotification[]>([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_account_notifications');
    if (error) setMessage(error.message || 'Account notifications could not be loaded.');
    else {
      setItems(data ?? []);
      setMessage('');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      void refresh();
      channel = supabase
        .channel(`admin-account-notifications-${data.user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'admin_account_notifications',
            filter: `recipient_id=eq.${data.user.id}`,
          },
          () => void refresh(),
        )
        .subscribe();
      interval = setInterval(() => void refresh(), 30_000);
    });

    return () => {
      active = false;
      if (interval) clearInterval(interval);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh]);

  async function markAllRead() {
    const { error } = await supabase.rpc('admin_mark_account_notifications_read', {
      p_notification_ids: null,
    });
    if (error) {
      setMessage(error.message || 'Notifications could not be marked as read.');
      return;
    }
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
  }

  return (
    <>
      <Pressable
        accessibilityLabel={unreadCount ? `${unreadCount} unread account notifications` : 'Account notifications'}
        accessibilityRole="button"
        onPress={() => {
          setVisible(true);
          void refresh(true);
        }}
        style={({ pressed }) => [styles.bell, pressed && styles.pressed]}>
        <Ionicons color={colors.accent} name="notifications-outline" size={20} />
        {unreadCount ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View> : null}
      </Pressable>

      <ModalShell onClose={() => setVisible(false)} title="Account notifications" visible={visible}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>New registrations</Text>
              <Text style={styles.title}>{unreadCount ? `${unreadCount} unread` : 'Up to date'}</Text>
            </View>
            {unreadCount ? <View style={styles.markButton}><ActionButton icon="checkmark-done-outline" onPress={() => void markAllRead()} variant="secondary">Mark all read</ActionButton></View> : null}
          </View>

          {message ? <Notice>{message}</Notice> : null}
          {loading ? (
            <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.muted}>Loading notifications…</Text></View>
          ) : !items.length ? (
            <EmptyState icon="notifications-off-outline" text="New player and administrator registrations will appear here." title="No account notifications" />
          ) : (
            <View style={styles.list}>
              {items.map((item) => (
                <View key={item.notification_id} style={[styles.item, !item.read_at && styles.itemUnread]}>
                  <View style={styles.itemIcon}>
                    <Ionicons color={colors.accent} name={item.account_role === 'administrator' ? 'shield-checkmark-outline' : 'person-add-outline'} size={20} />
                  </View>
                  <View style={styles.itemCopy}>
                    <View style={styles.itemHeading}>
                      <Text style={styles.itemTitle}>{item.account_role === 'administrator' ? 'Administrator account created' : 'Player account created'}</Text>
                      {!item.read_at ? <StatusChip emphasized>New</StatusChip> : null}
                    </View>
                    <Text style={styles.accountName}>{item.account_full_name || `@${item.account_username}`}</Text>
                    <Text selectable style={styles.muted}>@{item.account_username} · {item.account_email}</Text>
                    <Text style={styles.date}>{formatDateTime(item.created_at, timeZone)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </ModalShell>
    </>
  );
}

const styles = StyleSheet.create({
  bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pressed: { opacity: 0.68 },
  badge: { position: 'absolute', right: -4, top: -5, minWidth: 20, height: 20, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.background, borderRadius: 10 },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  scrollContent: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', padding: layout.gutter, paddingBottom: 52, gap: 18 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.text, paddingBottom: 14 },
  headingCopy: { flex: 1, gap: 5 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 29, lineHeight: 32, fontWeight: '900', letterSpacing: -1 },
  markButton: { maxWidth: 170 },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  list: { gap: 10 },
  item: { flexDirection: 'row', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  itemUnread: { borderLeftWidth: 4, borderLeftColor: colors.accent, backgroundColor: colors.paleAccent },
  itemIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surface },
  itemCopy: { flex: 1, gap: 4 },
  itemHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  accountName: { color: colors.text, fontSize: 17, fontWeight: '900' },
  date: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
