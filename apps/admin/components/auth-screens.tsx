import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ActionButton, Notice } from '@/components/admin-ui';
import { Text, TextInput } from '@/components/branded-text';
import { colors, radii } from '@/constants/admin-theme';
import { supabase } from '@/lib/supabase';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function signIn() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setMessage('Enter the administrator email address and password.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) setMessage(error.message || 'Sign in failed. Check the account details and try again.');
    setSubmitting(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <View style={styles.folioRow}>
        <Text style={styles.product}>Padel Court Admin</Text>
      </View>

      <View style={styles.loginBody}>
        <Text style={styles.eyebrow}>ADMINISTRATOR ACCESS</Text>
        <Text style={styles.title}>Sign in to manage the court.</Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              editable={!submitting}
              inputMode="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              onSubmitEditing={() => undefined}
              placeholder="Administrator email"
              placeholderTextColor={colors.muted}
              returnKeyType="next"
              selectionColor={colors.accent}
              style={styles.input}
              value={email}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!submitting}
                onChangeText={setPassword}
                onSubmitEditing={() => void signIn()}
                placeholder="Password"
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                secureTextEntry={!showPassword}
                selectionColor={colors.accent}
                style={styles.passwordInput}
                value={password}
              />
              <Pressable
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                accessibilityRole="button"
                onPress={() => setShowPassword((current) => !current)}
                style={styles.passwordToggle}>
                <Ionicons color={colors.accent} name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} />
              </Pressable>
            </View>
          </View>

          {message ? <Notice>{message}</Notice> : null}
          <ActionButton disabled={submitting} icon="log-in-outline" onPress={() => void signIn()}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </ActionButton>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export function LoadingScreen() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.loadingText}>Checking administrator access…</Text>
    </View>
  );
}

export function SetupScreen() {
  return (
    <View style={styles.centeredContent}>
      <Text style={styles.folio}>03</Text>
      <Text style={styles.title}>Supabase configuration required.</Text>
      <Text style={styles.intro}>Add the project URL and publishable key to the administrator app environment before starting Expo.</Text>
    </View>
  );
}

export function AccessDeniedScreen({ email }: { email?: string }) {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
  }

  return (
    <View style={styles.centeredContent}>
      <Ionicons color={colors.accent} name="lock-closed-outline" size={34} />
      <Text style={styles.eyebrow}>ACCESS RESTRICTED</Text>
      <Text style={styles.title}>This account is not an administrator.</Text>
      <Text style={styles.intro}>{email ? `${email} is signed in, but it does not have administrator access.` : 'The signed-in account does not have administrator access.'}</Text>
      <ActionButton disabled={signingOut} icon="log-out-outline" onPress={() => void signOut()} variant="secondary">
        {signingOut ? 'Signing out…' : 'Sign out'}
      </ActionButton>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  folioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 16,
  },
  folio: {
    color: colors.accent,
    fontSize: 52,
    lineHeight: 54,
    fontWeight: '900',
    letterSpacing: -2.5,
  },
  product: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  loginBody: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 30,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1.5,
    maxWidth: 520,
  },
  intro: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
    maxWidth: 520,
  },
  form: {
    gap: 18,
    marginTop: 34,
    maxWidth: 520,
  },
  field: {
    gap: 7,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    borderRadius: radii.small,
  },
  passwordRow: {
    minHeight: 52,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.small,
  },
  passwordInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
  },
  passwordToggle: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
});
