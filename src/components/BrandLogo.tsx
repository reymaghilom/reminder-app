import { Image, ImageStyle, StyleProp } from 'react-native';

const source = require('../../assets/reminder-app-logo.png');

export function BrandLogo({ style }: { style?: StyleProp<ImageStyle> }) {
  return <Image accessibilityLabel="Reminder App logo" source={source} resizeMode="contain" style={style} />;
}
