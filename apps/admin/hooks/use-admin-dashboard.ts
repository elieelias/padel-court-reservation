// Owns the dashboard state, data refresh flow, confirmations, and administrator actions.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

import * as adminApi from '@/lib/admin-actions';
import { periodStart, shiftPeriod } from '@/lib/admin-periods';
import { loadAdminData } from '@/lib/admin-data';
import {
  type AnalyticsPeriod,
  type AnalyticsReservation,
  type AuditEntry,
  type BlockedPeriod,
  type BlockedPeriodValues,
  type FacilityEvent,
  type FacilityEventEditValues,
  type FacilityEventValues,
  type FacilitySection,
  type FacilitySettings,
  type FacilityInformationValues,
  type FacilityPricingValues,
  getPlayerName,
  type IssueReport,
  type IssueReportStatus,
  type Player,
  type PlayerEditValues,
  type PaymentPeriod,
  type Reservation,
  type ReservationEditValues,
  type ReservationParticipant,
  type ScheduleRule,
  type TabName,
} from '@/lib/admin-types';
import { dateKeyDayOfWeek, dayBounds, formatDayHeading, todayKey } from '@/lib/date';
import { getEdgeFunctionError, getErrorMessage } from '@/lib/errors';

export function useAdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabName>('schedule');
  const [facilitySection, setFacilitySection] = useState<FacilitySection>('information');
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [paymentDate, setPaymentDate] = useState(() => todayKey());
  const [paymentPeriod, setPaymentPeriod] = useState<PaymentPeriod>('month');
  const [paymentReservations, setPaymentReservations] = useState<Reservation[]>([]);
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
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
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

  // Use the facility timezone once loaded; Beirut is only the initial fallback.
  const timeZone = settings?.timezone || 'Asia/Beirut';
  const dateHeading = formatDayHeading(selectedDate);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const playerNameById = useMemo(() => new Map(players.map((player) => [player.id, getPlayerName(player)])), [players]);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setMessage('');
    try {
      const data = await loadAdminData({
        selectedDate,
        paymentDate,
        paymentPeriod,
        analyticsDate,
        analyticsPeriod,
        timeZone,
      });
      setSettings(data.settings);
      setScheduleRules(data.scheduleRules);
      setReservations(data.reservations);
      setPaymentReservations(data.paymentReservations);
      setAnalyticsReservations(data.analyticsReservations);
      setPreviousAnalyticsReservations(data.previousAnalyticsReservations);
      setBlockedPeriods(data.blockedPeriods);
      setFacilityEvents(data.facilityEvents);
      setIssueReports(data.issueReports);
      setPlayers(data.players);
      setReservationParticipants(data.reservationParticipants);
      setAuditEntries(data.auditEntries);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Administrator data could not be loaded.');
    }
    setLoading(false);
    setRefreshing(false);
  }, [analyticsDate, analyticsPeriod, paymentDate, paymentPeriod, selectedDate, timeZone]);

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

  // All save actions share the same loading, error, success, and refresh behavior.
  async function runAction(key: string, action: () => Promise<{ error: { message?: string } | null }>, success: string) {
    if (busyAction) return false;
    setBusyAction(key);
    setMessage('');
    const { error } = await action();
    if (error) {
      setMessage(getErrorMessage(error, 'The action could not be completed.'));
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
        const { error } = await adminApi.confirmCashPayment(reservation.id);
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
        const { error } = await adminApi.cancelReservation(reservation.id);
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
    const { error } = await adminApi.updateReservation(values, timeZone);
    if (error) return getErrorMessage(error, 'The reservation could not be updated.');
    setEditingReservation(null);
    setSelectedReservation(null);
    setMessage('Reservation updated.');
    setSelectedDate(values.date);
    await loadData(true);
    return '';
  }

  async function saveFacilityInformation(values: FacilityInformationValues) {
    return runAction(
      'save-facility-information',
      async () => {
        const { error } = await adminApi.updateFacilityInformation(values);
        return { error };
      },
      'Facility information updated.',
    );
  }

  async function saveFacilityHours(rules: ScheduleRule[]) {
    return runAction(
      'save-facility-hours',
      async () => {
        return adminApi.updateFacilityHours(rules);
      },
      'Weekly opening hours updated.',
    );
  }

  async function saveFacilityPricing(values: FacilityPricingValues) {
    return runAction(
      'save-facility-pricing',
      async () => {
        const { error } = await adminApi.updatePricing(values);
        return { error };
      },
      values.enabled ? 'Discount pricing activated.' : 'Discount pricing saved and switched off.',
    );
  }

  async function createBlockedPeriod(values: BlockedPeriodValues) {
    return runAction(
      'create-block',
      async () => {
        const { error } = await adminApi.createBlockedPeriod(values, timeZone);
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
            const { error } = await adminApi.removeBlockedPeriod(period);
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
        const { error } = await adminApi.createFacilityEvent(values, timeZone);
        return { error };
      },
      'Event published.',
    );
  }

  async function saveFacilityEvent(values: FacilityEventEditValues) {
    const { error } = await adminApi.updateFacilityEvent(values, timeZone);
    if (error) return getErrorMessage(error, 'The event could not be updated.');
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
            const { error } = await adminApi.removeFacilityEvent(event);
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
        const { error } = await adminApi.updateIssueReport(report, status);
        return { error };
      },
      `Report marked ${status}.`,
    );
  }

  async function savePlayer(values: PlayerEditValues) {
    const { error } = await adminApi.updatePlayer(values);
    if (error) return getErrorMessage(error, 'The player account could not be updated.');
    setEditingPlayer(null);
    setMessage('Player account updated.');
    await loadData(true);
    return '';
  }

  async function deletePlayer(player: Player) {
    const { error } = await adminApi.deletePlayer(player.id);
    if (error) return getEdgeFunctionError(error, 'The player profile could not be deleted.');
    setEditingPlayer(null);
    setMessage('Player profile deleted.');
    await loadData(true);
    return '';
  }

  async function openArchivedReservation(reservation: Reservation) {
    const { data, error } = await adminApi.loadReservationParticipants(reservation.id);
    if (error) {
      setMessage(getErrorMessage(error, 'The reservation participants could not be loaded.'));
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
    await adminApi.signOutAdministrator();
  }

  return {
    activeTab, setActiveTab,
    facilitySection, setFacilitySection,
    selectedDate, setSelectedDate,
    paymentDate, setPaymentDate,
    paymentPeriod, setPaymentPeriod,
    paymentReservations,
    analyticsDate, setAnalyticsDate,
    analyticsPeriod, setAnalyticsPeriod,
    analyticsReservations,
    previousAnalyticsReservations,
    blockedPeriods,
    facilityEvents,
    issueReports,
    scheduleRules,
    players,
    auditEntries,
    settings,
    loading,
    refreshing,
    message,
    busyAction,
    selectedReservation, setSelectedReservation,
    editingReservation, setEditingReservation,
    editingEvent, setEditingEvent,
    editingPlayer, setEditingPlayer,
    archiveVisible, setArchiveVisible,
    administratorAccountsVisible, setAdministratorAccountsVisible,
    openCourtsVisible, setOpenCourtsVisible,
    scannerVisible, setScannerVisible,
    timeZone,
    dateHeading,
    playerById,
    playerNameById,
    selectedReservations,
    selectedBlocks,
    upcomingBlockedPeriods,
    unpaidCount,
    scheduleRule,
    reservationParticipants,
    refresh,
    confirmPayment,
    cancelReservation,
    saveReservation,
    saveFacilityInformation,
    saveFacilityHours,
    saveFacilityPricing,
    createBlockedPeriod,
    deleteBlockedPeriod,
    createFacilityEvent,
    saveFacilityEvent,
    deleteFacilityEvent,
    updateIssueReport,
    savePlayer,
    deletePlayer,
    openArchivedReservation,
    signOut,
  };
}
