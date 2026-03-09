import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string
  change?: number
  changeLabel?: string
  icon: React.ReactNode
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}

const variantStyles = {
  default: 'border-border',
  primary: 'border-l-4 border-l-blue-500',
  success: 'border-l-4 border-l-green-500',
  warning: 'border-l-4 border-l-orange-400',
  danger: 'border-l-4 border-l-red-500',
}

const iconBgStyles = {
  default: 'bg-gray-100 text-gray-600',
  primary: 'bg-blue-100 text-blue-600',
  success: 'bg-green-100 text-green-600',
  warning: 'bg-orange-100 text-orange-600',
  danger: 'bg-red-100 text-red-600',
}

export function KPICard({
  title,
  value,
  change,
  changeLabel,
  icon,
  variant = 'default',
}: KPICardProps) {
  return (
    <div
      className={cn(
        "bg-card border rounded-xl p-4 shadow-sm h-[110px] flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:-translate-y-1",
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between">

        {/* LEFT */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>

          <p className="text-2xl font-bold mt-1 text-foreground">
            {value}
          </p>
        </div>

        {/* ICON */}
        <div
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center",
            iconBgStyles[variant]
          )}
        >
          {icon}
        </div>
      </div>

      {/* CHANGE SECTION */}
      {change !== undefined && (
        <div className="flex items-center gap-1 text-xs">
          {change >= 0 ? (
            <TrendingUp className="h-3 w-3 text-green-500" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}

          <span
            className={cn(
              "font-medium",
              change >= 0 ? "text-green-500" : "text-red-500"
            )}
          >
            {change >= 0 ? "+" : ""}
            {change}%
          </span>

          {changeLabel && (
            <span className="text-muted-foreground">
              {changeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}