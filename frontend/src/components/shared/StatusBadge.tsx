import { cn } from '@/lib/utils';

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

const statusMap: Record<string, StatusVariant> = {
  // PO
  draft: 'neutral', confirmed: 'info', partial: 'warning', received: 'success', cancelled: 'danger',
  // SO
  pick_ready: 'info', dispatched: 'primary', delivered: 'success',
  // GRN
  verified: 'info', posted: 'success',
  // Payment
  pending: 'warning', paid: 'success',
  // Invoice
  issued: 'success',
  // Alert
  open: 'danger', acknowledged: 'warning', resolved: 'success',
  // Adjustment
  approved: 'success', rejected: 'danger',
  // Transfer
  in_transit: 'info',
  // Pick list
  in_progress: 'info',
  // Sales return
  inspected: 'info', completed: 'success',
  // Boolean
  active: 'success', inactive: 'danger',
};

const variantStyles: Record<StatusVariant, string> = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-accent/10 text-accent-foreground border-accent/20',
  danger: 'bg-destructive/10 text-destructive border-destructive/20',
  info: 'bg-secondary/10 text-secondary border-secondary/20',
  neutral: 'bg-muted text-muted-foreground border-border',
  primary: 'bg-primary/10 text-primary border-primary/20',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusMap[status] || 'neutral';
  const label = status.replace(/_/g, ' ');

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize border",
      variantStyles[variant],
      className
    )}>
      {label}
    </span>
  );
}
