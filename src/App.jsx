import Navbar from "./components/Navbar/Navbar";
import Hero from "./components/Hero/Hero";
import TrustSection from "./components/TrustSection/TrustSection";
import WhatIsSection from "./components/WhatIsSection/WhatIsSection";
import HowItWorks from "./components/HowItWorks/HowItWorks";
import ProductPreview from "./components/ProductPreview/ProductPreview";
import Features from "./components/Features/Features";
import UseCases from "./components/UseCases/UseCases";
import SelfHostedSection from "./components/SelfHostedSection/SelfHostedSection";
import Comparison from "./components/Comparison/Comparison";
import AudienceSection from "./components/AudienceSection/AudienceSection";
import FAQ from "./components/FAQ/FAQ";
import FinalCTA from "./components/FinalCTA/FinalCTA";
import Footer from "./components/Footer/Footer";

function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content">
        <Hero />
        <TrustSection />
        <WhatIsSection />
        <HowItWorks />
        <ProductPreview />
        <Features />
        <UseCases />
        <SelfHostedSection />
        <Comparison />
        <AudienceSection />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}

export default App;
