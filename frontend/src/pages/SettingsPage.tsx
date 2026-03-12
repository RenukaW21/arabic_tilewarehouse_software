import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Warehouse, Settings as SettingsIcon, Package, Bell, MapPin, Layers } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { warehouseApi } from '@/api/warehouseApi';
import { toast } from 'sonner';

export default function SettingsPage() {
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
      toast.success('Settings updated successfully');
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage your application and warehouse configurations"
      />

      <Tabs defaultValue="warehouse" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="general" className="gap-2">
            <SettingsIcon className="h-4 w-4" /> General
          </TabsTrigger>
          <TabsTrigger value="warehouse" className="gap-2">
            <Warehouse className="h-4 w-4" /> Warehouse
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" /> Inventory
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" /> Alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure basic application details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>System Display Name</Label>
                <Input placeholder="Tiles WMS" defaultValue="Tiles WMS" />
              </div>
              <div className="grid gap-2">
                <Label>Admin Email</Label>
                <Input placeholder="admin@example.com" type="email" />
              </div>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warehouse" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Defaults</CardTitle>
              <CardDescription>Default settings for warehouse operations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>Auto-Allocation</Label>
                  <p className="text-xs text-muted-foreground">Automatically suggest racks based on proximity and availability</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>Strict Capacity Check</Label>
                  <p className="text-xs text-muted-foreground">Prevent overstocking racks beyond their defined capacity</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>Multi-Warehouse Search</Label>
                  <p className="text-xs text-muted-foreground">Search for stock across all warehouses when assigning orders</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Warehouse List Quick View</CardTitle>
              <CardDescription>Overview of your active warehouses</CardDescription>
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
                        <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">Racks</p>
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
              <CardTitle>Inventory Rules</CardTitle>
              <CardDescription>Configure how products and stock are managed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Default GST Rate (%)</Label>
                <Input type="number" defaultValue="18" />
              </div>
              <div className="grid gap-2">
                <Label>Low Stock Warning Threshold (Boxes)</Label>
                <Input type="number" defaultValue="10" />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>Enable Expiry Tracking</Label>
                  <p className="text-xs text-muted-foreground">Track manufacturing and expiry dates for batches</p>
                </div>
                <Switch />
              </div>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert Settings</CardTitle>
              <CardDescription>Choose how you want to be notified of critical events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>Low Stock Alerts</Label>
                  <p className="text-xs text-muted-foreground">Get notified when stock levels fall below threshold</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>Capacity Warnings</Label>
                  <p className="text-xs text-muted-foreground">Alert when a warehouse or rack is above 90% capacity</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label>Movement Alerts</Label>
                  <p className="text-xs text-muted-foreground">Notify on significant stock movements or transfers</p>
                </div>
                <Switch />
              </div>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
