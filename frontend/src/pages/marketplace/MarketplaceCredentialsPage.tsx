import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi, MarketplacePlatform, SaveCredentialData } from '@/api/marketplaceApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const PLATFORMS: { value: MarketplacePlatform; label: string; color: string; description: string }[] = [
  {
    value: 'amazon',
    label: 'Amazon',
    color: 'border-orange-200 bg-orange-50',
    description: 'Amazon Seller Central — SP-API integration for orders, stock, pricing and returns.',
  },
  {
    value: 'flipkart',
    label: 'Flipkart',
    color: 'border-blue-200 bg-blue-50',
    description: 'Flipkart Seller Hub — sync listings, orders, shipments and returns.',
  },
  {
    value: 'meesho',
    label: 'Meesho',
    color: 'border-pink-200 bg-pink-50',
    description: 'Meesho Supplier Panel — manage orders, inventory and shipment tracking.',
  },
];

const BADGE_COLOR: Record<MarketplacePlatform, string> = {
  amazon:   'bg-orange-100 text-orange-700',
  flipkart: 'bg-blue-100 text-blue-700',
  meesho:   'bg-pink-100 text-pink-700',
};

export default function MarketplaceCredentialsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activePlatform, setActivePlatform] = useState<MarketplacePlatform | null>(null);
  const [form, setForm] = useState<SaveCredentialData>({});

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-credentials'],
    queryFn: () => marketplaceApi.credentials.getAll(),
  });

  const credentials = data?.data ?? [];
  const credMap = Object.fromEntries(credentials.map(c => [c.platform, c]));

  const saveMutation = useMutation({
    mutationFn: ({ platform, data }: { platform: MarketplacePlatform; data: SaveCredentialData }) =>
      marketplaceApi.credentials.save(platform, data),
    onSuccess: () => {
      toast({ title: 'Credentials saved successfully' });
      queryClient.invalidateQueries({ queryKey: ['marketplace-credentials'] });
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to save credentials',
        description: err?.response?.data?.error?.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => marketplaceApi.credentials.remove(id),
    onSuccess: () => {
      toast({ title: 'Credentials removed' });
      queryClient.invalidateQueries({ queryKey: ['marketplace-credentials'] });
    },
    onError: () => {
      toast({ title: 'Failed to remove credentials', variant: 'destructive' });
    },
  });

  const openDialog = (platform: MarketplacePlatform) => {
    const cred = credMap[platform];
    setActivePlatform(platform);
    setForm({
      display_name:     cred?.display_name ?? '',
      seller_id:        cred?.seller_id ?? '',
      marketplace_id:   cred?.marketplace_id ?? '',
      fulfillment_type: cred?.fulfillment_type ?? undefined,
      is_active:        cred?.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!activePlatform) return;
    saveMutation.mutate({ platform: activePlatform, data: form });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Marketplace Credentials</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure API credentials for each marketplace platform.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {PLATFORMS.map(platform => {
            const cred = credMap[platform.value];
            const isConnected = !!cred?.is_active;

            return (
              <div
                key={platform.value}
                className={`border-2 rounded-xl p-5 space-y-4 ${platform.color}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${BADGE_COLOR[platform.value]}`}>
                    {platform.label}
                  </span>
                  <Badge variant={isConnected ? 'default' : 'secondary'}>
                    {isConnected ? 'Connected' : 'Not Connected'}
                  </Badge>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {platform.description}
                </p>

                {/* Connected info */}
                {cred && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {cred.display_name && <p><span className="font-medium">Name:</span> {cred.display_name}</p>}
                    {cred.seller_id    && <p><span className="font-medium">Seller ID:</span> {cred.seller_id}</p>}
                    {cred.fulfillment_type && (
                      <p>
                        <span className="font-medium">Fulfillment:</span>{' '}
                        <span className="uppercase font-semibold">{cred.fulfillment_type}</span>
                      </p>
                    )}
                    {cred.last_sync_at && (
                      <p><span className="font-medium">Last sync:</span> {new Date(cred.last_sync_at).toLocaleString()}</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant={cred ? 'outline' : 'default'}
                    className="flex-1"
                    onClick={() => openDialog(platform.value)}
                  >
                    {cred ? 'Edit Credentials' : 'Connect'}
                  </Button>
                  {cred && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(cred.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Credentials dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {activePlatform
                ? `${activePlatform.charAt(0).toUpperCase() + activePlatform.slice(1)} — API Credentials`
                : 'Credentials'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                placeholder={`e.g. Main ${activePlatform ? activePlatform.charAt(0).toUpperCase() + activePlatform.slice(1) : ''} Store`}
                value={form.display_name ?? ''}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Seller ID</Label>
              <Input
                placeholder="Your seller account ID"
                value={form.seller_id ?? ''}
                onChange={e => setForm(f => ({ ...f, seller_id: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>API Key / Client ID</Label>
              <Input
                type="password"
                placeholder="Leave blank to keep existing"
                value={form.api_key ?? ''}
                onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>API Secret / Client Secret</Label>
              <Input
                type="password"
                placeholder="Leave blank to keep existing"
                value={form.api_secret ?? ''}
                onChange={e => setForm(f => ({ ...f, api_secret: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Refresh Token</Label>
              <Input
                type="password"
                placeholder="Leave blank to keep existing"
                value={form.refresh_token ?? ''}
                onChange={e => setForm(f => ({ ...f, refresh_token: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Marketplace ID</Label>
              <Input
                placeholder={activePlatform === 'amazon' ? 'e.g. A21TJRUUN4KGV (India)' : 'Marketplace / Store ID'}
                value={form.marketplace_id ?? ''}
                onChange={e => setForm(f => ({ ...f, marketplace_id: e.target.value }))}
              />
            </div>

            {activePlatform === 'amazon' && (
              <div className="space-y-1.5">
                <Label>
                  Fulfillment Type <span className="text-muted-foreground font-normal">(Amazon only)</span>
                </Label>
                <Select
                  value={form.fulfillment_type ?? ''}
                  onValueChange={v => setForm(f => ({ ...f, fulfillment_type: v as 'fbm' | 'fba' }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select fulfillment type..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fbm">FBM — Fulfilled by Merchant (self-ship)</SelectItem>
                    <SelectItem value="fba">FBA — Fulfilled by Amazon</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Check Amazon Seller Central → Inventory to confirm which applies.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <Label>Active</Label>
              <Switch
                checked={form.is_active ?? true}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
