import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Warehouse, Settings as SettingsIcon, Package, Bell, MapPin, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { warehouseApi } from '@/api/warehouseApi';
import { gstApi, type CreateGstConfigDto } from '@/api/gstApi';
import {
  DEFAULT_LOCAL_SETTINGS,
  loadLocalSettings,
  saveLocalSettings,
  type LocalSettingsState,
} from '@/lib/settingsStorage';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface CompanySettingsForm {
  gstin: string;
  legal_name: string;
  trade_name: string;
  state_code: string;
  state_name: string;
  pan: string;
  invoice_prefix: string;
  default_gst_rate: string;
}

const EMPTY_COMPANY_FORM: CompanySettingsForm = {
  gstin: '',
  legal_name: '',
  trade_name: '',
  state_code: '',
  state_name: '',
  pan: '',
  invoice_prefix: '',
  default_gst_rate: '18',
};

function normalizeCompanyForm(config: any): CompanySettingsForm {
  if (!config) return EMPTY_COMPANY_FORM;
  return {
    gstin: config.gstin ?? '',
    legal_name: config.legal_name ?? '',
    trade_name: config.trade_name ?? '',
    state_code: config.state_code ?? '',
    state_name: config.state_name ?? '',
    pan: config.pan ?? '',
    invoice_prefix: config.invoice_prefix ?? '',
    default_gst_rate: String(config.default_gst_rate ?? 18),
  };
}

function toGstPayload(form: CompanySettingsForm): CreateGstConfigDto {
  return {
    gstin: form.gstin.trim().toUpperCase(),
    legal_name: form.legal_name.trim(),
    trade_name: form.trade_name.trim() || null,
    state_code: form.state_code.trim(),
    state_name: form.state_name.trim(),
    pan: form.pan.trim().toUpperCase() || null,
    invoice_prefix: form.invoice_prefix.trim() || null,
    default_gst_rate: Number(form.default_gst_rate) || 18,
    fiscal_year_start: '04-01',
    is_composition_scheme: false,
  };
}

