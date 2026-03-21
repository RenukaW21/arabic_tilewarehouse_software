import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { notificationApi } from '@/api/miscApi';
import { Notification } from '@/types/misc.types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: response, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.getAll({ limit: 10, sortBy: 'created_at', sortOrder: 'DESC' }),
    refetchInterval: 30000,
  });

  const notifications = response?.data ?? [];
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.update(id, { is_read: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:bg-muted">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 bg-destructive text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-in zoom-in duration-300">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex flex-col">
            <h3 className="font-semibold text-sm">{t('notifications.title')}</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                {t('notifications.unreadItems', { count: unreadCount })}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] font-medium px-2"
              onClick={() => {
                notifications.filter(n => !n.is_read).forEach(n => markReadMutation.mutate(n.id));
              }}
            >
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>
        <ScrollArea className="h-[350px]">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>{t('notifications.syncingAlerts')}</span>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
              <Bell className="h-8 w-8 text-muted-foreground/30" />
              <p>{t('notifications.everythingUpToDate')}</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/50">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex flex-col gap-1 p-4 transition-all hover:bg-primary/5 cursor-pointer group relative",
                    !n.is_read && "bg-primary/5"
                  )}
                  onClick={() => {
                    if (!n.is_read) markReadMutation.mutate(n.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getIcon(n.type)}
                      <span className={cn("text-xs font-semibold", !n.is_read ? "text-foreground" : "text-muted-foreground")}>
                        {n.title}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground/90 leading-normal pl-6">
                    {n.message}
                  </p>
                  <div className="flex items-center gap-2 mt-2 pl-6">
                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 font-medium italic">
                       {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                    {!n.is_read && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t border-border bg-muted/10">
          <Button
            variant="ghost"
            className="w-full text-[11px] h-8 font-semibold text-primary hover:bg-primary/10"
            onClick={() => {
              setOpen(false);
              navigate('/alerts');
            }}
          >
            {t('notifications.goToAlertsCenter')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
