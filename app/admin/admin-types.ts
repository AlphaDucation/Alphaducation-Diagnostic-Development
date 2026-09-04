import type { DiagnosticResult } from "@/app/types";

export type ReviewStatus = "new" | "in_review" | "reviewed";

export type AttemptListItem = {
  id: string;
  studentFirstName: string;
  studentLastName: string;
  grade: string;
  guardianContact: string;
  durationSeconds: number | null;
  completedAt: string;
  reviewStatus: ReviewStatus;
  reviewUpdatedAt: string | null;
  profileTitle: string;
  strengths: DiagnosticResult["strengths"];
  priorities: DiagnosticResult["priorities"];
  calibration: DiagnosticResult["calibration"];
};

export type AttemptListResponse = {
  items: AttemptListItem[];
  total: number;
  newCount: number;
  inReviewCount: number;
  reviewedCount: number;
  averageDurationSeconds: number;
};

export type AttemptDetail = {
  id: string;
  clientReference: string;
  diagnosticSlug: string;
  diagnosticVersion: number;
  student: { firstName: string; lastName: string; grade: string };
  guardian: { name: string; contact: string };
  consentConfirmed: boolean;
  parentConfirmed: boolean;
  language: string;
  durationSeconds: number | null;
  completedAt: string;
  responses: {
    math?: Array<{ itemId: string; answer: Record<string, unknown>; confidence: number }>;
    study?: Array<{ itemId: string; value: number }>;
    scenarios?: Array<{ itemId: string; optionId: string }>;
    planning?: Array<{ day: string; text: string }>;
  };
  result: DiagnosticResult;
  review: { status: ReviewStatus; notes: string; reviewedAt: string | null; updatedAt: string | null };
};
