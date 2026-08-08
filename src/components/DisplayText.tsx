import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '../theme/theme';

type Weight = 'black' | 'heavy' | 'bold' | 'semibold';

interface Props extends TextProps {
  size: number;
  weight?: Weight;
  color?: string;
}

const familyFor: Record<Weight, string> = {
  heavy: fonts.displayBlack,
  black: fonts.displayBlack,
  bold: fonts.displayBold,
  semibold: fonts.displaySemiBold,
};

/**
 * Barlow Condensed display text for logos, section titles, and hero numbers —
 * the RN counterpart to SwiftUI's `Font.display(_:weight:)`.
 */
export function DisplayText({ size, weight = 'bold', color = colors.navy, style, ...rest }: Props) {
  const textStyle: TextStyle = {
    fontFamily: familyFor[weight],
    fontSize: size,
    color,
    // Barlow Condensed sits tight; give headings a touch of breathing room.
    lineHeight: size * 1.05,
  };
  return <Text {...rest} style={[textStyle, style]} />;
}
