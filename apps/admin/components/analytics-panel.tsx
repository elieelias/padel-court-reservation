// Calculates and displays daily, weekly, and monthly court performance analytics.

import { useMemo } from 'react';
import { View } from 'react-native';

import { analyticsPanelStyles as styles } from '@/stylesheets/analytics-panel.styles';
import { EmptyState, IconButton, Segmented } from '@/components/admin-ui';
import { Text } from '@/components/branded-text';
import { colors } from '@/constants/admin-theme';
import {
  addDays as addDaysToDateKey,
  dateKeyFromParts,
  dateKeyParts,
  periodBounds as analyticsPeriodBounds,
  periodLabel as analyticsPeriodLabel,
  periodStart as analyticsPeriodStart,
  shiftPeriod as shiftAnalyticsPeriod,
} from '@/lib/admin-periods';
import type { AnalyticsPeriod, AnalyticsReservation, Player, ScheduleRule } from '@/lib/admin-types';
import { dateKeyDayOfWeek, inputDate, inputTime, todayKey } from '@/lib/date';

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
  // Availability comes from the published weekly schedule, not a fixed number of court hours.
  analyticsPeriodDateKeys(dateKey, period).forEach((periodDateKey) => {
    const weekday = dateKeyDayOfWeek(periodDateKey);
    const rule = scheduleRules.find((candidate) => candidate.day_of_week === weekday);
    if (!rule?.is_open || !rule.opening_time || !rule.closing_time) return;
    totals[weekday] += Math.max(0, minutesFromTime(rule.closing_time) - minutesFromTime(rule.opening_time)) / 60;
  });
  return totals;
}

function summarizeAnalytics(reservations: AnalyticsReservation[], dateKey: string, period: AnalyticsPeriod, scheduleRules: ScheduleRule[]) {
  // Cancelled and expired reservations stay in status metrics but do not count toward revenue or use.
  const active = reservations.filter((reservation) => !['cancelled', 'expired'].includes(reservation.status));
  const bookedHours = active.reduce((total, reservation) => total + reservationHours(reservation), 0);
  const openHours = openHoursByWeekday(dateKey, period, scheduleRules).reduce((total, value) => total + value, 0);
  const bookedValue = active.reduce((total, reservation) => total + Number(reservation.price), 0);
  const collected = active.filter((reservation) => reservation.payment_status === 'paid').reduce((total, reservation) => total + Number(reservation.price), 0);
  const hostCounts = new Map<string, number>();
  active.forEach((reservation) => hostCounts.set(reservation.host_id, (hostCounts.get(reservation.host_id) ?? 0) + 1));
  return {
    active,
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

export function AnalyticsPanel({
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
        <AnalyticsMetric detail="Average value per active reservation" label="Average booking" value={analyticsAmount(summary.averageValue)} />
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
