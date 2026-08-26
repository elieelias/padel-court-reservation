// Displays the administrative audit timeline and the fields changed by each action.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/components/admin-ui';
import { Text } from '@/components/branded-text';
import { colors } from '@/constants/admin-theme';
import { formatDateTime } from '@/lib/date';
import type { Json, Tables } from '@/lib/database.types';
import { auditHistoryStyles as styles } from '@/stylesheets/audit-history.styles';

type AuditEntry = Tables<'administrative_audit_log'>;

const hiddenKeys = new Set(['created_at', 'updated_at']);

function objectValue(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function displayValue(value: Json | undefined) {
  if (value === null || value === undefined || value === '') return 'None';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).replaceAll('_', ' ');
}

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function changedFields(entry: AuditEntry) {
  const before = objectValue(entry.old_values);
  const after = objectValue(entry.new_values);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => !hiddenKeys.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ after: after[key], before: before[key], key }));
}

function actionSentence(entry: AuditEntry) {
  if (entry.action === 'create_administrator') return 'created an administrator account';
  if (entry.action === 'delete_player') return 'deleted a player account';
  const verb = entry.action === 'create' ? 'created' : entry.action === 'delete' ? 'deleted' : 'updated';
  return `${verb} ${label(entry.entity_type).toLowerCase()}`;
}

export function AuditHistoryPanel({ entries, timeZone }: { entries: AuditEntry[]; timeZone: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <View style={styles.stack}>
      <View>
        <Text style={styles.title}>Administrative history</Text>
        <Text style={styles.copy}>A read-only record of administrator changes. Entries cannot be edited or deleted in the app.</Text>
      </View>

      {entries.length === 0 ? (
        <EmptyState icon="shield-checkmark-outline" title="No administrator changes yet" text="New facility, reservation, and account changes will appear here." />
      ) : entries.map((entry, index) => {
        const expanded = entry.id === expandedId;
        const changes = changedFields(entry);
        const actor = entry.actor_name || entry.actor_username || 'Administrator';
        return (
          <View key={entry.id} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={styles.timelineDot} />
              {index < entries.length - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
            <Pressable onPress={() => setExpandedId(expanded ? null : entry.id)} style={styles.card}>
              <View style={styles.cardHeading}>
                <View style={styles.cardHeadingCopy}>
                  <Text style={styles.actor}>{actor}</Text>
                  <Text style={styles.action}>{actionSentence(entry)}</Text>
                </View>
                <Ionicons color={colors.accent} name={expanded ? 'chevron-up' : 'chevron-down'} size={18} />
              </View>
              <Text style={styles.timestamp}>{formatDateTime(entry.created_at, timeZone)}</Text>
              {expanded ? (
                <View style={styles.details}>
                  {entry.entity_id ? <Text style={styles.identifier}>Record {entry.entity_id}</Text> : null}
                  {changes.length === 0 ? (
                    <Text style={styles.detailText}>The record was {entry.action === 'delete' || entry.action === 'delete_player' ? 'removed' : 'created'}.</Text>
                  ) : changes.map((change) => (
                    <View key={change.key} style={styles.changeRow}>
                      <Text style={styles.changeLabel}>{label(change.key)}</Text>
                      {entry.action === 'update' ? <Text style={styles.beforeValue}>{displayValue(change.before)}</Text> : null}
                      {entry.action === 'update' ? <Ionicons color={colors.muted} name="arrow-forward" size={14} /> : null}
                      <Text style={styles.afterValue}>{displayValue(entry.action === 'delete' ? change.before : change.after)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
