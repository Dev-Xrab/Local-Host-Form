import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/site.css";
import LegalPage from "./components/LegalPage";

// privacy/index.html and terms/index.html both load this entry; data-page picks the document.
const page = document.body.dataset.page === "terms" ? "terms" : "privacy";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LegalPage page={page} />
  </StrictMode>
);
