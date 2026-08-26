// Provides reusable phone-style scrolling wheels for choosing dates and times.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/branded-text';
import { dateKeyFromParts, dateKeyParts } from '@/lib/admin-periods';
import { isDateKey, isTime, todayKey } from '@/lib/date';
import { dateTimeWheelStyles as styles } from '@/stylesheets/date-time-wheel-field.styles';

type WheelOption = { label: string; value: number };

type BaseFieldProps = {
  label: string;
  optional?: boolean;
  value: string;
};

export function DateWheelField({ label, onChange, optional = false, value }: BaseFieldProps & { onChange: (value: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const fallback = todayKey();
  const selected = isDateKey(value) ? dateKeyParts(value) : dateKeyParts(fallback);
  const currentYear = dateKeyParts(fallback).year;
  const years = useMemo(() => numberOptions(currentYear - 10, currentYear + 10), [currentYear]);
  const months = useMemo(() => numberValues(1, 12).map((month) => ({
    label: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, month - 1, 1))),
    value: month,
  })), []);
  const daysInMonth = new Date(Date.UTC(selected.year, selected.month, 0, 12)).getUTCDate();
  const days = numberOptions(1, daysInMonth);

  function update(parts: Partial<typeof selected>) {
    const next = { ...selected, ...parts };
    const maximumDay = new Date(Date.UTC(next.year, next.month, 0, 12)).getUTCDate();
    onChange(dateKeyFromParts(next.year, next.month, Math.min(next.day, maximumDay)));
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={() => setExpanded((current) => !current)} style={styles.valueButton}>
        <Text style={[styles.valueText, !value && styles.placeholder]}>{value ? dateLabel(value) : 'Choose a date'}</Text>
        <Text style={styles.disclosure}>{expanded ? 'Done' : 'Change'}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.pickerCard}>
          <View pointerEvents="none" style={styles.selectionBand} />
          <View style={styles.wheels}>
            <WheelColumn onChange={(month) => update({ month })} options={months} value={selected.month} />
            <WheelColumn onChange={(day) => update({ day })} options={days} value={Math.min(selected.day, daysInMonth)} />
            <WheelColumn onChange={(year) => update({ year })} options={years} value={selected.year} />
          </View>
          {optional && value ? <Pressable onPress={() => onChange('')} style={styles.clearButton}><Text style={styles.clearText}>Clear date</Text></Pressable> : null}
        </View>
      ) : null}
    </View>
  );
}

export function TimeWheelField({ label, onChange, optional = false, value }: BaseFieldProps & { onChange: (value: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [fallbackHour, fallbackMinute] = '12:00'.split(':').map(Number);
  const [selectedHour, selectedMinute] = isTime(value) ? value.split(':').map(Number) : [fallbackHour, fallbackMinute];
  const hours = useMemo(() => numberOptions(0, 23, true), []);
  const minutes = useMemo(() => numberOptions(0, 59, true), []);

  function update(hour: number, minute: number) {
    onChange(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={() => setExpanded((current) => !current)} style={styles.valueButton}>
        <Text style={[styles.valueText, !value && styles.placeholder]}>{value || 'Choose a time'}</Text>
        <Text style={styles.disclosure}>{expanded ? 'Done' : 'Change'}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.pickerCard}>
          <View pointerEvents="none" style={styles.selectionBand} />
          <View style={[styles.wheels, styles.timeWheels]}>
            <WheelColumn onChange={(hour) => update(hour, selectedMinute)} options={hours} value={selectedHour} />
            <Text style={styles.timeSeparator}>:</Text>
            <WheelColumn onChange={(minute) => update(selectedHour, minute)} options={minutes} value={selectedMinute} />
          </View>
          {optional && value ? <Pressable onPress={() => onChange('')} style={styles.clearButton}><Text style={styles.clearText}>Clear time</Text></Pressable> : null}
        </View>
      ) : null}
    </View>
  );
}

function WheelColumn({ onChange, options, value }: { onChange: (value: number) => void; options: WheelOption[]; value: number }) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ animated: false, y: selectedIndex * 44 }));
  }, [selectedIndex]);

  function selectOffset(offset: number) {
    const index = Math.max(0, Math.min(options.length - 1, Math.round(offset / 44)));
    onChange(options[index].value);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.wheelContent}
      decelerationRate="fast"
      onMomentumScrollEnd={(event) => selectOffset(event.nativeEvent.contentOffset.y)}
      onScrollEndDrag={(event) => selectOffset(event.nativeEvent.contentOffset.y)}
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      snapToInterval={44}
      style={styles.wheel}>
      {options.map((option) => (
        <Pressable key={option.value} onPress={() => onChange(option.value)} style={styles.wheelItem}>
          <Text style={[styles.wheelText, option.value === value && styles.wheelTextSelected]}>{option.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function numberValues(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function numberOptions(start: number, end: number, pad = false): WheelOption[] {
  return numberValues(start, end).map((value) => {
    return { label: pad ? String(value).padStart(2, '0') : String(value), value };
  });
}

function dateLabel(value: string) {
  const { year, month, day } = dateKeyParts(value);
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}
