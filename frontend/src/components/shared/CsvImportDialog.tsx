import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { productApi } from "@/api/productApi";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ImportError {
  row: number;
  code: string;
  error: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: ImportError[];
}

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  templateHeaders?: string[];
  sampleRow?: string;
  requiredColumns?: string[];
  optionalColumns?: string[];
  entityName?: string;
  queryKeyToInvalidate?: string;
  importMutationFn?: (file: File) => Promise<any>;
}

// ─── Sample CSV template ──────────────────────────────────────────────────────
const CSV_TEMPLATE_HEADERS = [
  "name",
  "code",
  "category",
  "size_label",
  "size_length_mm",
  "size_width_mm",
  "pieces_per_box",
  "sqft_per_box",
  "gst_rate",
  "mrp",
  "reorder_level_boxes",
  "brand",
  "hsn_code",
  "description",
  "is_active",
].join(",");

// ─── Component ────────────────────────────────────────────────────────────────
export function CsvImportDialog({ 
  open, 
  onClose,
  title,
  description,
  templateHeaders = CSV_TEMPLATE_HEADERS.split(','),
  sampleRow,
  requiredColumns = ["name", "code", "size_label", "size_length_mm", "size_width_mm", "pieces_per_box", "sqft_per_box"],
  optionalColumns = ["category", "gst_rate", "mrp", "brand", "hsn_code", "reorder_level_boxes", "description", "is_active"],
  entityName,
  queryKeyToInvalidate = "products",
  importMutationFn = (file: File) => productApi.importCsv(file)
}: CsvImportDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultTitle = t('sampleData.importProductsTitle');
  const defaultDesc = t('sampleData.importProductsDesc');
  const defaultSampleRow = "Vitrified Premium,VIT-001,Tiles,600x600,600,600,4,21.50,18,850,10,OrientBell,6907,Premium glossy vitrified tile,true";
  const defaultEntityName = t('dashboard.products').toLowerCase();

  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const importMutation = useMutation({
    mutationFn: importMutationFn,
    onSuccess: (data: any) => {
      setResult(data.data);
      qc.invalidateQueries({ queryKey: [queryKeyToInvalidate] });
      if (data.data.imported > 0) {
        toast.success(`✅ ${data.data.imported} ${entityName || defaultEntityName} imported successfully!`);
      }
      if (data.data.skipped > 0) {
        toast.warning(`⚠️ ${data.data.skipped} row(s) were skipped. Check errors below.`);
      }
    },
    onError: () => {
      toast.error("Import failed. Please check the file and try again.");
    },
  });

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Only .csv files are accepted.");
      return;
    }
    setSelectedFile(file);
    setResult(null);
    setShowErrors(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  };

  const handleImport = () => {
    if (!selectedFile) return;
    importMutation.mutate(selectedFile);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setResult(null);
    setShowErrors(false);
    importMutation.reset();
    onClose();
  };

  const isLoading = importMutation.isPending;
  const hasResult = !!result;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5 text-blue-600" />
            {title || defaultTitle}
          </DialogTitle>
          <DialogDescription>
            {description || defaultDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* ─── Template Download ─── */}
          <div className="flex items-center justify-between rounded-lg border border-dashed border-blue-200 bg-blue-50/60 px-4 py-3">
            <div className="flex items-start gap-3">
              <Download className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  {t('sampleData.downloadTemplate')}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  {t('sampleData.downloadTemplateDesc')}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const blob = new Blob([`${templateHeaders.join(",")}\n${sampleRow || defaultSampleRow}`], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${queryKeyToInvalidate}_import_template.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="border-blue-300 text-blue-700 hover:bg-blue-100 shrink-0"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {t('sampleData.template')}
            </Button>
          </div>

          {/* ─── Drop Zone ─── */}
          {!hasResult && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 py-10 px-4",
                dragging
                  ? "border-blue-500 bg-blue-50 scale-[1.01]"
                  : selectedFile
                    ? "border-emerald-400 bg-emerald-50/50"
                    : "border-muted-foreground/30 bg-muted/20 hover:border-blue-400 hover:bg-blue-50/30"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={onFileChange}
              />

              {selectedFile ? (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                    <FileText className="h-7 w-7 text-emerald-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-emerald-800">{selectedFile.name}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB · Click to change
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full transition-colors",
                    dragging ? "bg-blue-100" : "bg-muted"
                  )}>
                    <Upload className={cn(
                      "h-7 w-7 transition-colors",
                      dragging ? "text-blue-600" : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">
                      {dragging ? t('sampleData.dropZoneDragging') : t('sampleData.dropZone')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('sampleData.orClickBrowse')}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── Import Result ─── */}
          {hasResult && (
            <div className="rounded-xl border overflow-hidden">
              {/* Summary Bar */}
              <div className="grid grid-cols-3 divide-x bg-muted/30">
                <div className="flex flex-col items-center gap-1 py-4">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-2xl font-bold text-emerald-700">{result.imported}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{t('sampleData.imported')}</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-4">
                  <div className="flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-2xl font-bold text-red-600">{result.skipped}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{t('sampleData.skipped')}</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-4">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-2xl font-bold text-amber-600">{result.errors.length}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{t('sampleData.warningsErrors')}</span>
                </div>
              </div>

              {/* Errors List */}
              {result.errors.length > 0 && (
                <div className="border-t">
                  <button
                    onClick={() => setShowErrors((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      {t('sampleData.issuesClickTo', { action: showErrors ? t('sampleData.hide') : t('sampleData.view') })}
                    </span>
                    {showErrors ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {showErrors && (
                    <div className="divide-y max-h-56 overflow-y-auto bg-red-50/40">
                      {result.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-medium text-red-700">
                              Row {err.row}
                              {err.code && err.code !== "(unknown)" ? ` · SKU: ${err.code}` : ""}
                            </span>
                            <p className="text-xs text-red-600 mt-0.5 break-words">{err.error}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── Action Buttons ─── */}
          <div className="flex justify-between gap-3 pt-1">
            {hasResult ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    setSelectedFile(null);
                    setShowErrors(false);
                  }}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  {t('sampleData.importAnother')}
                </Button>
                <Button onClick={handleClose}>{t('sampleData.done')}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!selectedFile || isLoading}
                  className="min-w-[130px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('sampleData.importing')}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {t('sampleData.importData')}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

