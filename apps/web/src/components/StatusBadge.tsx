import type { ApplicationStatus } from '@nezarat/shared';
import { STATUS_LABELS_FA } from '@nezarat/shared';
import { cn } from '../lib/format';

const tone: Record<ApplicationStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-secondary text-secondary-foreground',
  screening: 'bg-secondary text-secondary-foreground',
  incomplete: 'bg-warning/15 text-warning',
  committee_review: 'bg-accent/20 text-accent-foreground',
  interview: 'bg-accent/20 text-accent-foreground',
  scored: 'bg-primary/10 text-primary',
  accepted: 'bg-success/15 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  reserve: 'bg-warning/15 text-warning',
  withdrawn: 'bg-muted text-muted-foreground line-through',
};

export function StatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tone[status], className)}>{STATUS_LABELS_FA[status]}</span>;
}
