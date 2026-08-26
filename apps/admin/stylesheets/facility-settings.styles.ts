// Styles facility information, schedule, and pricing forms.

import { StyleSheet } from "react-native";

import { colors, radii } from "@/constants/admin-theme";

export const facilitySettingStyles = StyleSheet.create({
  formCard: {
    gap: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    backgroundColor: colors.surface,
  },
  hoursStack: {
    gap: 14,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  cardCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  headingCopy: {
    minWidth: 0,
    flex: 1,
  },
  priceSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: radii.small,
    backgroundColor: colors.panel,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    marginTop: 3,
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  dayCard: {
    gap: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    backgroundColor: colors.surface,
  },
  dayHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dayName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  openToggle: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 19,
    backgroundColor: colors.panel,
  },
  openToggleSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  openToggleText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  openToggleTextSelected: {
    color: colors.onAccent,
  },
  dayFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  flexField: {
    minWidth: 96,
    flex: 1,
  },
});
