import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loyaltyApi } from "@/api/loyaltyApi";
import { customerApi } from "@/api/customerApi";
import type { LoyaltyCustomer, LoyaltyPromotion, LoyaltyReferral, LoyaltySettings, LoyaltyTransaction } from "@/types/loyalty.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTableShell } from "@/components/shared/DataTableShell";
import { CrudFormDialog, FieldDef } from "@/components/shared/CrudFormDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, IndianRupee, Percent, Plus, RefreshCcw, Star, Ticket, Users } from "lucide-react";
import { toast } from "sonner";

const currency = (value: number | string | null | undefined) =>
  `Rs. ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const number = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("en-IN");

const defaultSettings: LoyaltySettings = {
  earn_rate_amount: 100,
  earn_rate_points: 1,
  point_value_amount: 1,
  min_redeem_points: 1,
  max_redeem_percent: 25,
  cashback_percent: 0,
  referral_reward_points: 50,
  tiers: [
    { name: "Bronze", min_points: 0, benefit: "Standard loyalty benefits" },
    { name: "Silver", min_points: 500, benefit: "Priority promotions" },
    { name: "Gold", min_points: 1500, benefit: "Higher-value offers" },
  ],
};

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-md p-3 ${tone}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoyaltyPage() {
  const qc = useQueryClient();
  const [customerPage, setCustomerPage] = useState(1);
  const [transactionPage, setTransactionPage] = useState(1);
  const [customerSearch, setCustomerSearch] = useState("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [settingsDraft, setSettingsDraft] = useState<LoyaltySettings>(defaultSettings);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<LoyaltyPromotion | null>(null);
  const [referralOpen, setReferralOpen] = useState(false);

  const overviewQuery = useQuery({
    queryKey: ["loyalty", "overview"],
    queryFn: loyaltyApi.getOverview,
  });

  const customersQuery = useQuery({
    queryKey: ["loyalty", "customers", customerPage, customerSearch],
    queryFn: () =>
      loyaltyApi.getCustomers({
        page: customerPage,
        limit: 25,
        search: customerSearch || undefined,
        sortBy: "points_balance",
        sortOrder: "DESC",
      }),
  });

  const transactionsQuery = useQuery({
    queryKey: ["loyalty", "transactions", transactionPage, transactionSearch],
    queryFn: () =>
      loyaltyApi.getTransactions({
        page: transactionPage,
        limit: 25,
        search: transactionSearch || undefined,
        sortBy: "created_at",
        sortOrder: "DESC",
      }),
  });

  const promotionsQuery = useQuery({
    queryKey: ["loyalty", "promotions"],
    queryFn: loyaltyApi.getPromotions,
  });

  const referralsQuery = useQuery({
    queryKey: ["loyalty", "referrals"],
    queryFn: loyaltyApi.getReferrals,
  });

  const masterCustomersQuery = useQuery({
    queryKey: ["customers", "loyalty-select"],
    queryFn: () => customerApi.getAll({ page: 1, limit: 200, sortBy: "name", sortOrder: "ASC" }),
  });

  const overview = overviewQuery.data?.data;
  const settings = overview?.settings ?? defaultSettings;
  const customers = customersQuery.data?.data ?? [];
  const transactions = transactionsQuery.data?.data ?? [];
  const promotions = promotionsQuery.data?.data ?? [];
  const referrals = referralsQuery.data?.data ?? [];
  const masterCustomers = masterCustomersQuery.data?.data ?? [];

  useEffect(() => {
    setSettingsDraft(settings);
  }, [settings]);

  const invalidateLoyalty = () => {
    qc.invalidateQueries({ queryKey: ["loyalty"] });
  };

  const saveSettings = useMutation({
    mutationFn: loyaltyApi.updateSettings,
    onSuccess: () => {
      invalidateLoyalty();
      toast.success("Loyalty settings saved");
    },
  });

  const createTransaction = useMutation({
    mutationFn: loyaltyApi.createTransaction,
    onSuccess: () => {
      invalidateLoyalty();
      setTransactionOpen(false);
      toast.success("Loyalty adjustment posted");
    },
  });

  const savePromotion = useMutation({
    mutationFn: (data: Partial<LoyaltyPromotion>) =>
      editingPromotion ? loyaltyApi.updatePromotion(editingPromotion.id, data) : loyaltyApi.createPromotion(data),
    onSuccess: () => {
      invalidateLoyalty();
      setPromotionOpen(false);
      setEditingPromotion(null);
      toast.success(editingPromotion ? "Promotion updated" : "Promotion created");
    },
  });

  const createReferral = useMutation({
    mutationFn: loyaltyApi.createReferral,
    onSuccess: () => {
      invalidateLoyalty();
      setReferralOpen(false);
      toast.success("Referral created");
    },
  });

  const completeReferral = useMutation({
    mutationFn: loyaltyApi.completeReferral,
    onSuccess: () => {
      invalidateLoyalty();
      toast.success("Referral reward posted");
    },
  });

  const customerOptions = masterCustomers.map((c) => ({ label: `${c.name}${c.code ? ` (${c.code})` : ""}`, value: c.id }));

  const transactionFields: FieldDef[] = [
    { key: "customer_id", label: "Customer", type: "select", required: true, options: customerOptions },
    {
      key: "type",
      label: "Type",
      type: "select",
      required: true,
      defaultValue: "adjustment",
      options: [
        { label: "Adjustment", value: "adjustment" },
        { label: "Promotion", value: "promotion" },
        { label: "Cashback", value: "cashback" },
      ],
    },
    { key: "points_delta", label: "Points Delta", type: "number", defaultValue: 0 },
    { key: "cashback_delta", label: "Cashback Delta", type: "number", defaultValue: 0 },
    { key: "description", label: "Description", type: "textarea", placeholder: "Reason for manual adjustment" },
  ];

  const promotionFields: FieldDef[] = [
    { key: "name", label: "Promotion Name", type: "text", required: true },
    { key: "description", label: "Description", type: "textarea" },
    {
      key: "offer_type",
      label: "Offer Type",
      type: "select",
      defaultValue: "points_multiplier",
      options: [
        { label: "Points Multiplier", value: "points_multiplier" },
        { label: "Cashback", value: "cashback" },
        { label: "Member Benefit", value: "member_benefit" },
        { label: "Discount", value: "discount" },
      ],
    },
    { key: "points_multiplier", label: "Points Multiplier", type: "number", defaultValue: 1 },
    { key: "cashback_percent", label: "Cashback %", type: "number", defaultValue: 0 },
    { key: "start_date", label: "Start Date", type: "date", required: true },
    { key: "end_date", label: "End Date", type: "date" },
    { key: "is_active", label: "Active", type: "switch", defaultValue: true },
  ];

  const referralFields: FieldDef[] = [
    { key: "referrer_customer_id", label: "Referrer Customer", type: "select", required: true, options: customerOptions },
    { key: "referred_customer_id", label: "Referred Customer", type: "select", options: customerOptions },
    { key: "referral_code", label: "Referral Code", type: "text", placeholder: "Auto generated if blank" },
    { key: "reward_points", label: "Reward Points", type: "number", defaultValue: settings.referral_reward_points },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const customerColumns = [
    { key: "name", label: "Customer" },
    { key: "code", label: "Code", render: (r: LoyaltyCustomer) => r.code ?? "-" },
    { key: "tier", label: "Tier", render: (r: LoyaltyCustomer) => <Badge variant="secondary">{r.tier?.name ?? "Bronze"}</Badge> },
    { key: "points_balance", label: "Points", render: (r: LoyaltyCustomer) => number(r.points_balance) },
    { key: "cashback_balance", label: "Cashback", render: (r: LoyaltyCustomer) => currency(r.cashback_balance) },
    { key: "phone", label: "Phone", render: (r: LoyaltyCustomer) => r.phone ?? "-" },
  ];

  const transactionColumns = [
    { key: "created_at", label: "Date", render: (r: LoyaltyTransaction) => new Date(r.created_at).toLocaleDateString() },
    { key: "customer_name", label: "Customer" },
    { key: "type", label: "Type", render: (r: LoyaltyTransaction) => <Badge variant="outline">{r.type}</Badge> },
    { key: "points_delta", label: "Points", render: (r: LoyaltyTransaction) => number(r.points_delta) },
    { key: "cashback_delta", label: "Cashback", render: (r: LoyaltyTransaction) => currency(r.cashback_delta) },
    { key: "so_number", label: "Order", render: (r: LoyaltyTransaction) => r.so_number ?? "-" },
    { key: "description", label: "Description", render: (r: LoyaltyTransaction) => r.description ?? "-" },
  ];

  const referralColumns = [
    { key: "referral_code", label: "Code" },
    { key: "referrer_name", label: "Referrer" },
    { key: "referred_customer_name", label: "Referred", render: (r: LoyaltyReferral) => r.referred_customer_name ?? "-" },
    { key: "reward_points", label: "Reward", render: (r: LoyaltyReferral) => number(r.reward_points) },
    { key: "status", label: "Status", render: (r: LoyaltyReferral) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (r: LoyaltyReferral) =>
        r.status !== "rewarded" ? (
          <Button size="sm" variant="outline" onClick={() => completeReferral.mutate(r.id)}>
            <Gift className="me-1.5 h-4 w-4" />
            Reward
          </Button>
        ) : (
          "-"
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Loyalty" subtitle="Reward points, cashback, membership tiers, referrals, and promotional offers" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active Points" value={number(overview?.summary.active_points)} icon={Star} tone="bg-amber-500" />
        <StatCard label="Cashback Liability" value={currency(overview?.summary.active_cashback)} icon={IndianRupee} tone="bg-emerald-600" />
        <StatCard label="Enrolled Customers" value={number(overview?.summary.enrolled_customers)} icon={Users} tone="bg-blue-600" />
        <StatCard label="Active Offers" value={number(overview?.summary.active_promotions)} icon={Ticket} tone="bg-rose-600" />
        <StatCard label="Referrals" value={number(overview?.summary.referral_count)} icon={Gift} tone="bg-violet-600" />
      </div>

      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <DataTableShell<LoyaltyCustomer>
            data={customers}
            columns={customerColumns}
            searchKey="name"
            serverSide
            searchValue={customerSearch}
            onSearchChange={(value) => {
              setCustomerSearch(value);
              setCustomerPage(1);
            }}
            paginationMeta={customersQuery.data?.meta}
            onPageChange={setCustomerPage}
            isLoading={customersQuery.isLoading}
          />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Button onClick={() => setTransactionOpen(true)}>
            <Plus className="me-1.5 h-4 w-4" />
            Manual Adjustment
          </Button>
          <DataTableShell<LoyaltyTransaction>
            data={transactions}
            columns={transactionColumns}
            searchKey="customer_name"
            serverSide
            searchValue={transactionSearch}
            onSearchChange={(value) => {
              setTransactionSearch(value);
              setTransactionPage(1);
            }}
            paginationMeta={transactionsQuery.data?.meta}
            onPageChange={setTransactionPage}
            isLoading={transactionsQuery.isLoading}
          />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Reward Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2 text-sm font-medium">
                  Earn Amount
                  <Input type="number" value={settingsDraft.earn_rate_amount} onChange={(e) => setSettingsDraft({ ...settingsDraft, earn_rate_amount: Number(e.target.value) })} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Earn Points
                  <Input type="number" value={settingsDraft.earn_rate_points} onChange={(e) => setSettingsDraft({ ...settingsDraft, earn_rate_points: Number(e.target.value) })} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Point Value
                  <Input type="number" value={settingsDraft.point_value_amount} onChange={(e) => setSettingsDraft({ ...settingsDraft, point_value_amount: Number(e.target.value) })} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Min Redeem Points
                  <Input type="number" value={settingsDraft.min_redeem_points} onChange={(e) => setSettingsDraft({ ...settingsDraft, min_redeem_points: Number(e.target.value) })} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Max Redeem %
                  <Input type="number" value={settingsDraft.max_redeem_percent} onChange={(e) => setSettingsDraft({ ...settingsDraft, max_redeem_percent: Number(e.target.value) })} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Cashback %
                  <Input type="number" value={settingsDraft.cashback_percent} onChange={(e) => setSettingsDraft({ ...settingsDraft, cashback_percent: Number(e.target.value) })} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Referral Reward Points
                  <Input type="number" value={settingsDraft.referral_reward_points} onChange={(e) => setSettingsDraft({ ...settingsDraft, referral_reward_points: Number(e.target.value) })} />
                </label>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveSettings.mutate(settingsDraft)} disabled={saveSettings.isPending}>
                  Save Rules
                </Button>
                <Button variant="outline" onClick={() => setSettingsDraft(settings)}>
                  <RefreshCcw className="me-1.5 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promotions" className="space-y-4">
          <Button onClick={() => { setEditingPromotion(null); setPromotionOpen(true); }}>
            <Plus className="me-1.5 h-4 w-4" />
            Add Promotion
          </Button>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {promotions.map((promo) => (
              <Card key={promo.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{promo.name}</h3>
                      <p className="text-sm text-muted-foreground">{promo.description || promo.offer_type}</p>
                    </div>
                    <StatusBadge status={promo.is_active ? "active" : "inactive"} />
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="secondary">
                      <Star className="me-1 h-3.5 w-3.5" />
                      {number(promo.points_multiplier)}x
                    </Badge>
                    <Badge variant="secondary">
                      <Percent className="me-1 h-3.5 w-3.5" />
                      {number(promo.cashback_percent)}%
                    </Badge>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setEditingPromotion(promo); setPromotionOpen(true); }}>
                    Edit
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="referrals" className="space-y-4">
          <Button onClick={() => setReferralOpen(true)}>
            <Plus className="me-1.5 h-4 w-4" />
            Add Referral
          </Button>
          <DataTableShell<LoyaltyReferral> data={referrals} columns={referralColumns} isLoading={referralsQuery.isLoading} />
        </TabsContent>
      </Tabs>

      <CrudFormDialog
        open={transactionOpen}
        onClose={() => setTransactionOpen(false)}
        onSubmit={(data) => createTransaction.mutateAsync(data as Partial<LoyaltyTransaction>)}
        fields={transactionFields}
        title="Manual Loyalty Adjustment"
        loading={createTransaction.isPending}
      />

      <CrudFormDialog
        open={promotionOpen}
        onClose={() => { setPromotionOpen(false); setEditingPromotion(null); }}
        onSubmit={(data) => savePromotion.mutateAsync(data as Partial<LoyaltyPromotion>)}
        fields={promotionFields}
        title={editingPromotion ? "Edit Promotion" : "New Promotion"}
        initialData={editingPromotion ?? { start_date: new Date().toISOString().slice(0, 10), is_active: true }}
        loading={savePromotion.isPending}
      />

      <CrudFormDialog
        open={referralOpen}
        onClose={() => setReferralOpen(false)}
        onSubmit={(data) =>
          createReferral.mutateAsync({
            ...(data as Partial<LoyaltyReferral>),
            referred_customer_id: data.referred_customer_id === "none" ? null : data.referred_customer_id,
          })
        }
        fields={referralFields}
        title="New Referral"
        loading={createReferral.isPending}
      />
    </div>
  );
}
