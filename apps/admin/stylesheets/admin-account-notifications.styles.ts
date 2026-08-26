// Styles the account-notification button, list, and notification cards.

import { StyleSheet } from "react-native";

import { colors, layout } from "@/constants/admin-theme";

export const adminAccountNotificationStyles = StyleSheet.create({
  bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pressed: { opacity: 0.68 },
  badge: { position: 'absolute', right: -4, top: -5, minWidth: 20, height: 20, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.background, borderRadius: 10 },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  scrollContent: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', padding: layout.gutter, paddingBottom: 52, gap: 18 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.text, paddingBottom: 14 },
  headingCopy: { flex: 1, gap: 5 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 29, lineHeight: 32, fontWeight: '900', letterSpacing: -1 },
  markButton: { maxWidth: 170 },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  list: { gap: 10 },
  item: { flexDirection: 'row', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  itemUnread: { borderLeftWidth: 4, borderLeftColor: colors.accent, backgroundColor: colors.paleAccent },
  itemIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surface },
  itemCopy: { flex: 1, gap: 4 },
  itemHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  accountName: { color: colors.text, fontSize: 17, fontWeight: '900' },
  date: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
