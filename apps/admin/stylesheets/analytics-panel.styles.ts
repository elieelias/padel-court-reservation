// Styles the analytics metrics, comparison cards, legends, and charts.

import { StyleSheet } from "react-native";

import { colors } from "@/constants/admin-theme";

export const analyticsPanelStyles = StyleSheet.create({
  analyticsBarFill: {
      height: '100%',
      borderRadius: 5,
      backgroundColor: colors.accent,
    },
  analyticsBarHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  analyticsBarLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
  analyticsBarRow: {
      gap: 7,
    },
  analyticsBarTrack: {
      height: 10,
      overflow: 'hidden',
      borderRadius: 5,
      backgroundColor: colors.paleAccent,
    },
  analyticsBarValue: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '900',
    },
  analyticsColumn: {
      width: '66%',
      minHeight: 2,
      overflow: 'hidden',
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      backgroundColor: colors.border,
    },
  analyticsColumnChart: {
      minHeight: 180,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
  analyticsColumnCollected: {
      backgroundColor: colors.accent,
    },
  analyticsColumnItem: {
      flex: 1,
      alignItems: 'center',
      gap: 7,
    },
  analyticsColumnLabel: {
      color: colors.text,
      fontSize: 10,
      fontWeight: '800',
    },
  analyticsColumnOutstanding: {
      backgroundColor: colors.sage,
    },
  analyticsColumnStage: {
      height: 124,
      width: '100%',
      justifyContent: 'flex-end',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
  analyticsColumnValue: {
      width: '100%',
      color: colors.muted,
      fontSize: 9,
      fontWeight: '700',
      textAlign: 'center',
    },
  analyticsCompactDetail: {
      color: colors.muted,
      fontSize: 9,
      lineHeight: 12,
    },
  analyticsCompactLabel: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '800',
    },
  analyticsCompactMetric: {
      width: '48%',
      flexGrow: 1,
      minHeight: 95,
      padding: 12,
      justifyContent: 'space-between',
      borderRadius: 16,
      backgroundColor: colors.panel,
    },
  analyticsCompactValue: {
      color: colors.accent,
      fontSize: 27,
      fontWeight: '900',
      letterSpacing: -1,
    },
  analyticsEmptyCopy: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
    },
  analyticsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
  analyticsHero: {
      gap: 15,
      padding: 20,
      borderRadius: 24,
      backgroundColor: colors.accent,
    },
  analyticsHeroCaption: {
      color: colors.onAccent,
      fontSize: 12,
      lineHeight: 18,
    },
  analyticsHeroDetail: {
      color: colors.sage,
      fontSize: 11,
      fontWeight: '700',
    },
  analyticsHeroFill: {
      height: '100%',
      borderRadius: 8,
      backgroundColor: colors.ballGreen,
    },
  analyticsHeroLabel: {
      color: colors.onAccent,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
  analyticsHeroTrack: {
      height: 14,
      overflow: 'hidden',
      borderRadius: 8,
      backgroundColor: colors.paleAccent,
    },
  analyticsHeroValue: {
      color: colors.onAccent,
      fontSize: 50,
      lineHeight: 55,
      fontWeight: '900',
      letterSpacing: -2.5,
    },
  analyticsLegend: {
      flexDirection: 'row',
      gap: 18,
    },
  analyticsLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
  analyticsLegendLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
    },
  analyticsLegendSwatch: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
  analyticsMetric: {
      width: '48%',
      flexGrow: 1,
      minHeight: 132,
      justifyContent: 'space-between',
      padding: 15,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
    },
  analyticsMetricDetail: {
      color: colors.muted,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '600',
    },
  analyticsMetricLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
  analyticsMetricValue: {
      color: colors.accent,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -1.2,
    },
  analyticsMonthEyebrow: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
  analyticsMonthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
  analyticsMonthName: {
      color: colors.text,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '900',
      letterSpacing: -0.8,
    },
  analyticsMonthTitle: {
      flex: 1,
      alignItems: 'center',
    },
  analyticsPlayerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
  analyticsSection: {
      gap: 14,
      padding: 17,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      backgroundColor: colors.surface,
    },
  analyticsSectionTitle: {
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
});