function validateCompanyForm(form: CompanySettingsForm) {
  if (!form.legal_name.trim()) return 'Legal name is required';
  if (!form.gstin.trim()) return 'GSTIN is required';
  if (!/^[0-9]{2}$/.test(form.state_code.trim())) return 'State code must be 2 digits';
  if (!form.state_name.trim()) return 'State name is required';
  return null;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [companyForm, setCompanyForm] = useState<CompanySettingsForm>(EMPTY_COMPANY_FORM);
  const [localSettings, setLocalSettings] = useState<LocalSettingsState>(DEFAULT_LOCAL_SETTINGS);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLocalSettings(loadLocalSettings(window.localStorage));
    }
  }, []);

  const { data: warehousesRes, isLoading: warehousesLoading } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn: () => warehouseApi.getAll({ limit: 100 }),
  });

  const {
    data: gstConfigRes,
    isLoading: gstLoading,
  } = useQuery({
    queryKey: ['gst-config'],
    queryFn: () => gstApi.getByTenant(),
  });

  const warehouses = warehousesRes?.data ?? [];
  const gstConfig = gstConfigRes?.data ?? null;

  useEffect(() => {
    setCompanyForm(normalizeCompanyForm(gstConfig));
  }, [gstConfig]);

  const saveLocalSection = (updater: (current: LocalSettingsState) => LocalSettingsState, message?: string) => {
    setLocalSettings((current) => {
      const next = updater(current);
      if (typeof window !== 'undefined') {
        saveLocalSettings(next, window.localStorage);
      }
      if (message) toast.success(message);
      return next;
    });
  };

  const gstMutation = useMutation({
    mutationFn: async (payload: CreateGstConfigDto) => {
      if (gstConfig?.id) return gstApi.update(gstConfig.id, payload);
      return gstApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gst-config'] });
      toast.success(t('settings.settingsUpdated'));
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error?.message ?? t('common.updateFailed'));
    },
  });

  const warehouseToggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      warehouseApi.update(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success(t('settings.settingsUpdated'));
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error?.message ?? t('common.updateFailed'));
    },
  });

  const generalBusy = gstLoading || gstMutation.isPending;
  const handleGeneralSave = () => {
    const error = validateCompanyForm(companyForm);
    if (error) {
      toast.error(error);
      return;
    }
    gstMutation.mutate(toGstPayload(companyForm));
  };

  const handleAlertsSave = () => {
    saveLocalSection((current) => current, t('settings.settingsUpdated'));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />

      <Tabs defaultValue="warehouse" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="general" className="gap-2">
            <SettingsIcon className="h-4 w-4" /> {t('settings.general')}
          </TabsTrigger>
          <TabsTrigger value="warehouse" className="gap-2">
            <Warehouse className="h-4 w-4" /> {t('settings.warehouse')}
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" /> {t('settings.inventory')}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" /> {t('settings.alerts')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.generalSettings')}</CardTitle>
              <CardDescription>{t('settings.generalSettingsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t('gstConfig.legalName')}</Label>
                  <Input
                    value={companyForm.legal_name}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, legal_name: e.target.value }))}
                    placeholder={t('gstConfig.placeholderLegalName')}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t('gstConfig.tradeName')}</Label>
                  <Input
                    value={companyForm.trade_name}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, trade_name: e.target.value }))}
                    placeholder={t('gstConfig.placeholderTradeName')}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t('gstConfig.gstin')}</Label>
                  <Input
                    value={companyForm.gstin}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                    placeholder={t('gstConfig.placeholderGstin')}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t('gstConfig.pan')}</Label>
                  <Input
                    value={companyForm.pan}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                    placeholder={t('gstConfig.placeholderPan')}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>{t('gstConfig.stateCode')}</Label>
                  <Input
                    value={companyForm.state_code}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, state_code: e.target.value }))}
                    placeholder={t('gstConfig.placeholderStateCode')}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>{t('gstConfig.stateName')}</Label>
                  <Input
                    value={companyForm.state_name}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, state_name: e.target.value }))}
                    placeholder={t('gstConfig.placeholderStateName')}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t('gstConfig.invoicePrefix')}</Label>
                  <Input
                    value={companyForm.invoice_prefix}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, invoice_prefix: e.target.value }))}
                    placeholder={t('gstConfig.placeholderInvoicePrefix')}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t('gstConfig.defaultGstRate')}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={companyForm.default_gst_rate}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, default_gst_rate: e.target.value }))}
                  />
                </div>
              </div>

              <Button onClick={handleGeneralSave} disabled={generalBusy}>
                {generalBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {generalBusy ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warehouse" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.warehouseDefaults')}</CardTitle>
              <CardDescription>{t('settings.warehouseDefaultsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>{t('settings.autoAllocation')}</Label>
                  <p className="text-xs text-muted-foreground">{t('settings.autoAllocationDesc')}</p>
                </div>
                <Switch
                  checked={localSettings.warehouse.autoAllocation}
                  onCheckedChange={(checked) =>
                    saveLocalSection(
                      (current) => ({
                        ...current,
                        warehouse: { ...current.warehouse, autoAllocation: checked },
                      }),
                      t('settings.settingsUpdated')
                    )
                  }
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>{t('settings.strictCapacityCheck')}</Label>
                  <p className="text-xs text-muted-foreground">{t('settings.strictCapacityCheckDesc')}</p>
                </div>
                <Switch
                  checked={localSettings.warehouse.strictCapacityCheck}
                  onCheckedChange={(checked) =>
                    saveLocalSection(
                      (current) => ({
                        ...current,
                        warehouse: { ...current.warehouse, strictCapacityCheck: checked },
                      }),
                      t('settings.settingsUpdated')
                    )
                  }
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>{t('settings.multiWarehouseSearch')}</Label>
                  <p className="text-xs text-muted-foreground">{t('settings.multiWarehouseSearchDesc')}</p>
                </div>
                <Switch
                  checked={localSettings.warehouse.multiWarehouseSearch}
                  onCheckedChange={(checked) =>
                    saveLocalSection(
                      (current) => ({
                        ...current,
                        warehouse: { ...current.warehouse, multiWarehouseSearch: checked },
                      }),
                      t('settings.settingsUpdated')
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings.warehouseListQuickView')}</CardTitle>
              <CardDescription>{t('settings.warehouseListQuickViewDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {warehousesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </div>
                ) : warehouses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('common.noRecordsFound')}</p>
                ) : (
                  warehouses.map((wh) => (
                    <div key={wh.id} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                          <MapPin className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{wh.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{wh.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden text-right sm:block">
                          <p className="text-xs font-semibold">{wh.rack_count || 0}</p>
                          <p className="text-[10px] uppercase tracking-tighter text-muted-foreground">{t('settings.racks')}</p>
                        </div>
                        <div className="hidden h-2 w-px bg-border sm:block" />
                        <Switch
                          checked={!!wh.is_active}
                          onCheckedChange={(checked) => warehouseToggleMutation.mutate({ id: wh.id, is_active: checked })}
                          disabled={warehouseToggleMutation.isPending}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.inventoryRules')}</CardTitle>
              <CardDescription>{t('settings.inventoryRulesDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>{t('settings.defaultGstRate')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={companyForm.default_gst_rate}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, default_gst_rate: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t('settings.lowStockWarningThreshold')}</Label>
                <Input
                  type="number"
                  value={localSettings.inventory.lowStockWarningThreshold}
                  onChange={(e) =>
                    setLocalSettings((current) => ({
                      ...current,
                      inventory: {
                        ...current.inventory,
                        lowStockWarningThreshold: Number(e.target.value) || 0,
                      },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>{t('settings.enableExpiryTracking')}</Label>
                  <p className="text-xs text-muted-foreground">{t('settings.enableExpiryTrackingDesc')}</p>
                </div>
                <Switch
                  checked={localSettings.inventory.enableExpiryTracking}
                  onCheckedChange={(checked) =>
                    setLocalSettings((current) => ({
                      ...current,
                      inventory: {
                        ...current.inventory,
                        enableExpiryTracking: checked,
                      },
                    }))
                  }
                />
              </div>
              <Button
                onClick={() => {
                  const error = validateCompanyForm(companyForm);
                  if (error) {
                    toast.error('Fill General settings first before saving GST defaults.');
                    return;
                  }
                  if (typeof window !== 'undefined') {
                    saveLocalSettings(localSettings, window.localStorage);
                  }
                  gstMutation.mutate(toGstPayload(companyForm));
                }}
                disabled={gstMutation.isPending}
              >
                {gstMutation.isPending ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.alertSettings')}</CardTitle>
              <CardDescription>{t('settings.alertSettingsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>{t('settings.lowStockAlerts')}</Label>
                  <p className="text-xs text-muted-foreground">{t('settings.lowStockAlertsDesc')}</p>
                </div>
                <Switch
                  checked={localSettings.alerts.lowStockAlerts}
                  onCheckedChange={(checked) =>
                    setLocalSettings((current) => ({
                      ...current,
                      alerts: { ...current.alerts, lowStockAlerts: checked },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>{t('settings.capacityWarnings')}</Label>
                  <p className="text-xs text-muted-foreground">{t('settings.capacityWarningsDesc')}</p>
                </div>
                <Switch
                  checked={localSettings.alerts.capacityWarnings}
                  onCheckedChange={(checked) =>
                    setLocalSettings((current) => ({
                      ...current,
                      alerts: { ...current.alerts, capacityWarnings: checked },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>{t('settings.movementAlerts')}</Label>
                  <p className="text-xs text-muted-foreground">{t('settings.movementAlertsDesc')}</p>
                </div>
                <Switch
                  checked={localSettings.alerts.movementAlerts}
                  onCheckedChange={(checked) =>
                    setLocalSettings((current) => ({
                      ...current,
                      alerts: { ...current.alerts, movementAlerts: checked },
                    }))
                  }
                />
              </div>
              <Button
                onClick={() => handleAlertsSave()}
                disabled={false}
              >
                {t('common.saveChanges')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
