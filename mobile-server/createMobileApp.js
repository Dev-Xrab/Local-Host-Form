// Builds the exact same Express app the desktop server runs, mounted on the phone-friendly
// framework. Everything that touches Node (database, crypto, os) goes through the shims.
import { createApp } from "../server/createApp.js";
import { webUiMiddleware } from "./webUi.js";

/**
 * @param {object} opts
 * @param {number} opts.port
 * @param {{ read(path: string): Promise<Uint8Array | null> } | null} [opts.webUi]  Source of the web build files.
 */
export function createMobileApp({ port, webUi = null }) {
  return createApp({
    port,
    mountWebUi(app) {
      if (webUi) app.use(webUiMiddleware(webUi));
    },
  });
}
