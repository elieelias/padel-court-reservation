// Styles blocked periods, facility events, reports, and their management forms.

import { StyleSheet } from "react-native";

import { colors } from "@/constants/admin-theme";

export const facilityManagementStyles = StyleSheet.create({
  blockCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
  cardActions: {
      flexDirection: 'row',
      gap: 6,
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
  flexField: {
      flex: 1,
    },
  formCard: {
      gap: 16,
      padding: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
  formCardTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: '800',
    },
  formScroll: {
      paddingVertical: 22,
      paddingBottom: 48,
      gap: 18,
    },
  listTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      borderBottomWidth: 1,
      borderBottomColor: colors.text,
      paddingBottom: 10,
    },
  panelStack: {
      gap: 18,
    },
  playerUsername: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
  reportCard: {
      gap: 10,
      padding: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 5,
      borderLeftColor: colors.accent,
    },
  reportCategory: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
  reportDetails: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 21,
    },
  rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
  savingText: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '700',
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
  twoColumn: {
      flexDirection: 'row',
      gap: 12,
    },
});
