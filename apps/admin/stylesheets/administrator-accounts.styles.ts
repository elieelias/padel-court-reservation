// Styles the administrator account creation form and account list.

import { StyleSheet } from "react-native";

import { colors, layout } from "@/constants/admin-theme";

export const administratorAccountStyles = StyleSheet.create({
  scrollContent: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', padding: layout.gutter, paddingBottom: 52, gap: 22 },
  authorityBanner: { flexDirection: 'row', gap: 14, padding: 18, backgroundColor: colors.accent, borderTopWidth: 4, borderTopColor: colors.text },
  bannerCopy: { flex: 1, gap: 5 },
  bannerEyebrow: { color: colors.onAccent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  bannerTitle: { color: colors.onAccent, fontSize: 23, lineHeight: 26, fontWeight: '900', letterSpacing: -0.6 },
  bannerText: { color: colors.onAccent, fontSize: 13, lineHeight: 18, opacity: 0.88 },
  formSection: { gap: 13, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: colors.text },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  passwordNote: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: -5 },
  listSection: { gap: 12 },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  loading: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  administratorCard: { flexDirection: 'row', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  initial: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paleAccent, borderWidth: 1, borderColor: colors.accent },
  initialText: { color: colors.accent, fontSize: 19, fontWeight: '900' },
  accountCopy: { flex: 1, gap: 3 },
  accountHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  accountName: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '900' },
  accountDetail: { color: colors.text, fontSize: 13 },
  date: { color: colors.muted, fontSize: 11, marginTop: 3 },
});
