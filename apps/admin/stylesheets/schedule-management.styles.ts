// Styles the monthly calendar, daily timeline, and reservation forms.

import { StyleSheet } from "react-native";

import { colors } from "@/constants/admin-theme";

export const scheduleManagementStyles = StyleSheet.create({
  actionStack: {
      gap: 10,
      marginTop: 4,
    },
  blockedContent: {
      borderLeftWidth: 5,
      borderLeftColor: colors.accent,
      paddingLeft: 12,
    },
  calendarCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      marginHorizontal: -6,
      paddingHorizontal: 13,
      paddingTop: 16,
      paddingBottom: 14,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.07,
      shadowRadius: 17,
      elevation: 3,
    },
  calendarDay: {
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
  calendarDayPressed: {
      backgroundColor: colors.paleAccent,
    },
  calendarDaySelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
  calendarDaySlot: {
      width: '14.2857%',
      paddingHorizontal: 1.5,
      paddingVertical: 1.5,
    },
  calendarDayText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '500',
    },
  calendarDayTextDisabled: {
      color: colors.muted,
      opacity: 0.36,
    },
  calendarDayTextNextMonth: {
      color: colors.accent,
      opacity: 0.72,
    },
  calendarDayTextSelected: {
      color: colors.onAccent,
      fontWeight: '800',
    },
  calendarDayTextToday: {
      color: colors.accent,
      fontWeight: '800',
    },
  calendarDayToday: {
      borderColor: colors.accent,
    },
  calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
  calendarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 12,
      paddingHorizontal: 4,
    },
  calendarRangeNote: {
      color: colors.muted,
      fontSize: 11,
    },
  calendarTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
  calendarWeekday: {
      width: '14.2857%',
      paddingTop: 2,
      paddingBottom: 5,
      color: colors.muted,
      fontSize: 10,
      fontWeight: '800',
      textAlign: 'center',
    },
  calendarWeekdays: {
      flexDirection: 'row',
    },
  cardMeta: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
    },
  cardTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
  chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 10,
    },
  detailDate: {
      color: colors.muted,
      fontSize: 14,
    },
  detailGroup: {
      borderTopWidth: 1,
      borderTopColor: colors.text,
    },
  detailGroupTitle: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      paddingVertical: 11,
    },
  detailLabel: {
      color: colors.muted,
      fontSize: 13,
    },
  detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 18,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 12,
    },
  detailTime: {
      color: colors.accent,
      fontSize: 42,
      lineHeight: 44,
      fontWeight: '900',
      letterSpacing: -1.8,
    },
  detailValue: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'right',
    },
  flexField: {
      flex: 1,
    },
  formScroll: {
      paddingVertical: 22,
      paddingBottom: 48,
      gap: 18,
    },
  modalScroll: {
      paddingVertical: 22,
      paddingBottom: 48,
      gap: 18,
    },
  openHours: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
  openHoursLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
  openHoursValue: {
      flex: 1,
      color: colors.muted,
      fontSize: 13,
      textAlign: 'right',
    },
  panelStack: {
      gap: 18,
    },
  rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
  scheduleAction: {
      flex: 1,
    },
  scheduleActions: {
      flexDirection: 'row',
      gap: 9,
    },
  sectionEyebrow: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
  sectionHeading: {
      borderBottomWidth: 1,
      borderBottomColor: colors.text,
      paddingBottom: 14,
    },
  sectionTitle: {
      color: colors.text,
      fontSize: 25,
      lineHeight: 30,
      fontWeight: '800',
      letterSpacing: -0.8,
      marginTop: 6,
    },
  timeline: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  timelineContent: {
      flex: 1,
      justifyContent: 'center',
      paddingVertical: 12,
      paddingLeft: 16,
    },
  timelineEnd: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 4,
    },
  timelineRow: {
      flexDirection: 'row',
      minHeight: 82,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
  timelineStart: {
      color: colors.accent,
      fontSize: 15,
      fontWeight: '800',
    },
  timelineTime: {
      width: 82,
      paddingVertical: 14,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
  twoColumn: {
      flexDirection: 'row',
      gap: 12,
    },
});
