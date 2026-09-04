import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editor = await readFile(new URL("../app/admin/report-editor.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("professional report includes editable summary and fourteen-day plan", () => {
  assert.match(editor, /Bilan pédagogique personnalisé/);
  assert.match(editor, /Plan personnalisé · 14 jours/);
  assert.match(editor, /day: 14/);
  assert.match(editor, /professionalSummary: summary/);
  assert.match(editor, /studyPlan: plan/);
});

test("report supports a private notes area and print-to-PDF layout", () => {
  assert.match(editor, /Notes privées de suivi/);
  assert.match(editor, /window\.print\(\)/);
  assert.match(styles, /@media print/);
  assert.match(editor, /report-private-card screen-only/);
  assert.match(styles, /@page\{size:A4/);
});
