import { Image, ImageStyle, StyleProp } from 'react-native';

const source = require('../../assets/mamacare-logo-official.png');

export function BrandLogo({ style }: { style?: StyleProp<ImageStyle> }) {
  return <Image accessibilityLabel="MamaCare Vitamin Reminder logo" source={source} resizeMode="contain" style={style} />;
}
