// Styles the dashboard shell, summary header, navigation, and tabs.

import { StyleSheet } from "react-native";

import { colors, layout } from "@/constants/admin-theme";

export const adminDashboardStyles = StyleSheet.create({
  adminName: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 3,
    },
  dateCopy: {
      paddingBottom: 10,
    },
  dateHero: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 18,
      paddingTop: 8,
    },
  dateMonth: {
      color: colors.muted,
      fontSize: 14,
      marginTop: 3,
    },
  dateNumeral: {
      color: colors.accent,
      fontSize: 92,
      lineHeight: 92,
      fontWeight: '900',
      letterSpacing: -5,
    },
  dateWeekday: {
      color: colors.text,
      fontSize: 25,
      fontWeight: '800',
      letterSpacing: -0.8,
    },
  facilityNavigation: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
  facilityNavigationItem: {
      minHeight: 46,
      flexGrow: 1,
      flexBasis: '30%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
  facilityNavigationItemSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accent,
    },
  facilityNavigationText: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: '800',
    },
  facilityNavigationTextSelected: {
      color: colors.onAccent,
    },
  headerActions: {
      flexDirection: 'row',
      gap: 8,
      flexShrink: 0,
    },
  headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
  headerIdentity: {
      flex: 1,
      minWidth: 0,
      paddingRight: 10,
    },
  panelStack: {
      gap: 18,
    },
  productName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
  screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
  scrollContent: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: layout.gutter,
      paddingBottom: 36,
      gap: 22,
    },
  sectionBody: {
      minHeight: 280,
    },
  stat: {
      flex: 1,
      paddingVertical: 16,
      paddingHorizontal: 10,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
  statLabel: {
      color: colors.muted,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '700',
      marginTop: 2,
    },
  statValue: {
      color: colors.accent,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -1,
    },
  statsGrid: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.text,
    },
  tab: {
      flex: 1,
      minHeight: 62,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
  tabBar: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.accent,
    },
  tabSelected: {
      backgroundColor: colors.accent,
    },
  tabText: {
      color: colors.accent,
      fontSize: 9,
      fontWeight: '700',
    },
  tabTextSelected: {
      color: colors.onAccent,
    },
});
