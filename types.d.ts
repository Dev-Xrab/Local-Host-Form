declare module "qrcode" {
  const QRCode: {
    create(text: string, options?: { errorCorrectionLevel?: "L" | "M" | "Q" | "H" }): { modules: { size: number; data: unknown } };
  };
  export default QRCode;
}

// Web-only: the template hover preview renders into document.body through a portal.
declare module "react-dom" {
  import type { ReactNode } from "react";
  export function createPortal(children: ReactNode, container: Element | DocumentFragment): ReactNode;
}
