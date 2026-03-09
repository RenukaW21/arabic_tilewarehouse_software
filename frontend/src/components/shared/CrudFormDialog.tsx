import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetchNextDocNumber } from '@/hooks/useNextDocNumber';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'switch' | 'date';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: any;
}

export interface AutoNumberConfig {
  fieldKey: string;
  docType: string;
}

interface CrudFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  fields: FieldDef[];
  title: string;
  initialData?: Record<string, any> | null;
  loading?: boolean;
  autoNumber?: AutoNumberConfig;
}

export function CrudFormDialog({ open, onClose, onSubmit, fields, title, initialData, loading, autoNumber }: CrudFormDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
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

      // Auto-generate doc number for new records
      if (!initialData && autoNumber) {
        fetchNextDocNumber(autoNumber.docType)
          .then(num => setFormData(prev => ({ ...prev, [autoNumber.fieldKey]: num })))
          .catch(() => {/* keep placeholder */ });
      }
    }
  }, [open, initialData, fields, autoNumber]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    fields.forEach(f => {
      if (!f.required) return;
      const val = formData[f.key];
      const empty = val === undefined || val === null || val === '' || (f.type === 'select' && (val === 'none' || val === ''));
      if (empty) next[f.key] = `${f.label} is required`;
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
          const key = Array.isArray(d.path) ? d.path.join('.') : String(d.path ?? '');
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
                <Textarea id={f.key} value={formData[f.key] || ''} onChange={e => setValue(f.key, e.target.value)} placeholder={f.placeholder} required={f.required} className={errors[f.key] ? 'border-destructive' : ''} />
              ) : f.type === 'select' ? (
                <Select value={formData[f.key] || (f.required ? '' : 'none')} onValueChange={v => setValue(f.key, v)}>
                  <SelectTrigger className={errors[f.key] ? 'border-destructive' : ''}><SelectValue placeholder={f.placeholder || 'Select...'} /></SelectTrigger>
                  <SelectContent>
                    {!f.required && <SelectItem value="none">— None —</SelectItem>}
                    {f.options?.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : f.type === 'switch' ? (
                <div className="flex items-center gap-2">
                  <Switch id={f.key} checked={!!formData[f.key]} onCheckedChange={v => setValue(f.key, v)} />
                  <span className="text-sm text-muted-foreground">{formData[f.key] ? 'Active' : 'Inactive'}</span>
                </div>
              ) : (
                <Input
                  id={f.key}
                  type={f.type}
                  value={f.type === 'date' && formData[f.key] ? String(formData[f.key]).slice(0, 10) : (formData[f.key] ?? '')}
                  onChange={e => setValue(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  required={f.required}
                  step={f.type === 'number' ? 'any' : undefined}
                  readOnly={isAutoNumberField(f.key)}
                  className={cn(isAutoNumberField(f.key) && 'bg-muted font-mono', errors[f.key] && 'border-destructive')}
                />
              )}
              {errors[f.key] && <p className="text-xs text-destructive">{errors[f.key]}</p>}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : initialData ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
