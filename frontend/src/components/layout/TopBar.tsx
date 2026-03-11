import { Menu, Bell, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';

interface TopBarProps {
  onToggleSidebar: () => void;
  title?: string;
}

export function TopBar({ onToggleSidebar, title }: TopBarProps) {
  const { user } = useAuth();

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="text-muted-foreground">
          <Menu className="h-5 w-5" />
        </Button>
        {title && <h2 className="font-display font-semibold text-foreground text-lg hidden sm:block">{title}</h2>}
      </div>

      <div className="flex items-center gap-2">
        {/* <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, orders..."
            className="w-64 pl-9 h-9 text-sm bg-background"
          />
        </div> */}

        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-destructive rounded-full" />
        </Button>

        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-foreground">{user?.name ?? 'User'}</p>
            <p className="text-[10px] text-muted-foreground">{user?.email ?? ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
