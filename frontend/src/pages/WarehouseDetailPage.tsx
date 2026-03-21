import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { warehouseApi, rackApi } from "@/api/warehouseApi";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Layers, MapPin, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Rack } from "@/types/warehouse.types";
import { useTranslation } from "react-i18next";

export default function WarehouseDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: warehouse, isLoading: loadingWarehouse } = useQuery({
    queryKey: ["warehouse", id],
    queryFn: () => warehouseApi.getById(id!),
    enabled: !!id,
  });

  const { data: racksData, isLoading: loadingRacks } = useQuery({
    queryKey: ["warehouse-racks", id],
    queryFn: () => rackApi.getAll({ warehouse_id: id, limit: 1000 }),
    enabled: !!id,
  });

  if (loadingWarehouse) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">{t('warehouseDetails.loading')}</div>;
  }

  if (!warehouse) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-destructive font-medium">{t('warehouseDetails.notFound')}</p>
        <Button variant="outline" onClick={() => navigate("/setup/warehouses")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('warehouseDetails.backBtn')}
        </Button>
      </div>
    );
  }

  const columns = [
    { key: "name", label: t('warehouseDetails.rackName'), render: (r: Rack) => <span className="font-semibold">{r.name}</span> },
    { key: "zone", label: t('warehouseDetails.zone'), render: (r: Rack) => r.zone || "—" },
    { key: "aisle", label: t('warehouseDetails.aisle'), render: (r: Rack) => r.aisle || "—" },
    { key: "row", label: t('warehouseDetails.row'), render: (r: Rack) => r.row || "—" },
    { key: "level", label: t('warehouseDetails.level'), render: (r: Rack) => r.level || "—" },
    {
      key: "capacity",
      label: t('warehouseDetails.capacityOccupancy'),
      render: (r: Rack) => (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{r.occupied_boxes || 0} / {r.capacity_boxes || 0} {t('common.boxes')}</span>
          </div>
          <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${Math.min(100, ((r.occupied_boxes || 0) / (r.capacity_boxes || 1)) * 100)}%` }}
            />
          </div>
        </div>
      )
    },
    { key: "rack_status", label: t('common.status'), render: (r: Rack) => <StatusBadge status={r.rack_status?.toLowerCase() || 'active'} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/setup/warehouses")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={warehouse.name}
          subtitle={`${t('warehouseDetails.warehouseCode')}: ${warehouse.code}`}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Info className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">{t('warehouseDetails.generalInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <StatusBadge status={warehouse.is_active ? "active" : "inactive"} />
              <span className="text-xs text-muted-foreground font-mono uppercase">{warehouse.code}</span>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('warehouseDetails.location')}</p>
                  <p className="text-sm">
                    {warehouse.city && warehouse.state ? `${warehouse.city}, ${warehouse.state}` : warehouse.city || warehouse.state || "N/A"}
                  </p>
                  <p className="text-xs text-muted-foreground">{warehouse.address}</p>
                  {warehouse.pincode && <p className="text-xs text-muted-foreground">PIN: {warehouse.pincode}</p>}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Layers className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{t('warehouseDetails.inventoryStats')}</p>
                  <p className="text-sm font-medium">{warehouse.rack_count || 0} {t('warehouseDetails.totalRacks')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center border-b bg-muted/20 px-6 py-4">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">{t('warehouseDetails.warehouseRacks')}</CardTitle>
                <p className="text-xs text-muted-foreground">{t('warehouseDetails.rackListDesc')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataTableShell
              data={racksData?.data || []}
              columns={columns}
              isLoading={loadingRacks}
              searchKey="name"
              searchPlaceholder={t('warehouseDetails.filterRacks')}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
