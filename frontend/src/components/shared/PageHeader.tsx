import { Button } from '@/components/ui/button';
import { Plus, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  addLabel?: string;
  onExport?: () => void;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, onAdd, addLabel, onExport, children }: PageHeaderProps) {
  const { t } = useTranslation();
  const resolvedAddLabel = addLabel ?? t('pageHeader.addNew');

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-display font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {children}
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-1.5" /> {t('pageHeader.export')}
          </Button>
        )}
        {onAdd && (
          <Button size="sm" onClick={onAdd} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Plus className="h-4 w-4 mr-1.5" /> {resolvedAddLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
