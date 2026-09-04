import { useMemo, useState } from "react";
import "./form-search-select.css";

export default function FormSearchSelect({ forms, value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = forms.find((f) => f.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((f) => (f.title || "Untitled form").toLowerCase().includes(q));
  }, [forms, query]);

  const pick = (form) => {
    onChange(form.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="form-search-select">
      {selected && !open ? (
        <button type="button" className="form-search-selected" onClick={() => setOpen(true)}>
          <span>{selected.title || "Untitled form"}</span>
          <span className="form-search-change">Change</span>
        </button>
      ) : (
        <>
          <input
            type="text"
            className="dash-form-input"
            placeholder="Search forms..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            autoFocus={open}
          />
          {open && (
            <div className="form-search-results">
              {filtered.length === 0 ? (
                <p className="form-search-empty">No forms found.</p>
              ) : (
                filtered.map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    className="form-search-result"
                    onClick={() => pick(f)}
                  >
                    <span>{f.title || "Untitled form"}</span>
                    <span className="form-search-result-meta">{f.questionCount} question{f.questionCount === 1 ? "" : "s"}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
