import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { gstApi, type GstConfiguration, type CreateGstConfigDto } from '@/api/gstApi';
import { PageHeader } from '@/components/shared/PageHeader';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const gstConfigSchema = z.object({
  gstin: z.string().min(1, 'GSTIN is required'),
  legal_name: z.string().min(1, 'Legal name is required'),
  trade_name: z.string().optional(),
  state_code: z.string().min(1, 'State code is required').length(2, 'State code must be 2 digits'),
  state_name: z.string().min(1, 'State name is required'),
  pan: z.string().optional(),
  default_gst_rate: z.coerce.number().min(0, 'Must be 0 or more').max(100, 'Must be 100 or less'),
  fiscal_year_start: z.string().optional(),
  invoice_prefix: z.string().optional(),
  is_composition_scheme: z.boolean(),
});

type GstConfigFormValues = z.infer<typeof gstConfigSchema>;

function formDefaultValues(config: GstConfiguration | null): GstConfigFormValues {
  if (config) {
    return {
      gstin: config.gstin ?? '',
      legal_name: config.legal_name ?? '',
      trade_name: config.trade_name ?? '',
      state_code: config.state_code ?? '',
      state_name: config.state_name ?? '',
      pan: config.pan ?? '',
      default_gst_rate: Number(config.default_gst_rate) ?? 18,
      fiscal_year_start: config.fiscal_year_start ?? '04-01',
      invoice_prefix: config.invoice_prefix ?? '',
      is_composition_scheme: Boolean(config.is_composition_scheme),
    };
  }
  return {
    gstin: '',
    legal_name: '',
    trade_name: '',
    state_code: '',
    state_name: '',
    pan: '',
    default_gst_rate: 18,
    fiscal_year_start: '04-01',
    invoice_prefix: '',
    is_composition_scheme: false,
  };
}

function toCreateDto(values: GstConfigFormValues): CreateGstConfigDto {
  return {
    gstin: values.gstin.trim(),
    legal_name: values.legal_name.trim(),
    trade_name: values.trade_name?.trim() || null,
    state_code: values.state_code.trim(),
    state_name: values.state_name.trim(),
    pan: values.pan?.trim() || null,
    default_gst_rate: values.default_gst_rate,
    fiscal_year_start: values.fiscal_year_start?.trim() || null,
    invoice_prefix: values.invoice_prefix?.trim() || null,
    is_composition_scheme: values.is_composition_scheme,
  };
}

export default function GstConfigurationPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<GstConfiguration | null>(null);

  const {
    data: configResponse,
    isLoading: configLoading,
    isError: configError,
    error: configErrorObj,
  } = useQuery({
    queryKey: ['gst-config'],
    queryFn: () => gstApi.getByTenant(),
  });

  const config: GstConfiguration | null = configResponse?.data ?? null;

  const form = useForm<GstConfigFormValues>({
    resolver: zodResolver(gstConfigSchema),
    defaultValues: formDefaultValues(null),
  });

  useEffect(() => {
    if (config !== undefined) {
      form.reset(formDefaultValues(config));
    }
  }, [config, form]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateGstConfigDto) => gstApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gst-config'] });
      toast.success(t('gstConfig.created'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string }; status?: number } } }) => {
      const msg = e?.response?.data?.error?.message;
      const status = e?.response?.data?.status ?? e?.response?.status;
      if (status === 404) {
        toast.error(t('gstConfig.notFound'));
        return;
      }
      if (status === 500) {
        toast.error(t('gstConfig.serverError'));
        return;
      }
      if (e?.response?.data?.error?.message) {
        toast.error(msg);
        return;
      }
      toast.error(t('gstConfig.failedToCreate'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateGstConfigDto }) => gstApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gst-config'] });
      toast.success(t('gstConfig.updated'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } }; status?: number } }) => {
      const msg = e?.response?.data?.error?.message;
      const status = e?.response?.status;
      if (status === 404) {
        toast.error(t('gstConfig.configNotFound'));
        return;
      }
      if (status === 500) {
        toast.error(t('gstConfig.serverError'));
        return;
      }
      toast.error(msg ?? t('gstConfig.failedToUpdate'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => gstApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gst-config'] });
      setDeleteTarget(null);
      form.reset(formDefaultValues(null));
      toast.success(t('gstConfig.deleted'));
    },
    onError: (e: { response?: { data?: { error?: { message?: string } }; status?: number } }) => {
      const status = e?.response?.status;
      if (status === 404) {
        toast.error(t('gstConfig.configNotFound'));
        return;
      }
      if (status === 500) {
        toast.error(t('gstConfig.serverError'));
        return;
      }
      toast.error(e?.response?.data?.error?.message ?? t('gstConfig.failedToDelete'));
    },
  });

  const onSubmit = (values: GstConfigFormValues) => {
    const payload = toCreateDto(values);
    if (config) {
      updateMutation.mutate({ id: config.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isCreateMode = !config;
  const isMutating = createMutation.isPending || updateMutation.isPending;

  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (configError) {
    const status = (configErrorObj as { response?: { status?: number } })?.response?.status;
    return (
      <div>
        <PageHeader title={t('gstConfig.title')} subtitle={t('gstConfig.setupSubtitle')} />
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {status === 404
            ? t('gstConfig.noConfigFound')
            : status === 500
              ? t('gstConfig.serverErrorLong')
              : (configErrorObj as Error)?.message ?? t('gstConfig.failedToLoad')}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('gstConfig.title')}
        subtitle={isCreateMode ? t('gstConfig.subtitleCreate') : t('gstConfig.subtitleEdit')}
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{isCreateMode ? t('gstConfig.cardTitleCreate') : t('gstConfig.cardTitleEdit')}</CardTitle>
          <CardDescription>
            {isCreateMode
              ? t('gstConfig.cardDescCreate')
              : t('gstConfig.cardDescEdit')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="gstin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('gstConfig.gstin')} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t('gstConfig.placeholderGstin')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="legal_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('gstConfig.legalName')} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t('gstConfig.placeholderLegalName')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="trade_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('gstConfig.tradeName')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('gstConfig.placeholderTradeName')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="state_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('gstConfig.stateCode')} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t('gstConfig.placeholderStateCode')} maxLength={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('gstConfig.stateName')} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t('gstConfig.placeholderStateName')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="pan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('gstConfig.pan')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('gstConfig.placeholderPan')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="default_gst_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('gstConfig.defaultGstRate')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={100} step={0.01} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fiscal_year_start"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('gstConfig.fiscalYearStart')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('gstConfig.placeholderFiscalYear')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="invoice_prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('gstConfig.invoicePrefix')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('gstConfig.placeholderInvoicePrefix')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_composition_scheme"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t('gstConfig.compositionScheme')}</FormLabel>
                      <p className="text-sm text-muted-foreground">{t('gstConfig.compositionSchemeDesc')}</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap gap-3 pt-2">
                {isCreateMode ? (
                  <Button type="submit" disabled={isMutating}>
                    {isMutating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {t('common.save')}
                  </Button>
                ) : (
                  <>
                    <Button type="submit" disabled={isMutating}>
                      {isMutating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {t('common.update')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => config && setDeleteTarget(config)}
                      disabled={isMutating}
                    >
                      {t('common.delete')}
                    </Button>
                  </>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => (deleteTarget ? deleteMutation.mutateAsync(deleteTarget.id) : Promise.resolve())}
        title={t('gstConfig.deleteTitle')}
        description={t('gstConfig.deleteDesc')}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
