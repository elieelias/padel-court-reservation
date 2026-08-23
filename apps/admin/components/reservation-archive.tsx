import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ActionButton, EmptyState, Field, ModalShell, Notice, StatusChip } from '@/components/admin-ui';
import { Text } from '@/components/branded-text';
import { colors } from '@/constants/admin-theme';
import { formatTimeRange, isDateKey, zonedDateTimeToIso } from '@/lib/date';
import type { Database, Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type Reservation = Tables<'reservations'>;
type ArchiveRow = Database['public']['Functions']['admin_search_reservations']['Returns'][number];
type ReservationStatus = Database['public']['Enums']['reservation_status'];
type PaymentStatus = Database['public']['Enums']['payment_status'];
type ReservationType = Database['public']['Enums']['reservation_type'];
type ArchiveFilters = {
  search: string;
  status: 'all' | ReservationStatus;
  paymentStatus: 'all' | PaymentStatus;
  type: 'all' | ReservationType;
  fromDate: string;
  toDate: string;
};

const pageSize = 25;
const emptyFilters: ArchiveFilters = {
  search: '',
  status: 'all',
  paymentStatus: 'all',
  type: 'all',
  fromDate: '',
  toDate: '',
};

function nextDateKey(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function archiveDate(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(new Date(value));
  return {
    day: parts.find((part) => part.type === 'day')?.value || '',
    month: parts.find((part) => part.type === 'month')?.value || '',
    year: parts.find((part) => part.type === 'year')?.value || '',
  };
}

function rowReservation(row: ArchiveRow): Reservation {
  return {
    id: row.reservation_id,
    host_id: row.host_id,
    start_at: row.start_at,
    end_at: row.end_at,
    type: row.type,
    status: row.status,
    price: row.price,
    initial_player_count: row.initial_player_count,
    payment_status: row.payment_status,
    payment_confirmed_at: row.payment_confirmed_at,
    cancelled_at: row.cancelled_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    pass_token: row.pass_token,
    pass_code: row.pass_code,
  };
}

export function ReservationArchiveModal({
  onClose,
  onSelectReservation,
  timeZone,
  visible,
}: {
  onClose: () => void;
  onSelectReservation: (reservation: Reservation) => void;
  timeZone: string;
  visible: boolean;
}) {
  const [draft, setDraft] = useState<ArchiveFilters>(emptyFilters);
  const [applied, setApplied] = useState<ArchiveFilters>(emptyFilters);
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestId = useRef(0);

  const loadArchive = useCallback(async (offset: number, replace: boolean) => {
    const currentRequest = ++requestId.current;
    if (replace) setLoading(true);
    else setLoadingMore(true);
    setError('');

    const { data, error: searchError } = await supabase.rpc('admin_search_reservations', {
      p_search: applied.search.trim() || null,
      p_status: applied.status === 'all' ? null : applied.status,
      p_payment_status: applied.paymentStatus === 'all' ? null : applied.paymentStatus,
      p_type: applied.type === 'all' ? null : applied.type,
      p_start_at: applied.fromDate ? zonedDateTimeToIso(applied.fromDate, '00:00', timeZone) : null,
      p_end_at: applied.toDate ? zonedDateTimeToIso(nextDateKey(applied.toDate), '00:00', timeZone) : null,
      p_limit: pageSize,
      p_offset: offset,
    });

    if (currentRequest !== requestId.current) return;
    setLoading(false);
    setLoadingMore(false);
    if (searchError) {
      setError('The reservation archive could not be loaded.');
      return;
    }

    const nextRows = data ?? [];
    setRows((current) => replace ? nextRows : [...current, ...nextRows]);
    if (nextRows[0]) setTotalCount(Number(nextRows[0].total_count));
    else if (replace) setTotalCount(0);
  }, [applied, timeZone]);

  useEffect(() => {
    if (!visible) return;
    void loadArchive(0, true);
  }, [loadArchive, refreshVersion, visible]);

  function applyFilters() {
    if (draft.fromDate && !isDateKey(draft.fromDate)) {
      setValidationError('The from date must use YYYY-MM-DD.');
      return;
    }
    if (draft.toDate && !isDateKey(draft.toDate)) {
      setValidationError('The to date must use YYYY-MM-DD.');
      return;
    }
    if (draft.fromDate && draft.toDate && draft.fromDate > draft.toDate) {
      setValidationError('The from date must be before the to date.');
      return;
    }
    setValidationError('');
    setApplied({ ...draft });
    setRefreshVersion((value) => value + 1);
  }

  function clearFilters() {
    setDraft(emptyFilters);
    setApplied(emptyFilters);
    setValidationError('');
    setRefreshVersion((value) => value + 1);
  }

  return (
    <ModalShell onClose={onClose} title="Reservation archive" visible={visible}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.archiveIntro}>
          <Text style={styles.archiveTitle}>Find any reservation</Text>
          <Text style={styles.archiveCopy}>Search hosts, participants, contact details, or a receipt pass code.</Text>
        </View>

        <View style={styles.filters}>
          <Field
            autoCapitalize="none"
            label="Search"
            onChangeText={(search) => setDraft((current) => ({ ...current, search }))}
            placeholder="Player, email, phone, or pass code"
            returnKeyType="search"
            value={draft.search}
            onSubmitEditing={applyFilters}
          />
          <ArchiveFilter
            label="Status"
            onChange={(status) => setDraft((current) => ({ ...current, status: status as ArchiveFilters['status'] }))}
            options={['all', 'pending', 'confirmed', 'completed', 'cancelled', 'expired']}
            value={draft.status}
          />
          <ArchiveFilter
            label="Payment"
            onChange={(paymentStatus) => setDraft((current) => ({ ...current, paymentStatus: paymentStatus as ArchiveFilters['paymentStatus'] }))}
            options={['all', 'unpaid', 'paid']}
            value={draft.paymentStatus}
          />
          <ArchiveFilter
            label="Type"
            onChange={(type) => setDraft((current) => ({ ...current, type: type as ArchiveFilters['type'] }))}
            options={['all', 'private', 'open']}
            value={draft.type}
          />
          <View style={styles.dateFields}>
            <View style={styles.flexField}><Field autoCapitalize="none" label="From date" onChangeText={(fromDate) => setDraft((current) => ({ ...current, fromDate }))} placeholder="YYYY-MM-DD" value={draft.fromDate} /></View>
            <View style={styles.flexField}><Field autoCapitalize="none" label="To date" onChangeText={(toDate) => setDraft((current) => ({ ...current, toDate }))} placeholder="YYYY-MM-DD" value={draft.toDate} /></View>
          </View>
          {validationError ? <Notice>{validationError}</Notice> : null}
          <View style={styles.filterActions}>
            <View style={styles.flexField}><ActionButton icon="search-outline" onPress={applyFilters}>Search archive</ActionButton></View>
            <Pressable accessibilityRole="button" onPress={clearFilters} style={styles.clearButton}><Text style={styles.clearButtonText}>Clear</Text></Pressable>
          </View>
        </View>

        <View style={styles.resultHeading}>
          <Text style={styles.resultCount}>{loading ? 'Searching…' : `${totalCount} ${totalCount === 1 ? 'reservation' : 'reservations'}`}</Text>
          {totalCount > 0 ? <Text style={styles.resultRange}>Showing {Math.min(rows.length, totalCount)} of {totalCount}</Text> : null}
        </View>

        {error ? <Notice>{error}</Notice> : null}
        {loading ? (
          <View style={styles.loadingState}><ActivityIndicator color={colors.accent} /><Text style={styles.loadingText}>Loading reservations…</Text></View>
        ) : !rows.length && !error ? (
          <EmptyState icon="archive-outline" text="Adjust the filters or clear them to see the latest reservations." title="No matching reservations" />
        ) : (
          <View style={styles.resultList}>
            {rows.map((row) => <ArchiveCard key={row.reservation_id} onPress={() => onSelectReservation(rowReservation(row))} row={row} timeZone={timeZone} />)}
          </View>
        )}

        {rows.length < totalCount ? (
          <ActionButton disabled={loadingMore} icon="chevron-down" onPress={() => void loadArchive(rows.length, false)} variant="secondary">
            {loadingMore ? 'Loading more…' : 'Load more reservations'}
          </ActionButton>
        ) : null}
      </ScrollView>
    </ModalShell>
  );
}

function ArchiveFilter({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterOptions}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} key={option} onPress={() => onChange(option)} style={[styles.filterOption, selected && styles.filterOptionSelected]}>
              <Text style={[styles.filterOptionText, selected && styles.filterOptionTextSelected]}>{option === 'all' ? 'All' : option.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ArchiveCard({ onPress, row, timeZone }: { onPress: () => void; row: ArchiveRow; timeZone: string }) {
  const date = archiveDate(row.start_at, timeZone);
  const player = row.host_full_name || row.host_username || row.host_email || 'Player account';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.resultCard, pressed && styles.resultCardPressed]}>
      <View style={styles.resultDate}>
        <Text style={styles.resultDay}>{date.day}</Text>
        <Text style={styles.resultMonth}>{date.month}</Text>
        <Text style={styles.resultYear}>{date.year}</Text>
      </View>
      <View style={styles.resultDetails}>
        <View style={styles.resultTopLine}>
          <Text numberOfLines={1} style={styles.resultPlayer}>{player}</Text>
          <Ionicons color={colors.accent} name="chevron-forward" size={18} />
        </View>
        <Text style={styles.resultUsername}>@{row.host_username}</Text>
        <Text style={styles.resultTime}>{formatTimeRange(row.start_at, row.end_at, timeZone)}</Text>
        <View style={styles.resultChips}>
          <StatusChip emphasized={row.status === 'confirmed'}>{row.status}</StatusChip>
          <StatusChip emphasized={row.payment_status === 'unpaid'}>Cash {row.payment_status}</StatusChip>
        </View>
        <View style={styles.resultFooter}>
          <Text style={styles.resultMeta}>{row.type === 'open' ? 'Open Court' : 'Private'} · {row.pass_code}</Text>
          <Text style={styles.resultPrice}>${Number(row.price).toFixed(2)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingVertical: 22, paddingBottom: 48, gap: 20 },
  archiveIntro: { gap: 5 },
  archiveTitle: { color: colors.text, fontSize: 26, lineHeight: 30, fontWeight: '900', letterSpacing: -1 },
  archiveCopy: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  filters: { gap: 16, padding: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterGroup: { gap: 7 },
  filterLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterOption: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterOptionSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterOptionText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  filterOptionTextSelected: { color: colors.onAccent },
  dateFields: { flexDirection: 'row', gap: 10 },
  flexField: { flex: 1 },
  filterActions: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  clearButton: { minWidth: 72, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  clearButtonText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  resultHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: colors.text },
  resultCount: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  resultRange: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  loadingState: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: colors.muted, fontSize: 13 },
  resultList: { borderTopWidth: 1, borderTopColor: colors.border },
  resultCard: { flexDirection: 'row', minHeight: 174, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  resultCardPressed: { backgroundColor: colors.background },
  resultDate: { width: 76, alignItems: 'flex-start', paddingTop: 14, paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: colors.border },
  resultDay: { color: colors.accent, fontSize: 43, lineHeight: 44, fontWeight: '900', letterSpacing: -2.5 },
  resultMonth: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  resultYear: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  resultDetails: { flex: 1, gap: 5, padding: 14 },
  resultTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  resultPlayer: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '900' },
  resultUsername: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  resultTime: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  resultChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 3 },
  resultFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 4 },
  resultMeta: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 },
  resultPrice: { color: colors.text, fontSize: 15, fontWeight: '900' },
});
