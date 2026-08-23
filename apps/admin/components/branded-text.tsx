import { forwardRef, type ComponentRef } from 'react';
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { fonts } from '@/constants/admin-theme';

function fontFamilyFor(style: TextProps['style'] | TextInputProps['style']) {
  const weight = StyleSheet.flatten(style as TextStyle)?.fontWeight;

  if (weight === '900' || weight === '800' || weight === '700' || weight === 'bold') return fonts.bold;
  if (weight === '600') return fonts.semiBold;
  if (weight === '500') return fonts.medium;
  return fonts.regular;
}

export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(function BrandedText(
  { style, ...props },
  ref,
) {
  return <NativeText ref={ref} style={[style, { fontFamily: fontFamilyFor(style), fontWeight: 'normal' }]} {...props} />;
});

export const TextInput = forwardRef<ComponentRef<typeof NativeTextInput>, TextInputProps>(function BrandedTextInput(
  { style, ...props },
  ref,
) {
  return <NativeTextInput ref={ref} style={[style, { fontFamily: fontFamilyFor(style), fontWeight: 'normal' }]} {...props} />;
});
