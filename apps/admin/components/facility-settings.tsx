// Provides forms for facility information, weekly opening hours, and reservation pricing.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionButton, Field, Notice } from '@/components/admin-ui';
import { Text } from '@/components/branded-text';
import { colors } from '@/constants/admin-theme';
import { inputDate, inputTime, isDateKey, isTime, zonedDateTimeToIso } from '@/lib/date';
import type { Tables } from '@/lib/database.types';
import type { FacilityInformationValues, FacilityPricingValues } from '@/lib/admin-types';
import { facilitySettingStyles as styles } from '@/stylesheets/facility-settings.styles';

type FacilitySettings = Tables<'facility_settings'>;
type ScheduleRule = Tables<'schedule_rules'>;

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function FacilityInformationPanel({
  busy,
  onSave,
  settings,
}: {
  busy: boolean;
  onSave: (values: FacilityInformationValues) => Promise<boolean>;
  settings: FacilitySettings;
}) {
  const [facilityName, setFacilityName] = useState(settings.facility_name);
  const [defaultPrice, setDefaultPrice] = useState(String(settings.default_price));
  const [cancellationHours, setCancellationHours] = useState(String(settings.cancellation_hours));
  const [timezone, setTimezone] = useState(settings.timezone);
  const [error, setError] = useState('');

  useEffect(() => {
    setFacilityName(settings.facility_name);
    setDefaultPrice(String(settings.default_price));
    setCancellationHours(String(settings.cancellation_hours));
    setTimezone(settings.timezone);
  }, [settings]);

  async function submit() {
    const price = Number(defaultPrice);
    const cancellationWindow = Number(cancellationHours);
    if (facilityName.trim().length < 2) {
      setError('Enter the facility name.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError('Enter a valid default reservation price.');
      return;
    }
    if (!Number.isInteger(cancellationWindow) || cancellationWindow < 0) {
      setError('Cancellation hours must be a whole number.');
      return;
    }
    if (!timezone.trim()) {
      setError('Enter the facility timezone.');
      return;
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone.trim() }).format(new Date());
    } catch {
      setError('Enter a valid timezone, such as Asia/Beirut.');
      return;
    }

    setError('');
    await onSave({
      cancellationHours: cancellationWindow,
      defaultPrice: price,
      facilityName: facilityName.trim(),
      timezone: timezone.trim(),
    });
  }

  return (
    <View style={styles.formCard}>
      <Text style={styles.cardTitle}>Facility information</Text>
      <Text style={styles.cardCopy}>These details are used when displaying reservation rules and prices.</Text>
      <Field label="Facility name" onChangeText={setFacilityName} value={facilityName} />
      <Field inputMode="decimal" keyboardType="decimal-pad" label="Default reservation price" onChangeText={setDefaultPrice} value={defaultPrice} />
      <Field inputMode="numeric" keyboardType="number-pad" label="Cancellation notice (hours)" onChangeText={setCancellationHours} value={cancellationHours} />
      <Field autoCapitalize="none" label="Timezone" onChangeText={setTimezone} value={timezone} />
      {error ? <Notice>{error}</Notice> : null}
      <ActionButton disabled={busy} icon="save-outline" onPress={() => void submit()}>
        {busy ? 'Saving…' : 'Save facility information'}
      </ActionButton>
    </View>
  );
}

