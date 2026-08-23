import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
import { AdminAccountNotifications } from '@/components/admin-account-notifications';
import { AdministratorAccountsModal } from '@/components/administrator-accounts';
import { Text } from '@/components/branded-text';
import { OpenCourtManagementModal } from '@/components/open-court-management';
import { ReceiptScannerModal } from '@/components/receipt-scanner';
import { ReservationArchiveModal } from '@/components/reservation-archive';
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
  todayKey,
  zonedDateTimeToIso,
} from '@/lib/date';
import type { Database, Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type Reservation = Tables<'reservations'>;
type AnalyticsReservation = Pick<Reservation,
  'created_at' | 'end_at' | 'host_id' | 'initial_player_count' | 'payment_status' |
  'price' | 'start_at' | 'status' | 'type'
>;
type BlockedPeriod = Tables<'blocked_periods'>;
type ScheduleRule = Tables<'schedule_rules'>;
type FacilitySettings = Tables<'facility_settings'>;
type FacilityEvent = Tables<'facility_events'>;
type IssueReport = Tables<'player_issue_reports'>;
type ReservationParticipant = Tables<'reservation_participants'>;
type Player = Database['public']['Functions']['admin_list_players']['Returns'][number] & { username: string };
type PlayerStats = Database['public']['Functions']['admin_get_player_details']['Returns'][number];
type ParticipantDetail = { player?: Player; role: Database['public']['Enums']['participant_role'] };
type IssueReportStatus = 'open' | 'reviewing' | 'resolved';
type TabName = 'schedule' | 'blocked' | 'events' | 'reports' | 'players' | 'analytics';
type AnalyticsPeriod = 'day' | 'week' | 'month';

const tabs: { icon: keyof typeof Ionicons.glyphMap; label: string; value: TabName }[] = [
  { icon: 'calendar-outline', label: 'Schedule', value: 'schedule' },
  { icon: 'ban-outline', label: 'Blocked', value: 'blocked' },
  { icon: 'trophy-outline', label: 'Events', value: 'events' },
  { icon: 'chatbox-ellipses-outline', label: 'Reports', value: 'reports' },
  { icon: 'people-outline', label: 'Players', value: 'players' },
  { icon: 'bar-chart-outline', label: 'Analytics', value: 'analytics' },
];

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dateKeyParts(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day };
}

function dateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDaysToDateKey(dateKey: string, amount: number) {
  const { year, month, day } = dateKeyParts(dateKey);
  const value = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return dateKeyFromParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function addMonthToDateKey(dateKey: string) {
  const { year, month, day } = dateKeyParts(dateKey);
  const target = new Date(Date.UTC(year, month, 1, 12));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0, 12)).getUTCDate();
  return dateKeyFromParts(targetYear, targetMonth, Math.min(day, daysInTargetMonth));
}

function shiftMonthDateKey(dateKey: string, amount: number) {
  const { year, month, day } = dateKeyParts(dateKey);
  const target = new Date(Date.UTC(year, month - 1 + amount, 1, 12));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0, 12)).getUTCDate();
  return dateKeyFromParts(targetYear, targetMonth, Math.min(day, daysInTargetMonth));
}

function startOfWeekDateKey(dateKey: string) {
  return addDaysToDateKey(dateKey, -dateKeyDayOfWeek(dateKey));
}

function daysBetween(startDateKey: string, endDateKey: string) {
  const start = dateKeyParts(startDateKey);
  const end = dateKeyParts(endDateKey);
  return Math.round((
    Date.UTC(end.year, end.month - 1, end.day, 12)
    - Date.UTC(start.year, start.month - 1, start.day, 12)
  ) / 86_400_000);
}

function monthBounds(dateKey: string, timeZone: string) {
  const { year, month } = dateKeyParts(dateKey);
  const nextMonth = new Date(Date.UTC(year, month, 1, 12));
  return {
    start: zonedDateTimeToIso(dateKeyFromParts(year, month, 1), '00:00', timeZone),
    end: zonedDateTimeToIso(dateKeyFromParts(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 1), '00:00', timeZone),
  };
}

function analyticsPeriodStart(dateKey: string, period: AnalyticsPeriod) {
  if (period === 'day') return dateKey;
  if (period === 'week') {
    const daysSinceMonday = (dateKeyDayOfWeek(dateKey) + 6) % 7;
    return addDaysToDateKey(dateKey, -daysSinceMonday);
  }
  const { year, month } = dateKeyParts(dateKey);
  return dateKeyFromParts(year, month, 1);
}

function shiftAnalyticsPeriod(dateKey: string, period: AnalyticsPeriod, amount: number) {
  if (period === 'day') return addDaysToDateKey(dateKey, amount);
  if (period === 'week') return addDaysToDateKey(dateKey, amount * 7);
  return shiftMonthDateKey(dateKey, amount);
}

function analyticsPeriodBounds(dateKey: string, period: AnalyticsPeriod, timeZone: string) {
  const startDateKey = analyticsPeriodStart(dateKey, period);
  const endDateKey = period === 'day'
    ? addDaysToDateKey(startDateKey, 1)
    : period === 'week'
      ? addDaysToDateKey(startDateKey, 7)
      : analyticsPeriodStart(shiftMonthDateKey(startDateKey, 1), 'month');
  return {
    start: zonedDateTimeToIso(startDateKey, '00:00', timeZone),
    end: zonedDateTimeToIso(endDateKey, '00:00', timeZone),
    startDateKey,
    endDateKey,
  };
}

