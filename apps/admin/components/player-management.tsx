// Displays player accounts and provides profile viewing, editing, and authorized deletion controls.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, View } from 'react-native';

import { playerManagementStyles as styles } from '@/stylesheets/player-management.styles';
import { ActionButton, EmptyState, Field, ModalShell, Notice } from '@/components/admin-ui';
import { Text } from '@/components/branded-text';
import { DetailGroup, DetailRow } from '@/components/schedule-management';
import { colors } from '@/constants/admin-theme';
import { getPlayerName as playerLabel, type Player, type PlayerEditValues, type PlayerStats } from '@/lib/admin-types';
import { formatDateTime } from '@/lib/date';
import { getErrorMessage as errorText } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export function PlayersPanel({
  isMainAdministrator,
  onEdit,
  onManageAdministrators,
  players,
}: {
  isMainAdministrator: boolean;
  onEdit: (player: Player) => void;
  onManageAdministrators: () => void;
  players: Player[];
}) {
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const visiblePlayers = players.filter((player) => !normalizedSearch || [player.username, player.full_name, player.email, player.phone_number].some((value) => value?.toLowerCase().includes(normalizedSearch)));

  return (
    <View style={styles.panelStack}>
      <SectionHeading eyebrow="Player accounts" title={`${players.length} ${players.length === 1 ? 'player' : 'players'}`} />
      {isMainAdministrator ? <ActionButton icon="shield-checkmark-outline" onPress={onManageAdministrators}>Manage administrator accounts</ActionButton> : null}
      <Field autoCapitalize="none" label="Search" onChangeText={setSearch} placeholder="Username, name, email, or phone" value={search} />
      {!visiblePlayers.length ? (
        <EmptyState icon="people-outline" text={players.length ? 'Try a different name, email, or phone number.' : 'Player accounts created through the website will appear here.'} title={players.length ? 'No matching players' : 'No player accounts'} />
      ) : visiblePlayers.map((player) => (
        <Pressable key={player.id} onPress={() => onEdit(player)} style={styles.playerCard}>
          <View style={styles.playerInitial}>
            <Text style={styles.playerInitialText}>{(player.full_name || player.email || 'P').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.flexField}>
            <Text style={styles.cardTitle}>{playerLabel(player)}</Text>
            <Text style={styles.playerUsername}>@{player.username}</Text>
            <Text style={styles.cardMeta}>{player.email || 'No email available'}</Text>
            <Text style={styles.cardMeta}>{player.phone_number || 'No phone number'}</Text>
          </View>
          <Ionicons color={colors.accent} name="chevron-forward" size={20} />
        </Pressable>
      ))}
    </View>
  );
}

