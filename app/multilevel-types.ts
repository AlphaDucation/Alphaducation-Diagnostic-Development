import type { DiagnosticResult } from "@/app/types";

export type CoverageStatus = "taught" | "in_progress" | "not_taught" | "unknown";
export type AssessmentMode = "entry_diagnostic" | "midyear" | "end_year" | "placement";

export type BankAssessment = {
  assessmentId: string;
  slug: string;
  gradeCode: string;
  streamCode: string;
  language: "fr";
  version: number;
  titleFr: string;
  purposeFr: string;
  estimatedMinutes: number;
  studyAgeBand: string;
  introEyebrowFr: string;
  introDescriptionFr: string;
  noticeFr: string;
};

export type ModeRule = {
  modeRuleId: string;
  assessmentId: string;
  assessmentMode: AssessmentMode;
  labelFr: string;
  descriptionFr: string;
  prerequisitePolicy: string;
  taughtTopicPolicy: string;
  maxMathItems: number;
  targetMinutes: number;
};

export type CurriculumTopic = {
  topicId: string;
  gradeCode: string;
  streamCode: string;
  topicFr: string;
  subtopicFr: string;
  curriculumOrder: number;
  isPrerequisiteCore: boolean;
};

export type BankItem = {
  itemId: string;
  section: string;
  ageBand: string;
  gradeMin: string;
  gradeMax: string;
  streamCode: string;
  topicId?: string;
  skillId?: string;
  prerequisiteSkillId?: string;
  processPrimary?: string;
  processSecondary?: string;
  itemFormat: string;
  promptFr: string;
  stimulusFr?: string;
  difficulty: string;
  targetTimeSec: number;
  maxPoints: number;
  confidenceRequired: boolean;
  taughtTopicRule: "prerequisite_always" | "current_if_taught" | "optional_probe";
  anchorScope: string;
  displayOrder: number;
  responseUnit?: string;
};

export type BankOption = { optionId: string; itemId: string; displayOrder: number; optionTextFr: string };
export type BankScale = { scaleId: string; valueCode: string; labelFr: string; displayOrder: number; numericValue: number; construct: string; ageBand: string };

export type BankDefinition = {
  slug: string;
  version: number;
  language: "fr";
  title: string;
  estimated_minutes: number;
  content: {
    schemaVersion: "alphadiagnostic-bank-v1";
    assessment: BankAssessment;
    routing: { modes: ModeRule[]; coverageStatuses: Array<{ code: CoverageStatus; labelFr: string }> };
    curriculumTopics: CurriculumTopic[];
    items: BankItem[];
    options: BankOption[];
    scales: BankScale[];
  };
};

export type CatalogEntry = {
  slug: string;
  version: number;
  title: string;
  estimatedMinutes: number;
  gradeCode: string;
  streamCode: string;
  modes: ModeRule[];
};

export type TopicGroup = { key: string; label: string; topicIds: string[]; order: number };
export type TopicCoverage = { topicId: string; status: CoverageStatus };
export type RoutedAssessment = { mathItems: BankItem[]; profileItems: BankItem[]; allItems: BankItem[]; mode: ModeRule };
export type GenericResponse = { itemId: string; optionId?: string; answer?: string; confidence?: number };

export type MultilevelDiagnosticResult = DiagnosticResult & {
  attemptId: string;
  processProfile?: Array<{ processCode: string; score: number; evidenceCount: number; band: string }>;
  misconceptionMap?: Array<{ code: string; label: string; evidenceCount: number; stateCode: string }>;
  recommendedPlan?: Array<{ day: number; focus: string; action: string; duration: string; interventionId?: string }>;
  notAssessedTopics?: Array<{ topicId: string; status: CoverageStatus; label: string; subtopic?: string }>;
  diagnosticContext?: { grade: string; stream?: string; mode: AssessmentMode; modeLabel: string; assessedMathItems: number; notAssessedTopicCount: number };
};
