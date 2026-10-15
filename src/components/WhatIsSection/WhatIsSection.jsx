import { Icons } from "../icons";
import "./what-is-section.css";

const CONTROLS = [
  { icon: "monitor", title: "Runs on your computer", text: "Install it on a Windows PC and it starts its own local server. Nothing to sign up for and nothing to subscribe to." },
  { icon: "database", title: "Data stays with you", text: "Forms and responses are stored in a local database on the host machine, not on a vendor's servers." },
  { icon: "qrCode", title: "Join by code", text: "Students open a link, scan a QR code or type a short session code. No student accounts." },
  { icon: "wifiOff", title: "Works without internet", text: "Run a whole session over your classroom Wi-Fi, even when the school's connection is down." },
  { icon: "network", title: "Public link when needed", text: "Start a temporary public link in one click for students off your network. No router changes." },
  { icon: "cloud", title: "Cloud is optional", text: "Sign in with Google only if you want to import Google Forms or sync forms to your account." },
];

export default function WhatIsSection() {
  return (
    <section id="product" className="section what-is-section">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow">Why Self Host Form</p>
          <h2>Your classroom. Your machine. Your data.</h2>
          <p>
            Hosted form tools keep your students' answers on someone else's servers. Self Host
            Form runs on a computer you control, so you decide where the data lives and who
            can reach it.
          </p>
        </div>

        <div className="whatis-grid">
          {CONTROLS.map((item) => {
            const Icon = Icons[item.icon];
            return (
              <div className="whatis-card" key={item.title}>
                <span className="whatis-icon-wrap">
                  <Icon className="whatis-icon" />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            );
          })}
        </div>

        <p className="whatis-resolve">
          It's a form and quiz builder first. Self-hosting is what lets you keep the whole
          thing in your own hands.
        </p>
      </div>
    </section>
  );
}
