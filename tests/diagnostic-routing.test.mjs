import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(async () => vite.close());

const { routeAssessment } = await vite.ssrLoadModule("/app/diagnostic-routing.ts");

function item(itemId, rule, topicId, streamCode = "ALL", section = "math", skillId = itemId) {
  return { itemId, section, ageBand: "ALL", gradeMin: "G6", gradeMax: "T", streamCode, topicId, skillId, processPrimary: "conceptual_understanding", itemFormat: "diagnostic_mcq", promptFr: itemId, difficulty: "easy", targetTimeSec: 30, maxPoints: 1, confidenceRequired: section === "math", taughtTopicRule: rule, anchorScope: "grade_only", displayOrder: Number(itemId.match(/\d+/)?.[0] ?? 1) };
}

function definition(maxMathItems = 12) {
  return { slug: "math-g6-fr", version: 1, language: "fr", title: "Test", estimated_minutes: 35, content: {
    schemaVersion: "alphadiagnostic-bank-v1",
    assessment: { assessmentId: "A", slug: "math-g6-fr", gradeCode: "G6", streamCode: "ALL", language: "fr", version: 1, titleFr: "Test", purposeFr: "Test", estimatedMinutes: 35, studyAgeBand: "ALL", introEyebrowFr: "Test", introDescriptionFr: "Test", noticeFr: "Test" },
    routing: { modes: [
      { modeRuleId: "entry", assessmentId: "A", assessmentMode: "entry_diagnostic", labelFr: "Début", descriptionFr: "", prerequisitePolicy: "all", taughtTopicPolicy: "taught", maxMathItems: 12, targetMinutes: 35 },
      { modeRuleId: "mid", assessmentId: "A", assessmentMode: "midyear", labelFr: "Milieu", descriptionFr: "", prerequisitePolicy: "sample", taughtTopicPolicy: "taught", maxMathItems, targetMinutes: 50 },
    ], coverageStatuses: [] },
    curriculumTopics: [], options: [], scales: [], items: [
      ...Array.from({ length: 14 }, (_, index) => item(`P${index + 1}`, "prerequisite_always", `OLD${index + 1}`)),
      ...Array.from({ length: 8 }, (_, index) => item(`A${index + 1}`, "current_if_taught", "TOPIC-A")),
      ...Array.from({ length: 8 }, (_, index) => item(`B${index + 1}`, "current_if_taught", "TOPIC-B")),
      item("SCI1", "current_if_taught", "TOPIC-SCI", "SCI"),
      item("HUM1", "current_if_taught", "TOPIC-HUM", "HUM"),
      item("SG1", "current_if_taught", "TOPIC-SG", "SG"),
      item("PROBE1", "optional_probe", "TOPIC-A"),
      item("META1", "prerequisite_always", undefined, "ALL", "metacognition"),
      item("AI1", "prerequisite_always", undefined, "ALL", "ai_behavior"),
    ],
  } };
}

test("entry diagnostic relies on prior-grade prerequisites when no current topic was taught", () => {
  const routed = routeAssessment(definition(), "entry_diagnostic", "ALL", [{ topicId: "TOPIC-A", status: "not_taught" }]);
  assert.equal(routed.mathItems.length, 12);
  assert.ok(routed.mathItems.every((candidate) => candidate.taughtTopicRule === "prerequisite_always"));
  assert.deepEqual(new Set(routed.profileItems.map((candidate) => candidate.itemId)), new Set(["META1", "AI1"]));
});

test("midyear includes only taught current-year topics and keeps a prerequisite sample", () => {
  const routed = routeAssessment(definition(12), "midyear", "ALL", [
    { topicId: "TOPIC-A", status: "taught" },
    { topicId: "TOPIC-B", status: "in_progress" },
  ]);
  assert.ok(routed.mathItems.some((candidate) => candidate.topicId === "TOPIC-A"));
  assert.ok(routed.mathItems.some((candidate) => candidate.taughtTopicRule === "prerequisite_always"));
  assert.ok(routed.mathItems.every((candidate) => candidate.topicId !== "TOPIC-B"));
  assert.ok(routed.mathItems.every((candidate) => candidate.taughtTopicRule !== "optional_probe"));
});

test("stream routing excludes questions belonging to another stream", () => {
  const science = routeAssessment(definition(12), "midyear", "SCI", [{ topicId: "TOPIC-SCI", status: "taught" }]);
  const humanities = routeAssessment(definition(12), "midyear", "HUM", [{ topicId: "TOPIC-HUM", status: "taught" }]);
  assert.ok(science.mathItems.some((candidate) => candidate.itemId === "SCI1"));
  assert.ok(science.mathItems.every((candidate) => candidate.itemId !== "HUM1"));
  assert.ok(humanities.mathItems.some((candidate) => candidate.itemId === "HUM1"));
  assert.ok(humanities.mathItems.every((candidate) => candidate.itemId !== "SCI1"));
});

test("Terminale branches inherit their scientific or humanities family items", () => {
  const sg = routeAssessment(definition(12), "midyear", "SG", [
    { topicId: "TOPIC-SCI", status: "taught" },
    { topicId: "TOPIC-SG", status: "taught" },
  ]);
  const lh = routeAssessment(definition(12), "midyear", "LH", [{ topicId: "TOPIC-HUM", status: "taught" }]);
  assert.ok(sg.mathItems.some((candidate) => candidate.itemId === "SCI1"));
  assert.ok(sg.mathItems.some((candidate) => candidate.itemId === "SG1"));
  assert.ok(lh.mathItems.some((candidate) => candidate.itemId === "HUM1"));
});
