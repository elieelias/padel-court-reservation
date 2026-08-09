import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ActionButton,
  EmptyState,
  Field,
  IconButton,
  LoadingBlock,
  ModalShell,
  Notice,
  Segmented,
  StatusChip,
} from '@/components/admin-ui';
import { colors, layout } from '@/constants/admin-theme';
import {
  dateKeyDayOfWeek,
  dayBounds,
  formatDateTime,
  formatDayHeading,
  formatTime,
  formatTimeRange,
  inputDate,
  inputTime,
  isDateKey,
  isTime,
  shiftDateKey,
  todayKey,
  zonedDateTimeToIso,
} from '@/lib/date';
import type { Database, Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type Reservation = Tables<'reservations'>;
type BlockedPeriod = Tables<'blocked_periods'>;
type ScheduleRule = Tables<'schedule_rules'>;
type FacilitySettings = Tables<'facility_settings'>;
type Player = Database['public']['Functions']['admin_list_players']['Returns'][number];
type TabName = 'schedule' | 'reservations' | 'blocked' | 'players';

const tabs: { icon: keyof typeof Ionicons.glyphMap; label: string; value: TabName }[] = [
  { icon: 'calendar-outline', label: 'Schedule', value: 'schedule' },
  { icon: 'receipt-outline', label: 'Bookings', value: 'reservations' },
  { icon: 'ban-outline', label: 'Blocked', value: 'blocked' },
  { icon: 'people-outline', label: 'Players', value: 'players' },
];

function errorText(error: { message?: string } | null, fallback: string) {
  if (!error?.message) return fallback;
  if (error.message.includes('reservations_no_active_overlap')) return 'That time overlaps an active reservation.';
  if (error.message.includes('blocked_periods_no_overlap')) return 'That time overlaps another blocked period.';
  return error.message;
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function playerLabel(player: Player | undefined) {
  return player?.full_name || player?.email || 'Player account';
}

export function AdminDashboard({ administratorName }: { administratorName: string | null }) {
  const [activeTab, setActiveTab] = useState<TabName>('schedule');
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([]);
  const [scheduleRules, setScheduleRules] = useState<ScheduleRule[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [settings, setSettings] = useState<FacilitySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const timeZone = settings?.timezone || 'Asia/Beirut';
  const dateHeading = formatDayHeading(selectedDate);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setMessage('');
    const bounds = dayBounds(selectedDate, timeZone);
    const [settingsResult, scheduleResult, reservationsResult, blocksResult, playersResult] = await Promise.all([
      supabase.from('facility_settings').select('*').eq('id', 1).single(),
      supabase.from('schedule_rules').select('*').order('day_of_week'),
      supabase.from('reservations').select('*').gte('start_at', bounds.start).lt('start_at', bounds.end).order('start_at'),
      supabase.from('blocked_periods').select('*').order('start_at', { ascending: false }).limit(200),
      supabase.rpc('admin_list_players'),
    ]);

    const firstError = settingsResult.error || scheduleResult.error || reservationsResult.error || blocksResult.error || playersResult.error;
    if (firstError) {
      setMessage(errorText(firstError, 'Administrator data could not be loaded.'));
    } else {
      setSettings(settingsResult.data);
      setScheduleRules(scheduleResult.data ?? []);
      setReservations(reservationsResult.data ?? []);
      setBlockedPeriods(blocksResult.data ?? []);
      setPlayers(playersResult.data ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [selectedDate, timeZone]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedBlocks = useMemo(() => {
    const bounds = dayBounds(selectedDate, timeZone);
    return blockedPeriods
      .filter((period) => period.start_at < bounds.end && period.end_at > bounds.start)
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
  }, [blockedPeriods, selectedDate, timeZone]);

  const unpaidCount = reservations.filter((reservation) => reservation.payment_status === 'unpaid' && !['cancelled', 'expired'].includes(reservation.status)).length;
  const scheduleRule = scheduleRules.find((rule) => rule.day_of_week === dateKeyDayOfWeek(selectedDate));

  async function refresh() {
    setRefreshing(true);
    await loadData(true);
  }

  async function runAction(key: string, action: () => Promise<{ error: { message?: string } | null }>, success: string) {
    if (busyAction) return false;
    setBusyAction(key);
    setMessage('');
    const { error } = await action();
    if (error) {
      setMessage(errorText(error, 'The action could not be completed.'));
      setBusyAction('');
      return false;
    }
    setMessage(success);
    setBusyAction('');
    await loadData(true);
    return true;
  }

  function confirmPayment(reservation: Reservation) {
    Alert.alert('Confirm cash payment', 'Record this cash payment as received now?', [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Confirm payment',
        onPress: () => void runAction(
          `payment-${reservation.id}`,
          async () => {
            const { error } = await supabase.rpc('admin_confirm_cash_payment', { p_reservation_id: reservation.id });
            return { error };
          },
          'Cash payment recorded.',
        ).then((success) => {
          if (success) setSelectedReservation(null);
        }),
      },
    ]);
  }

  function cancelReservation(reservation: Reservation) {
    Alert.alert('Cancel reservation', 'Cancel this reservation? Players will receive a cancellation notification.', [
      { text: 'Keep reservation', style: 'cancel' },
      {
        text: 'Cancel reservation',
        style: 'destructive',
        onPress: () => void runAction(
          `cancel-${reservation.id}`,
          async () => {
            const { error } = await supabase.rpc('admin_cancel_reservation', { p_reservation_id: reservation.id });
            return { error };
          },
          'Reservation cancelled.',
        ).then((success) => {
          if (success) setSelectedReservation(null);
        }),
      },
    ]);
  }

  async function saveReservation(values: ReservationEditValues) {
    const { error } = await supabase.rpc('admin_update_reservation', {
      p_reservation_id: values.id,
      p_start_at: zonedDateTimeToIso(values.date, values.startTime, timeZone),
      p_end_at: zonedDateTimeToIso(values.date, values.endTime, timeZone),
      p_type: values.type,
      p_status: values.status,
      p_price: Number(values.price),
      p_initial_player_count: values.type === 'private' ? 1 : Number(values.playerCount),
    });
    if (error) return errorText(error, 'The reservation could not be updated.');
    setEditingReservation(null);
    setSelectedReservation(null);
    setMessage('Reservation updated.');
    setSelectedDate(values.date);
    await loadData(true);
    return '';
  }

  async function createBlockedPeriod(values: BlockedPeriodValues) {
    return runAction(
      'create-block',
      async () => {
        const { error } = await supabase.from('blocked_periods').insert({
          start_at: zonedDateTimeToIso(values.date, values.startTime, timeZone),
          end_at: zonedDateTimeToIso(values.date, values.endTime, timeZone),
          reason: values.reason.trim() || null,
        });
        return { error };
      },
      'Blocked period created.',
    );
  }

  function deleteBlockedPeriod(period: BlockedPeriod) {
    Alert.alert('Remove blocked period', 'Make this time available for reservations again?', [
      { text: 'Keep blocked', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void runAction(
          `delete-block-${period.id}`,
          async () => {
            const { error } = await supabase.from('blocked_periods').delete().eq('id', period.id);
            return { error };
          },
          'Blocked period removed.',
        ),
      },
    ]);
  }

  async function savePlayer(values: PlayerEditValues) {
    const { error } = await supabase.rpc('admin_update_player_profile', {
      p_player_id: values.id,
      p_full_name: values.fullName,
      p_phone_number: values.phoneNumber,
    });
    if (error) return errorText(error, 'The player account could not be updated.');
    setEditingPlayer(null);
    setMessage('Player account updated.');
    await loadData(true);
    return '';
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl onRefresh={() => void refresh()} refreshing={refreshing} tintColor={colors.accent} />}>
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.productName}>{settings?.facility_name || 'Padel Court'}</Text>
            <Text style={styles.adminName}>{administratorName || 'Administrator'}</Text>
          </View>
          <IconButton accessibilityLabel="Sign out" icon="log-out-outline" onPress={() => void signOut()} />
        </View>

        <View style={styles.dateHero}>
          <Text style={styles.dateNumeral}>{dateHeading.numeral}</Text>
          <View style={styles.dateCopy}>
            <Text style={styles.dateWeekday}>{dateHeading.weekday}</Text>
            <Text style={styles.dateMonth}>{dateHeading.monthYear}</Text>
          </View>
        </View>

        <View style={styles.dayControls}>
          <IconButton accessibilityLabel="Previous day" icon="chevron-back" onPress={() => setSelectedDate((value) => shiftDateKey(value, -1))} />
          <ActionButton onPress={() => setSelectedDate(todayKey(timeZone))} variant="quiet">Today</ActionButton>
          <IconButton accessibilityLabel="Next day" icon="chevron-forward" onPress={() => setSelectedDate((value) => shiftDateKey(value, 1))} />
        </View>

        <View style={styles.statsGrid}>
          <Stat label="Reservations" value={String(reservations.length)} />
          <Stat label="Unpaid" value={String(unpaidCount)} />
          <Stat label="Blocked" value={String(selectedBlocks.length)} />
        </View>

        {message ? <Notice>{message}</Notice> : null}
        {loading ? <LoadingBlock label="Loading the daily court schedule…" /> : (
          <View style={styles.sectionBody}>
            {activeTab === 'schedule' ? (
              <SchedulePanel
                blocks={selectedBlocks}
                dateLabel={dateHeading.long}
                onSelectReservation={setSelectedReservation}
                playerById={playerById}
                reservations={reservations}
                rule={scheduleRule}
                timeZone={timeZone}
              />
            ) : null}
            {activeTab === 'reservations' ? (
              <ReservationsPanel
                onSelect={setSelectedReservation}
                playerById={playerById}
                reservations={reservations}
                timeZone={timeZone}
              />
            ) : null}
            {activeTab === 'blocked' ? (
              <BlockedPeriodsPanel
                busy={busyAction}
                defaultDate={selectedDate}
                onCreate={createBlockedPeriod}
                onDelete={deleteBlockedPeriod}
                periods={blockedPeriods}
                timeZone={timeZone}
              />
            ) : null}
            {activeTab === 'players' ? (
              <PlayersPanel onEdit={setEditingPlayer} players={players} />
            ) : null}
          </View>
        )}
      </ScrollView>

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const selected = tab.value === activeTab;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab.value}
              onPress={() => setActiveTab(tab.value)}
              style={[styles.tab, selected && styles.tabSelected]}>
              <Ionicons color={selected ? colors.white : colors.accent} name={tab.icon} size={20} />
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ReservationDetailsModal
        busy={busyAction}
        onCancel={cancelReservation}
        onClose={() => setSelectedReservation(null)}
        onConfirmPayment={confirmPayment}
        onEdit={(reservation) => {
          setSelectedReservation(null);
          setEditingReservation(reservation);
        }}
        player={selectedReservation ? playerById.get(selectedReservation.host_id) : undefined}
        reservation={selectedReservation}
        timeZone={timeZone}
      />
      <ReservationEditModal
        onClose={() => setEditingReservation(null)}
        onSave={saveReservation}
        reservation={editingReservation}
        timeZone={timeZone}
      />
      <PlayerEditModal onClose={() => setEditingPlayer(null)} onSave={savePlayer} player={editingPlayer} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function SchedulePanel({
  blocks,
  dateLabel,
  onSelectReservation,
  playerById,
  reservations,
  rule,
  timeZone,
}: {
  blocks: BlockedPeriod[];
  dateLabel: string;
  onSelectReservation: (reservation: Reservation) => void;
  playerById: Map<string, Player>;
  reservations: Reservation[];
  rule?: ScheduleRule;
  timeZone: string;
}) {
  const events = [
    ...reservations.map((reservation) => ({ id: reservation.id, kind: 'reservation' as const, startAt: reservation.start_at, reservation })),
    ...blocks.map((period) => ({ id: period.id, kind: 'blocked' as const, startAt: period.start_at, period })),
  ].sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <View style={styles.panelStack}>
      <SectionHeading eyebrow="Daily court schedule" title={dateLabel} />
      <View style={styles.openHours}>
        <Text style={styles.openHoursLabel}>{rule?.is_open ? 'Open hours' : 'Court closed'}</Text>
        <Text style={styles.openHoursValue}>
          {rule?.is_open && rule.opening_time && rule.closing_time
            ? `${rule.opening_time.slice(0, 5)}–${rule.closing_time.slice(0, 5)} · ${rule.slot_duration_minutes}-minute slots`
            : 'No regular schedule'}
        </Text>
      </View>
      {!events.length ? (
        <EmptyState icon="calendar-clear-outline" text="The court has no reservations or blocked periods on this date." title="Schedule is clear" />
      ) : (
        <View style={styles.timeline}>
          {events.map((event) => event.kind === 'reservation' ? (
            <Pressable key={`reservation-${event.id}`} onPress={() => onSelectReservation(event.reservation)} style={styles.timelineRow}>
              <View style={styles.timelineTime}>
                <Text style={styles.timelineStart}>{formatTime(event.reservation.start_at, timeZone)}</Text>
                <Text style={styles.timelineEnd}>{formatTime(event.reservation.end_at, timeZone)}</Text>
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{playerLabel(playerById.get(event.reservation.host_id))}</Text>
                  <Ionicons color={colors.accent} name="chevron-forward" size={18} />
                </View>
                <Text style={styles.cardMeta}>{titleCase(event.reservation.type)} · {titleCase(event.reservation.status)}</Text>
              </View>
            </Pressable>
          ) : (
            <View key={`blocked-${event.id}`} style={styles.timelineRow}>
              <View style={styles.timelineTime}>
                <Text style={styles.timelineStart}>{formatTime(event.period.start_at, timeZone)}</Text>
                <Text style={styles.timelineEnd}>{formatTime(event.period.end_at, timeZone)}</Text>
              </View>
              <View style={[styles.timelineContent, styles.blockedContent]}>
                <Text style={styles.cardTitle}>Blocked period</Text>
                <Text style={styles.cardMeta}>{event.period.reason || 'No reason added'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ReservationsPanel({
  onSelect,
  playerById,
  reservations,
  timeZone,
}: {
  onSelect: (reservation: Reservation) => void;
  playerById: Map<string, Player>;
  reservations: Reservation[];
  timeZone: string;
}) {
  return (
    <View style={styles.panelStack}>
      <SectionHeading eyebrow="By date and time" title="Reservations" />
      {!reservations.length ? (
        <EmptyState icon="receipt-outline" text="Reservations created through the player website will appear here." title="No reservations on this date" />
      ) : reservations.map((reservation) => (
        <Pressable key={reservation.id} onPress={() => onSelect(reservation)} style={styles.reservationCard}>
          <View style={styles.reservationTimeColumn}>
            <Text style={styles.reservationTime}>{formatTime(reservation.start_at, timeZone)}</Text>
            <Text style={styles.reservationEnd}>{formatTime(reservation.end_at, timeZone)}</Text>
          </View>
          <View style={styles.reservationCardBody}>
            <View style={styles.rowBetween}>
              <Text numberOfLines={1} style={styles.cardTitle}>{playerLabel(playerById.get(reservation.host_id))}</Text>
              <Ionicons color={colors.accent} name="chevron-forward" size={18} />
            </View>
            <View style={styles.chipRow}>
              <StatusChip emphasized={reservation.status === 'confirmed'}>{reservation.status}</StatusChip>
              <StatusChip emphasized={reservation.payment_status === 'unpaid'}>Cash {reservation.payment_status}</StatusChip>
            </View>
            <Text style={styles.cardMeta}>{titleCase(reservation.type)} · {Number(reservation.price).toFixed(2)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function ReservationDetailsModal({
  busy,
  onCancel,
  onClose,
  onConfirmPayment,
  onEdit,
  player,
  reservation,
  timeZone,
}: {
  busy: string;
  onCancel: (reservation: Reservation) => void;
  onClose: () => void;
  onConfirmPayment: (reservation: Reservation) => void;
  onEdit: (reservation: Reservation) => void;
  player?: Player;
  reservation: Reservation | null;
  timeZone: string;
}) {
  if (!reservation) return null;
  const active = ['pending', 'confirmed'].includes(reservation.status);
  const payable = !['cancelled', 'expired'].includes(reservation.status) && reservation.payment_status === 'unpaid';

  return (
    <ModalShell onClose={onClose} title="Reservation details" visible>
      <ScrollView contentContainerStyle={styles.modalScroll}>
        <Text style={styles.detailTime}>{formatTimeRange(reservation.start_at, reservation.end_at, timeZone)}</Text>
        <Text style={styles.detailDate}>{formatDateTime(reservation.start_at, timeZone)}</Text>
        <View style={styles.chipRow}>
          <StatusChip emphasized={reservation.status === 'confirmed'}>{reservation.status}</StatusChip>
          <StatusChip emphasized={reservation.payment_status === 'unpaid'}>Cash {reservation.payment_status}</StatusChip>
        </View>

        <DetailGroup title="Player">
          <DetailRow label="Name" value={playerLabel(player)} />
          <DetailRow label="Phone" value={player?.phone_number || 'Not added'} />
          <DetailRow label="Email" value={player?.email || 'Not available'} />
        </DetailGroup>
        <DetailGroup title="Reservation">
          <DetailRow label="Type" value={titleCase(reservation.type)} />
          <DetailRow label="Price" value={Number(reservation.price).toFixed(2)} />
          <DetailRow label="Players" value={String(reservation.initial_player_count)} />
          <DetailRow label="Created" value={formatDateTime(reservation.created_at, timeZone)} />
          {reservation.cancelled_at ? <DetailRow label="Cancelled" value={formatDateTime(reservation.cancelled_at, timeZone)} /> : null}
        </DetailGroup>
        <DetailGroup title="Cash payment">
          <DetailRow label="Status" value={titleCase(reservation.payment_status)} />
          <DetailRow label="Confirmed" value={reservation.payment_confirmed_at ? formatDateTime(reservation.payment_confirmed_at, timeZone) : 'Not received'} />
        </DetailGroup>

        <View style={styles.actionStack}>
          {active ? <ActionButton icon="create-outline" onPress={() => onEdit(reservation)} variant="secondary">Edit reservation</ActionButton> : null}
          {payable ? (
            <ActionButton disabled={Boolean(busy)} icon="cash-outline" onPress={() => onConfirmPayment(reservation)}>
              {busy === `payment-${reservation.id}` ? 'Recording…' : 'Mark cash as received'}
            </ActionButton>
          ) : null}
          {active ? (
            <ActionButton disabled={Boolean(busy)} icon="close-circle-outline" onPress={() => onCancel(reservation)} variant="quiet">
              {busy === `cancel-${reservation.id}` ? 'Cancelling…' : 'Cancel reservation'}
            </ActionButton>
          ) : null}
        </View>
      </ScrollView>
    </ModalShell>
  );
}

function DetailGroup({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.detailGroup}>
      <Text style={styles.detailGroupTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>{value}</Text>
    </View>
  );
}

type ReservationEditValues = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'private' | 'open';
  status: 'pending' | 'confirmed' | 'completed';
  price: string;
  playerCount: string;
};

function ReservationEditModal({
  onClose,
  onSave,
  reservation,
  timeZone,
}: {
  onClose: () => void;
  onSave: (values: ReservationEditValues) => Promise<string>;
  reservation: Reservation | null;
  timeZone: string;
}) {
  const [values, setValues] = useState<ReservationEditValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reservation) {
      setValues(null);
      return;
    }
    setValues({
      id: reservation.id,
      date: inputDate(reservation.start_at, timeZone),
      startTime: inputTime(reservation.start_at, timeZone),
      endTime: inputTime(reservation.end_at, timeZone),
      type: reservation.type,
      status: ['pending', 'confirmed', 'completed'].includes(reservation.status) ? reservation.status as ReservationEditValues['status'] : 'confirmed',
      price: String(reservation.price),
      playerCount: String(reservation.initial_player_count),
    });
    setError('');
  }, [reservation, timeZone]);

  if (!reservation || !values) return null;

  function update<K extends keyof ReservationEditValues>(key: K, value: ReservationEditValues[K]) {
    setValues((current) => current ? { ...current, [key]: value } : current);
  }

  async function submit() {
    const currentValues = values;
    if (!currentValues) return;
    if (!isDateKey(currentValues.date) || !isTime(currentValues.startTime) || !isTime(currentValues.endTime)) {
      setError('Use YYYY-MM-DD for the date and HH:MM for each time.');
      return;
    }
    const start = zonedDateTimeToIso(currentValues.date, currentValues.startTime, timeZone);
    const end = zonedDateTimeToIso(currentValues.date, currentValues.endTime, timeZone);
    if (end <= start) {
      setError('End time must be after start time.');
      return;
    }
    if (!Number.isFinite(Number(currentValues.price)) || Number(currentValues.price) < 0) {
      setError('Enter a valid non-negative price.');
      return;
    }
    if (currentValues.type === 'open' && (!Number.isInteger(Number(currentValues.playerCount)) || Number(currentValues.playerCount) < 1 || Number(currentValues.playerCount) > 4)) {
      setError('Open Court player count must be between 1 and 4.');
      return;
    }

    setSaving(true);
    setError('');
    const nextError = await onSave(currentValues);
    setError(nextError);
    setSaving(false);
  }

  return (
    <ModalShell onClose={onClose} title="Edit reservation" visible>
      <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
        <Field autoCapitalize="none" label="Date (YYYY-MM-DD)" onChangeText={(value) => update('date', value)} value={values.date} />
        <View style={styles.twoColumn}>
          <View style={styles.flexField}><Field autoCapitalize="none" label="Start (HH:MM)" onChangeText={(value) => update('startTime', value)} value={values.startTime} /></View>
          <View style={styles.flexField}><Field autoCapitalize="none" label="End (HH:MM)" onChangeText={(value) => update('endTime', value)} value={values.endTime} /></View>
        </View>
        <Segmented label="Type" onChange={(value) => update('type', value)} options={[{ label: 'Private', value: 'private' }, { label: 'Open Court', value: 'open' }]} value={values.type} />
        <Segmented label="Status" onChange={(value) => update('status', value)} options={[{ label: 'Pending', value: 'pending' }, { label: 'Confirmed', value: 'confirmed' }, { label: 'Completed', value: 'completed' }]} value={values.status} />
        <Field keyboardType="decimal-pad" label="Price" onChangeText={(value) => update('price', value)} value={values.price} />
        {values.type === 'open' ? <Field keyboardType="number-pad" label="Players already included" onChangeText={(value) => update('playerCount', value)} value={values.playerCount} /> : null}
        {error ? <Notice>{error}</Notice> : null}
        <ActionButton disabled={saving} icon="save-outline" onPress={() => void submit()}>{saving ? 'Saving…' : 'Save reservation'}</ActionButton>
      </ScrollView>
    </ModalShell>
  );
}

type BlockedPeriodValues = { date: string; startTime: string; endTime: string; reason: string };

function BlockedPeriodsPanel({
  busy,
  defaultDate,
  onCreate,
  onDelete,
  periods,
  timeZone,
}: {
  busy: string;
  defaultDate: string;
  onCreate: (values: BlockedPeriodValues) => Promise<boolean>;
  onDelete: (period: BlockedPeriod) => void;
  periods: BlockedPeriod[];
  timeZone: string;
}) {
  const [values, setValues] = useState<BlockedPeriodValues>({ date: defaultDate, startTime: '16:00', endTime: '17:00', reason: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    setValues((current) => ({ ...current, date: defaultDate }));
  }, [defaultDate]);

  async function submit() {
    if (!isDateKey(values.date) || !isTime(values.startTime) || !isTime(values.endTime)) {
      setError('Use YYYY-MM-DD for the date and HH:MM for each time.');
      return;
    }
    if (zonedDateTimeToIso(values.date, values.endTime, timeZone) <= zonedDateTimeToIso(values.date, values.startTime, timeZone)) {
      setError('End time must be after start time.');
      return;
    }
    setError('');
    const success = await onCreate(values);
    if (success) setValues((current) => ({ ...current, reason: '' }));
  }

  return (
    <View style={styles.panelStack}>
      <SectionHeading eyebrow="Court availability" title="Blocked periods" />
      <View style={styles.formCard}>
        <Text style={styles.formCardTitle}>Create blocked period</Text>
        <Field autoCapitalize="none" label="Date (YYYY-MM-DD)" onChangeText={(date) => setValues((current) => ({ ...current, date }))} value={values.date} />
        <View style={styles.twoColumn}>
          <View style={styles.flexField}><Field autoCapitalize="none" label="Start (HH:MM)" onChangeText={(startTime) => setValues((current) => ({ ...current, startTime }))} value={values.startTime} /></View>
          <View style={styles.flexField}><Field autoCapitalize="none" label="End (HH:MM)" onChangeText={(endTime) => setValues((current) => ({ ...current, endTime }))} value={values.endTime} /></View>
        </View>
        <Field label="Reason (optional)" maxLength={300} multiline onChangeText={(reason) => setValues((current) => ({ ...current, reason }))} value={values.reason} />
        {error ? <Notice>{error}</Notice> : null}
        <ActionButton disabled={Boolean(busy)} icon="add-outline" onPress={() => void submit()}>{busy === 'create-block' ? 'Creating…' : 'Block this period'}</ActionButton>
      </View>

      <Text style={styles.listTitle}>Recent blocked periods</Text>
      {!periods.length ? <EmptyState icon="ban-outline" text="Blocked periods created here will also remove those times from player availability." title="No blocked periods" /> : periods.map((period) => (
        <View key={period.id} style={styles.blockCard}>
          <View style={styles.flexField}>
            <Text style={styles.cardTitle}>{formatDateTime(period.start_at, timeZone)}</Text>
            <Text style={styles.cardMeta}>{formatTimeRange(period.start_at, period.end_at, timeZone)} · {period.reason || 'No reason added'}</Text>
          </View>
          <IconButton accessibilityLabel="Remove blocked period" disabled={Boolean(busy)} icon="trash-outline" onPress={() => onDelete(period)} />
        </View>
      ))}
    </View>
  );
}

function PlayersPanel({ onEdit, players }: { onEdit: (player: Player) => void; players: Player[] }) {
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLowerCase();
  const visiblePlayers = players.filter((player) => !normalizedSearch || [player.full_name, player.email, player.phone_number].some((value) => value?.toLowerCase().includes(normalizedSearch)));

  return (
    <View style={styles.panelStack}>
      <SectionHeading eyebrow="Player accounts" title={`${players.length} ${players.length === 1 ? 'player' : 'players'}`} />
      <Field autoCapitalize="none" label="Search" onChangeText={setSearch} placeholder="Name, email, or phone" value={search} />
      {!visiblePlayers.length ? (
        <EmptyState icon="people-outline" text={players.length ? 'Try a different name, email, or phone number.' : 'Player accounts created through the website will appear here.'} title={players.length ? 'No matching players' : 'No player accounts'} />
      ) : visiblePlayers.map((player) => (
        <Pressable key={player.id} onPress={() => onEdit(player)} style={styles.playerCard}>
          <View style={styles.playerInitial}>
            <Text style={styles.playerInitialText}>{(player.full_name || player.email || 'P').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.flexField}>
            <Text style={styles.cardTitle}>{playerLabel(player)}</Text>
            <Text style={styles.cardMeta}>{player.email || 'No email available'}</Text>
            <Text style={styles.cardMeta}>{player.phone_number || 'No phone number'}</Text>
          </View>
          <Ionicons color={colors.accent} name="create-outline" size={20} />
        </Pressable>
      ))}
    </View>
  );
}

type PlayerEditValues = { id: string; fullName: string; phoneNumber: string };

function PlayerEditModal({
  onClose,
  onSave,
  player,
}: {
  onClose: () => void;
  onSave: (values: PlayerEditValues) => Promise<string>;
  player: Player | null;
}) {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFullName(player?.full_name || '');
    setPhoneNumber(player?.phone_number || '');
    setError('');
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

  return (
    <ModalShell onClose={onClose} title="Manage player" visible>
      <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
        <DetailGroup title="Account">
          <DetailRow label="Email" value={player.email || 'Not available'} />
          <DetailRow label="Created" value={formatDateTime(player.created_at)} />
          <DetailRow label="Last sign-in" value={player.last_sign_in_at ? formatDateTime(player.last_sign_in_at) : 'Not recorded'} />
        </DetailGroup>
        <Field autoComplete="name" label="Full name" maxLength={120} onChangeText={setFullName} value={fullName} />
        <Field autoComplete="tel" keyboardType="phone-pad" label="Phone number" maxLength={32} onChangeText={setPhoneNumber} value={phoneNumber} />
        {error ? <Notice>{error}</Notice> : null}
        <ActionButton disabled={saving} icon="save-outline" onPress={() => void submit()}>{saving ? 'Saving…' : 'Save player account'}</ActionButton>
      </ScrollView>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingBottom: 36,
    gap: 22,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  adminName: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 3,
  },
  dateHero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 18,
    paddingTop: 8,
  },
  dateNumeral: {
    color: colors.accent,
    fontSize: 92,
    lineHeight: 92,
    fontWeight: '900',
    letterSpacing: -5,
  },
  dateCopy: {
    paddingBottom: 10,
  },
  dateWeekday: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  dateMonth: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 3,
  },
  dayControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.text,
  },
  stat: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  statValue: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionBody: {
    minHeight: 280,
  },
  panelStack: {
    gap: 18,
  },
  sectionHeading: {
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingBottom: 14,
  },
  sectionEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 6,
  },
  openHours: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  openHoursLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  openHoursValue: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
    textAlign: 'right',
  },
  timeline: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 82,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timelineTime: {
    width: 82,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  timelineStart: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
  timelineEnd: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
    paddingLeft: 16,
  },
  blockedContent: {
    borderLeftWidth: 5,
    borderLeftColor: colors.accent,
    paddingLeft: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  reservationCard: {
    flexDirection: 'row',
    minHeight: 116,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reservationTimeColumn: {
    width: 88,
    padding: 13,
    backgroundColor: colors.paleAccent,
    borderRightWidth: 1,
    borderRightColor: colors.accent,
  },
  reservationTime: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '900',
  },
  reservationEnd: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  reservationCardBody: {
    flex: 1,
    padding: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  tabBar: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.accent,
  },
  tab: {
    flex: 1,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  tabSelected: {
    backgroundColor: colors.accent,
  },
  tabText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  tabTextSelected: {
    color: colors.white,
  },
  modalScroll: {
    paddingVertical: 22,
    paddingBottom: 48,
    gap: 18,
  },
  detailTime: {
    color: colors.accent,
    fontSize: 42,
    lineHeight: 44,
    fontWeight: '900',
    letterSpacing: -1.8,
  },
  detailDate: {
    color: colors.muted,
    fontSize: 14,
  },
  detailGroup: {
    borderTopWidth: 1,
    borderTopColor: colors.text,
  },
  detailGroupTitle: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingVertical: 11,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 12,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 13,
  },
  detailValue: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  actionStack: {
    gap: 10,
    marginTop: 4,
  },
  formScroll: {
    paddingVertical: 22,
    paddingBottom: 48,
    gap: 18,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 12,
  },
  flexField: {
    flex: 1,
  },
  formCard: {
    gap: 16,
    padding: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formCardTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  listTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingBottom: 10,
  },
  blockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playerInitial: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  playerInitialText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
  },
});
