import Svg, { Path, Rect } from "react-native-svg";

export default function ElevatorLogoIcon({
  size = 56,
  color = "#FFFFFF",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="10"
        stroke={color}
        strokeWidth="6"
      />

      <Path
        d="M63 17L85 52H42L63 17Z"
        stroke={color}
        strokeWidth="6"
        strokeLinejoin="round"
      />

      <Path
        d="M37 83L15 48H58L37 83Z"
        stroke={color}
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </Svg>
  );
}