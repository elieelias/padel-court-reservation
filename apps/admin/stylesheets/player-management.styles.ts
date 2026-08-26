// Styles the player list, profile details, statistics, and account controls.

import { StyleSheet } from "react-native";

import { colors } from "@/constants/admin-theme";

export const playerManagementStyles = StyleSheet.create({
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
  formScroll: {
      paddingVertical: 22,
      paddingBottom: 48,
      gap: 18,
    },
  panelStack: {
      gap: 18,
    },
  playerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
  playerDeleteButton: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.secondary,
      backgroundColor: colors.surface,
    },
  playerDeleteButtonDisabled: {
      opacity: 0.42,
    },
  playerDeleteButtonPressed: {
      backgroundColor: colors.background,
    },
  playerDeleteButtonText: {
      color: colors.secondary,
      fontSize: 15,
      fontWeight: '800',
    },
  playerDeleteCopy: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
    },
  playerDeleteSection: {
      gap: 10,
      marginTop: 8,
      paddingTop: 18,
      borderTopWidth: 1,
      borderTopColor: colors.text,
    },
  playerDeleteTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
  playerEditTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      paddingTop: 2,
    },
  playerInitial: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
  playerInitialText: {
      color: colors.onAccent,
      fontSize: 20,
      fontWeight: '900',
    },
  playerProfileHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
  playerProfileInitial: {
      width: 64,
      height: 64,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
  playerProfileInitialText: {
      color: colors.onAccent,
      fontSize: 28,
      fontWeight: '900',
    },
  playerProfileName: {
      color: colors.text,
      fontSize: 24,
      lineHeight: 28,
      fontWeight: '900',
      letterSpacing: -0.8,
    },
  playerProfileUsername: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 4,
    },
  playerStat: {
      flex: 1,
      minHeight: 106,
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
  playerStatLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 15,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
  playerStatValue: {
      color: colors.accent,
      fontSize: 36,
      lineHeight: 40,
      fontWeight: '900',
      letterSpacing: -1.5,
    },
  playerStatsLedger: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.text,
    },
  playerUsername: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
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
});
