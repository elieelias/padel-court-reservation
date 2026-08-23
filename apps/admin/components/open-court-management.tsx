import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ActionButton, EmptyState, ModalShell, Notice, StatusChip } from '@/components/admin-ui';
import { Text } from '@/components/branded-text';
import { colors, layout } from '@/constants/admin-theme';
import { formatDateTime, formatTimeRange } from '@/lib/date';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type OpenCourt = Database['public']['Functions']['admin_list_open_courts']['Returns'][number];
type OpenCourtRequest = Database['public']['Functions']['admin_list_open_court_requests']['Returns'][number];

function displayName(fullName: string | null, username: string) {
  return fullName?.trim() || `@${username}`;
}

function errorMessage(error: { message?: string } | null, fallback: string) {
  return error?.message || fallback;
}

export function OpenCourtManagementModal({
  onClose,
  timeZone,
  visible,
}: {
  onClose: () => void;
  timeZone: string;
  visible: boolean;
}) {
  const [courts, setCourts] = useState<OpenCourt[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requests, setRequests] = useState<OpenCourtRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [busyRequest, setBusyRequest] = useState('');
  const [message, setMessage] = useState('');

  const selected = useMemo(
    () => courts.find((court) => court.reservation_id === selectedId) ?? null,
    [courts, selectedId],
  );

  const loadCourts = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setMessage('');
    const { data, error } = await supabase.rpc('admin_list_open_courts');
    if (error) setMessage(errorMessage(error, 'Open Courts could not be loaded.'));
    else setCourts(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadRequests = useCallback(async (reservationId: string, quiet = false) => {
    if (!quiet) setRequestsLoading(true);
    const { data, error } = await supabase.rpc('admin_list_open_court_requests', {
      p_reservation_id: reservationId,
    });
    if (error) setMessage(errorMessage(error, 'The Open Court roster could not be loaded.'));
    else setRequests(data ?? []);
    setRequestsLoading(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setSelectedId(null);
    setRequests([]);
    void loadCourts();
  }, [loadCourts, visible]);

  useEffect(() => {
    if (!selectedId) return;
    void loadRequests(selectedId);
  }, [loadRequests, selectedId]);

  async function refresh() {
    setRefreshing(true);
    await loadCourts(true);
    if (selectedId) await loadRequests(selectedId, true);
  }

  async function respond(request: OpenCourtRequest, accept: boolean) {
    if (busyRequest) return;
    setBusyRequest(request.join_request_id);
    setMessage('');
    const { error } = await supabase.rpc('admin_respond_open_court_request', {
      p_accept: accept,
      p_join_request_id: request.join_request_id,
    });
    if (error) {
      setMessage(errorMessage(error, 'The join request could not be updated.'));
    } else {
      setMessage(accept ? 'Player added to this Open Court.' : 'Join request declined.');
      await Promise.all([loadCourts(true), selectedId ? loadRequests(selectedId, true) : Promise.resolve()]);
    }
    setBusyRequest('');
  }

  function decline(request: OpenCourtRequest) {
    Alert.alert(
      'Decline join request',
      `Decline ${displayName(request.player_full_name, request.player_username)}’s request?`,
      [
        { text: 'Keep pending', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => void respond(request, false) },
      ],
    );
  }

  function remove(request: OpenCourtRequest) {
    Alert.alert(
      'Remove player',
      `Remove ${displayName(request.player_full_name, request.player_username)} from this Open Court? The player will be notified.`,
      [
        { text: 'Keep player', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void removeConfirmed(request),
        },
      ],
    );
  }

  async function removeConfirmed(request: OpenCourtRequest) {
    if (busyRequest) return;
    setBusyRequest(request.join_request_id);
    setMessage('');
    const { error } = await supabase.rpc('admin_remove_open_court_participant', {
      p_join_request_id: request.join_request_id,
    });
    if (error) {
      setMessage(errorMessage(error, 'The player could not be removed.'));
    } else {
      setMessage('Player removed from this Open Court.');
      await Promise.all([loadCourts(true), selectedId ? loadRequests(selectedId, true) : Promise.resolve()]);
    }
    setBusyRequest('');
  }

  return (
    <ModalShell onClose={onClose} title={selected ? 'Open Court roster' : 'Open Courts'} visible={visible}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl onRefresh={() => void refresh()} refreshing={refreshing} tintColor={colors.accent} />}>
        {selected ? (
          <CourtDetail
            busyRequest={busyRequest}
            court={selected}
            loading={requestsLoading}
            onAccept={(request) => void respond(request, true)}
            onBack={() => {
              setSelectedId(null);
              setRequests([]);
              setMessage('');
            }}
            onDecline={decline}
            onRemove={remove}
            requests={requests}
            timeZone={timeZone}
          />
        ) : (
          <CourtList courts={courts} loading={loading} onSelect={setSelectedId} timeZone={timeZone} />
        )}
        {message ? <Notice>{message}</Notice> : null}
      </ScrollView>
    </ModalShell>
  );
}

function CourtList({
  courts,
  loading,
  onSelect,
  timeZone,
}: {
  courts: OpenCourt[];
  loading: boolean;
  onSelect: (id: string) => void;
  timeZone: string;
}) {
  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.muted}>Loading upcoming Open Courts…</Text></View>;
  }

  return (
    <View style={styles.stack}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Live roster management</Text>
        <Text style={styles.title}>Upcoming Open Courts</Text>
        <Text style={styles.intro}>Review every public match, its four-player capacity, and requests waiting for a decision.</Text>
      </View>
      {!courts.length ? (
        <EmptyState icon="people-circle-outline" text="New confirmed Open Courts will appear here automatically." title="No upcoming Open Courts" />
      ) : courts.map((court) => (
        <Pressable key={court.reservation_id} onPress={() => onSelect(court.reservation_id)} style={({ pressed }) => [styles.courtCard, pressed && styles.pressed]}>
          <View style={styles.rowBetween}>
            <View style={styles.cardHeading}>
              <Text style={styles.cardTitle}>{displayName(court.host_full_name, court.host_username)}</Text>
              <Text style={styles.muted}>@{court.host_username}</Text>
            </View>
            <Ionicons color={colors.accent} name="chevron-forward" size={21} />
          </View>
          <Text style={styles.date}>{formatDateTime(court.start_at, timeZone)}</Text>
          <CapacityLedger court={court} />
          <View style={styles.chipRow}>
            <StatusChip emphasized>{court.occupied_spots}/4 occupied</StatusChip>
            <StatusChip>{court.accepted_count} registered</StatusChip>
            <StatusChip>{Math.max(court.initial_player_count - 1, 0)} guest spots</StatusChip>
            {court.pending_count ? <StatusChip emphasized>{court.pending_count} pending</StatusChip> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function CapacityLedger({ court, accepted = [] }: { court: OpenCourt; accepted?: OpenCourtRequest[] }) {
  const labels = [
    'Host',
    ...Array.from({ length: Math.max(court.initial_player_count - 1, 0) }, (_, index) => `Guest ${index + 1}`),
    ...accepted.map((request) => request.player_full_name?.split(' ')[0] || `@${request.player_username}`),
  ];

  return (
    <View accessibilityLabel={`${court.occupied_spots} of 4 Open Court spots occupied`} style={styles.ledger}>
      {Array.from({ length: 4 }, (_, index) => {
        const occupied = index < court.occupied_spots;
        return (
          <View key={index} style={[styles.spot, occupied && styles.spotOccupied]}>
            <Ionicons color={occupied ? colors.onAccent : colors.accent} name={occupied ? 'person' : 'add'} size={15} />
            <Text numberOfLines={1} style={[styles.spotLabel, occupied && styles.spotLabelOccupied]}>{labels[index] || 'Open'}</Text>
          </View>
        );
      })}
    </View>
  );
}

function CourtDetail({
  busyRequest,
  court,
  loading,
  onAccept,
  onBack,
  onDecline,
  onRemove,
  requests,
  timeZone,
}: {
  busyRequest: string;
  court: OpenCourt;
  loading: boolean;
  onAccept: (request: OpenCourtRequest) => void;
  onBack: () => void;
  onDecline: (request: OpenCourtRequest) => void;
  onRemove: (request: OpenCourtRequest) => void;
  requests: OpenCourtRequest[];
  timeZone: string;
}) {
  const pending = requests.filter((request) => request.request_status === 'pending');
  const accepted = requests.filter((request) => request.request_status === 'accepted');

  return (
    <View style={styles.stack}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Ionicons color={colors.accent} name="arrow-back" size={18} />
        <Text style={styles.backText}>All Open Courts</Text>
      </Pressable>

      <View style={styles.detailHero}>
        <Text style={styles.eyebrow}>Confirmed Open Court</Text>
        <Text style={styles.detailTime}>{formatTimeRange(court.start_at, court.end_at, timeZone)}</Text>
        <Text style={styles.date}>{formatDateTime(court.start_at, timeZone)}</Text>
        <CapacityLedger accepted={accepted} court={court} />
      </View>

      <View style={styles.infoGrid}>
        <Info label="Host" value={displayName(court.host_full_name, court.host_username)} />
        <Info label="Username" value={`@${court.host_username}`} />
        <Info label="Email" value={court.host_email} />
        <Info label="Phone" value={court.host_phone_number || 'Not provided'} />
        <Info label="Unregistered guests" value={String(Math.max(court.initial_player_count - 1, 0))} />
        <Info label="Payment" value={`${court.payment_status} · $${Number(court.price).toFixed(2)}`} />
        <Info label="Receipt code" value={court.pass_code} />
        <Info label="Available spots" value={String(court.available_spots)} />
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.muted}>Loading roster…</Text></View>
      ) : (
        <>
          <RosterSection
            busyRequest={busyRequest}
            courtFull={court.available_spots === 0}
            empty="No players are waiting for a decision."
            onAccept={onAccept}
            onDecline={onDecline}
            requests={pending}
            title={`Pending requests · ${pending.length}`}
          />
          <RosterSection
            busyRequest={busyRequest}
            empty="No registered players have joined yet."
            onRemove={onRemove}
            requests={accepted}
            title={`Registered players · ${accepted.length}`}
          />
        </>
      )}
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text selectable style={styles.infoValue}>{value}</Text></View>;
}

function RosterSection({
  busyRequest,
  courtFull = false,
  empty,
  onAccept,
  onDecline,
  onRemove,
  requests,
  title,
}: {
  busyRequest: string;
  courtFull?: boolean;
  empty: string;
  onAccept?: (request: OpenCourtRequest) => void;
  onDecline?: (request: OpenCourtRequest) => void;
  onRemove?: (request: OpenCourtRequest) => void;
  requests: OpenCourtRequest[];
  title: string;
}) {
  return (
    <View style={styles.rosterSection}>
      <Text style={styles.rosterTitle}>{title}</Text>
      {!requests.length ? <Text style={styles.emptyCopy}>{empty}</Text> : requests.map((request) => {
        const busy = busyRequest === request.join_request_id;
        return (
          <View key={request.join_request_id} style={styles.playerCard}>
            <View style={styles.rowBetween}>
              <View style={styles.playerCopy}>
                <Text style={styles.playerName}>{displayName(request.player_full_name, request.player_username)}</Text>
                <Text style={styles.muted}>@{request.player_username}</Text>
              </View>
              <StatusChip emphasized={request.request_status === 'pending'}>{request.request_status}</StatusChip>
            </View>
            <Text selectable style={styles.contact}>{request.player_email}</Text>
            <Text selectable style={styles.contact}>{request.player_phone_number || 'No phone number'}</Text>
            {onAccept && onDecline ? (
              <View style={styles.actions}>
                <View style={styles.action}><ActionButton disabled={busy || courtFull} icon="checkmark" onPress={() => onAccept(request)}>Accept</ActionButton></View>
                <View style={styles.action}><ActionButton disabled={busy} icon="close" onPress={() => onDecline(request)} variant="secondary">Decline</ActionButton></View>
              </View>
            ) : null}
            {onRemove ? <ActionButton disabled={busy} icon="person-remove-outline" onPress={() => onRemove(request)} variant="secondary">Remove player</ActionButton> : null}
            {busy ? <ActivityIndicator color={colors.accent} /> : null}
            {courtFull && request.request_status === 'pending' ? <Text style={styles.fullNote}>This court is full. Remove a player before accepting another request.</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', padding: layout.gutter, paddingBottom: 52 },
  stack: { gap: 18 },
  heading: { gap: 7, marginBottom: 4 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.25, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 29, lineHeight: 32, fontWeight: '900', letterSpacing: -1 },
  intro: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  courtCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 13 },
  pressed: { opacity: 0.68 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardHeading: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  date: { color: colors.text, fontSize: 15, fontWeight: '700' },
  ledger: { flexDirection: 'row', gap: 6 },
  spot: { flex: 1, minWidth: 0, minHeight: 54, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 3 },
  spotOccupied: { backgroundColor: colors.accent },
  spotLabel: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  spotLabelOccupied: { color: colors.onAccent },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40 },
  backText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  detailHero: { backgroundColor: colors.paleAccent, borderTopWidth: 3, borderTopColor: colors.accent, padding: 18, gap: 10 },
  detailTime: { color: colors.accent, fontSize: 35, lineHeight: 38, fontWeight: '900', letterSpacing: -1.3 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.border },
  info: { width: '50%', minHeight: 78, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border, padding: 11, gap: 5, backgroundColor: colors.surface },
  infoLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  infoValue: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  rosterSection: { gap: 10, borderTopWidth: 1, borderTopColor: colors.text, paddingTop: 13 },
  rosterTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  emptyCopy: { color: colors.muted, fontSize: 14, lineHeight: 20, paddingVertical: 10 },
  playerCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 9 },
  playerCopy: { flex: 1 },
  playerName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  contact: { color: colors.text, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  fullNote: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
