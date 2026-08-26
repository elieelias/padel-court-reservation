// Styles the reusable scrolling date and time wheels.

import { StyleSheet } from 'react-native';

import { colors, radii } from '@/constants/admin-theme';

export const dateTimeWheelStyles = StyleSheet.create({
  field: { gap: 7 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700' },
  valueButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radii.small, backgroundColor: colors.surface },
  valueText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  placeholder: { color: colors.muted, fontWeight: '500' },
  disclosure: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  pickerCard: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, backgroundColor: colors.surface },
  wheels: { height: 132, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  timeWheels: { justifyContent: 'center', paddingHorizontal: 34 },
  wheel: { flex: 1, height: 132 },
  wheelContent: { paddingVertical: 44 },
  wheelItem: { height: 44, alignItems: 'center', justifyContent: 'center' },
  wheelText: { color: colors.muted, fontSize: 17, fontWeight: '600' },
  wheelTextSelected: { color: colors.text, fontSize: 19, fontWeight: '900' },
  selectionBand: { position: 'absolute', zIndex: 0, top: 44, left: 10, right: 10, height: 44, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.accent, backgroundColor: colors.paleAccent },
  timeSeparator: { width: 24, color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  clearButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  clearText: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
});
