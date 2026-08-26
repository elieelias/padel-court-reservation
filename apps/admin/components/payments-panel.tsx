// Summarizes reservation payments by period and lets administrators confirm cash payments.

import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { ActionButton, EmptyState, IconButton, Segmented, StatusChip } from '@/components/admin-ui';
import { Text } from '@/components/branded-text';
import { colors } from '@/constants/admin-theme';
import type { PaymentPeriod } from '@/lib/admin-types';
import { formatDateTime, formatTimeRange } from '@/lib/date';
import type { Tables } from '@/lib/database.types';
import { paymentPanelStyles as styles } from '@/stylesheets/payments-panel.styles';

type Reservation = Tables<'reservations'>;

export function PaymentsPanel({
  busyAction,
  canMoveNext,
  onChangePeriod,
  onMarkPaid,
  onMovePeriod,
  period,
  periodLabel,
  playerNameById,
  reservations,
  timeZone,
}: {
  busyAction: string;
  canMoveNext: boolean;
  onChangePeriod: (period: PaymentPeriod) => void;
  onMarkPaid: (reservation: Reservation) => void;
  onMovePeriod: (amount: number) => void;
  period: PaymentPeriod;
  periodLabel: string;
  playerNameById: Map<string, string>;
  reservations: Reservation[];
  timeZone: string;
}) {
  const payableReservations = reservations
    .filter((reservation) => !['cancelled', 'expired'].includes(reservation.status))
    .sort((first, second) => second.start_at.localeCompare(first.start_at));
  const paidReservations = payableReservations.filter((reservation) => reservation.payment_status === 'paid');
  const unpaidReservations = payableReservations.filter((reservation) => reservation.payment_status === 'unpaid');
  const collected = paidReservations.reduce((total, reservation) => total + Number(reservation.price), 0);
  const outstanding = unpaidReservations.reduce((total, reservation) => total + Number(reservation.price), 0);

  return (
    <View style={styles.stack}>
      <Segmented
        label="View payments by"
        onChange={onChangePeriod}
        options={[
          { label: 'Day', value: 'day' },
          { label: 'Week', value: 'week' },
          { label: 'Month', value: 'month' },
        ]}
        value={period}
      />

      <View style={styles.periodHeader}>
        <IconButton accessibilityLabel={`Previous ${period}`} icon="chevron-back" onPress={() => onMovePeriod(-1)} />
        <View style={styles.periodTitle}>
          <Text style={styles.periodEyebrow}>Reservation payments</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.periodName}>{periodLabel}</Text>
        </View>
        <IconButton accessibilityLabel={`Next ${period}`} disabled={!canMoveNext} icon="chevron-forward" onPress={() => onMovePeriod(1)} />
      </View>

      <View style={styles.summaryGrid}>
        <PaymentSummary label="Collected" value={currency(collected)} />
        <PaymentSummary label="Outstanding" value={currency(outstanding)} />
        <PaymentSummary label="Paid" value={String(paidReservations.length)} />
        <PaymentSummary label="Unpaid" value={String(unpaidReservations.length)} />
      </View>

      <View style={styles.listHeading}>
        <Text style={styles.listTitle}>Payments</Text>
        <Text style={styles.listCount}>{payableReservations.length} reservations</Text>
      </View>

      {payableReservations.map((reservation) => {
        const isPaid = reservation.payment_status === 'paid';
        return (
          <View key={reservation.id} style={styles.paymentCard}>
            <View style={styles.paymentIcon}>
              <Ionicons color={colors.accent} name={isPaid ? 'checkmark-circle-outline' : 'cash-outline'} size={22} />
            </View>
            <View style={styles.paymentBody}>
              <View style={styles.paymentHeading}>
                <View style={styles.paymentIdentity}>
                  <Text numberOfLines={1} style={styles.playerName}>{playerNameById.get(reservation.host_id) || 'Player account'}</Text>
                  <Text style={styles.reservationTime}>{formatDateTime(reservation.start_at, timeZone)} · {formatTimeRange(reservation.start_at, reservation.end_at, timeZone)}</Text>
                </View>
                <Text style={styles.amount}>{currency(Number(reservation.price))}</Text>
              </View>
              <View style={styles.paymentFooter}>
                <View style={styles.statusGroup}>
                  <StatusChip emphasized={!isPaid}>{isPaid ? 'Paid' : 'Unpaid'}</StatusChip>
                  {reservation.payment_confirmed_at ? (
                    <Text style={styles.confirmedAt}>Received {formatDateTime(reservation.payment_confirmed_at, timeZone)}</Text>
                  ) : null}
                </View>
                {!isPaid ? (
                  <View style={styles.paymentAction}>
                    <ActionButton
                      disabled={Boolean(busyAction)}
                      icon="checkmark-outline"
                      onPress={() => onMarkPaid(reservation)}
                      variant="secondary">
                      {busyAction === `payment-${reservation.id}` ? 'Recording…' : 'Mark paid'}
                    </ActionButton>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}

      {!payableReservations.length ? (
        <EmptyState
          icon="receipt-outline"
          text={`Choose another ${period} to review reservation payments.`}
          title="No payments in this period"
        />
      ) : null}
    </View>
  );
}

function PaymentSummary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function currency(value: number) {
  return `$${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value)}`;
}
