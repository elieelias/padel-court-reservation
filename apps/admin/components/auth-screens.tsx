// Provides the setup, loading, login, and access-denied screens used before the dashboard.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native';

import { ActionButton, Notice } from '@/components/admin-ui';
import { Text, TextInput } from '@/components/branded-text';
import { colors } from '@/constants/admin-theme';
import { supabase } from '@/lib/supabase';
import { authScreenStyles as styles } from '@/stylesheets/auth-screens.styles';

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
      <View style={styles.loginBackdrop}>
        <View style={styles.backdropGlow} />
        <View style={styles.courtDrawing}>
          <View style={styles.courtOuterLine} />
          <View style={styles.courtCenterLine} />
          <View style={styles.courtServiceLine} />
          <View style={styles.courtNet} />
        </View>
        <View style={styles.ballMark} />
      </View>

      <View style={styles.folioRow}>
        <Text style={styles.product}>Padel Court Admin</Text>
      </View>

      <View style={styles.loginBody}>
        <View style={styles.loginCard}>
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
