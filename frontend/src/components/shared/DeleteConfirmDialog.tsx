import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<any>;
  title?: string;
  description?: string;
  loading?: boolean;
}

export function DeleteConfirmDialog({ open, onClose, onConfirm, title, description, loading }: DeleteConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={v => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t('deleteDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>{description ?? t('deleteDialog.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{t('deleteDialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {loading ? t('deleteDialog.deleting') : t('deleteDialog.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