export function FacilityHoursPanel({
  busy,
  onSave,
  rules,
}: {
  busy: boolean;
  onSave: (rules: ScheduleRule[]) => Promise<boolean>;
  rules: ScheduleRule[];
}) {
  const [draftRules, setDraftRules] = useState(() => orderedRules(rules));
  const [error, setError] = useState('');

  useEffect(() => {
    setDraftRules(orderedRules(rules));
  }, [rules]);

  function updateRule(dayOfWeek: number, changes: Partial<ScheduleRule>) {
    setDraftRules((current) => current.map((rule) => (
      rule.day_of_week === dayOfWeek ? { ...rule, ...changes } : rule
    )));
  }

  async function submit() {
    const invalidRule = draftRules.find((rule) => (
      rule.is_open && (
        !rule.opening_time ||
        !rule.closing_time ||
        !isTime(rule.opening_time.slice(0, 5)) ||
        !isTime(rule.closing_time.slice(0, 5)) ||
        rule.opening_time >= rule.closing_time ||
        rule.slot_duration_minutes < 15
      )
    ));
    if (invalidRule) {
      setError(`Check the opening hours and slot duration for ${dayNames[invalidRule.day_of_week]}.`);
      return;
    }

    setError('');
    await onSave(draftRules);
  }

  return (
    <View style={styles.hoursStack}>
      <View>
        <Text style={styles.cardTitle}>Weekly opening hours</Text>
        <Text style={styles.cardCopy}>Closed days will not offer reservation slots to players.</Text>
      </View>

      {draftRules.map((rule) => (
        <View key={rule.id} style={styles.dayCard}>
          <View style={styles.dayHeading}>
            <Text style={styles.dayName}>{dayNames[rule.day_of_week]}</Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: rule.is_open }}
              onPress={() => updateRule(rule.day_of_week, { is_open: !rule.is_open })}
              style={[styles.openToggle, rule.is_open && styles.openToggleSelected]}>
              <Ionicons color={rule.is_open ? colors.onAccent : colors.muted} name={rule.is_open ? 'checkmark' : 'close'} size={16} />
              <Text style={[styles.openToggleText, rule.is_open && styles.openToggleTextSelected]}>{rule.is_open ? 'Open' : 'Closed'}</Text>
            </Pressable>
          </View>
          {rule.is_open ? (
            <View style={styles.dayFields}>
              <View style={styles.flexField}>
                <Field
                  label="Opens"
                  onChangeText={(value) => updateRule(rule.day_of_week, { opening_time: value })}
                  placeholder="08:00"
                  value={rule.opening_time?.slice(0, 5) || ''}
                />
              </View>
              <View style={styles.flexField}>
                <Field
                  label="Closes"
                  onChangeText={(value) => updateRule(rule.day_of_week, { closing_time: value })}
                  placeholder="22:00"
                  value={rule.closing_time?.slice(0, 5) || ''}
                />
              </View>
              <View style={styles.flexField}>
                <Field
                  inputMode="numeric"
                  keyboardType="number-pad"
                  label="Slot (min)"
                  onChangeText={(value) => updateRule(rule.day_of_week, { slot_duration_minutes: Number(value) || 0 })}
                  value={String(rule.slot_duration_minutes)}
                />
              </View>
            </View>
          ) : null}
        </View>
      ))}

      {error ? <Notice>{error}</Notice> : null}
      <ActionButton disabled={busy} icon="time-outline" onPress={() => void submit()}>
        {busy ? 'Saving…' : 'Save weekly hours'}
      </ActionButton>
    </View>
  );
}

