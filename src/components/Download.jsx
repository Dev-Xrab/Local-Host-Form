import { motion } from "motion/react";
import { Icons } from "./icons";
import { ANDROID_DOWNLOAD_URL, RELEASE_VERSION, WINDOWS_DOWNLOAD_URL } from "../constants";
import { SectionHead, ease } from "./ui/Section";

const CARDS = [
  {
    id: "windows",
    icon: "monitor",
    title: "Windows",
    badge: "Recommended",
    meta: "Installer · 108 MB",
    href: WINDOWS_DOWNLOAD_URL,
    cta: "Download for Windows",
    points: [
      "Starts its own local server. Respondents join from any browser on your network.",
      "Includes the one-click public link for remote respondents.",
      "Not code-signed yet, so SmartScreen may warn. Choose More info, then Run anyway.",
    ],
  },
  {
    id: "android",
    icon: "devices",
    title: "Android",
    badge: "Experimental",
    meta: "APK · 68 MB",
    href: ANDROID_DOWNLOAD_URL,
    cta: "Download the APK",
    points: [
      "Hosts a session from your phone to respondents on the same Wi-Fi.",
      "Open the file on your phone and allow installs from this source. It isn't on Google Play.",
      "For ARM phones and tablets. No public link, and the app must stay open during a session.",
    ],
  },
];

export default function Download() {
  return (
    <section id="download" className="section download">
      <div className="container">
        <SectionHead eyebrow={`Download · ${RELEASE_VERSION}`} title="Get Self Host Form">
          Free for personal and educational use. No account and no signup.
        </SectionHead>

        <div className="download-grid">
          {CARDS.map((c, i) => {
            const Icon = Icons[c.icon];
            return (
              <motion.article
                key={c.id}
                className="download-card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "0px 0px -60px 0px" }}
                transition={{ duration: 0.6, ease, delay: i * 0.1 }}
              >
                <div className="download-head">
                  <span className="icon-chip">
                    <Icon />
                  </span>
                  <div>
                    <h3>{c.title}</h3>
                    <p>{c.meta}</p>
                  </div>
                  <span className={`badge ${c.id === "windows" ? "badge-live" : "badge-muted"}`}>{c.badge}</span>
                </div>
                <ul className="download-points">
                  {c.points.map((p) => (
                    <li key={p}>
                      <Icons.checkCircle className="check-icon" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <a href={c.href} className={`btn btn-lg btn-block ${c.id === "windows" ? "btn-primary" : "btn-secondary"}`} download>
                  <Icons.download className="btn-icon" /> {c.cta}
                </a>
              </motion.article>
            );
          })}
        </div>

        <p className="download-foot">
Other platforms are not available as downloads yet.
        </p>
      </div>
    </section>
  );
}
