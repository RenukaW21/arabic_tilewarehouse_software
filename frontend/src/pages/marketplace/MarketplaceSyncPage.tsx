import { useQuery } from '@tanstack/react-query';
import { marketplaceApi, MarketplacePlatform, SyncLog } from '@/api/marketplaceApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_BADGE: Record<string, string> = {
  success: 'bg-green-100 text-green-700',
  error:   'bg-red-100 text-red-700',
  partial: 'bg-yellow-100 text-yellow-700',
};

const PLATFORM_BADGE: Record<MarketplacePlatform, string> = {
  amazon:   'bg-orange-100 text-orange-700',
  flipkart: 'bg-blue-100 text-blue-700',
  meesho:   'bg-pink-100 text-pink-700',
};

const SYNC_TYPE_LABEL: Record<string, string> = {
  orders:   'Orders',
  returns:  'Returns',
  listings: 'Listings',
  pricing:  'Pricing',
  stock:    'Stock',
};

export default function MarketplaceSyncPage() {
  const [filterPlatform, setFilterPlatform] = useState<MarketplacePlatform | 'all'>('all');
  const [page, setPage] = useState(1);

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['marketplace-sync-health'],
    queryFn: () => marketplaceApi.sync.getHealth(),
    refetchInterval: 60_000,
  });

  const logsParams = {
    page,
    limit: 50,
    ...(filterPlatform !== 'all' && { platform: filterPlatform }),
  };

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['marketplace-sync-logs', logsParams],
    queryFn: () => marketplaceApi.sync.getLogs(logsParams),
  });

  const health      = healthData?.data;
  const syncLogs    = logsData?.data ?? [];
  const total       = logsData?.meta?.total ?? 0;
  const totalPages  = Math.ceil(total / 50);

  // Build per-platform health summary
  const credMap = Object.fromEntries((health?.credentials ?? []).map(c => [c.platform, c]));
  const lastSyncByPlatform: Record<string, Record<string, SyncLog>> = {};
  (health?.logs ?? []).forEach(log => {
    if (!lastSyncByPlatform[log.platform]) lastSyncByPlatform[log.platform] = {};
    lastSyncByPlatform[log.platform][log.sync_type] = log;
  });

  const platforms: MarketplacePlatform[] = ['amazon', 'flipkart', 'meesho'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Sync Health</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Per-platform connection status and recent sync history.
        </p>
      </div>

      {/* Health cards */}
      {healthLoading ? (
        <p className="text-sm text-muted-foreground">Loading health status...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {platforms.map(platform => {
            const cred = credMap[platform];
            const platformLogs = lastSyncByPlatform[platform] ?? {};
            const isConnected = !!cred?.is_active;

            return (
              <div key={platform} className="border rounded-lg p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PLATFORM_BADGE[platform]}`}>
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </span>
                  <Badge variant={isConnected ? 'default' : 'secondary'}>
                    {isConnected ? 'Connected' : 'Not Connected'}
                  </Badge>
                </div>

                {cred?.last_sync_at && (
                  <p className="text-xs text-muted-foreground">
                    Last sync: {new Date(cred.last_sync_at).toLocaleString()}
                  </p>
                )}

                {!cred && (
                  <p className="text-xs text-muted-foreground italic">No credentials configured</p>
                )}

                {Object.keys(platformLogs).length > 0 && (
                  <div className="space-y-1">
                    {Object.entries(platformLogs).map(([syncType, log]) => (
                      <div key={syncType} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {SYNC_TYPE_LABEL[syncType] ?? syncType}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_BADGE[log.status]}`}>
                            {log.status}
                          </span>
                          {log.error_msg && (
                            <span className="text-[10px] text-red-500" title={log.error_msg}>!</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {Object.keys(platformLogs).length === 0 && cred && (
                  <p className="text-xs text-muted-foreground italic">No syncs run yet</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sync logs table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Sync Log History</h3>
          <Select value={filterPlatform} onValueChange={v => { setFilterPlatform(v as any); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="amazon">Amazon</SelectItem>
              <SelectItem value="flipkart">Flipkart</SelectItem>
              <SelectItem value="meesho">Meesho</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Records In</TableHead>
                <TableHead>Records Out</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Finished</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : syncLogs.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No sync logs found.</TableCell></TableRow>
              ) : syncLogs.map(log => (
                <TableRow key={log.id}>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLATFORM_BADGE[log.platform]}`}>
                      {log.platform.charAt(0).toUpperCase() + log.platform.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{SYNC_TYPE_LABEL[log.sync_type] ?? log.sync_type}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[log.status]}`}>
                      {log.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{log.records_in}</TableCell>
                  <TableCell className="text-sm">{log.records_out}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(log.started_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.finished_at ? new Date(log.finished_at).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-red-500 max-w-[200px] truncate" title={log.error_msg ?? ''}>
                    {log.error_msg ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page} of {totalPages} · {total} records</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
