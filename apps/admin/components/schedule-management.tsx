// Displays the monthly calendar and daily court timeline, including reservation editing.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { scheduleManagementStyles as styles } from '@/stylesheets/schedule-management.styles';
import { ActionButton, EmptyState, Field, ModalShell, Notice, Segmented, StatusChip } from '@/components/admin-ui';
import { Text } from '@/components/branded-text';
import { colors } from '@/constants/admin-theme';
import {
  addDays as addDaysToDateKey,
  addOneMonth as addMonthToDateKey,
  dateKeyParts,
  daysBetween,
  monthDayLabel,
  startOfSundayWeek as startOfWeekDateKey,
} from '@/lib/admin-periods';
import { getPlayerName as playerLabel, type BlockedPeriod, type ParticipantDetail, type Player, type Reservation, type ReservationEditValues, type ScheduleRule } from '@/lib/admin-types';
import { formatDateTime, formatDayHeading, formatTime, formatTimeRange, inputDate, inputTime, isDateKey, isTime, todayKey, zonedDateTimeToIso } from '@/lib/date';
import { titleCase } from '@/lib/errors';

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export function BookingDatePicker({
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

export function SchedulePanel({
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

export function ReservationDetailsModal({
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

export function DetailGroup({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.detailGroup}>
      <Text style={styles.detailGroupTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function ReservationEditModal({
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
