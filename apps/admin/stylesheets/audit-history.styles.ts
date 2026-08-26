// Styles the administrative audit timeline and change details.

import { StyleSheet } from "react-native";

import { colors, radii } from "@/constants/admin-theme";

export const auditHistoryStyles = StyleSheet.create({
  stack: { gap: 14 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  copy: { marginTop: 5, color: colors.muted, fontSize: 13, lineHeight: 19 },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch' },
  timelineRail: { width: 24, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, marginTop: 20, borderRadius: 5, backgroundColor: colors.accent },
  timelineLine: { width: 1, flex: 1, backgroundColor: colors.border },
  card: { flex: 1, gap: 8, marginBottom: 8, padding: 15, borderWidth: 1, borderColor: colors.border, borderRadius: radii.medium, backgroundColor: colors.surface },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardHeadingCopy: { minWidth: 0, flex: 1 },
  actor: { color: colors.text, fontSize: 14, fontWeight: '800' },
  action: { marginTop: 2, color: colors.text, fontSize: 14 },
  timestamp: { color: colors.muted, fontSize: 12 },
  details: { gap: 8, marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  identifier: { color: colors.muted, fontSize: 11 },
  detailText: { color: colors.text, fontSize: 13 },
  changeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  changeLabel: { width: '100%', color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  beforeValue: { color: colors.secondary, fontSize: 13, textDecorationLine: 'line-through' },
  afterValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
