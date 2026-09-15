import { useInView } from "../../hooks/useInView";
import "./reveal.css";

// A one-shot scroll reveal: fades and lifts an element into place the first time
// it enters the viewport. Used sparingly, only where the reveal marks a real
// narrative beat — not applied blanket-wide across every section.
export default function Reveal({ as: Tag = "div", className = "", delay = 0, children, ...rest }) {
  const [ref, inView] = useInView();

  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? "is-in-view" : ""} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
