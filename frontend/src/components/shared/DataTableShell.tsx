import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaginationMeta } from "@/types/api.types";
import { ChevronLeft, ChevronRight, Search, Loader2 } from "lucide-react";

interface ColumnDef<T = any> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableShellProps<T = any> {
  data?: T[];
  columns: ColumnDef<T>[];
  /** Client-side: filter by this key. Server-side: pass search to parent */
  searchKey?: string;
  searchPlaceholder?: string;
  /** Server-side: pagination meta from API */
  paginationMeta?: PaginationMeta | null;
  /** Server-side: called when user changes search */
  onSearchChange?: (value: string) => void;
  /** Server-side: called when user changes page */
  onPageChange?: (page: number) => void;
  /** If true, search is server-side (onSearchChange required) */
  serverSide?: boolean;
  /** Server-side: controlled search input value from parent */
  searchValue?: string;
  isLoading?: boolean;
}

export function DataTableShell<T extends any>({
  data = [],
  columns,
  searchKey,
  searchPlaceholder = "Search...",
  paginationMeta = null,
  onSearchChange,
  onPageChange,
  serverSide = false,
  searchValue: serverSideSearchValue,
  isLoading = false,
}: DataTableShellProps<T>) {
  // Internal state for the input to keep typing fluid
  const [localSearch, setLocalSearch] = useState(serverSide ? (serverSideSearchValue ?? "") : "");
  const safeData = Array.isArray(data) ? data : [];

  // Sync internal state when parent state changes (e.g. cleared from outside)
  useEffect(() => {
    if (serverSide && serverSideSearchValue !== undefined) {
      setLocalSearch(serverSideSearchValue);
    }
  }, [serverSideSearchValue, serverSide]);

  // Debounce server-side search
  useEffect(() => {
    if (!serverSide || !onSearchChange) return;
    
    // Only trigger if local state and parent state differ
    if (localSearch === serverSideSearchValue) return;

    const handler = setTimeout(() => {
      onSearchChange(localSearch);
    }, 400); // 400ms debounce

    return () => clearTimeout(handler);
  }, [localSearch, serverSide, onSearchChange, serverSideSearchValue]);

  const filteredData = useMemo(() => {
    if (serverSide || !searchKey) return safeData;
    return safeData.filter((row) =>
      String(row?.[searchKey] ?? "")
        .toLowerCase()
        .includes(localSearch.toLowerCase())
    );
  }, [safeData, localSearch, searchKey, serverSide]);

  const showSearch = !!searchKey;

  const onSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value);
  };

  return (
    <div className="space-y-4">
      {showSearch && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={localSearch}
            onChange={onSearchInput}
            className="pl-9 h-10 shadow-sm"
          />
          {isLoading && serverSide && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          )}
        </div>
      )}

      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left text-sm font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                  No records found.
                </td>
              </tr>
            ) : (
              filteredData.map((row: T) => (
                <tr key={(row as { id?: string }).id ?? Math.random()} className="border-b">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2">
                      {col.render ? col.render(row) : (row[col.key] as React.ReactNode) ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginationMeta && onPageChange && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {paginationMeta.page} of {paginationMeta.totalPages} ({paginationMeta.total} total)
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(paginationMeta.page - 1)}
              disabled={!paginationMeta.hasPrev || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            {(() => {
              const totalPages = Math.max(1, paginationMeta.totalPages);
              const current = paginationMeta.page;
              const delta = 2;
              const start = Math.max(1, current - delta);
              const end = Math.min(totalPages, current + delta);
              const pages: number[] = [];
              for (let p = start; p <= end; p++) pages.push(p);
              return (
                <div className="flex items-center gap-1 px-1">
                  {pages.map((p) => (
                    <Button
                      key={p}
                      variant={p === current ? 'default' : 'outline'}
                      size="sm"
                      className="min-w-[2rem] h-8"
                      onClick={() => onPageChange(p)}
                      disabled={isLoading}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              );
            })()}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(paginationMeta.page + 1)}
              disabled={!paginationMeta.hasNext || isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
