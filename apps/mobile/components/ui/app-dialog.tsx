/**
 * app-dialog.tsx — dialog modal TERKONTROL (pengganti `Dialog` custom lama),
 * dibangun di atas shadcn Dialog (react-native-reusables). API tetap sama:
 * `visible`, `onDismiss`, `title`, `description`, `actions`, `children` —
 * jadi layar cukup mengganti nama komponen tanpa mengubah logika.
 */
import type { ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface AppDialogProps {
  visible: boolean;
  onDismiss?: () => void;
  title?: string;
  description?: ReactNode;
  /** Tombol aksi (ditata menumpuk vertikal). */
  actions?: ReactNode;
  children?: ReactNode;
}

export function AppDialog({ visible, onDismiss, title, description, actions, children }: AppDialogProps) {
  return (
    <Dialog
      open={visible}
      onOpenChange={(open) => {
        if (!open) onDismiss?.();
      }}>
      <DialogContent>
        {title != null || description != null ? (
          <DialogHeader>
            {title != null ? <DialogTitle>{title}</DialogTitle> : null}
            {description != null ? (
              typeof description === 'string' ? (
                <DialogDescription>{description}</DialogDescription>
              ) : (
                description
              )
            ) : null}
          </DialogHeader>
        ) : null}
        {children}
        {actions != null ? <DialogFooter className="flex-col gap-2">{actions}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
