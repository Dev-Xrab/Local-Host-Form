// A real product capture. Both themes ship; CSS shows the one that matches the page theme.
export const SHOTS = {
  session: { w: 2240, h: 1440, alt: "The session screen in Self-Host Form: join code, link, QR code and live respondent counts" },
  results: { w: 2240, h: 1440, alt: "The Results tab of a form, with the number of responses and a summary of each question" },
  editor: { w: 2240, h: 1440, alt: "The form editor with a feedback form: a multiple choice question and its options" },
  answer: { w: 1170, h: 2340, alt: "The respondent view on a phone, with the countdown timer and the first question" },
  join: { w: 1170, h: 2340, alt: "The respondent view on a phone, asking for a name to start answering" },
};

export default function Shot({ name, className = "", priority = false, alt }) {
  const s = SHOTS[name];
  return (
    <span className={`shot ${className}`} style={{ aspectRatio: `${s.w} / ${s.h}` }}>
      {["dark", "light"].map((t) => (
        <img key={t} className={`shot-${t}`} src={`/shots/${t}-${name}.webp`} width={s.w} height={s.h} alt={alt ?? s.alt} loading={priority ? "eager" : "lazy"} decoding="async" />
      ))}
    </span>
  );
}
