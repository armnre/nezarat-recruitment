import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export function Dialog({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
        <D.Content dir="rtl" aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-xl bg-card p-5 shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <div className="mb-4 flex items-center justify-between">
            <D.Title className="text-lg font-bold">{title}</D.Title>
            <D.Close className="rounded-md p-1 hover:bg-muted" aria-label="بستن"><X className="h-5 w-5" /></D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmText = 'تأیید', onConfirm, loading }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; description: string; confirmText?: string; onConfirm: () => void; loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button className="h-10 rounded-md border px-4 hover:bg-muted" onClick={() => onOpenChange(false)}>انصراف</button>
        <button disabled={loading} className="h-10 rounded-md bg-destructive px-4 text-destructive-foreground disabled:opacity-50" onClick={onConfirm}>{confirmText}</button>
      </div>
    </Dialog>
  );
}
