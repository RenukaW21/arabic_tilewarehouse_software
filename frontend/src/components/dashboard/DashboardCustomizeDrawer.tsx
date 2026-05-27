import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Save } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useDashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '@/hooks/useDashboardConfig';
import type { DashboardConfig } from '@/types/stock.types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const AVAILABLE_QUICK_ACTIONS = [
  'new_sale',
  'new_purchase_order',
  'new_grn',
  'new_stock_transfer',
] as const;

export function DashboardCustomizeDrawer({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { config, saveMutation, resetMutation } = useDashboardConfig();

  const [draft, setDraft] = useState<DashboardConfig>(config);

  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  const setWidget = (key: keyof DashboardConfig['widgets'], value: boolean) => {
    setDraft((d) => ({ ...d, widgets: { ...d.widgets, [key]: value } }));
  };

  const setKpi = (key: keyof DashboardConfig['kpis'], value: boolean) => {
    setDraft((d) => ({ ...d, kpis: { ...d.kpis, [key]: value } }));
  };

  const toggleQuickAction = (action: string) => {
    setDraft((d) => {
      const current = d.quick_actions;
      const next = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...d, quick_actions: next };
    });
  };

  const handleSave = () => {
    saveMutation.mutate(draft, { onSuccess: onClose });
  };

  const handleReset = () => {
    resetMutation.mutate(undefined, {
      onSuccess: () => {
        setDraft(DEFAULT_DASHBOARD_CONFIG);
        onClose();
      },
    });
  };

  const widgetRows: { key: keyof DashboardConfig['widgets']; label: string }[] = [
    { key: 'kpi_summary', label: t('dashboardConfig.widgets.kpi_summary') },
    { key: 'kpi_secondary', label: t('dashboardConfig.widgets.kpi_secondary') },
    { key: 'chart_stock_by_category', label: t('dashboardConfig.widgets.chart_stock_by_category') },
    { key: 'table_recent_sales', label: t('dashboardConfig.widgets.table_recent_sales') },
    { key: 'table_recent_purchases', label: t('dashboardConfig.widgets.table_recent_purchases') },
    { key: 'table_recent_grns', label: t('dashboardConfig.widgets.table_recent_grns') },
    { key: 'table_recent_transfers', label: t('dashboardConfig.widgets.table_recent_transfers') },
    { key: 'table_low_stock', label: t('dashboardConfig.widgets.table_low_stock') },
    { key: 'quick_actions', label: t('dashboardConfig.widgets.quick_actions') },
  ];

  const kpiRows: { key: keyof DashboardConfig['kpis']; label: string }[] = [
    { key: 'warehouses', label: t('dashboardConfig.kpis.warehouses') },
    { key: 'products', label: t('dashboardConfig.kpis.products') },
    { key: 'vendors', label: t('dashboardConfig.kpis.vendors') },
    { key: 'customers', label: t('dashboardConfig.kpis.customers') },
    { key: 'pending_pos', label: t('dashboardConfig.kpis.pending_pos') },
    { key: 'total_stock', label: t('dashboardConfig.kpis.total_stock') },
    { key: 'monthly_sales', label: t('dashboardConfig.kpis.monthly_sales') },
    { key: 'monthly_purchases', label: t('dashboardConfig.kpis.monthly_purchases') },
    { key: 'today_sales', label: t('dashboardConfig.kpis.today_sales') },
    { key: 'month_revenue', label: t('dashboardConfig.kpis.month_revenue') },
    { key: 'unpaid_invoices', label: t('dashboardConfig.kpis.unpaid_invoices') },
    { key: 'low_stock_count', label: t('dashboardConfig.kpis.low_stock_count') },
    { key: 'active_pos', label: t('dashboardConfig.kpis.active_pos') },
    { key: 'ledger_entries', label: t('dashboardConfig.kpis.ledger_entries') },
  ];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] sm:w-[420px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>{t('dashboardConfig.customize')}</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={resetMutation.isPending}
              className="text-muted-foreground hover:text-destructive"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              {t('dashboardConfig.resetToDefault')}
            </Button>
          </div>
        </SheetHeader>

        <Tabs defaultValue="sections" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 grid grid-cols-3">
            <TabsTrigger value="sections">{t('dashboardConfig.sections')}</TabsTrigger>
            <TabsTrigger value="kpis">{t('dashboardConfig.kpiCards')}</TabsTrigger>
            <TabsTrigger value="actions">{t('dashboardConfig.quickActions')}</TabsTrigger>
          </TabsList>

          {/* ── Sections Tab ──────────────────────────────────── */}
          <TabsContent value="sections" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full px-6 py-4">
              <div className="space-y-1">
                {widgetRows.map(({ key, label }, i) => (
                  <div key={key}>
                    <div className="flex items-center justify-between py-3">
                      <Label htmlFor={`widget-${key}`} className="cursor-pointer text-sm font-normal">
                        {label}
                      </Label>
                      <Switch
                        id={`widget-${key}`}
                        checked={draft.widgets[key]}
                        onCheckedChange={(v) => setWidget(key, v)}
                      />
                    </div>
                    {i < widgetRows.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── KPI Cards Tab ─────────────────────────────────── */}
          <TabsContent value="kpis" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full px-6 py-4">
              <p className="text-xs text-muted-foreground mb-4">
                {t('dashboardConfig.kpiCardsHint')}
              </p>
              <div className="space-y-1">
                {kpiRows.map(({ key, label }, i) => (
                  <div key={key}>
                    <div className="flex items-center justify-between py-3">
                      <Label htmlFor={`kpi-${key}`} className="cursor-pointer text-sm font-normal">
                        {label}
                      </Label>
                      <Switch
                        id={`kpi-${key}`}
                        checked={draft.kpis[key]}
                        onCheckedChange={(v) => setKpi(key, v)}
                      />
                    </div>
                    {i < kpiRows.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Quick Actions Tab ─────────────────────────────── */}
          <TabsContent value="actions" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full px-6 py-4">
              <p className="text-xs text-muted-foreground mb-4">
                {t('dashboardConfig.quickActionsHint')}
              </p>
              <div className="space-y-3">
                {AVAILABLE_QUICK_ACTIONS.map((action) => (
                  <div key={action} className="flex items-center gap-3">
                    <Checkbox
                      id={`action-${action}`}
                      checked={draft.quick_actions.includes(action)}
                      onCheckedChange={() => toggleQuickAction(action)}
                    />
                    <Label htmlFor={`action-${action}`} className="cursor-pointer text-sm font-normal">
                      {t(`dashboardConfig.actions.${action}`)}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <SheetFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="flex-1">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? t('common.saving') : t('common.saveChanges')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
