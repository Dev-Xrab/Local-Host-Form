import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QrCode({ value, size = 128 }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return <div className="qr-code-placeholder" style={{ width: size, height: size }} />;
  }

  return <img src={dataUrl} alt="QR code" width={size} height={size} className="qr-code-img" />;
}
