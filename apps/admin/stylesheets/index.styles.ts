// Styles the root application and authentication content containers.

import { StyleSheet } from "react-native";

import { colors, layout } from "@/constants/admin-theme";

export const indexStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  authContent: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
  },
});
