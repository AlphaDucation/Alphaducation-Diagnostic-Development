import type { AssessmentMode, BankDefinition, BankItem, CatalogEntry, CoverageStatus, RoutedAssessment, TopicCoverage, TopicGroup } from "@/app/multilevel-types";

export const gradeChoices = [
  { code: "G6", label: "Grade 6 / EB6" },
  { code: "G7", label: "Grade 7 / EB7" },
  { code: "G8", label: "Grade 8 / EB8" },
  { code: "G9", label: "Grade 9 / EB9" },
  { code: "S1", label: "Secondaire 1" },
  { code: "S2", label: "Secondaire 2" },
  { code: "T", label: "Terminale" },
] as const;

export const streamChoices: Record<string, Array<{ code: string; label: string }>> = {
  S2: [{ code: "SCI", label: "Série scientifique" }, { code: "HUM", label: "Série humanités" }],
  T: [
    { code: "SG", label: "Sciences générales (SG)" },
    { code: "SV", label: "Sciences de la vie (SV)" },
    { code: "SE", label: "Sociologie et économie (SE)" },
    { code: "LH", label: "Lettres et humanités (LH)" },
  ],
};

export function selectCatalogEntry(catalog: CatalogEntry[], grade: string, stream: string) {
  if (grade === "T") return catalog.find((entry) => entry.gradeCode === grade && entry.streamCode === stream);
  return catalog.find((entry) => entry.gradeCode === grade);
}

export function currentTopicGroups(definition: BankDefinition, stream: string): TopicGroup[] {
  const grade = definition.content.assessment.gradeCode;
  const streamFamily = stream === "SG" || stream === "SV" ? "SCI" : stream === "SE" || stream === "LH" ? "HUM" : stream;
  const relevant = definition.content.curriculumTopics.filter((topic) =>
    topic.gradeCode === grade && (topic.streamCode === "ALL" || topic.streamCode === stream || topic.streamCode === streamFamily),
  );
  const grouped = new Map<string, TopicGroup>();
  for (const topic of relevant) {
    const key = `${topic.streamCode}:${topic.topicFr}`;
    const group = grouped.get(key) ?? { key, label: topic.topicFr, topicIds: [], order: topic.curriculumOrder };
    group.topicIds.push(topic.topicId);
    group.order = Math.min(group.order, topic.curriculumOrder);
    grouped.set(key, group);
  }
  return [...grouped.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "fr"));
}

export function expandTopicCoverage(groups: TopicGroup[], statuses: Record<string, CoverageStatus>): TopicCoverage[] {
  return groups.flatMap((group) => group.topicIds.map((topicId) => ({ topicId, status: statuses[group.key] ?? "unknown" })));
}

function streamCompatible(item: BankItem, stream: string) {
  const streamFamily = stream === "SG" || stream === "SV" ? "SCI" : stream === "SE" || stream === "LH" ? "HUM" : stream;
  return item.streamCode === "ALL" || item.streamCode === stream || item.streamCode === streamFamily;
}

function roundRobin(items: BankItem[], limit: number) {
  const groups = new Map<string, BankItem[]>();
  for (const item of [...items].sort((a, b) => a.displayOrder - b.displayOrder || a.itemId.localeCompare(b.itemId))) {
    const key = item.skillId ?? item.topicId ?? item.itemId;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const queues = [...groups.values()];
  const selected: BankItem[] = [];
  while (selected.length < limit && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      if (selected.length >= limit || queue.length === 0) continue;
      const item = queue.shift()!;
      selected.push(item);
      if (item.itemFormat === "two_tier_answer" && selected.length < limit) {
        const reasonIndex = queue.findIndex((candidate) => candidate.itemFormat === "two_tier_reason");
        if (reasonIndex >= 0) selected.push(queue.splice(reasonIndex, 1)[0]);
      }
    }
  }
  return selected.slice(0, limit);
}

export function routeAssessment(
  definition: BankDefinition,
  modeCode: AssessmentMode,
  stream: string,
  coverage: TopicCoverage[],
): RoutedAssessment {
  const mode = definition.content.routing.modes.find((candidate) => candidate.assessmentMode === modeCode);
  if (!mode) throw new Error("Mode de diagnostic indisponible.");
  const taught = new Set(coverage.filter((entry) => entry.status === "taught").map((entry) => entry.topicId));
  const compatible = definition.content.items.filter((item) => streamCompatible(item, stream));
  const profileItems = compatible.filter((item) => item.section !== "math").sort((a, b) => a.displayOrder - b.displayOrder || a.itemId.localeCompare(b.itemId));
  const prerequisites = compatible.filter((item) => item.section === "math" && item.taughtTopicRule === "prerequisite_always");
  const current = compatible.filter((item) => item.section === "math" && item.taughtTopicRule === "current_if_taught" && item.topicId && taught.has(item.topicId));
  const limit = Math.max(8, Math.min(40, mode.maxMathItems));
  let prerequisiteLimit = limit;
  if (modeCode === "midyear") prerequisiteLimit = Math.min(6, Math.ceil(limit * 0.3));
  if (modeCode === "end_year") prerequisiteLimit = Math.min(4, Math.ceil(limit * 0.2));
  if (modeCode === "placement") prerequisiteLimit = Math.ceil(limit * 0.45);
  if (modeCode === "entry_diagnostic") prerequisiteLimit = Math.max(6, limit - Math.min(6, current.length));
  const first = roundRobin(prerequisites, Math.min(prerequisiteLimit, limit));
  const second = roundRobin(current, Math.max(0, limit - first.length));
  let mathItems = [...first, ...second];
  if (mathItems.length < Math.min(8, limit)) mathItems = [...mathItems, ...roundRobin(prerequisites.filter((item) => !mathItems.some((selected) => selected.itemId === item.itemId)), limit - mathItems.length)];
  mathItems = mathItems.slice(0, limit);
  return { mathItems, profileItems, allItems: [...mathItems, ...profileItems], mode };
}
