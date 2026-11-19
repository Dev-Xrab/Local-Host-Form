import { MotionConfig } from "motion/react";
import Nav from "./components/Nav";
import Hero from "./components/home/Hero";
import Panels from "./components/home/Panels";
import Capabilities from "./components/home/Capabilities";
import LocalFirst from "./components/home/LocalFirst";
import Download from "./components/home/Download";
import Tutorial from "./components/home/Tutorial";
import Faq from "./components/home/Faq";
import FinalCta from "./components/home/FinalCta";
import Footer from "./components/Footer";
import "./styles/shell.css";
import "./styles/home.css";

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Nav />
      <main id="main-content">
        <Hero />
        <Panels />
        <Capabilities />
        <LocalFirst />
        <Download />
        <Tutorial />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </MotionConfig>
  );
}