function analyticsPeriodLabel(dateKey: string, period: AnalyticsPeriod) {
  if (period === 'day') return formatDayHeading(dateKey).long;
  if (period === 'month') return monthLabel(dateKey);
  const start = analyticsPeriodStart(dateKey, period);
  const end = addDaysToDateKey(start, 6);
  const startParts = dateKeyParts(start);
  const endParts = dateKeyParts(end);
  const startValue = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day, 12));
  const endValue = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day, 12));
  const startLabel = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(startValue);
  const endLabel = new Intl.DateTimeFormat('en', {
    month: startParts.month === endParts.month ? undefined : 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(endValue);
  return `${startLabel}–${endLabel}`;
}

function monthLabel(dateKey: string) {
  const { year, month } = dateKeyParts(dateKey);
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

function monthDayLabel(dateKey: string) {
  const { year, month, day } = dateKeyParts(dateKey);
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function errorText(error: { message?: string } | null, fallback: string) {
  if (!error?.message) return fallback;
  if (error.message.includes('reservations_no_active_overlap')) return 'That time overlaps an active reservation.';
  if (error.message.includes('blocked_periods_no_overlap')) return 'That time overlaps another blocked period.';
  return error.message;
}

async function edgeFunctionErrorText(error: { message?: string; context?: Response } | null, fallback: string) {
  try {
    const payload = await error?.context?.json() as { error?: unknown } | undefined;
    if (typeof payload?.error === 'string' && payload.error) return payload.error;
  } catch {
    // Fall back to the client error when the response has no JSON body.
  }
  return errorText(error, fallback);
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function playerLabel(player: Player | undefined) {
  return player?.full_name || player?.username || player?.email || 'Player account';
}

export function AdminDashboard({ administratorName, isMainAdministrator }: { administratorName: string | null; isMainAdministrator: boolean }) {
  const [activeTab, setActiveTab] = useState<TabName>('schedule');
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [analyticsDate, setAnalyticsDate] = useState(() => todayKey());
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('month');
  const [analyticsReservations, setAnalyticsReservations] = useState<AnalyticsReservation[]>([]);
  const [previousAnalyticsReservations, setPreviousAnalyticsReservations] = useState<AnalyticsReservation[]>([]);
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([]);
  const [facilityEvents, setFacilityEvents] = useState<FacilityEvent[]>([]);
  const [issueReports, setIssueReports] = useState<IssueReport[]>([]);
  const [scheduleRules, setScheduleRules] = useState<ScheduleRule[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [reservationParticipants, setReservationParticipants] = useState<ReservationParticipant[]>([]);
  const [settings, setSettings] = useState<FacilitySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [editingEvent, setEditingEvent] = useState<FacilityEvent | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [archiveVisible, setArchiveVisible] = useState(false);
  const [administratorAccountsVisible, setAdministratorAccountsVisible] = useState(false);
  const [openCourtsVisible, setOpenCourtsVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);

  const timeZone = settings?.timezone || 'Asia/Beirut';
  const dateHeading = formatDayHeading(selectedDate);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setMessage('');
    const selectedMonthBounds = monthBounds(selectedDate, timeZone);
    const analyticsBounds = analyticsPeriodBounds(analyticsDate, analyticsPeriod, timeZone);
    const previousAnalyticsBounds = analyticsPeriodBounds(shiftAnalyticsPeriod(analyticsDate, analyticsPeriod, -1), analyticsPeriod, timeZone);
    const now = new Date().toISOString();
    const [settingsResult, scheduleResult, reservationsResult, analyticsResult, previousAnalyticsResult, blocksResult, eventsResult, reportsResult, playersResult, profileUsernamesResult] = await Promise.all([
      supabase.from('facility_settings').select('*').eq('id', 1).single(),
      supabase.from('schedule_rules').select('*').order('day_of_week'),
      supabase.from('reservations').select('*').gte('start_at', selectedMonthBounds.start).lt('start_at', selectedMonthBounds.end).order('start_at'),
      supabase.from('reservations').select('created_at, end_at, host_id, initial_player_count, payment_status, price, start_at, status, type').gte('start_at', analyticsBounds.start).lt('start_at', analyticsBounds.end).order('start_at'),
      supabase.from('reservations').select('created_at, end_at, host_id, initial_player_count, payment_status, price, start_at, status, type').gte('start_at', previousAnalyticsBounds.start).lt('start_at', previousAnalyticsBounds.end).order('start_at'),
      supabase.from('blocked_periods').select('*').gt('end_at', now).order('start_at').limit(200),
      supabase.from('facility_events').select('*').gt('end_at', now).order('start_at').limit(200),
      supabase.from('player_issue_reports').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.rpc('admin_list_players'),
      supabase.from('profiles').select('id, username').eq('role', 'player'),
    ]);

    const participantResult = reservationsResult.data?.length
      ? await supabase.from('reservation_participants').select('*').in('reservation_id', reservationsResult.data.map((reservation) => reservation.id))
      : { data: [] as ReservationParticipant[], error: null };
    const firstError = settingsResult.error || scheduleResult.error || reservationsResult.error || analyticsResult.error || previousAnalyticsResult.error || blocksResult.error || eventsResult.error || reportsResult.error || playersResult.error || profileUsernamesResult.error || participantResult.error;
    if (firstError) {
      setMessage(errorText(firstError, 'Administrator data could not be loaded.'));
    } else {
      setSettings(settingsResult.data);
      setScheduleRules(scheduleResult.data ?? []);
      setReservations(reservationsResult.data ?? []);
      setAnalyticsReservations(analyticsResult.data ?? []);
      setPreviousAnalyticsReservations(previousAnalyticsResult.data ?? []);
      setBlockedPeriods(blocksResult.data ?? []);
      setFacilityEvents(eventsResult.data ?? []);
      setIssueReports(reportsResult.data ?? []);
      const usernameById = new Map((profileUsernamesResult.data ?? []).map((profile) => [profile.id, profile.username]));
      setPlayers((playersResult.data ?? []).map((player) => ({ ...player, username: usernameById.get(player.id) || player.full_name || 'player' })));
      setReservationParticipants(participantResult.data ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [analyticsDate, analyticsPeriod, selectedDate, timeZone]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedReservations = useMemo(() => {
    const bounds = dayBounds(selectedDate, timeZone);
    return reservations.filter((reservation) => reservation.start_at >= bounds.start && reservation.start_at < bounds.end);
  }, [reservations, selectedDate, timeZone]);

  const selectedBlocks = useMemo(() => {
    const bounds = dayBounds(selectedDate, timeZone);
    return blockedPeriods
      .filter((period) => period.start_at < bounds.end && period.end_at > bounds.start)
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
  }, [blockedPeriods, selectedDate, timeZone]);

  const upcomingBlockedPeriods = useMemo(
    () => blockedPeriods
      .filter((period) => period.end_at > new Date().toISOString())
      .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [blockedPeriods],
  );

  const unpaidCount = selectedReservations.filter((reservation) => reservation.payment_status === 'unpaid' && !['cancelled', 'expired'].includes(reservation.status)).length;
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
    const message = 'Record this cash payment as received now?';
    const confirm = () => void runAction(
      `payment-${reservation.id}`,
      async () => {
        const { error } = await supabase.rpc('admin_confirm_cash_payment', { p_reservation_id: reservation.id });
        return { error };
      },
      'Cash payment recorded.',
    ).then((success) => {
      if (success) setSelectedReservation(null);
    });

    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Confirm cash payment\n\n${message}`)) confirm();
      return;
    }

    Alert.alert('Confirm cash payment', message, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Confirm payment',
        onPress: confirm,
      },
    ]);
  }

  function cancelReservation(reservation: Reservation) {
    const message = 'Cancel this reservation? Players will receive a cancellation notification.';
    const confirm = () => void runAction(
      `cancel-${reservation.id}`,
      async () => {
        const { error } = await supabase.rpc('admin_cancel_reservation', { p_reservation_id: reservation.id });
        return { error };
      },
      'Reservation cancelled.',
    ).then((success) => {
      if (success) setSelectedReservation(null);
    });

    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Cancel reservation\n\n${message}`)) confirm();
      return;
    }

    Alert.alert('Cancel reservation', message, [
      { text: 'Keep reservation', style: 'cancel' },
      {
        text: 'Cancel reservation',
        style: 'destructive',
        onPress: confirm,
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

  async function createFacilityEvent(values: FacilityEventValues) {
    return runAction(
      'create-event',
      async () => {
        const { error } = await supabase.from('facility_events').insert({
          title: values.title.trim(),
          description: values.description.trim() || null,
          event_type: values.eventType,
          start_at: zonedDateTimeToIso(values.date, values.startTime, timeZone),
          end_at: zonedDateTimeToIso(values.date, values.endTime, timeZone),
        });
        return { error };
      },
      'Event published.',
    );
  }

  async function saveFacilityEvent(values: FacilityEventEditValues) {
    const { error } = await supabase.from('facility_events').update({
      title: values.title.trim(),
      description: values.description.trim() || null,
      event_type: values.eventType,
      start_at: zonedDateTimeToIso(values.date, values.startTime, timeZone),
      end_at: zonedDateTimeToIso(values.date, values.endTime, timeZone),
      updated_at: new Date().toISOString(),
    }).eq('id', values.id);
    if (error) return errorText(error, 'The event could not be updated.');
    setEditingEvent(null);
    setMessage('Event updated.');
    await loadData(true);
    return '';
  }

  function deleteFacilityEvent(event: FacilityEvent) {
    Alert.alert('Delete event', 'Remove this event from the player app?', [
      { text: 'Keep event', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void runAction(
          `delete-event-${event.id}`,
          async () => {
            const { error } = await supabase.from('facility_events').delete().eq('id', event.id);
            return { error };
          },
          'Event deleted.',
        ),
      },
    ]);
  }

  async function updateIssueReport(report: IssueReport, status: IssueReportStatus) {
    return runAction(
      `report-${report.id}`,
      async () => {
        const { error } = await supabase.from('player_issue_reports').update({ status }).eq('id', report.id);
        return { error };
      },
      `Report marked ${status}.`,
    );
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

  async function deletePlayer(player: Player) {
    const { error } = await supabase.functions.invoke('admin-delete-player', { body: { playerId: player.id } });
    if (error) return edgeFunctionErrorText(error, 'The player profile could not be deleted.');
    setEditingPlayer(null);
    setMessage('Player profile deleted.');
    await loadData(true);
    return '';
  }

  async function openArchivedReservation(reservation: Reservation) {
    const { data, error } = await supabase
      .from('reservation_participants')
      .select('*')
      .eq('reservation_id', reservation.id);
    if (error) {
      setMessage(errorText(error, 'The reservation participants could not be loaded.'));
      return;
    }
    setReservationParticipants((current) => [
      ...current.filter((participant) => participant.reservation_id !== reservation.id),
      ...(data ?? []),
    ]);
    setArchiveVisible(false);
    setSelectedReservation(reservation);
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
          <View style={styles.headerIdentity}>
            <Text numberOfLines={1} style={styles.productName}>{settings?.facility_name || 'Padel Court'}</Text>
            <Text style={styles.adminName}>{administratorName || 'Administrator'}</Text>
          </View>
          <View style={styles.headerActions}>
            <AdminAccountNotifications timeZone={timeZone} />
            <IconButton accessibilityLabel="Scan reservation receipt" icon="scan-outline" onPress={() => setScannerVisible(true)} />
            <IconButton accessibilityLabel="Sign out" icon="log-out-outline" onPress={() => void signOut()} />
          </View>
        </View>

        {activeTab === 'schedule' ? (
          <>
            <View style={styles.dateHero}>
              <Text style={styles.dateNumeral}>{dateHeading.numeral}</Text>
              <View style={styles.dateCopy}>
                <Text style={styles.dateWeekday}>{dateHeading.weekday}</Text>
                <Text style={styles.dateMonth}>{dateHeading.monthYear}</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <Stat label="Reservations" value={String(selectedReservations.length)} />
              <Stat label="Unpaid" value={String(unpaidCount)} />
              <Stat label="Blocked" value={String(selectedBlocks.length)} />
            </View>
          </>
        ) : null}

        {message ? <Notice>{message}</Notice> : null}
        {loading ? <LoadingBlock label="Loading administrator data…" /> : (
          <View style={styles.sectionBody}>
            {activeTab === 'schedule' ? (
              <View style={styles.panelStack}>
                <BookingDatePicker onSelectDate={setSelectedDate} selectedDate={selectedDate} timeZone={timeZone} />
                <SchedulePanel
                  blocks={selectedBlocks}
                  dateLabel={dateHeading.long}
                  onOpenArchive={() => setArchiveVisible(true)}
                  onOpenCourts={() => setOpenCourtsVisible(true)}
                  onSelectReservation={setSelectedReservation}
                  playerById={playerById}
                  reservations={selectedReservations}
                  rule={scheduleRule}
                  timeZone={timeZone}
                />
              </View>
            ) : null}
            {activeTab === 'blocked' ? (
              <BlockedPeriodsPanel
                busy={busyAction}
                defaultDate={selectedDate}
                onCreate={createBlockedPeriod}
                onDelete={deleteBlockedPeriod}
                periods={upcomingBlockedPeriods}
                timeZone={timeZone}
              />
            ) : null}
            {activeTab === 'events' ? (
              <FacilityEventsPanel
                busy={busyAction}
                defaultDate={selectedDate}
                events={facilityEvents}
                onCreate={createFacilityEvent}
                onDelete={deleteFacilityEvent}
                onEdit={setEditingEvent}
                timeZone={timeZone}
              />
            ) : null}
            {activeTab === 'reports' ? (
              <IssueReportsPanel
                busy={busyAction}
                onUpdate={updateIssueReport}
                playerById={playerById}
                reports={issueReports}
                timeZone={timeZone}
              />
            ) : null}
            {activeTab === 'players' ? (
              <PlayersPanel
                isMainAdministrator={isMainAdministrator}
                onEdit={setEditingPlayer}
                onManageAdministrators={() => setAdministratorAccountsVisible(true)}
                players={players}
              />
            ) : null}
            {activeTab === 'analytics' ? (
              <AnalyticsPanel
                dateKey={analyticsDate}
                onChangeDate={setAnalyticsDate}
                onChangePeriod={setAnalyticsPeriod}
                period={analyticsPeriod}
                players={players}
                previousReservations={previousAnalyticsReservations}
                reservations={analyticsReservations}
                scheduleRules={scheduleRules}
                timeZone={timeZone}
              />
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
              <Ionicons color={selected ? colors.onAccent : colors.accent} name={tab.icon} size={20} />
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
        participants={selectedReservation ? reservationParticipants.filter((item) => item.reservation_id === selectedReservation.id).map((item) => ({ player: playerById.get(item.player_id), role: item.role })) : []}
        reservation={selectedReservation}
        timeZone={timeZone}
      />
      <ReservationArchiveModal
        onClose={() => setArchiveVisible(false)}
        onSelectReservation={(reservation) => void openArchivedReservation(reservation)}
        timeZone={timeZone}
        visible={archiveVisible}
      />
      <OpenCourtManagementModal onClose={() => setOpenCourtsVisible(false)} timeZone={timeZone} visible={openCourtsVisible} />
      <AdministratorAccountsModal onClose={() => setAdministratorAccountsVisible(false)} timeZone={timeZone} visible={administratorAccountsVisible} />
      <ReservationEditModal
        onClose={() => setEditingReservation(null)}
        onSave={saveReservation}
        reservation={editingReservation}
        timeZone={timeZone}
      />
      <FacilityEventEditModal event={editingEvent} onClose={() => setEditingEvent(null)} onSave={saveFacilityEvent} timeZone={timeZone} />
      <PlayerEditModal
        canDelete={isMainAdministrator}
        onClose={() => setEditingPlayer(null)}
        onDelete={deletePlayer}
        onSave={savePlayer}
        player={editingPlayer}
      />
      <ReceiptScannerModal onClose={() => setScannerVisible(false)} playerById={playerById} timeZone={timeZone} visible={scannerVisible} />
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

function BookingDatePicker({
  onSelectDate,
  selectedDate,
  timeZone,
}: {
  onSelectDate: (dateKey: string) => void;
  selectedDate: string;
  timeZone: string;
}) {
  const today = todayKey(timeZone);
  const bookingLimit = addMonthToDateKey(today);
  const firstCell = startOfWeekDateKey(today);
  const dayCount = daysBetween(firstCell, bookingLimit) + 1;
  const calendarDays = Array.from({ length: dayCount }, (_, index) => addDaysToDateKey(firstCell, index));
  const todayParts = dateKeyParts(today);
  const rangeLabel = `${monthDayLabel(today)} – ${monthDayLabel(bookingLimit)}`;

  return (
    <View style={styles.calendarCard}>
      <View style={styles.calendarHeader}>
        <Text style={styles.calendarTitle}>{rangeLabel}</Text>
        <Text style={styles.calendarRangeNote}>One month ahead</Text>
      </View>
      <View style={styles.calendarWeekdays}>
        {weekdayLabels.map((label, index) => <Text key={`${label}-${index}`} style={styles.calendarWeekday}>{label}</Text>)}
      </View>
      <View style={styles.calendarGrid}>
        {calendarDays.map((dateKey) => {
          const dateParts = dateKeyParts(dateKey);
          const isBeforeToday = dateKey < today;
          const isSelected = dateKey === selectedDate;
          const isToday = dateKey === today;
          const isNextMonth = dateParts.year !== todayParts.year || dateParts.month !== todayParts.month;
          return (
            <View key={dateKey} style={styles.calendarDaySlot}>
              <Pressable
                accessibilityLabel={formatDayHeading(dateKey).long}
                accessibilityRole="button"
                accessibilityState={{ disabled: isBeforeToday, selected: isSelected }}
                disabled={isBeforeToday}
                onPress={() => onSelectDate(dateKey)}
                style={({ pressed }) => [
                  styles.calendarDay,
                  isToday && !isSelected && styles.calendarDayToday,
                  isSelected && styles.calendarDaySelected,
                  pressed && !isBeforeToday && !isSelected && styles.calendarDayPressed,
                ]}>
                <Text style={[
                  styles.calendarDayText,
                  isBeforeToday && styles.calendarDayTextDisabled,
                  isNextMonth && !isSelected && !isBeforeToday && styles.calendarDayTextNextMonth,
                  isToday && !isSelected && styles.calendarDayTextToday,
                  isSelected && styles.calendarDayTextSelected,
                ]}>{dateParts.day}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SchedulePanel({
  blocks,
  dateLabel,
  onOpenArchive,
  onOpenCourts,
  onSelectReservation,
  playerById,
  reservations,
  rule,
  timeZone,
}: {
  blocks: BlockedPeriod[];
  dateLabel: string;
  onOpenArchive: () => void;
  onOpenCourts: () => void;
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
      <View style={styles.scheduleActions}>
        <View style={styles.scheduleAction}><ActionButton icon="people-circle-outline" onPress={onOpenCourts}>Manage Open Courts</ActionButton></View>
        <View style={styles.scheduleAction}><ActionButton icon="archive-outline" onPress={onOpenArchive} variant="secondary">Reservation archive</ActionButton></View>
      </View>
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

function ReservationDetailsModal({
  busy,
  onCancel,
  onClose,
  onConfirmPayment,
  onEdit,
  player,
  participants,
  reservation,
  timeZone,
}: {
  busy: string;
  onCancel: (reservation: Reservation) => void;
  onClose: () => void;
  onConfirmPayment: (reservation: Reservation) => void;
  onEdit: (reservation: Reservation) => void;
  player?: Player;
  participants: ParticipantDetail[];
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
        <DetailGroup title="Players in this reservation">
          {participants.map((participant, index) => <DetailRow key={`${participant.player?.id || 'unknown'}-${index}`} label={participant.role === 'host' ? 'Host' : `Player ${index + 1}`} value={playerLabel(participant.player)} />)}
        </DetailGroup>
        <DetailGroup title="Reservation">
          <DetailRow label="Pass code" value={reservation.pass_code} />
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
    const startAt = zonedDateTimeToIso(values.date, values.startTime, timeZone);
    const endAt = zonedDateTimeToIso(values.date, values.endTime, timeZone);
    if (startAt <= new Date().toISOString()) {
      setError('The blocked period must start in the future.');
      return;
    }
    if (endAt <= startAt) {
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

      <Text style={styles.listTitle}>Upcoming blocked periods</Text>
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

type FacilityEventValues = {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  eventType: Database['public']['Enums']['facility_event_type'];
};
type FacilityEventEditValues = FacilityEventValues & { id: string };

function FacilityEventsPanel({
  busy,
  defaultDate,
  events,
  onCreate,
  onDelete,
  onEdit,
  timeZone,
}: {
  busy: string;
  defaultDate: string;
  events: FacilityEvent[];
  onCreate: (values: FacilityEventValues) => Promise<boolean>;
  onDelete: (event: FacilityEvent) => void;
  onEdit: (event: FacilityEvent) => void;
  timeZone: string;
}) {
  const [values, setValues] = useState<FacilityEventValues>({ date: defaultDate, startTime: '16:00', endTime: '17:00', title: '', description: '', eventType: 'tournament' });
  const [error, setError] = useState('');

  useEffect(() => {
    setValues((current) => ({ ...current, date: defaultDate }));
  }, [defaultDate]);

  async function submit() {
    const currentValues = values;
    if (!currentValues) return;
    if (currentValues.title.trim().length < 3) {
      setError('Add an event title with at least three characters.');
      return;
    }
    if (!isDateKey(currentValues.date) || !isTime(currentValues.startTime) || !isTime(currentValues.endTime)) {
      setError('Use YYYY-MM-DD for the date and HH:MM for each time.');
      return;
    }
    const startAt = zonedDateTimeToIso(currentValues.date, currentValues.startTime, timeZone);
    const endAt = zonedDateTimeToIso(currentValues.date, currentValues.endTime, timeZone);
    if (startAt <= new Date().toISOString()) {
      setError('The event must start in the future.');
      return;
    }
    if (endAt <= startAt) {
      setError('End time must be after start time.');
      return;
    }
    setError('');
    const success = await onCreate(values);
    if (success) setValues((current) => ({ ...current, title: '', description: '' }));
  }

  return (
    <View style={styles.panelStack}>
      <SectionHeading eyebrow="Player app" title="Events" />
      <View style={styles.formCard}>
        <Text style={styles.formCardTitle}>Publish an event</Text>
        <Segmented label="Type" onChange={(eventType) => setValues((current) => ({ ...current, eventType: eventType as FacilityEventValues['eventType'] }))} options={[{ label: 'Tournament', value: 'tournament' }, { label: 'Community', value: 'community' }, { label: 'Announcement', value: 'announcement' }]} value={values.eventType} />
        <Field label="Title" maxLength={120} onChangeText={(title) => setValues((current) => ({ ...current, title }))} placeholder="Event name" value={values.title} />
        <Field autoCapitalize="none" label="Date (YYYY-MM-DD)" onChangeText={(date) => setValues((current) => ({ ...current, date }))} value={values.date} />
        <View style={styles.twoColumn}>
          <View style={styles.flexField}><Field autoCapitalize="none" label="Start (HH:MM)" onChangeText={(startTime) => setValues((current) => ({ ...current, startTime }))} value={values.startTime} /></View>
          <View style={styles.flexField}><Field autoCapitalize="none" label="End (HH:MM)" onChangeText={(endTime) => setValues((current) => ({ ...current, endTime }))} value={values.endTime} /></View>
        </View>
        <Field label="Description (optional)" maxLength={500} multiline onChangeText={(description) => setValues((current) => ({ ...current, description }))} value={values.description} />
        {error ? <Notice>{error}</Notice> : null}
        <ActionButton disabled={Boolean(busy)} icon="paper-plane-outline" onPress={() => void submit()}>{busy === 'create-event' ? 'Publishing…' : 'Publish event'}</ActionButton>
      </View>

      <Text style={styles.listTitle}>Upcoming events</Text>
      {!events.length ? <EmptyState icon="calendar-outline" text="Tournaments, community activities, and announcements published here appear in the player app." title="No upcoming events" /> : events.map((event) => (
        <View key={event.id} style={styles.blockCard}>
          <View style={styles.flexField}>
            <Text style={styles.cardTitle}>{event.title}</Text>
            <Text style={styles.cardMeta}>{titleCase(event.event_type)} · {formatDateTime(event.start_at, timeZone)}</Text>
            <Text style={styles.cardMeta}>{formatTimeRange(event.start_at, event.end_at, timeZone)}{event.description ? ` · ${event.description}` : ''}</Text>
          </View>
          <View style={styles.cardActions}>
            <IconButton accessibilityLabel="Edit event" disabled={Boolean(busy)} icon="create-outline" onPress={() => onEdit(event)} />
            <IconButton accessibilityLabel="Delete event" disabled={Boolean(busy)} icon="trash-outline" onPress={() => onDelete(event)} />
          </View>
        </View>
      ))}
    </View>
  );
}

function FacilityEventEditModal({
  event,
  onClose,
  onSave,
  timeZone,
}: {
  event: FacilityEvent | null;
  onClose: () => void;
  onSave: (values: FacilityEventEditValues) => Promise<string>;
  timeZone: string;
}) {
  const [values, setValues] = useState<FacilityEventEditValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setValues(event ? {
      id: event.id,
      date: inputDate(event.start_at, timeZone),
      startTime: inputTime(event.start_at, timeZone),
      endTime: inputTime(event.end_at, timeZone),
      title: event.title,
      description: event.description || '',
      eventType: event.event_type,
    } : null);
    setError('');
  }, [event, timeZone]);

  if (!event || !values) return null;

  function update<K extends keyof FacilityEventEditValues>(key: K, value: FacilityEventEditValues[K]) {
    setValues((current) => current ? { ...current, [key]: value } : current);
  }

  async function submit() {
    const currentValues = values;
    if (!currentValues) return;
    if (currentValues.title.trim().length < 3) {
      setError('Add an event title with at least three characters.');
      return;
    }
    if (!isDateKey(currentValues.date) || !isTime(currentValues.startTime) || !isTime(currentValues.endTime)) {
      setError('Use YYYY-MM-DD for the date and HH:MM for each time.');
      return;
    }
    const startAt = zonedDateTimeToIso(currentValues.date, currentValues.startTime, timeZone);
    const endAt = zonedDateTimeToIso(currentValues.date, currentValues.endTime, timeZone);
    if (endAt <= startAt) {
      setError('End time must be after start time.');
      return;
    }
    setSaving(true);
    setError('');
    const nextError = await onSave(currentValues);
    setError(nextError);
    setSaving(false);
  }

  return (
    <ModalShell onClose={onClose} title="Edit event" visible>
      <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
        <Segmented label="Type" onChange={(eventType) => update('eventType', eventType as FacilityEventValues['eventType'])} options={[{ label: 'Tournament', value: 'tournament' }, { label: 'Community', value: 'community' }, { label: 'Announcement', value: 'announcement' }]} value={values.eventType} />
        <Field label="Title" maxLength={120} onChangeText={(title) => update('title', title)} value={values.title} />
        <Field autoCapitalize="none" label="Date (YYYY-MM-DD)" onChangeText={(date) => update('date', date)} value={values.date} />
        <View style={styles.twoColumn}>
          <View style={styles.flexField}><Field autoCapitalize="none" label="Start (HH:MM)" onChangeText={(startTime) => update('startTime', startTime)} value={values.startTime} /></View>
          <View style={styles.flexField}><Field autoCapitalize="none" label="End (HH:MM)" onChangeText={(endTime) => update('endTime', endTime)} value={values.endTime} /></View>
        </View>
        <Field label="Description (optional)" maxLength={500} multiline onChangeText={(description) => update('description', description)} value={values.description} />
        {error ? <Notice>{error}</Notice> : null}
        <ActionButton disabled={saving} icon="save-outline" onPress={() => void submit()}>{saving ? 'Saving…' : 'Save event'}</ActionButton>
      </ScrollView>
    </ModalShell>
  );
}

function IssueReportsPanel({
  busy,
  onUpdate,
  playerById,
  reports,
  timeZone,
}: {
  busy: string;
  onUpdate: (report: IssueReport, status: IssueReportStatus) => Promise<boolean>;
  playerById: Map<string, Player>;
  reports: IssueReport[];
  timeZone: string;
}) {
  const [filter, setFilter] = useState<'active' | 'resolved'>('active');
  const visibleReports = reports.filter((report) => filter === 'active' ? report.status !== 'resolved' : report.status === 'resolved');
  const activeCount = reports.filter((report) => report.status !== 'resolved').length;

  return (
    <View style={styles.panelStack}>
      <SectionHeading eyebrow="Player support" title={`${activeCount} active ${activeCount === 1 ? 'report' : 'reports'}`} />
      <Segmented label="Show" onChange={setFilter} options={[{ label: `Active (${activeCount})`, value: 'active' }, { label: 'Resolved', value: 'resolved' }]} value={filter} />
      {!visibleReports.length ? (
        <EmptyState icon="chatbox-ellipses-outline" text={filter === 'active' ? 'New problems submitted from the web app will appear here.' : 'Resolved reports are kept here for reference.'} title={filter === 'active' ? 'No active reports' : 'No resolved reports'} />
      ) : visibleReports.map((report) => {
        const player = playerById.get(report.player_id);
        const status = report.status as IssueReportStatus;
        return (
          <View key={report.id} style={styles.reportCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.reportCategory}>{titleCase(report.category)}</Text>
              <StatusChip emphasized={status === 'open'}>{status}</StatusChip>
            </View>
            <Text style={styles.cardTitle}>{playerLabel(player)}</Text>
            {player?.username ? <Text style={styles.playerUsername}>@{player.username}</Text> : null}
            <Text style={styles.cardMeta}>{player?.email || 'No email available'}{player?.phone_number ? ` · ${player.phone_number}` : ''}</Text>
            <Text style={styles.reportDetails}>{report.details}</Text>
            <Text style={styles.cardMeta}>{formatDateTime(report.created_at, timeZone)}{report.page_path ? ` · ${report.page_path}` : ''}</Text>
            <Segmented
              label="Status"
              onChange={(nextStatus) => void onUpdate(report, nextStatus)}
              options={[{ label: 'Open', value: 'open' }, { label: 'Reviewing', value: 'reviewing' }, { label: 'Resolved', value: 'resolved' }]}
              value={status}
            />
            {busy === `report-${report.id}` ? <Text style={styles.savingText}>Updating…</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function PlayersPanel({
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

const analyticsWeekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function reservationHours(reservation: AnalyticsReservation) {
  return Math.max(0, new Date(reservation.end_at).getTime() - new Date(reservation.start_at).getTime()) / 3_600_000;
}

function analyticsAmount(value: number) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);
}

function analyticsNumber(value: number) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: value % 1 === 0 ? 0 : 1 }).format(value);
}

function minutesFromTime(value: string | null) {
  if (!value) return 0;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function analyticsPeriodDateKeys(dateKey: string, period: AnalyticsPeriod) {
  const startDateKey = analyticsPeriodStart(dateKey, period);
  if (period === 'day') return [startDateKey];
  if (period === 'week') return Array.from({ length: 7 }, (_, index) => addDaysToDateKey(startDateKey, index));
  const { year, month } = dateKeyParts(startDateKey);
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) => dateKeyFromParts(year, month, index + 1));
}

function openHoursByWeekday(dateKey: string, period: AnalyticsPeriod, scheduleRules: ScheduleRule[]) {
  const totals = Array.from({ length: 7 }, () => 0);
  analyticsPeriodDateKeys(dateKey, period).forEach((periodDateKey) => {
    const weekday = dateKeyDayOfWeek(periodDateKey);
    const rule = scheduleRules.find((candidate) => candidate.day_of_week === weekday);
    if (!rule?.is_open || !rule.opening_time || !rule.closing_time) return;
    totals[weekday] += Math.max(0, minutesFromTime(rule.closing_time) - minutesFromTime(rule.opening_time)) / 60;
  });
  return totals;
}

function summarizeAnalytics(reservations: AnalyticsReservation[], dateKey: string, period: AnalyticsPeriod, scheduleRules: ScheduleRule[]) {
  const active = reservations.filter((reservation) => !['cancelled', 'expired'].includes(reservation.status));
  const bookedHours = active.reduce((total, reservation) => total + reservationHours(reservation), 0);
  const openHours = openHoursByWeekday(dateKey, period, scheduleRules).reduce((total, value) => total + value, 0);
  const bookedValue = active.reduce((total, reservation) => total + Number(reservation.price), 0);
  const collected = active.filter((reservation) => reservation.payment_status === 'paid').reduce((total, reservation) => total + Number(reservation.price), 0);
  const hostCounts = new Map<string, number>();
  active.forEach((reservation) => hostCounts.set(reservation.host_id, (hostCounts.get(reservation.host_id) ?? 0) + 1));
  const averageLeadDays = active.length
    ? active.reduce((total, reservation) => total + Math.max(0, new Date(reservation.start_at).getTime() - new Date(reservation.created_at).getTime()) / 86_400_000, 0) / active.length
    : 0;
  return {
    active,
    averageLeadDays,
    averageValue: active.length ? bookedValue / active.length : 0,
    bookedHours,
    bookedValue,
    cancelled: reservations.filter((reservation) => reservation.status === 'cancelled').length,
    cancellationRate: reservations.length ? reservations.filter((reservation) => reservation.status === 'cancelled').length / reservations.length * 100 : 0,
    collected,
    collectionRate: bookedValue ? collected / bookedValue * 100 : 0,
    completed: reservations.filter((reservation) => reservation.status === 'completed').length,
    confirmed: reservations.filter((reservation) => reservation.status === 'confirmed').length,
    expired: reservations.filter((reservation) => reservation.status === 'expired').length,
    openCourts: active.filter((reservation) => reservation.type === 'open').length,
    outstanding: Math.max(0, bookedValue - collected),
    privateBookings: active.filter((reservation) => reservation.type === 'private').length,
    repeatRate: hostCounts.size ? [...hostCounts.values()].filter((count) => count > 1).length / hostCounts.size * 100 : 0,
    uniqueBookers: hostCounts.size,
    utilization: openHours ? bookedHours / openHours * 100 : 0,
  };
}

function comparisonText(current: number, previous: number, period: AnalyticsPeriod, points = false) {
  if (current === 0 && previous === 0) return `No change from prior ${period}`;
  if (points) {
    const difference = current - previous;
    return `${difference >= 0 ? '+' : ''}${difference.toFixed(1)} pts vs prior ${period}`;
  }
  if (previous === 0) return `New activity this ${period}`;
  const change = (current - previous) / Math.abs(previous) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(0)}% vs prior ${period}`;
}

function hourLabel(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour} ${suffix}`;
}

function AnalyticsPanel({
  dateKey,
  onChangeDate,
  onChangePeriod,
  period,
  players,
  previousReservations,
  reservations,
  scheduleRules,
  timeZone,
}: {
  dateKey: string;
  onChangeDate: (dateKey: string) => void;
  onChangePeriod: (period: AnalyticsPeriod) => void;
  period: AnalyticsPeriod;
  players: Player[];
  previousReservations: AnalyticsReservation[];
  reservations: AnalyticsReservation[];
  scheduleRules: ScheduleRule[];
  timeZone: string;
}) {
  const today = todayKey(timeZone);
  const previousDateKey = shiftAnalyticsPeriod(dateKey, period, -1);
  const summary = useMemo(() => summarizeAnalytics(reservations, dateKey, period, scheduleRules), [dateKey, period, reservations, scheduleRules]);
  const previousSummary = useMemo(() => summarizeAnalytics(previousReservations, previousDateKey, period, scheduleRules), [period, previousDateKey, previousReservations, scheduleRules]);
  const currentBounds = analyticsPeriodBounds(dateKey, period, timeZone);
  const previousBounds = analyticsPeriodBounds(previousDateKey, period, timeZone);
  const newPlayers = players.filter((player) => player.created_at >= currentBounds.start && player.created_at < currentBounds.end).length;
  const previousNewPlayers = players.filter((player) => player.created_at >= previousBounds.start && player.created_at < previousBounds.end).length;

  const revenueTrend = useMemo(() => {
    let values: { key: string; label: string; collected: number; outstanding: number; total: number }[];
    if (period === 'day') {
      const hours = [...new Set(summary.active.map((reservation) => Number(inputTime(reservation.start_at, timeZone).split(':')[0])))].sort((a, b) => a - b);
      values = hours.map((hour) => ({ key: String(hour), label: hourLabel(hour), collected: 0, outstanding: 0, total: 0 }));
    } else if (period === 'week') {
      values = analyticsPeriodDateKeys(dateKey, period).map((periodDateKey) => ({
        key: periodDateKey,
        label: analyticsWeekdays[dateKeyDayOfWeek(periodDateKey)],
        collected: 0,
        outstanding: 0,
        total: 0,
      }));
    } else {
      const { year, month } = dateKeyParts(dateKey);
      const weekCount = Math.ceil(new Date(Date.UTC(year, month, 0, 12)).getUTCDate() / 7);
      values = Array.from({ length: weekCount }, (_, index) => ({ key: String(index), label: `W${index + 1}`, collected: 0, outstanding: 0, total: 0 }));
    }
    summary.active.forEach((reservation) => {
      const reservationDateKey = inputDate(reservation.start_at, timeZone);
      const key = period === 'day'
        ? String(Number(inputTime(reservation.start_at, timeZone).split(':')[0]))
        : period === 'week'
          ? reservationDateKey
          : String(Math.floor((dateKeyParts(reservationDateKey).day - 1) / 7));
      const bucket = values.find((value) => value.key === key);
      if (!bucket) return;
      const price = Number(reservation.price);
      bucket.total += price;
      if (reservation.payment_status === 'paid') bucket.collected += price;
      else bucket.outstanding += price;
    });
    return values;
  }, [dateKey, period, summary.active, timeZone]);

  const occupancyByWeekday = useMemo(() => {
    const available = openHoursByWeekday(dateKey, period, scheduleRules);
    const booked = Array.from({ length: 7 }, () => 0);
    summary.active.forEach((reservation) => {
      booked[dateKeyDayOfWeek(inputDate(reservation.start_at, timeZone))] += reservationHours(reservation);
    });
    return analyticsWeekdays.map((label, weekday) => ({
      label,
      hours: booked[weekday],
      value: available[weekday] ? Math.min(100, booked[weekday] / available[weekday] * 100) : 0,
    })).filter((item, weekday) => available[weekday] > 0);
  }, [dateKey, period, scheduleRules, summary.active, timeZone]);

  const peakHours = useMemo(() => {
    const counts = new Map<number, number>();
    summary.active.forEach((reservation) => {
      const hour = Number(inputTime(reservation.start_at, timeZone).split(':')[0]);
      counts.set(hour, (counts.get(hour) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([hour, value]) => ({ hour, label: hourLabel(hour), value }))
      .sort((a, b) => b.value - a.value || a.hour - b.hour)
      .slice(0, 6);
  }, [summary.active, timeZone]);

  const statusMax = Math.max(summary.confirmed, summary.completed, summary.cancelled, summary.expired, 1);
  const typeMax = Math.max(summary.privateBookings, summary.openCourts, 1);
  const isCurrentPeriod = analyticsPeriodStart(dateKey, period) >= analyticsPeriodStart(today, period);
  const revenueTitle = period === 'day' ? 'Revenue by booking time' : period === 'week' ? 'Daily revenue' : 'Weekly revenue';
  const occupancyTitle = period === 'day' ? 'Daily occupancy' : 'Occupancy by weekday';

  return (
    <View style={styles.panelStack}>
      <Segmented
        label="View analytics by"
        onChange={onChangePeriod}
        options={[
          { label: 'Day', value: 'day' },
          { label: 'Week', value: 'week' },
          { label: 'Month', value: 'month' },
        ]}
        value={period}
      />
      <View style={styles.analyticsMonthHeader}>
        <IconButton accessibilityLabel={`Previous analytics ${period}`} icon="chevron-back" onPress={() => onChangeDate(previousDateKey)} />
        <View style={styles.analyticsMonthTitle}>
          <Text style={styles.analyticsMonthEyebrow}>Court performance</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.analyticsMonthName}>{analyticsPeriodLabel(dateKey, period)}</Text>
        </View>
        <IconButton
          accessibilityLabel={`Next analytics ${period}`}
          disabled={isCurrentPeriod}
          icon="chevron-forward"
          onPress={() => onChangeDate(shiftAnalyticsPeriod(dateKey, period, 1))}
        />
      </View>

      <View style={styles.analyticsHero}>
        <View>
          <Text style={styles.analyticsHeroLabel}>Court utilization</Text>
          <Text style={styles.analyticsHeroValue}>{summary.utilization.toFixed(1)}%</Text>
          <Text style={styles.analyticsHeroDetail}>{comparisonText(summary.utilization, previousSummary.utilization, period, true)}</Text>
        </View>
        <View style={styles.analyticsHeroTrack}>
          <View style={[styles.analyticsHeroFill, { width: `${Math.min(100, summary.utilization)}%` }]} />
        </View>
        <Text style={styles.analyticsHeroCaption}>{analyticsNumber(summary.bookedHours)} court hours booked against the published schedule</Text>
      </View>

      <View style={styles.analyticsGrid}>
        <AnalyticsMetric detail={comparisonText(summary.bookedValue, previousSummary.bookedValue, period)} label="Booked value" value={analyticsAmount(summary.bookedValue)} />
        <AnalyticsMetric detail={`${summary.collectionRate.toFixed(0)}% collection rate`} label="Collected" value={analyticsAmount(summary.collected)} />
        <AnalyticsMetric detail={`${summary.active.filter((item) => item.payment_status === 'unpaid').length} unpaid bookings`} label="Outstanding" value={analyticsAmount(summary.outstanding)} />
        <AnalyticsMetric detail={comparisonText(summary.active.length, previousSummary.active.length, period)} label="Reservations" value={String(summary.active.length)} />
        <AnalyticsMetric detail={comparisonText(summary.cancellationRate, previousSummary.cancellationRate, period, true)} label="Cancellation rate" value={`${summary.cancellationRate.toFixed(1)}%`} />
        <AnalyticsMetric detail={`${analyticsNumber(summary.averageLeadDays)} days average lead`} label="Average booking" value={analyticsAmount(summary.averageValue)} />
      </View>

      <AnalyticsSection title={revenueTitle}>
        <View style={styles.analyticsLegend}>
          <AnalyticsLegend color={colors.accent} label="Collected" />
          <AnalyticsLegend color={colors.sage} label="Outstanding" />
        </View>
        {revenueTrend.length
          ? <RevenueColumnChart values={revenueTrend} />
          : <Text style={styles.analyticsEmptyCopy}>No active reservations in this {period}.</Text>}
      </AnalyticsSection>

      <AnalyticsSection title={occupancyTitle}>
        {occupancyByWeekday.map((item) => (
          <AnalyticsBar key={item.label} label={item.label} max={100} suffix={`% · ${analyticsNumber(item.hours)}h`} value={item.value} />
        ))}
      </AnalyticsSection>

      <AnalyticsSection title="Player activity">
        <View style={styles.analyticsPlayerGrid}>
          <AnalyticsCompactMetric label="Unique bookers" value={String(summary.uniqueBookers)} />
          <AnalyticsCompactMetric label="Repeat bookers" value={`${summary.repeatRate.toFixed(0)}%`} />
          <AnalyticsCompactMetric label="New players" value={String(newPlayers)} detail={comparisonText(newPlayers, previousNewPlayers, period)} />
          <AnalyticsCompactMetric label="Average lead time" value={`${analyticsNumber(summary.averageLeadDays)}d`} />
        </View>
      </AnalyticsSection>

      <AnalyticsSection title="Peak booking times">
        {peakHours.length ? peakHours.map((item) => (
          <AnalyticsBar key={item.hour} label={item.label} max={peakHours[0].value} suffix={item.value === 1 ? ' booking' : ' bookings'} value={item.value} />
        )) : <Text style={styles.analyticsEmptyCopy}>No active reservations in this {period}.</Text>}
      </AnalyticsSection>

      <AnalyticsSection title="Reservation health">
        <AnalyticsBar label="Confirmed" max={statusMax} value={summary.confirmed} />
        <AnalyticsBar label="Completed" max={statusMax} value={summary.completed} />
        <AnalyticsBar label="Cancelled" max={statusMax} value={summary.cancelled} />
        <AnalyticsBar label="Expired" max={statusMax} value={summary.expired} />
      </AnalyticsSection>

      <AnalyticsSection title="Booking type">
        <AnalyticsBar label="Private" max={typeMax} value={summary.privateBookings} />
        <AnalyticsBar label="Open Court" max={typeMax} value={summary.openCourts} />
      </AnalyticsSection>

      {!reservations.length ? (
        <EmptyState icon="bar-chart-outline" text={`Choose another ${period} or return after the first reservation is created.`} title="No reservation activity" />
      ) : null}
    </View>
  );
}

function AnalyticsSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.analyticsSection}>
      <Text style={styles.analyticsSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function AnalyticsMetric({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <View style={styles.analyticsMetric}>
      <Text style={styles.analyticsMetricLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.analyticsMetricValue}>{value}</Text>
      <Text style={styles.analyticsMetricDetail}>{detail}</Text>
    </View>
  );
}

function AnalyticsCompactMetric({ detail, label, value }: { detail?: string; label: string; value: string }) {
  return (
    <View style={styles.analyticsCompactMetric}>
      <Text style={styles.analyticsCompactValue}>{value}</Text>
      <Text style={styles.analyticsCompactLabel}>{label}</Text>
      {detail ? <Text style={styles.analyticsCompactDetail}>{detail}</Text> : null}
    </View>
  );
}

function AnalyticsLegend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.analyticsLegendItem}>
      <View style={[styles.analyticsLegendSwatch, { backgroundColor: color }]} />
      <Text style={styles.analyticsLegendLabel}>{label}</Text>
    </View>
  );
}

function RevenueColumnChart({ values }: { values: { key: string; label: string; collected: number; outstanding: number; total: number }[] }) {
  const largest = Math.max(...values.map((item) => item.total), 1);
  return (
    <View style={styles.analyticsColumnChart}>
      {values.map((item) => {
        const height = item.total ? Math.max(14, item.total / largest * 124) : 2;
        return (
          <View key={item.key} style={styles.analyticsColumnItem}>
            <Text numberOfLines={1} style={styles.analyticsColumnValue}>{item.total ? analyticsAmount(item.total) : '0'}</Text>
            <View style={styles.analyticsColumnStage}>
              <View style={[styles.analyticsColumn, { height }]}>
                {item.outstanding ? <View style={[styles.analyticsColumnOutstanding, { flex: item.outstanding }]} /> : null}
                {item.collected ? <View style={[styles.analyticsColumnCollected, { flex: item.collected }]} /> : null}
              </View>
            </View>
            <Text style={styles.analyticsColumnLabel}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function AnalyticsBar({ label, max, suffix = '', value }: { label: string; max: number; suffix?: string; value: number }) {
  return (
    <View style={styles.analyticsBarRow}>
      <View style={styles.analyticsBarHeading}>
        <Text style={styles.analyticsBarLabel}>{label}</Text>
        <Text style={styles.analyticsBarValue}>{analyticsNumber(value)}{suffix}</Text>
      </View>
      <View style={styles.analyticsBarTrack}>
        <View style={[styles.analyticsBarFill, { width: `${Math.max(value ? 5 : 0, value / Math.max(max, 1) * 100)}%` }]} />
      </View>
    </View>
  );
}

type PlayerEditValues = { id: string; fullName: string; phoneNumber: string };

function PlayerEditModal({
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
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
  scheduleActions: {
    flexDirection: 'row',
    gap: 9,
  },
  scheduleAction: {
    flex: 1,
  },
  calendarCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    marginHorizontal: -6,
    paddingHorizontal: 13,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 17,
    elevation: 3,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  calendarTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  calendarRangeNote: {
    color: colors.muted,
    fontSize: 11,
  },
  calendarWeekdays: {
    flexDirection: 'row',
  },
  calendarWeekday: {
    width: '14.2857%',
    paddingTop: 2,
    paddingBottom: 5,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDaySlot: {
    width: '14.2857%',
    paddingHorizontal: 1.5,
    paddingVertical: 1.5,
  },
  calendarDay: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  calendarDayToday: {
    borderColor: colors.accent,
  },
  calendarDaySelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  calendarDayPressed: {
    backgroundColor: colors.paleAccent,
  },
  calendarDayText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  calendarDayTextDisabled: {
    color: colors.muted,
    opacity: 0.36,
  },
  calendarDayTextNextMonth: {
    color: colors.accent,
    opacity: 0.72,
  },
  calendarDayTextToday: {
    color: colors.accent,
    fontWeight: '800',
  },
  calendarDayTextSelected: {
    color: colors.onAccent,
    fontWeight: '800',
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
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
    fontSize: 9,
    fontWeight: '700',
  },
  tabTextSelected: {
    color: colors.onAccent,
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
    backgroundColor: colors.surface,
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
  cardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  reportCard: {
    gap: 10,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    borderLeftColor: colors.accent,
  },
  reportCategory: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  reportDetails: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  playerUsername: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  savingText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
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
    color: colors.onAccent,
    fontSize: 20,
    fontWeight: '900',
  },
  playerProfileHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  playerProfileInitial: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  playerProfileInitialText: {
    color: colors.onAccent,
    fontSize: 28,
    fontWeight: '900',
  },
  playerProfileName: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  playerProfileUsername: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  playerStatsLedger: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.text,
  },
  playerStat: {
    flex: 1,
    minHeight: 106,
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  playerStatValue: {
    color: colors.accent,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  playerStatLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  playerEditTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    paddingTop: 2,
  },
  playerDeleteSection: {
    gap: 10,
    marginTop: 8,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.text,
  },
  playerDeleteTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  playerDeleteCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  playerDeleteButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.secondary,
    backgroundColor: colors.surface,
  },
  playerDeleteButtonText: {
    color: colors.secondary,
    fontSize: 15,
    fontWeight: '800',
  },
  playerDeleteButtonPressed: {
    backgroundColor: colors.background,
  },
  playerDeleteButtonDisabled: {
    opacity: 0.42,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  analyticsMetric: {
    width: '48%',
    flexGrow: 1,
    minHeight: 132,
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
  },
  analyticsMetricValue: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  analyticsMetricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  analyticsMetricDetail: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  analyticsMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  analyticsMonthTitle: {
    flex: 1,
    alignItems: 'center',
  },
  analyticsMonthEyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  analyticsMonthName: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  analyticsHero: {
    gap: 15,
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.accent,
  },
  analyticsHeroLabel: {
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  analyticsHeroValue: {
    color: colors.onAccent,
    fontSize: 50,
    lineHeight: 55,
    fontWeight: '900',
    letterSpacing: -2.5,
  },
  analyticsHeroDetail: {
    color: colors.sage,
    fontSize: 11,
    fontWeight: '700',
  },
  analyticsHeroTrack: {
    height: 14,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: colors.paleAccent,
  },
  analyticsHeroFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.ballGreen,
  },
  analyticsHeroCaption: {
    color: colors.onAccent,
    fontSize: 12,
    lineHeight: 18,
  },
  analyticsSection: {
    gap: 14,
    padding: 17,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  analyticsSectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingBottom: 10,
  },
  analyticsLegend: {
    flexDirection: 'row',
    gap: 18,
  },
  analyticsLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  analyticsLegendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  analyticsLegendLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  analyticsColumnChart: {
    minHeight: 180,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  analyticsColumnItem: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
  },
  analyticsColumnValue: {
    width: '100%',
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  analyticsColumnStage: {
    height: 124,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  analyticsColumn: {
    width: '66%',
    minHeight: 2,
    overflow: 'hidden',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: colors.border,
  },
  analyticsColumnCollected: {
    backgroundColor: colors.accent,
  },
  analyticsColumnOutstanding: {
    backgroundColor: colors.sage,
  },
  analyticsColumnLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  analyticsPlayerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  analyticsCompactMetric: {
    width: '48%',
    flexGrow: 1,
    minHeight: 95,
    padding: 12,
    justifyContent: 'space-between',
    borderRadius: 16,
    backgroundColor: colors.panel,
  },
  analyticsCompactValue: {
    color: colors.accent,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -1,
  },
  analyticsCompactLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  analyticsCompactDetail: {
    color: colors.muted,
    fontSize: 9,
    lineHeight: 12,
  },
  analyticsEmptyCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  analyticsBarRow: {
    gap: 7,
  },
  analyticsBarHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  analyticsBarLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  analyticsBarValue: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  analyticsBarTrack: {
    height: 10,
    overflow: 'hidden',
    borderRadius: 5,
    backgroundColor: colors.paleAccent,
  },
  analyticsBarFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
});
