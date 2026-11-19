import { Words } from "./Motion";

// Section heading in the page's one style: large, regular weight, tightly tracked.
export default function SectionHead({ title, children }) {
  return (
    <header className="vh">
      <Words text={title} className="vp-title" />
      {children}
    </header>
  );
}
