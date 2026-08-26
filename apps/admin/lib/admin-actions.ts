// Contains the Supabase write operations used by administrator dashboard features.

import type {
  BlockedPeriod,
  BlockedPeriodValues,
  FacilityEvent,
  FacilityEventEditValues,
  FacilityEventValues,
  FacilityEventType,
  FacilityInformationValues,
  FacilityPricingValues,
  IssueReport,
  IssueReportStatus,
  Reservation,
  ReservationEditValues,
  ScheduleRule,
  PlayerEditValues,
} from '@/lib/admin-types';
import { zonedDateTimeToIso } from '@/lib/date';
import { supabase } from '@/lib/supabase';

export function confirmCashPayment(reservationId: string) {
  return supabase.rpc('admin_confirm_cash_payment', { p_reservation_id: reservationId });
}

export function cancelReservation(reservationId: string) {
  return supabase.rpc('admin_cancel_reservation', { p_reservation_id: reservationId });
}

export function updateReservation(values: ReservationEditValues, timeZone: string) {
  return supabase.rpc('admin_update_reservation', {
    p_reservation_id: values.id,
    p_start_at: zonedDateTimeToIso(values.date, values.startTime, timeZone),
    p_end_at: zonedDateTimeToIso(values.date, values.endTime, timeZone),
    p_type: values.type,
    p_status: values.status,
    p_price: Number(values.price),
    p_initial_player_count: values.type === 'private' ? 1 : Number(values.playerCount),
  });
}

export function updateFacilityInformation(values: FacilityInformationValues) {
  return supabase.from('facility_settings').update({
    cancellation_hours: values.cancellationHours,
    default_price: values.defaultPrice,
    facility_name: values.facilityName,
    timezone: values.timezone,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
}

export async function updateFacilityHours(rules: ScheduleRule[]) {
  const results = await Promise.all(rules.map((rule) => supabase
    .from('schedule_rules')
    .update({
      closing_time: rule.is_open ? rule.closing_time : null,
      is_open: rule.is_open,
      opening_time: rule.is_open ? rule.opening_time : null,
      slot_duration_minutes: rule.slot_duration_minutes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rule.id)));
  return { error: results.find((result) => result.error)?.error ?? null };
}

export function updatePricing(values: FacilityPricingValues) {
  return supabase.from('facility_settings').update({
    discount_enabled: values.enabled,
    discount_ends_at: values.endsAt,
    discount_name: values.name,
    discount_percentage: values.percentage,
    discount_starts_at: values.startsAt,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
}

export function createBlockedPeriod(values: BlockedPeriodValues, timeZone: string) {
  return supabase.from('blocked_periods').insert({
    start_at: zonedDateTimeToIso(values.date, values.startTime, timeZone),
    end_at: zonedDateTimeToIso(values.date, values.endTime, timeZone),
    reason: values.reason.trim() || null,
  });
}

export function removeBlockedPeriod(period: BlockedPeriod) {
  return supabase.from('blocked_periods').delete().eq('id', period.id);
}

export function createFacilityEvent(values: FacilityEventValues, timeZone: string) {
  return supabase.from('facility_events').insert({
    title: values.title.trim(),
    description: values.description.trim() || null,
    event_type: values.eventType,
    start_at: zonedDateTimeToIso(values.date, values.startTime, timeZone),
    end_at: zonedDateTimeToIso(values.date, values.endTime, timeZone),
  });
}

export function updateFacilityEvent(values: FacilityEventEditValues, timeZone: string) {
  return supabase.from('facility_events').update({
    title: values.title.trim(),
    description: values.description.trim() || null,
    event_type: values.eventType,
    start_at: zonedDateTimeToIso(values.date, values.startTime, timeZone),
    end_at: zonedDateTimeToIso(values.date, values.endTime, timeZone),
    updated_at: new Date().toISOString(),
  }).eq('id', values.id);
}

export function removeFacilityEvent(event: FacilityEvent) {
  return supabase.from('facility_events').delete().eq('id', event.id);
}

export function updateIssueReport(report: IssueReport, status: IssueReportStatus) {
  return supabase.from('player_issue_reports').update({ status }).eq('id', report.id);
}

export function updatePlayer(values: PlayerEditValues) {
  return supabase.rpc('admin_update_player_profile', {
    p_player_id: values.id,
    p_full_name: values.fullName,
    p_phone_number: values.phoneNumber,
  });
}

export function deletePlayer(playerId: string) {
  return supabase.functions.invoke('admin-delete-player', { body: { playerId } });
}

export function loadReservationParticipants(reservationId: string) {
  return supabase.from('reservation_participants').select('*').eq('reservation_id', reservationId);
}

export function signOutAdministrator() {
  return supabase.auth.signOut();
}
