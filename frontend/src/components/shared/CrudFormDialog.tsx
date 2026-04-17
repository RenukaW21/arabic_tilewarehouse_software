import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetchNextDocNumber } from '@/hooks/useNextDocNumber';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'combobox' | 'switch' | 'date' | 'file';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: any;
  readOnly?: boolean;
}

export interface AutoNumberConfig {
  fieldKey: string;
  docType: string;
}

interface CrudFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, any>) => void | Promise<any>;
  fields: FieldDef[];
  title: string;
  initialData?: Record<string, any> | null;
  loading?: boolean;
  autoNumber?: AutoNumberConfig;
  onValueChange?: (key: string, value: any) => void;
  values?: Record<string, any>;
  readOnly?: boolean;
}

export function CrudFormDialog({ open, onClose, onSubmit, fields, title, initialData, loading, autoNumber, onValueChange, values, readOnly }: CrudFormDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const prevOpen = useRef(open);
  const prevInitialData = useRef(initialData);

  useEffect(() => {
    const becameOpen = open && !prevOpen.current;
    const initialDataChanged = initialData !== prevInitialData.current;
    
    if (open) {
      const shouldReset = becameOpen || initialDataChanged;

      if (shouldReset) {
        setErrors({});
        const defaults: Record<string, any> = {};
        fields.forEach(f => {
          let val = initialData?.[f.key] ?? f.defaultValue ?? (f.type === 'switch' ? true : f.type === 'number' ? '' : '');
          if (f.type === 'date' && val && typeof val === 'string') {
            val = val.slice(0, 10);
          }
          if (f.type === 'select' && !f.required) {
            defaults[f.key] = initialData?.[f.key] != null ? val : f.defaultValue || 'none';
          } else {
            defaults[f.key] = val;
          }
        });
        setFormData(defaults);

        if (!initialData && autoNumber) {
          fetchNextDocNumber(autoNumber.docType)
            .then(num => setFormData(prev => ({ ...prev, [autoNumber.fieldKey]: num })))
            .catch(() => {/* keep placeholder */ });
        }
      }
    }
    prevOpen.current = open;
    prevInitialData.current = initialData;
  }, [open, initialData, fields, autoNumber]);

  useEffect(() => {
    if (open && values) {
      setFormData(prev => {
        const hasChanged = Object.entries(values).some(([k, v]) => prev[k] !== v);
        if (!hasChanged) return prev;
        return { ...prev, ...values };
      });
    }
  }, [values, open]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    fields.forEach(f => {
      if (!f.required) return;
      const val = formData[f.key];
      const empty = val === undefined || val === null || val === '' || (f.type === 'select' && (val === 'none' || val === ''));
      if (empty) next[f.key] = `${f.label} ${t('crudForm.isRequired')}`;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const submitData: Record<string, any> = {};
    for (const key in formData) {
      submitData[key] = formData[key] === 'none' ? '' : formData[key];
    }
    setErrors({});
    try {
      await onSubmit(submitData);
    } catch (err: any) {
      const details = err?.response?.data?.error?.details as Array<{ path?: string[]; message?: string }> | undefined;
      if (Array.isArray(details) && details.length) {
        const next: Record<string, string> = {};
        details.forEach(d => {
          const pathArr = (d as any).path || (d as any).field;
          const key = Array.isArray(pathArr) ? pathArr.join('.') : String(pathArr ?? '');
          if (key && d.message) next[key] = d.message;
        });
        setErrors(next);
      }
      const msg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message ?? 'Request failed';
      toast.error(msg);
    }
  };

  const setValue = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }));
    if (onValueChange) onValueChange(key, value);
  };

  const isAutoNumberField = (key: string) => !initialData && autoNumber?.fieldKey === key;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {fields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>{f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}</Label>
              {f.type === 'textarea' ? (
                <Textarea id={f.key} value={formData[f.key] || ''} onChange={e => setValue(f.key, e.target.value)} placeholder={f.placeholder} required={f.required} className={errors[f.key] ? 'border-destructive' : ''} disabled={readOnly} />
              ) : f.type === 'select' ? (
                <Select value={formData[f.key] || (f.required ? '' : 'none')} onValueChange={v => setValue(f.key, v)} disabled={readOnly}>
                  <SelectTrigger className={errors[f.key] ? 'border-destructive' : ''}><SelectValue placeholder={f.placeholder || t('common.select')} /></SelectTrigger>
                  <SelectContent>
                    {!f.required && <SelectItem value="none">{t('common.none')}</SelectItem>}
                    {f.options?.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : f.type === 'combobox' ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      disabled={readOnly}
                      className={cn(
                        "w-full justify-between font-normal text-left",
                        !formData[f.key] && "text-muted-foreground",
                        errors[f.key] && "border-destructive"
                      )}
                    >
                      {formData[f.key]
                        ? f.options?.find(o => o.value === formData[f.key])?.label
                        : (f.placeholder || t('common.select'))}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder={`Search ${f.label.toLowerCase()}...`} />
                      <CommandList>
                        <CommandEmpty>No {f.label.toLowerCase()} found.</CommandEmpty>
                        <CommandGroup>
                          {f.options?.map(o => (
                            <CommandItem
                              key={o.value}
                              value={o.label}
                              onSelect={() => {
                                setValue(f.key, o.value);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  o.value === formData[f.key] ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {o.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              ) : f.type === 'switch' ? (
                <div className="flex items-center gap-2">
                  <Switch id={f.key} checked={!!formData[f.key]} onCheckedChange={v => setValue(f.key, v)} disabled={readOnly} />
                  <span className="text-sm text-muted-foreground">{formData[f.key] ? t('crudForm.active') : t('crudForm.inactive')}</span>
                </div>
              ) : (
                <Input
                  id={f.key}
                  type={f.type}
                  value={f.type === 'date' && formData[f.key] ? String(formData[f.key]).slice(0, 10) : (f.type === 'file' ? undefined : (formData[f.key] ?? ''))}
                  onChange={e => {
                    if (f.type === 'file') {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) setValue(f.key, file);
                    } else {
                      setValue(f.key, e.target.value);
                    }
                  }}
                  placeholder={f.placeholder}
                  required={f.required && (f.type === 'file' ? !initialData : true)}
                  step={f.type === 'number' ? 'any' : undefined}
                  readOnly={f.readOnly || isAutoNumberField(f.key) || readOnly}
                  disabled={readOnly}
                  className={cn((f.readOnly || isAutoNumberField(f.key) || readOnly) && 'bg-muted font-mono', errors[f.key] && 'border-destructive')}
                />
              )}
              {errors[f.key] && <p className="text-xs text-destructive">{errors[f.key]}</p>}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{readOnly ? t('common.close', 'Close') : t('crudForm.cancel')}</Button>
            {!readOnly && (
              <Button type="submit" disabled={loading}>{loading ? t('crudForm.saving') : initialData ? t('crudForm.update') : t('crudForm.create')}</Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
