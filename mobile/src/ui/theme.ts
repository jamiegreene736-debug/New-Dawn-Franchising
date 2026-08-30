import { TextStyle } from 'react-native';

export const brand = {
  navy: '#102A43',
  navySoft: '#1E4567',
  blue: '#356C95',
  gold: '#C9961A',
  goldWash: '#FBF5E5',
  canvas: '#F6F8FA',
  white: '#FFFFFF',
  ink: '#172433',
  slate: '#59697A',
  mist: '#E9EEF3',
  line: '#D9E1E8',
  success: '#277451',
  successWash: '#E8F5EE',
  warning: '#986A0B',
  warningWash: '#FFF5D8',
  danger: '#A33A42',
  dangerWash: '#FBEAEC',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 72,
} as const;

export const type = {
  display: { fontSize: 40, lineHeight: 45, fontWeight: '800', letterSpacing: -1.1 } satisfies TextStyle,
  title: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 } satisfies TextStyle,
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.2 } satisfies TextStyle,
  subheading: { fontSize: 18, lineHeight: 24, fontWeight: '700' } satisfies TextStyle,
  bodyLarge: { fontSize: 18, lineHeight: 27, fontWeight: '400' } satisfies TextStyle,
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' } satisfies TextStyle,
  label: { fontSize: 15, lineHeight: 20, fontWeight: '700' } satisfies TextStyle,
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '600' } satisfies TextStyle,
} as const;
