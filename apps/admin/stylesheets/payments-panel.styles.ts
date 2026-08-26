// Styles payment summaries, period controls, and reservation payment cards.

import { StyleSheet } from "react-native";

import { colors, radii } from "@/constants/admin-theme";

export const paymentPanelStyles = StyleSheet.create({
  stack: {
    gap: 18,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  periodTitle: {
    flex: 1,
    alignItems: 'center',
  },
  periodEyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  periodName: {
    color: colors.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCard: {
    width: '48%',
    flexGrow: 1,
    minHeight: 104,
    justifyContent: 'space-between',
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    backgroundColor: colors.surface,
  },
  summaryValue: {
    color: colors.accent,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -1,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingBottom: 10,
  },
  listTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  listCount: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  paymentCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    backgroundColor: colors.surface,
  },
  paymentIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: colors.paleAccent,
  },
  paymentBody: {
    flex: 1,
    gap: 12,
  },
  paymentHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  paymentIdentity: {
    flex: 1,
  },
  playerName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  reservationTime: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  amount: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '900',
  },
  paymentFooter: {
    gap: 10,
  },
  statusGroup: {
    gap: 6,
  },
  confirmedAt: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
  },
  paymentAction: {
    alignSelf: 'stretch',
  },
});