export function PlayerEditModal({
  canDelete,
  onClose,
  onDelete,
  onSave,
  player,
}: {
  canDelete: boolean;
  onClose: () => void;
  onDelete: (player: Player) => Promise<string>;
  onSave: (values: PlayerEditValues) => Promise<string>;
  player: Player | null;
}) {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    setFullName(player?.full_name || '');
    setPhoneNumber(player?.phone_number || '');
    setSaving(false);
    setDeleting(false);
    setError('');
    setStats(null);
    setStatsError('');

    if (!player) return;
    let active = true;
    void supabase.rpc('admin_get_player_details', { p_player_id: player.id }).single().then(({ data, error: detailsError }) => {
      if (!active) return;
      if (detailsError) {
        setStatsError(errorText(detailsError, 'Player activity could not be loaded.'));
      } else {
        setStats(data);
      }
    });

    return () => {
      active = false;
    };
  }, [player]);

  if (!player) return null;

  async function submit() {
    const currentPlayer = player;
    if (!currentPlayer) return;
    if (fullName.trim().length < 2) {
      setError('Player name must contain at least two characters.');
      return;
    }
    if (phoneNumber.trim() && phoneNumber.trim().length < 7) {
      setError('Enter a valid phone number or leave it blank.');
      return;
    }
    setSaving(true);
    setError('');
    const nextError = await onSave({ id: currentPlayer.id, fullName, phoneNumber });
    setError(nextError);
    setSaving(false);
  }

  async function remove() {
    const currentPlayer = player;
    if (!currentPlayer) return;
    setDeleting(true);
    setError('');
    const nextError = await onDelete(currentPlayer);
    if (nextError) {
      setError(nextError);
      setDeleting(false);
    }
  }

  function confirmDelete() {
    const message = 'This permanently removes the player’s login and personal profile information. Historical reservation and payment records will be preserved. This cannot be undone.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Delete player profile?\n\n${message}`)) void remove();
      return;
    }

    Alert.alert(
      'Delete player profile?',
      message,
      [
        { text: 'Keep profile', style: 'cancel' },
        { text: 'Delete profile', style: 'destructive', onPress: () => void remove() },
      ],
    );
  }

  return (
    <ModalShell onClose={onClose} title="Player profile" visible>
      <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.playerProfileHeading}>
          <View style={styles.playerProfileInitial}>
            <Text style={styles.playerProfileInitialText}>{(player.full_name || player.email || 'P').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.flexField}>
            <Text style={styles.playerProfileName}>{playerLabel(player)}</Text>
            <Text style={styles.playerProfileUsername}>@{player.username}</Text>
          </View>
        </View>

        <View style={styles.playerStatsLedger}>
          <View style={styles.playerStat}>
            {stats ? <Text style={styles.playerStatValue}>{stats.friend_count}</Text> : statsError ? <Text style={styles.playerStatValue}>—</Text> : <ActivityIndicator color={colors.accent} />}
            <Text style={styles.playerStatLabel}>Friends</Text>
          </View>
          <View style={styles.playerStat}>
            {stats ? <Text style={styles.playerStatValue}>{stats.reservations_played}</Text> : statsError ? <Text style={styles.playerStatValue}>—</Text> : <ActivityIndicator color={colors.accent} />}
            <Text style={styles.playerStatLabel}>Reservations played</Text>
          </View>
        </View>
        {statsError ? <Notice>{statsError}</Notice> : null}

        <DetailGroup title="Player information">
          <DetailRow label="Name" value={player.full_name || 'Not added'} />
          <DetailRow label="Username" value={`@${player.username}`} />
          <DetailRow label="Email" value={player.email || 'Not available'} />
          <DetailRow label="Phone" value={player.phone_number || 'Not added'} />
          <DetailRow label="Created" value={formatDateTime(player.created_at)} />
          <DetailRow label="Last sign-in" value={player.last_sign_in_at ? formatDateTime(player.last_sign_in_at) : 'Not recorded'} />
        </DetailGroup>

        <Text style={styles.playerEditTitle}>Edit player information</Text>
        <Field autoComplete="name" label="Full name" maxLength={120} onChangeText={setFullName} value={fullName} />
        <Field autoComplete="tel" keyboardType="phone-pad" label="Phone number" maxLength={32} onChangeText={setPhoneNumber} value={phoneNumber} />
        {error ? <Notice>{error}</Notice> : null}
        <ActionButton disabled={saving || deleting} icon="save-outline" onPress={() => void submit()}>{saving ? 'Saving…' : 'Save changes'}</ActionButton>

        {canDelete ? (
          <View style={styles.playerDeleteSection}>
            <Text style={styles.playerDeleteTitle}>Delete profile</Text>
            <Text style={styles.playerDeleteCopy}>Removes login access and personal profile information while preserving court records.</Text>
            <Pressable
              accessibilityRole="button"
              disabled={saving || deleting}
              onPress={confirmDelete}
              style={({ pressed }) => [styles.playerDeleteButton, pressed && styles.playerDeleteButtonPressed, (saving || deleting) && styles.playerDeleteButtonDisabled]}>
              <Ionicons color={colors.secondary} name="trash-outline" size={17} />
              <Text style={styles.playerDeleteButtonText}>{deleting ? 'Deleting profile…' : 'Delete player profile'}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </ModalShell>
  );
}
