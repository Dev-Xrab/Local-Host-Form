import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icons } from "../icons";
import { ease } from "./Section";

// Full-screen preview of a screenshot so small interface text can be read. Esc or a click closes it.
export default function Lightbox({ image, onClose }) {
  useEffect(() => {
    if (!image) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [image, onClose]);

  return (
    <AnimatePresence>
      {image && (
        <motion.div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={image.alt}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <button type="button" className="lightbox-close" aria-label="Close preview" onClick={onClose}>
            <Icons.close />
          </button>
          <motion.img
            src={image.src}
            alt={image.alt}
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98 }}
            transition={{ duration: 0.3, ease }}
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