export function FacilityPricingPanel({
  busy,
  onSave,
  settings,
}: {
  busy: boolean;
  onSave: (values: FacilityPricingValues) => Promise<boolean>;
  settings: FacilitySettings;
}) {
  const [enabled, setEnabled] = useState(settings.discount_enabled);
  const [name, setName] = useState(settings.discount_name || '');
  const [percentage, setPercentage] = useState(String(settings.discount_percentage));
  const [startsDate, setStartsDate] = useState(settings.discount_starts_at ? inputDate(settings.discount_starts_at, settings.timezone) : '');
  const [startsTime, setStartsTime] = useState(settings.discount_starts_at ? inputTime(settings.discount_starts_at, settings.timezone) : '');
  const [endsDate, setEndsDate] = useState(settings.discount_ends_at ? inputDate(settings.discount_ends_at, settings.timezone) : '');
  const [endsTime, setEndsTime] = useState(settings.discount_ends_at ? inputTime(settings.discount_ends_at, settings.timezone) : '');
  const [error, setError] = useState('');

  useEffect(() => {
    setEnabled(settings.discount_enabled);
    setName(settings.discount_name || '');
    setPercentage(String(settings.discount_percentage));
    setStartsDate(settings.discount_starts_at ? inputDate(settings.discount_starts_at, settings.timezone) : '');
    setStartsTime(settings.discount_starts_at ? inputTime(settings.discount_starts_at, settings.timezone) : '');
    setEndsDate(settings.discount_ends_at ? inputDate(settings.discount_ends_at, settings.timezone) : '');
    setEndsTime(settings.discount_ends_at ? inputTime(settings.discount_ends_at, settings.timezone) : '');
  }, [settings]);

  async function submit() {
    const amount = Number(percentage);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100 || (enabled && amount === 0)) {
      setError(enabled ? 'Enter a discount between 0.01% and 100%.' : 'Enter a percentage between 0% and 100%.');
      return;
    }

    const hasStart = Boolean(startsDate || startsTime);
    const hasEnd = Boolean(endsDate || endsTime);
    if (hasStart && (!isDateKey(startsDate) || !isTime(startsTime))) {
      setError('Enter a complete and valid start date and time, or leave both blank.');
      return;
    }
    if (hasEnd && (!isDateKey(endsDate) || !isTime(endsTime))) {
      setError('Enter a complete and valid end date and time, or leave both blank.');
      return;
    }

    const startsAt = hasStart ? zonedDateTimeToIso(startsDate, startsTime, settings.timezone) : null;
    const endsAt = hasEnd ? zonedDateTimeToIso(endsDate, endsTime, settings.timezone) : null;
    if (startsAt && endsAt && endsAt <= startsAt) {
      setError('The discount end must be later than its start.');
      return;
    }

    setError('');
    await onSave({
      enabled,
      endsAt,
      name: name.trim() || null,
      percentage: amount,
      startsAt,
    });
  }

  const discountedPrice = Math.max(settings.default_price * (1 - (Number(percentage) || 0) / 100), 0);

  return (
    <View style={styles.hoursStack}>
      <View style={styles.formCard}>
        <View style={styles.dayHeading}>
          <View style={styles.headingCopy}>
            <Text style={styles.cardTitle}>Reservation discount</Text>
            <Text style={styles.cardCopy}>New reservations made during the active window receive this discount automatically.</Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: enabled }}
            onPress={() => setEnabled((current) => !current)}
            style={[styles.openToggle, enabled && styles.openToggleSelected]}>
            <Ionicons color={enabled ? colors.onAccent : colors.muted} name={enabled ? 'checkmark' : 'close'} size={16} />
            <Text style={[styles.openToggleText, enabled && styles.openToggleTextSelected]}>{enabled ? 'Active' : 'Off'}</Text>
          </Pressable>
        </View>

        <View style={styles.priceSummary}>
          <View>
            <Text style={styles.summaryLabel}>Standard price</Text>
            <Text style={styles.summaryValue}>${settings.default_price.toFixed(2)}</Text>
          </View>
          <Ionicons color={colors.accent} name="arrow-forward" size={20} />
          <View>
            <Text style={styles.summaryLabel}>Discounted price</Text>
            <Text style={styles.summaryValue}>${discountedPrice.toFixed(2)}</Text>
          </View>
        </View>

        <Field label="Discount name" onChangeText={setName} placeholder="Summer offer" value={name} />
        <Field inputMode="decimal" keyboardType="decimal-pad" label="Discount percentage" onChangeText={setPercentage} placeholder="15" value={percentage} />
        <View style={styles.dayFields}>
          <View style={styles.flexField}><Field label="Starts on (optional)" onChangeText={setStartsDate} placeholder="YYYY-MM-DD" value={startsDate} /></View>
          <View style={styles.flexField}><Field label="Start time" onChangeText={setStartsTime} placeholder="16:00" value={startsTime} /></View>
        </View>
        <View style={styles.dayFields}>
          <View style={styles.flexField}><Field label="Ends on (optional)" onChangeText={setEndsDate} placeholder="YYYY-MM-DD" value={endsDate} /></View>
          <View style={styles.flexField}><Field label="End time" onChangeText={setEndsTime} placeholder="22:00" value={endsTime} /></View>
        </View>
        <Text style={styles.hint}>Leave both start and end blank to keep the discount active until you turn it off.</Text>
        {error ? <Notice>{error}</Notice> : null}
        <ActionButton disabled={busy} icon="pricetag-outline" onPress={() => void submit()}>
          {busy ? 'Saving…' : 'Save pricing'}
        </ActionButton>
      </View>
    </View>
  );
}

function orderedRules(rules: ScheduleRule[]) {
  return [...rules].sort((first, second) => first.day_of_week - second.day_of_week);
}
