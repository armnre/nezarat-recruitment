import type { ApplicationStatus, MeResponse, ResumeSection } from '@nezarat/shared';

export type Me = MeResponse;

export type PublicCall = {
  id: string; title: string; description: string; opensAt: string; closesAt: string; capacity: number | null;
  status: string; departmentName: string | null; facultyName: string | null;
};
export type RequiredDoc = { id: string; key: string; title: string; mimeTypes: string[]; maxSizeMb: number; required: boolean };
export type Criterion = { id: string; title: string; category: string | null; maxScore: number; weight: string };
export type CallDetail = PublicCall & { requiredDocuments: RequiredDoc[]; criteria: Criterion[] };

export type ApplicationRow = {
  id: string; callId: string; applicantId: string; status: ApplicationStatus; submittedAt: string | null;
  finalScore: string | null; createdAt: string; updatedAt: string; callTitle: string; callClosesAt: string; applicantName: string;
};
export type Application = Omit<ApplicationRow, 'callTitle' | 'callClosesAt' | 'applicantName'> & { decisionNote: string | null };
export type HistoryRow = { id: string; fromStatus: ApplicationStatus | null; toStatus: ApplicationStatus; note: string | null; createdAt: string };
export type DocRow = { id: string; requiredDocumentId: string | null; originalName: string; mime: string; size: number; createdAt: string };

export type Profile = {
  id: string; firstName: string | null; lastName: string | null; fatherName: string | null; nationalCode: string | null;
  birthDate: string | null; gender: 'male' | 'female' | null; maritalStatus: 'single' | 'married' | 'other' | null;
  province: string | null; city: string | null; address: string | null; email: string | null;
  family: { spouseName?: string; childrenCount?: number } | null; stepCompleted: number;
};
export type ResumeItem = Record<string, string | number | null> & { id: string };
export type ProfileResponse = { profile: Profile; resume: Record<ResumeSection, ResumeItem[]> };

export type Assignment = {
  id: string; applicationId: string; status: 'pending' | 'in_progress' | 'done'; dueAt: string | null; assignedAt: string;
  applicationStatus: ApplicationStatus; submittedAt: string | null; callTitle: string; applicantName: string;
  totalScore: string | null; evaluatedAt: string | null;
};
export type Evaluation = { id: string; comment: string | null; recommendation: string | null; totalScore: string | null; submittedAt: string | null };
export type Dossier = {
  application: Application; call: { id: string; title: string; workflow: { interview: boolean; minReviewers: number } };
  applicant: { fullName: string; mobile: string | null; email: string | null };
  profile: Profile | null; resume: Record<ResumeSection, ResumeItem[]> | null; documents: DocRow[];
  criteria: Criterion[]; canManage: boolean;
  mine: { assignment: { id: string; status: string; dueAt: string | null }; evaluation: Evaluation | null; scores: { criterionId: string; score: string }[] } | null;
};
export type CommitteeMember = { id: string; userId: string; fullName: string; specialization: string | null; openCount: number };
export type QueueRow = {
  id: string; status: ApplicationStatus; submittedAt: string | null; finalScore: string | null; callTitle: string; applicantName: string;
  minReviewers: number; assigned: number; evaluated: number;
};
export type Summary = {
  criteria: (Criterion & { average: number | null })[]; average: number | null; submittedCount: number;
  reviewers: { assignmentId: string; memberId: string; evaluationId: string | null; reviewer: string; status: string; dueAt: string | null; totalScore: string | null; comment: string | null; recommendation: string | null; submittedAt: string | null; scores: { criterionId: string; score: number }[] }[];
};

export type AdminStats = {
  byStatus: { status: ApplicationStatus; count: number }[]; openCalls: number; totalCalls: number; activeMembers: number;
  recent: { id: string; status: ApplicationStatus; submittedAt: string | null; applicantName: string; callTitle: string }[];
};
export type AdminCallRow = { id: string; title: string; status: 'draft' | 'published' | 'closed'; opensAt: string; closesAt: string; capacity: number | null; departmentName: string | null; applications: number };
export type AdminCall = {
  id: string; title: string; description: string; departmentId: string | null; opensAt: string; closesAt: string; capacity: number | null;
  status: 'draft' | 'published' | 'closed'; workflow: { interview: boolean; minReviewers: number }; structureLocked: boolean;
  requiredDocuments: RequiredDoc[]; criteria: Criterion[];
};
export type OrgFaculty = { id: string; name: string; departments: { id: string; name: string }[] };
export type AdminMember = { id: string; userId: string; fullName: string; mobile: string | null; specialization: string | null; facultyId: string | null; active: boolean; isChair: boolean; openCount: number; doneCount: number };
export type AuditRow = { id: string; action: string; entity: string; entityId: string | null; before: unknown; after: unknown; ip: string | null; createdAt: string; actor: string | null; actorMobile: string | null };
