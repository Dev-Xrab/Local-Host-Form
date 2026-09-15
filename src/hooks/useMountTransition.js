import { useEffect, useState } from "react";

// Keeps a conditionally-rendered element mounted for one extra tick after `active`
// goes false, so its exit transition can play instead of vanishing instantly.
export function useMountTransition(active, duration = 200) {
  const [shouldRender, setShouldRender] = useState(active);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let raf;
    let timer;

    if (active) {
      setShouldRender(true);
      raf = requestAnimationFrame(() => setVisible(true));
    } else if (shouldRender) {
      setVisible(false);
      timer = setTimeout(() => setShouldRender(false), duration);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, duration]);

  return [shouldRender, visible];
}
