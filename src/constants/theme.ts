export const spacing = { md: 16, lg: 20, xl: 24 } as const;
export const radius = { sm: 10, md: 14, lg: 18, xl: 22 } as const;
export const screenPadding = 18;

const common = {
  primary: '#849D78',
  primaryStrong: '#526E4B',
  primarySoft: '#ECF1E8',
  calcium: '#D59A45',
  calciumSoft: '#FFF4DF',
  heme: '#E99393',
  hemeSoft: '#FCEBEC',
  danger: '#C95D5D',
  warning: '#B77B2E',
  white: '#FFFFFF',
};

export const lightTheme = {
  ...common,
  background: '#F8F7F3',
  surface: '#FCFBF8',
  surfaceElevated: '#FFFFFF',
  text: '#27342E',
  textSecondary: '#69736E',
  muted: '#929B96',
  border: '#E5E3DB',
  divider: '#ECE9E2',
  tabBar: '#FFFEFB',
  input: '#FBFAF7',
  overlay: 'rgba(20, 39, 35, 0.35)',
};

const darkTheme = {
  ...common,
  primary: '#A7BD9C',
  primaryStrong: '#BDD0B4',
  primarySoft: '#25382D',
  calcium: '#E0B061',
  heme: '#F0A4A4',
  calciumSoft: '#3A3021',
  hemeSoft: '#3B282B',
  background: '#111815',
  surface: '#17201C',
  surfaceElevated: '#1D2823',
  text: '#F2F7F4',
  textSecondary: '#B2C0B9',
  muted: '#7D8C85',
  border: '#304039',
  divider: '#293730',
  tabBar: '#15201C',
  input: '#1C2824',
  overlay: 'rgba(0, 0, 0, 0.65)',
};

type AppTheme = typeof lightTheme;
export function getTheme(darkMode: boolean): AppTheme {
  return darkMode ? darkTheme : lightTheme;
}

export const shadows = {
  card: { shadowColor: '#203A31', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
};
