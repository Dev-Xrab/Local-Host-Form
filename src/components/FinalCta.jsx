import { Icons } from "./icons";
import { ANDROID_DOWNLOAD_URL, LINUX_DOWNLOAD_URL, MAC_DOWNLOAD_URL, WINDOWS_DOWNLOAD_URL } from "../constants";
import { Rise } from "./ui/Section";

export default function FinalCta() {
  return (
    <section id="get-started" className="cta">
      <div className="cta-glow" aria-hidden="true" />
      <Rise className="container cta-inner">
        <h2>Run your next form on your own machine.</h2>
        <p>
          Download the Windows installer and start a session in minutes. No signup, no hosted
          account, and free for personal and educational use.
        </p>
        <div className="cta-actions">
          <a href={WINDOWS_DOWNLOAD_URL} className="btn btn-light btn-lg" download>
            <Icons.download className="btn-icon" /> Download for Windows
          </a>
          <a href={MAC_DOWNLOAD_URL} className="btn btn-outline-light btn-lg" download>
            macOS
          </a>
          <a href={LINUX_DOWNLOAD_URL} className="btn btn-outline-light btn-lg" download>
            Linux
          </a>
          <a href={ANDROID_DOWNLOAD_URL} className="btn btn-outline-light btn-lg" download>
            Android APK
          </a>
        </div>
        <p className="cta-note">Windows installer · macOS DMG · Linux x64 archive · Android APK (experimental)</p>
      </Rise>
    </section>
  );
}
