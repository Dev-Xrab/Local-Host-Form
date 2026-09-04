// A respondent's own copy of what they answered — plain text so it opens anywhere,
// no spreadsheet app required. Choices are only included when the form owner has
// enabled that (see the form's "Download includes all choices" setting).
export function downloadAnswersAsText(formTitle, answers) {
  const lines = [formTitle || "Form responses", "=".repeat((formTitle || "Form responses").length), ""];

  answers.forEach((a, i) => {
    lines.push(`${i + 1}. ${a.title || "Untitled question"}`);
    if (a.choices) {
      lines.push(`   Choices: ${a.choices.join(", ")}`);
    }
    lines.push(`   Your answer: ${a.submittedAnswer}`);
    lines.push("");
  });

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(formTitle || "responses").trim().replace(/\s+/g, "-").toLowerCase()}-my-answers.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
