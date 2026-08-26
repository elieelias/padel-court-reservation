// Defines the shared color, spacing, radius, and layout values used throughout the admin app.

export const colors = {
  accent: '#1478B8',
  background: '#F4F7FA',
  ballGreen: '#DDEF55',
  border: '#C3C7CC',
  clay: '#D7DBDF',
  muted: '#6E767E',
  oat: '#E6E9ED',
  onAccent: '#F4F7FA',
  paleAccent: '#D9E8F2',
  panel: '#F0F3F7',
  sage: '#BED9EA',
  secondary: '#A12B2B',
  surface: '#F6F8FB',
  text: '#26313B',
  white: '#FFFFFF',
};

export const fonts = {
  bold: 'Epilogue_700Bold',
  medium: 'Epilogue_500Medium',
  regular: 'Epilogue_400Regular',
  semiBold: 'Epilogue_600SemiBold',
} as const;

export const radii = {
  small: 16,
  medium: 22,
  large: 30,
} as const;

export const layout = {
  gutter: 20,
  maxContentWidth: 760,
};
