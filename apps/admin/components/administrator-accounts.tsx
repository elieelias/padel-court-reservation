// Lets the main administrator view existing administrators and create sub-administrator accounts.

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { ActionButton, EmptyState, Field, ModalShell, Notice, StatusChip } from '@/components/admin-ui';
import { Text } from '@/components/branded-text';
import { colors } from '@/constants/admin-theme';
import { formatDateTime } from '@/lib/date';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { administratorAccountStyles as styles } from '@/stylesheets/administrator-accounts.styles';

type Administrator = Database['public']['Functions']['admin_list_administrators']['Returns'][number];

const initialForm = { email: '', fullName: '', password: '', phoneNumber: '', username: '' };

export function AdministratorAccountsModal({
  onClose,
  timeZone,
  visible,
}: {
  onClose: () => void;
  timeZone: string;
  visible: boolean;
}) {
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadAdministrators = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase.rpc('admin_list_administrators');
    if (loadError) setError(loadError.message || 'Administrator accounts could not be loaded.');
    else setAdministrators(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setError('');
    setMessage('');
    void loadAdministrators();
  }, [loadAdministrators, visible]);

  function update(key: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createAdministrator() {
    if (saving) return;
    if (!form.email.trim() || !form.email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/.test(form.username.trim())) {
      setError('Username must be 3–30 characters using letters, numbers, dots, dashes, or underscores.');
      return;
    }
    if (form.fullName.trim().length < 2) {
      setError('Enter the administrator’s full name.');
      return;
    }
    if (form.password.length < 12) {
      setError('The temporary password must contain at least 12 characters.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    const { error: createError } = await supabase.functions.invoke('admin-create-administrator', {
      body: {
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        password: form.password,
        phoneNumber: form.phoneNumber.trim(),
        username: form.username.trim(),
      },
    });

    if (createError) {
      let detail = createError.message || 'The administrator account could not be created.';
      const context = (createError as { context?: { json?: () => Promise<unknown> } }).context;
      if (context?.json) {
        try {
          const body = await context.json() as { error?: string };
          if (body.error) detail = body.error;
        } catch {
          // Keep the function error when its response body is unavailable.
        }
      }
      setError(detail);
      setSaving(false);
      return;
    }

    setMessage(`${form.fullName.trim()} can now sign in to the administrator application.`);
    setForm(initialForm);
    await loadAdministrators();
    setSaving(false);
  }

  return (
    <ModalShell onClose={onClose} title="Administrator accounts" visible={visible}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.authorityBanner}>
          <Ionicons color={colors.onAccent} name="shield-checkmark-outline" size={26} />
          <View style={styles.bannerCopy}>
            <Text style={styles.bannerEyebrow}>Main administrator</Text>
            <Text style={styles.bannerTitle}>Create administrator access</Text>
            <Text style={styles.bannerText}>Only the designated main administrator can create these accounts.</Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>New administrator</Text>
          <Field autoCapitalize="none" autoComplete="email" keyboardType="email-address" label="Email address" onChangeText={(value) => update('email', value)} value={form.email} />
          <Field autoCapitalize="words" label="Full name" onChangeText={(value) => update('fullName', value)} value={form.fullName} />
          <Field autoCapitalize="none" label="Username" onChangeText={(value) => update('username', value)} placeholder="3–30 letters, numbers, dots, dashes, or underscores" value={form.username} />
          <Field keyboardType="phone-pad" label="Phone number (optional)" onChangeText={(value) => update('phoneNumber', value)} value={form.phoneNumber} />
          <Field autoCapitalize="none" label="Temporary password" onChangeText={(value) => update('password', value)} secureTextEntry value={form.password} />
          <Text style={styles.passwordNote}>Use at least 12 characters and share the temporary password privately.</Text>
          {error ? <Notice>{error}</Notice> : null}
          {message ? <Notice>{message}</Notice> : null}
          <ActionButton disabled={saving} icon="person-add-outline" onPress={() => void createAdministrator()}>{saving ? 'Creating account…' : 'Create administrator'}</ActionButton>
        </View>

        <View style={styles.listSection}>
          <View style={styles.listHeading}>
            <Text style={styles.sectionTitle}>Current administrators</Text>
            <StatusChip emphasized>{administrators.length}</StatusChip>
          </View>
          {loading ? (
            <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.muted}>Loading administrators…</Text></View>
          ) : !administrators.length ? (
            <EmptyState icon="shield-outline" text="Administrator accounts will appear here." title="No administrators found" />
          ) : administrators.map((administrator) => (
            <View key={administrator.id} style={styles.administratorCard}>
              <View style={styles.initial}><Text style={styles.initialText}>{(administrator.full_name || administrator.email).charAt(0).toUpperCase()}</Text></View>
              <View style={styles.accountCopy}>
                <View style={styles.accountHeading}>
                  <Text style={styles.accountName}>{administrator.full_name || `@${administrator.username}`}</Text>
                  {administrator.is_main_administrator ? <StatusChip emphasized>Main</StatusChip> : null}
                </View>
                <Text style={styles.muted}>@{administrator.username}</Text>
                <Text selectable style={styles.accountDetail}>{administrator.email}</Text>
                <Text style={styles.date}>Created {formatDateTime(administrator.created_at, timeZone)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ModalShell>
  );
}
