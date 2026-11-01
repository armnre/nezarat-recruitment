import { Children, cloneElement, forwardRef, isValidElement, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type HTMLAttributes, type LabelHTMLAttributes, type ReactElement, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, fa } from '../lib/format';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary'; size?: 'sm' | 'md' | 'lg' | 'icon'; loading?: boolean };
const variants = {
  default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/95',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
  outline: 'border border-input bg-card text-foreground hover:bg-muted hover:border-foreground/20',
  ghost: 'text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
};
const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base', icon: 'h-10 w-10' };
const btnBase = 'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

export const Button = forwardRef<HTMLButtonElement, BtnProps>(({ className, variant = 'default', size = 'md', loading, disabled, children, ...p }, ref) => (
  <button ref={ref} disabled={disabled || loading} aria-busy={loading || undefined}
    className={cn(btnBase, variants[variant], sizes[size], className)} {...p}>
    {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
    {children}
  </button>
));

const field = 'flex w-full rounded-md border border-input bg-card px-3 text-sm shadow-[inset_0_1px_1px_hsl(var(--foreground)/0.03)] transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 hover:border-foreground/25 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20';
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(field, 'h-10', className)} {...p} />
));
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(field, 'min-h-[96px] py-2 leading-7', className)} {...p} />
));
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn(field, 'h-10 pl-8', className)} {...p} />
));
export const Label = (p: LabelHTMLAttributes<HTMLLabelElement>) => <label {...p} className={cn('text-sm font-medium text-foreground', p.className)} />;

const FORM_CONTROLS: unknown[] = [Input, Textarea, Select, 'input', 'select', 'textarea'];

/** Label + control + hint/error, wired for screen readers when the child is a form control. */
export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  const id = useId();
  const msgId = `${id}-msg`;
  const only = Children.count(children) === 1 ? Children.only(children) : null;
  const control = isValidElement(only) && FORM_CONTROLS.includes(only.type) ? (only as ReactElement<Record<string, unknown>>) : null;
  const ctrlId = (control?.props.id as string | undefined) ?? id;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={control ? ctrlId : undefined}>{label}</Label>
      {control ? cloneElement(control, { id: ctrlId, 'aria-invalid': error ? true : control.props['aria-invalid'], 'aria-describedby': error || hint ? msgId : undefined }) : children}
      {error ? <p id={msgId} role="alert" className="text-xs font-medium text-destructive">{error}</p> : hint ? <p id={msgId} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('rounded-lg border bg-card text-card-foreground shadow-card', className)} {...p} />;
export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...p} />;
export const CardTitle = ({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) => <h2 className={cn('text-base font-bold', className)} {...p} />;
export const CardContent = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('p-5 pt-0', className)} {...p} />;

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} />;

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: React.ReactNode }) {
  const t = { info: 'border-secondary-foreground/15 bg-secondary text-secondary-foreground', error: 'border-destructive/25 bg-destructive/[0.06] text-destructive', success: 'border-success/25 bg-success/[0.07] text-success' }[tone];
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-md border px-4 py-3 text-sm leading-6', t)}>{children}</div>;
}

export function LinkButton({ to, children, variant = 'default', size = 'md', className }: { to: string; children: React.ReactNode; variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string }) {
  return <Link to={to} className={cn(btnBase, variants[variant], sizes[size], className)}>{children}</Link>;
}

/** Page heading used by every route; renders the single <h1> of the page. */
export function PageTitle({ title, sub, action, eyebrow }: { title: string; sub?: string; action?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-medium text-primary">{eyebrow}</p>}
        <h1 className="text-xl font-bold leading-tight sm:text-2xl">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-secondary-foreground"><Icon className="h-6 w-6" aria-hidden /></span>
      <p className="font-medium">{title}</p>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'default' }: { label: string; value: number; icon?: LucideIcon; tone?: 'default' | 'accent' | 'success' | 'warning' }) {
  const t = { default: 'bg-secondary text-secondary-foreground', accent: 'bg-accent/15 text-accent-foreground', success: 'bg-success/10 text-success', warning: 'bg-warning/10 text-warning' }[tone];
  return (
    <Card className="flex items-center gap-3 p-4">
      {Icon && <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-md', t)}><Icon className="h-5 w-5" aria-hidden /></span>}
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none tabular">{fa(value)}</div>
        <div className="mt-1.5 truncate text-xs text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

/** Segmented control (tabs that switch local view state). */
export function Segmented<T extends string>({ value, onChange, options, label, className }: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, React.ReactNode])[]; label: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-md bg-muted p-1 text-sm', className)}>
      {options.map(([k, l]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}
          className={cn('inline-flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 transition-colors', value === k ? 'bg-card font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, hasNext, onPage, total, perPage }: { page: number; hasNext: boolean; onPage: (p: number) => void; total?: number; perPage?: number }) {
  if (page === 0 && !hasNext) return null;
  return (
    <nav aria-label="صفحه‌بندی" className="flex items-center justify-between gap-2 border-t px-3 py-2 text-sm">
      <span className="text-muted-foreground">صفحهٔ {fa(page + 1)}{total != null && perPage ? ` از ${fa(Math.max(1, Math.ceil(total / perPage)))}` : ''}</span>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" disabled={!page} onClick={() => onPage(page - 1)}><ChevronRight className="h-4 w-4" aria-hidden />قبلی</Button>
        <Button size="sm" variant="ghost" disabled={!hasNext} onClick={() => onPage(page + 1)}>بعدی<ChevronLeft className="h-4 w-4" aria-hidden /></Button>
      </div>
    </nav>
  );
}

/** Horizontally scrollable, keyboard-focusable wrapper for wide tables on small screens. */
export function DataTable({ label, minWidth = 640, children }: { label: string; minWidth?: number; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      <table className="data-table" style={{ minWidth }}>{children}</table>
    </div>
  );
}

export function SearchInput({ label, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" aria-label={label} placeholder={label} className="pr-9" {...p} />
    </div>
  );
}

/** Filter bar above lists/tables. Stacks on phones. */
export const Toolbar = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center [&>select]:w-full sm:[&>select]:w-52', className)} {...p} />
);
