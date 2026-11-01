import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from './ui';

export function Dialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: string; children: React.ReactNode }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-foreground/45 backdrop-blur-[2px] animate-fade-in" />
        <D.Content dir="rtl" {...(description ? {} : { 'aria-describedby': undefined })}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-xl border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-raised animate-fade-up sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-6">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <D.Title className="text-lg font-bold">{title}</D.Title>
              {description && <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description>}
            </div>
            <D.Close className="-m-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="بستن"><X className="h-5 w-5" /></D.Close>
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
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
        <Button variant="destructive" loading={loading} onClick={onConfirm}>{confirmText}</Button>
      </div>
    </Dialog>
  );
}
