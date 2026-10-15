import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import QRCode from "qrcode";

/** Renders a QR code as SVG (works on web and native; no canvas or data-URL needed). Always dark-on-white so it scans in dark mode. */
export function QrCode({ value, size = 128 }: { value: string; size?: number }) {
  const { count, path } = useMemo(() => {
    const qr = QRCode.create(value || " ", { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const data = qr.modules.data as unknown as ArrayLike<number>;
    let d = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (data[y * n + x]) d += `M${x + 1} ${y + 1}h1v1h-1z`;
    return { count: n, path: d };
  }, [value]);

  const box = count + 2; // 1-module quiet zone on each side
  return (
    <View accessibilityRole="image" accessibilityLabel={`QR code for ${value}`} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${box} ${box}`}>
        <Rect width={box} height={box} fill="#fff" />
        <Path d={path} fill="#000" />
      </Svg>
    </View>
  );
}
