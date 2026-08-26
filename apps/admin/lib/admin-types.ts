// Defines readable aliases and form value types shared across administrator features.

import type { Database, Tables } from '@/lib/database.types';

export type Reservation = Tables<'reservations'>;
export type BlockedPeriod = Tables<'blocked_periods'>;
export type ScheduleRule = Tables<'schedule_rules'>;
export type FacilitySettings = Tables<'facility_settings'>;
export type FacilityEvent = Tables<'facility_events'>;
export type IssueReport = Tables<'player_issue_reports'>;
export type ReservationParticipant = Tables<'reservation_participants'>;
export type AuditEntry = Tables<'administrative_audit_log'>;

export type AnalyticsReservation = Pick<Reservation,
  'created_at' | 'end_at' | 'host_id' | 'initial_player_count' | 'payment_status' |
  'price' | 'start_at' | 'status' | 'type'
>;

export type Player = Database['public']['Functions']['admin_list_players']['Returns'][number] & {
  username: string;
};

export type PlayerStats = Database['public']['Functions']['admin_get_player_details']['Returns'][number];
export type ParticipantDetail = {
  player?: Player;
  role: Database['public']['Enums']['participant_role'];
};

export type IssueReportStatus = 'open' | 'reviewing' | 'resolved';
export type FacilityEventType = Database['public']['Enums']['facility_event_type'];
export type TabName = 'schedule' | 'payments' | 'facility' | 'players' | 'analytics';
export type FacilitySection = 'information' | 'hours' | 'pricing' | 'blocked' | 'events' | 'reports' | 'audit';
export type AnalyticsPeriod = 'day' | 'week' | 'month';
export type PaymentPeriod = AnalyticsPeriod;

export type ReservationEditValues = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  type: Reservation['type'];
  status: 'pending' | 'confirmed' | 'completed';
  price: string;
  playerCount: string;
};

export type FacilityInformationValues = {
  cancellationHours: number;
  defaultPrice: number;
  facilityName: string;
  timezone: string;
};

export type FacilityPricingValues = {
  enabled: boolean;
  endsAt: string | null;
  name: string | null;
  percentage: number;
  startsAt: string | null;
};

export type BlockedPeriodValues = { date: string; startTime: string; endTime: string; reason: string };
export type FacilityEventValues = {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  description: string;
  eventType: FacilityEventType;
};
export type FacilityEventEditValues = FacilityEventValues & { id: string };
export type PlayerEditValues = { id: string; fullName: string; phoneNumber: string };

export function getPlayerName(player: Player | undefined) {
  return player?.full_name || player?.username || player?.email || 'Player account';
}
