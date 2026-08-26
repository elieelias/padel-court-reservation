// Groups blocked periods, facility events, issue reports, and facility settings into one management area.

import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { facilityManagementStyles as styles } from '@/stylesheets/facility-management.styles';
import { ActionButton, EmptyState, Field, IconButton, ModalShell, Notice, Segmented, StatusChip } from '@/components/admin-ui';
import { Text } from '@/components/branded-text';
import { getPlayerName as playerLabel, type BlockedPeriod, type BlockedPeriodValues, type FacilityEvent, type FacilityEventEditValues, type FacilityEventValues, type IssueReport, type IssueReportStatus, type Player } from '@/lib/admin-types';
import { formatDateTime, formatTimeRange, inputDate, inputTime, isDateKey, isTime, zonedDateTimeToIso } from '@/lib/date';
import { titleCase } from '@/lib/errors';

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export function BlockedPeriodsPanel({
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

export function FacilityEventsPanel({
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

export function FacilityEventEditModal({
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

export function IssueReportsPanel({
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
