// Loads and combines the Supabase records required by the administrator dashboard.

import { monthBounds, periodBounds, shiftPeriod } from '@/lib/admin-periods';
import type {
  AnalyticsPeriod,
  AnalyticsReservation,
  AuditEntry,
  BlockedPeriod,
  FacilityEvent,
  FacilitySettings,
  IssueReport,
  Player,
  Reservation,
  ReservationParticipant,
  ScheduleRule,
} from '@/lib/admin-types';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

type LoadOptions = {
  selectedDate: string;
  paymentDate: string;
  paymentPeriod: AnalyticsPeriod;
  analyticsDate: string;
  analyticsPeriod: AnalyticsPeriod;
  timeZone: string;
};

export type AdminData = {
  settings: FacilitySettings;
  scheduleRules: ScheduleRule[];
  reservations: Reservation[];
  paymentReservations: Reservation[];
  analyticsReservations: AnalyticsReservation[];
  previousAnalyticsReservations: AnalyticsReservation[];
  blockedPeriods: BlockedPeriod[];
  facilityEvents: FacilityEvent[];
  issueReports: IssueReport[];
  players: Player[];
  reservationParticipants: ReservationParticipant[];
  auditEntries: AuditEntry[];
};

const analyticsColumns = 'created_at, end_at, host_id, initial_player_count, payment_status, price, start_at, status, type';

export async function loadAdminData(options: LoadOptions): Promise<AdminData> {
  const reservationMonth = monthBounds(options.selectedDate, options.timeZone);
  const paymentRange = periodBounds(options.paymentDate, options.paymentPeriod, options.timeZone);
  const analyticsRange = periodBounds(options.analyticsDate, options.analyticsPeriod, options.timeZone);
  const previousDate = shiftPeriod(options.analyticsDate, options.analyticsPeriod, -1);
  const previousAnalyticsRange = periodBounds(previousDate, options.analyticsPeriod, options.timeZone);
  const now = new Date().toISOString();

  // These queries do not depend on one another, so load them together to keep the dashboard fast.
  const results = await Promise.all([
    supabase.from('facility_settings').select('*').eq('id', 1).single(),
    supabase.from('schedule_rules').select('*').order('day_of_week'),
    supabase.from('reservations').select('*').gte('start_at', reservationMonth.start).lt('start_at', reservationMonth.end).order('start_at'),
    supabase.from('reservations').select('*').gte('start_at', paymentRange.start).lt('start_at', paymentRange.end).order('start_at', { ascending: false }),
    supabase.from('reservations').select(analyticsColumns).gte('start_at', analyticsRange.start).lt('start_at', analyticsRange.end).order('start_at'),
    supabase.from('reservations').select(analyticsColumns).gte('start_at', previousAnalyticsRange.start).lt('start_at', previousAnalyticsRange.end).order('start_at'),
    supabase.from('blocked_periods').select('*').gt('end_at', now).order('start_at').limit(200),
    supabase.from('facility_events').select('*').gt('end_at', now).order('start_at').limit(200),
    supabase.from('player_issue_reports').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.rpc('admin_list_players'),
    supabase.from('profiles').select('id, username').eq('role', 'player'),
    supabase.from('administrative_audit_log').select('*').order('created_at', { ascending: false }).limit(100),
  ]);

  const [
    settingsResult,
    scheduleResult,
    reservationsResult,
    paymentsResult,
    analyticsResult,
    previousAnalyticsResult,
    blocksResult,
    eventsResult,
    reportsResult,
    playersResult,
    usernamesResult,
    auditResult,
  ] = results;

  // Participant rows need the reservation IDs returned by the monthly reservation query above.
  const participantResult = reservationsResult.data?.length
    ? await supabase
      .from('reservation_participants')
      .select('*')
      .in('reservation_id', reservationsResult.data.map((reservation) => reservation.id))
    : { data: [] as ReservationParticipant[], error: null };

  const error = results.find((result) => result.error)?.error || participantResult.error;
  if (error) throw new Error(getErrorMessage(error, 'Administrator data could not be loaded.'));
  if (!settingsResult.data) throw new Error('Facility settings could not be loaded.');

  // The player RPC omits usernames, so merge them in from profiles before displaying the list.
  const usernames = new Map((usernamesResult.data ?? []).map((profile) => [profile.id, profile.username]));
  const players = (playersResult.data ?? []).map((player) => ({
    ...player,
    username: usernames.get(player.id) || player.full_name || 'player',
  }));

  return {
    settings: settingsResult.data,
    scheduleRules: scheduleResult.data ?? [],
    reservations: reservationsResult.data ?? [],
    paymentReservations: paymentsResult.data ?? [],
    analyticsReservations: analyticsResult.data ?? [],
    previousAnalyticsReservations: previousAnalyticsResult.data ?? [],
    blockedPeriods: blocksResult.data ?? [],
    facilityEvents: eventsResult.data ?? [],
    issueReports: reportsResult.data ?? [],
    players,
    reservationParticipants: participantResult.data ?? [],
    auditEntries: auditResult.data ?? [],
  };
}
