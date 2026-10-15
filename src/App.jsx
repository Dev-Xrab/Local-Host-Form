import { MotionConfig } from "motion/react";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import FactStrip from "./components/FactStrip";
import Why from "./components/Why";
import Story from "./components/Story";
import Features from "./components/Features";
import LiveDemo from "./components/LiveDemo";
import SelfHost from "./components/SelfHost";
import Compare from "./components/Compare";
import Audience from "./components/Audience";
import Faq from "./components/Faq";
import FinalCta from "./components/FinalCta";
import Footer from "./components/Footer";
import "./styles/site.css";

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Nav />
      <main id="main-content">
        <Hero />
        <FactStrip />
        <Why />
        <Story />
        <Features />
        <LiveDemo />
        <SelfHost />
        <Compare />
        <Audience />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </MotionConfig>
  );
}
