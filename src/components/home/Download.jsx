import { motion } from "motion/react";
import { Icons } from "../icons";
import { Brands } from "../brandIcons";
import SectionHead from "./SectionHead";
import { ease } from "./primitives";
import { usePlatform } from "../../hooks/usePlatform";
import { ANDROID_DOWNLOAD_URL, LINUX_DOWNLOAD_URL, MAC_DOWNLOAD_URL, RELEASE_VERSION, WINDOWS_DOWNLOAD_URL } from "../../constants";

const ROWS = [
  { id: "windows", title: "Windows", meta: "Installer", href: WINDOWS_DOWNLOAD_URL, note: "SmartScreen may warn: More info, then Run anyway." },
  { id: "mac", brand: "apple", title: "macOS", meta: "DMG, Intel and Apple Silicon", href: MAC_DOWNLOAD_URL, note: "Not notarized yet: right-click, then Open." },
  { id: "linux", title: "Linux", meta: "tar.gz, x64", href: LINUX_DOWNLOAD_URL, note: "Extract and run the binary." },
  { id: "android", title: "Android", meta: "APK, experimental", href: ANDROID_DOWNLOAD_URL, note: "Same Wi-Fi only. Keep the app open." },
];

export default function Download() {
  const platform = usePlatform();
  return (
    <section id="download" className="section download">
      <div className="container">
        <SectionHead title={`Install ${RELEASE_VERSION}. Free for personal and educational use.`} />
        <ul className="dl-list">
          {ROWS.map((r, i) => {
            const Icon = Brands[r.brand ?? r.id];
            return (
              <motion.li key={r.id} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease, delay: i * 0.07 }}>
                <a href={r.href} download className={r.id === platform ? "is-rec" : ""}>
                  <span className="dl-os">
                    <Icon />
                    <b>{r.title}</b>
                    {r.id === platform && <em>Recommended</em>}
                  </span>
                  <span className="dl-meta">{r.meta}</span>
                  <span className="dl-note">{r.note}</span>
                  <span className="dl-go">
                    Download <Icons.arrowRight />
                  </span>
                </a>
              </motion.li>
            );
          })}
        </ul>
        <details className="dl-help">
          <summary>macOS says the app is damaged?</summary>
          <p>
            Run <code>xattr -cr "/Applications/Self Host Form.app"</code> in Terminal, then open it again.
          </p>
        </details>
      </div>
    </section>
  );
}
