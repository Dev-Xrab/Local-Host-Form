import { jsPDF } from "jspdf";

// A respondent's own copy of what they answered, as a PDF. Every page is drawn onto a canvas and
// placed in the PDF as a picture — the file contains no text layer, so nothing in it can be
// selected, searched or copied out (the same "no copying" spirit as the respondent page itself).
// Choices are only included when the form owner has enabled that (see the form's "Download
// includes all choices" setting).

const PAGE_W = 794; // A4 at 96 dpi, in CSS pixels — everything below is laid out in these units
const PAGE_H = 1123;
const SCALE = 2; // pixel density of the rendered pages: 2x keeps small text crisp when printed
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 48;

const FONT = 'Inter, "Segoe UI", Helvetica, Arial, sans-serif';
const INK = "#37352f";
const MUTED = "#787774";
const FAINT = "#9b9a97";
const RULE = "#e9e9e7";
const PANEL = "#f7f7f5";

function newPage() {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W * SCALE;
  canvas.height = PAGE_H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.textBaseline = "alphabetic";
  return { canvas, ctx };
}

// Greedy word wrap that honours explicit newlines and splits a single over-long word (a URL, say)
// across lines instead of letting it run off the page.
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  String(text ?? "")
    .split("\n")
    .forEach((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push("");
        return;
      }
      let line = "";
      words.forEach((word) => {
        let candidate = line ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth) {
          line = candidate;
          return;
        }
        if (line) lines.push(line);
        line = "";
        candidate = word;
        while (ctx.measureText(candidate).width > maxWidth) {
          let cut = candidate.length - 1;
          while (cut > 1 && ctx.measureText(candidate.slice(0, cut)).width > maxWidth) cut -= 1;
          lines.push(candidate.slice(0, cut));
          candidate = candidate.slice(cut);
        }
        line = candidate;
      });
      lines.push(line);
    });
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const setFont = (ctx, size, weight = 400) => {
  ctx.font = `${weight} ${size}px ${FONT}`;
};

function loadImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export async function downloadAnswersAsPdf({
  formTitle,
  respondentName,
  sessionName,
  submittedAt,
  score,
  maxScore,
  answers,
}) {
  const pages = [];
  let page = newPage();
  pages.push(page);
  let y = MARGIN;
  const limit = PAGE_H - MARGIN - FOOTER_H;

  const ensureSpace = (height) => {
    if (y + height <= limit) return;
    page = newPage();
    pages.push(page);
    y = MARGIN;
  };

  // ---- Header ----
  const { ctx: c0 } = page;
  setFont(c0, 11, 600);
  c0.fillStyle = FAINT;
  c0.fillText("SELF HOST FORM  ·  MY ANSWERS", MARGIN, y + 10);
  y += 34;

  setFont(c0, 25, 700);
  c0.fillStyle = INK;
  wrapText(c0, formTitle || "Form responses", CONTENT_W).forEach((line) => {
    c0.fillText(line, MARGIN, y + 22);
    y += 32;
  });
  y += 4;

  const meta = [
    respondentName ? ["Respondent", respondentName] : null,
    sessionName ? ["Session", sessionName] : null,
    ["Submitted", new Date(submittedAt || Date.now()).toLocaleString()],
    score !== null && score !== undefined && maxScore
      ? ["Score", `${score} / ${maxScore}  (${Math.round((score / maxScore) * 1000) / 10}%)`]
      : null,
  ].filter(Boolean);

  const metaH = meta.length * 22 + 24;
  c0.fillStyle = PANEL;
  roundRect(c0, MARGIN, y, CONTENT_W, metaH, 10);
  c0.fill();
  meta.forEach(([label, value], i) => {
    const rowY = y + 28 + i * 22;
    setFont(c0, 12, 500);
    c0.fillStyle = MUTED;
    c0.fillText(label, MARGIN + 18, rowY);
    setFont(c0, 13, 600);
    c0.fillStyle = INK;
    c0.fillText(value, MARGIN + 116, rowY);
  });
  y += metaH + 26;

  // ---- Questions & answers ----
  for (const [i, a] of answers.entries()) {
    const measure = page.ctx;
    setFont(measure, 14, 600);
    const titleLines = wrapText(measure, a.title || "Untitled question", CONTENT_W - 34);
    setFont(measure, 12, 400);
    const choiceLines = a.choices ? wrapText(measure, `Choices: ${a.choices.join(", ")}`, CONTENT_W - 34) : [];
    setFont(measure, 13.5, 500);
    const answerLines = wrapText(measure, a.fileName || a.submittedAnswer || "No answer", CONTENT_W - 36);

    const answerH = answerLines.length * 19 + 22;
    const blockH = titleLines.length * 20 + choiceLines.length * 17 + answerH + 30;
    ensureSpace(Math.min(blockH, 200)); // keep a block together when it fits; long answers may flow on

    const { ctx } = page;
    // Number badge
    ctx.fillStyle = INK;
    roundRect(ctx, MARGIN, y + 2, 22, 22, 6);
    ctx.fill();
    setFont(ctx, 11.5, 700);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), MARGIN + 11, y + 17);
    ctx.textAlign = "left";

    // Question
    setFont(ctx, 14, 600);
    ctx.fillStyle = INK;
    titleLines.forEach((line, li) => ctx.fillText(line, MARGIN + 34, y + 18 + li * 20));
    let cursor = y + titleLines.length * 20 + 6;

    if (choiceLines.length) {
      setFont(ctx, 12, 400);
      ctx.fillStyle = FAINT;
      choiceLines.forEach((line, li) => ctx.fillText(line, MARGIN + 34, cursor + 12 + li * 17));
      cursor += choiceLines.length * 17 + 4;
    }

    // Answer panel, split across pages line by line if it's very long
    let remaining = answerLines.slice();
    let panelTop = cursor + 6;
    while (remaining.length) {
      const room = Math.floor((limit - panelTop - 22) / 19);
      if (room < 1) {
        ensureSpace(limit);
        panelTop = y;
        continue;
      }
      const chunk = remaining.slice(0, room);
      remaining = remaining.slice(room);
      const h = chunk.length * 19 + 22;
      const cx = page.ctx;
      cx.fillStyle = PANEL;
      roundRect(cx, MARGIN + 34, panelTop, CONTENT_W - 34, h, 8);
      cx.fill();
      cx.fillStyle = INK;
      cx.fillRect(MARGIN + 34, panelTop + 6, 3, h - 12);
      setFont(cx, 13.5, 500);
      cx.fillStyle = a.submittedAnswer === "No answer" ? FAINT : INK;
      chunk.forEach((line, li) => cx.fillText(line, MARGIN + 34 + 18, panelTop + 21 + li * 19));
      cursor = panelTop + h;
      if (remaining.length) {
        page = newPage();
        pages.push(page);
        y = MARGIN;
        panelTop = y;
      }
    }
    y = cursor + 12;

    if (a.fileUrl && /^data:image\//i.test(a.fileUrl)) {
      const image = await loadImage(a.fileUrl);
      if (image) {
        const width = Math.min(CONTENT_W - 34, image.width);
        const height = Math.min(330, width * image.height / image.width);
        ensureSpace(height + 22);
        page.ctx.drawImage(image, MARGIN + 34, y, width, height);
        y += height + 22;
      }
    }

    // Divider between questions
    if (i < answers.length - 1) {
      ensureSpace(20);
      page.ctx.fillStyle = RULE;
      page.ctx.fillRect(MARGIN, y, CONTENT_W, 1);
      y += 20;
    }
  }

  // ---- Footers (page count is only known now) ----
  pages.forEach(({ ctx }, i) => {
    ctx.fillStyle = RULE;
    ctx.fillRect(MARGIN, PAGE_H - MARGIN - 20, CONTENT_W, 1);
    setFont(ctx, 10.5, 400);
    ctx.fillStyle = FAINT;
    ctx.fillText(respondentName ? `${respondentName}  ·  ${formTitle || "Form"}` : formTitle || "Form", MARGIN, PAGE_H - MARGIN);
    ctx.textAlign = "right";
    ctx.fillText(`Page ${i + 1} of ${pages.length}`, PAGE_W - MARGIN, PAGE_H - MARGIN);
    ctx.textAlign = "left";
  });

  // ---- Assemble: each page is a full-bleed picture, no text objects ----
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  pages.forEach(({ canvas }, i) => {
    if (i > 0) doc.addPage();
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pw, ph, undefined, "FAST");
  });
  doc.setProperties({ title: `${formTitle || "Form"} — my answers`, creator: "Self Host Form" });

  const filename = `${(formTitle || "responses").trim().replace(/\s+/g, "-").toLowerCase()}-my-answers.pdf`;
  doc.save(filename);
}
