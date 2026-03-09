import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaginationMeta } from "@/types/api.types";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ColumnDef<T = Record<string, unknown>> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableShellProps<T = Record<string, unknown>> {
  data?: T[];
  columns: ColumnDef<T>[];
  /** Client-side: filter by this key. Server-side: pass search to parent */
  searchKey?: string;
  searchPlaceholder?: string;
  /** Server-side: pagination meta from API */
  paginationMeta?: PaginationMeta | null;
  /** Server-side: called when user changes search (debounce in parent if needed) */
  onSearchChange?: (value: string) => void;
  /** Server-side: called when user changes page */
  onPageChange?: (page: number) => void;
  /** If true, search is server-side (onSearchChange required) */
  serverSide?: boolean;
  /** Server-side: controlled search input value */
  searchValue?: string;
  isLoading?: boolean;
}

export function DataTableShell<T extends Record<string, unknown>>({
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
  const [clientSearch, setClientSearch] = useState("");
  const safeData = Array.isArray(data) ? data : [];

  const filteredData = useMemo(() => {
    if (serverSide || !searchKey) return safeData;
    return safeData.filter((row) =>
      String(row?.[searchKey] ?? "")
        .toLowerCase()
        .includes(clientSearch.toLowerCase())
    );
  }, [safeData, clientSearch, searchKey, serverSide]);

  const showSearch = !!searchKey;
  const inputValue = serverSide ? (serverSideSearchValue ?? "") : clientSearch;
  const onSearchInput = serverSide
    ? (e: React.ChangeEvent<HTMLInputElement>) => onSearchChange?.(e.target.value)
    : (e: React.ChangeEvent<HTMLInputElement>) => setClientSearch(e.target.value);

  return (
    <div className="space-y-4">
      {showSearch && (
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={inputValue}
          onChange={onSearchInput}
          className="max-w-sm"
          disabled={isLoading}
        />
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
              onClick={() => onPageChange(1)}
              disabled={!paginationMeta.hasPrev || isLoading}
              title="First page"
            >
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(paginationMeta.page - 1)}
              disabled={!paginationMeta.hasPrev || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
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
                      className="min-w-[2rem]"
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
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, paginationMeta.totalPages))}
              disabled={!paginationMeta.hasNext || isLoading}
              title="Last page"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
