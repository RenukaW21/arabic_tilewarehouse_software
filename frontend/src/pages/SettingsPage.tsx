import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Warehouse, Settings as SettingsIcon, Package, Bell, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { warehouseApi } from '@/api/warehouseApi';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const { data: warehousesRes } = useQuery({
    queryKey: ['warehouses', { limit: 100 }],
    queryFn: () => warehouseApi.getAll({ limit: 100 }),
  });
  const warehouses = warehousesRes?.data || [];

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success(t('settings.settingsUpdated'));
    }, 1000);
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
              <div className="grid gap-2">
                <Label>{t('settings.systemDisplayName')}</Label>
                <Input placeholder="Tiles WMS" defaultValue="Tiles WMS" />
              </div>
              <div className="grid gap-2">
                <Label>{t('settings.adminEmail')}</Label>
                <Input placeholder="admin@example.com" type="email" />
              </div>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? t('common.saving') : t('common.saveChanges')}
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
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>{t('settings.strictCapacityCheck')}</Label>
                  <p className="text-xs text-muted-foreground">{t('settings.strictCapacityCheckDesc')}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>{t('settings.multiWarehouseSearch')}</Label>
                  <p className="text-xs text-muted-foreground">{t('settings.multiWarehouseSearchDesc')}</p>
                </div>
                <Switch defaultChecked />
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
                {warehouses.map((wh) => (
                  <div key={wh.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 bg-primary/10 rounded-md flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{wh.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{wh.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-semibold">{wh.rack_count || 0}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">{t('settings.racks')}</p>
                      </div>
                      <div className="h-2 w-px bg-border hidden sm:block" />
                      <Switch defaultChecked={wh.is_active} />
                    </div>
                  </div>
                ))}
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
                <Input type="number" defaultValue="18" />
              </div>
              <div className="grid gap-2">
                <Label>{t('settings.lowStockWarningThreshold')}</Label>
                <Input type="number" defaultValue="10" />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>{t('settings.enableExpiryTracking')}</Label>
                  <p className="text-xs text-muted-foreground">{t('settings.enableExpiryTrackingDesc')}</p>
                </div>
                <Switch />
              </div>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? t('common.saving') : t('common.saveChanges')}
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
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>{t('settings.capacityWarnings')}</Label>
                  <p className="text-xs text-muted-foreground">{t('settings.capacityWarningsDesc')}</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>{t('settings.movementAlerts')}</Label>
                  <p className="text-xs text-muted-foreground">{t('settings.movementAlertsDesc')}</p>
                </div>
                <Switch />
              </div>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
