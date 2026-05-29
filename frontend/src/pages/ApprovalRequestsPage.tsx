import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  CheckCircle,
  XCircle,
  Clock,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from 'lucide-react';
import { approvalApi, ApprovalRequest, ApprovalStatus, ApprovalRequestType } from '@/api/approvalApi';
import { useAuth } from '@/hooks/useAuth';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ApprovalRequestType, string> = {
  inventory_adjustment: 'Inventory Adjustment',
  production_entry:     'Production Entry',
  purchase_approval:    'Purchase Approval',
  pricing_change:       'Pricing Change',
  marketplace_update:   'Marketplace Update',
  report_validation:    'Report Validation',
};

const TYPE_COLORS: Record<ApprovalRequestType, string> = {
  inventory_adjustment: 'bg-blue-100 text-blue-800',
  production_entry:     'bg-emerald-100 text-emerald-800',
  purchase_approval:    'bg-purple-100 text-purple-800',
  pricing_change:       'bg-orange-100 text-orange-800',
  marketplace_update:   'bg-pink-100 text-pink-800',
  report_validation:    'bg-indigo-100 text-indigo-800',
};

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const STATUS_ICONS: Record<ApprovalStatus, React.ReactNode> = {
  pending:  <Clock className="h-3.5 w-3.5" />,
  approved: <CheckCircle className="h-3.5 w-3.5" />,
  rejected: <XCircle className="h-3.5 w-3.5" />,
};

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function StatCard({
  label, value, color, icon,
}: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-lg border p-4 flex items-center gap-4 ${color}`}>
      <div className="text-2xl">{icon}</div>
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-2xl font-bold">{value ?? 0}</p>
      </div>
    </div>
  );
}

// ── Review Modal ───────────────────────────────────────────────────────────────

function ReviewModal({
  request,
  action,
  onConfirm,
  onClose,
  loading,
}: {
  request: ApprovalRequest;
  action: 'approve' | 'reject';
  onConfirm: (notes: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          {action === 'approve'
            ? <><CheckCircle className="h-5 w-5 text-green-600" /> Approve Request</>
            : <><XCircle className="h-5 w-5 text-red-600" /> Reject Request</>}
        </h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">{request.title}</span>
          <br />
          Submitted by <span className="font-medium">{request.submitter_name}</span> on {formatDate(request.submitted_at)}
        </p>
        <div>
          <label className="block text-sm font-medium mb-1">
            Review Notes {action === 'reject' && <span className="text-red-500">*</span>}
          </label>
          <textarea
            className="w-full border rounded-md p-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={action === 'approve' ? 'Optional notes…' : 'Reason for rejection…'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border hover:bg-muted transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(notes)}
            disabled={loading || (action === 'reject' && !notes.trim())}
            className={`px-4 py-2 text-sm rounded-md font-medium text-white transition-colors disabled:opacity-50 ${
              action === 'approve'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? 'Processing…' : action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Row expanded detail ─────────────────────────────────────────────────────────

function ExpandedRow({ row }: { row: ApprovalRequest }) {
  return (
    <div className="bg-muted/30 border-t px-4 py-3 text-sm space-y-2">
      {row.description && (
        <p><span className="font-medium">Description:</span> {row.description}</p>
      )}
      {row.review_notes && (
        <p>
          <span className="font-medium">Review Notes:</span>{' '}
          <span className={row.status === 'rejected' ? 'text-red-700' : 'text-green-700'}>
            {row.review_notes}
          </span>
        </p>
      )}
      {row.reviewer_name && (
        <p>
          <span className="font-medium">Reviewed by:</span> {row.reviewer_name} on {formatDate(row.reviewed_at)}
        </p>
      )}
      <p>
        <span className="font-medium">Reference:</span> {row.reference_type} — {row.reference_id}
      </p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function ApprovalRequestsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  const [statusFilter, setStatusFilter]   = useState<string>('pending');
  const [typeFilter, setTypeFilter]       = useState<string>('');
  const [search, setSearch]               = useState('');
  const [page, setPage]                   = useState(1);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [modal, setModal] = useState<{ request: ApprovalRequest; action: 'approve' | 'reject' } | null>(null);

  const { data: statsData } = useQuery({
    queryKey: ['approval-stats'],
    queryFn: () => approvalApi.getStats(),
    enabled: isAdmin,
  });
  const stats = statsData?.data;

  const { data, isLoading } = useQuery({
    queryKey: ['approval-requests', statusFilter, typeFilter, search, page],
    queryFn: () =>
      approvalApi.getAll({
        status: (statusFilter as ApprovalStatus) || undefined,
        request_type: (typeFilter as ApprovalRequestType) || undefined,
        search: search || undefined,
        page,
        limit: 25,
      }),
  });

  const rows  = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      approvalApi.approve(id, notes),
    onSuccess: () => {
      toast.success('Request approved successfully');
      qc.invalidateQueries({ queryKey: ['approval-requests'] });
      qc.invalidateQueries({ queryKey: ['approval-stats'] });
      setModal(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to approve';
      toast.error(msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      approvalApi.reject(id, notes),
    onSuccess: () => {
      toast.success('Request rejected');
      qc.invalidateQueries({ queryKey: ['approval-requests'] });
      qc.invalidateQueries({ queryKey: ['approval-stats'] });
      setModal(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to reject';
      toast.error(msg);
    },
  });

  const handleConfirm = (notes: string) => {
    if (!modal) return;
    if (modal.action === 'approve') {
      approveMutation.mutate({ id: modal.request.id, notes });
    } else {
      rejectMutation.mutate({ id: modal.request.id, notes });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Admin Approval Requests</h1>
          <p className="text-sm text-muted-foreground">
            Review and authorize pending operational requests before they take effect.
          </p>
        </div>
      </div>

      {/* Stats */}
      {isAdmin && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total"    value={Number(stats.total)}    color="bg-card border"              icon={<ClipboardList className="h-5 w-5 text-muted-foreground" />} />
          <StatCard label="Pending"  value={Number(stats.pending)}  color="bg-yellow-50 border-yellow-200" icon={<Clock className="h-5 w-5 text-yellow-600" />} />
          <StatCard label="Approved" value={Number(stats.approved)} color="bg-green-50 border-green-200"  icon={<CheckCircle className="h-5 w-5 text-green-600" />} />
          <StatCard label="Rejected" value={Number(stats.rejected)} color="bg-red-50 border-red-200"      icon={<XCircle className="h-5 w-5 text-red-600" />} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search by title…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary w-56"
        />

        {(statusFilter || typeFilter || search) && (
          <button
            onClick={() => { setStatusFilter(''); setTypeFilter(''); setSearch(''); setPage(1); }}
            className="text-sm text-muted-foreground underline"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">{total} request{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Title</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Submitted By</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              {isAdmin && <th className="text-center px-4 py-3 font-medium">Actions</th>}
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-muted-foreground">No requests found.</td></tr>
            ) : (
              rows.map((row) => (
                <>
                  <tr
                    key={row.id}
                    className="border-t hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  >
                    <td className="px-4 py-3 font-medium max-w-[260px] truncate">{row.title}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[row.request_type]}`}>
                        {TYPE_LABELS[row.request_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status]}`}>
                        {STATUS_ICONS[row.status]}
                        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.submitter_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(row.submitted_at)}</td>
                    {isAdmin && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {row.status === 'pending' && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setModal({ request: row, action: 'approve' })}
                              className="px-3 py-1 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setModal({ request: row, action: 'reject' })}
                              className="px-3 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                    <td className="px-2 py-3 text-muted-foreground">
                      {expandedId === row.id
                        ? <ChevronUp className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />}
                    </td>
                  </tr>
                  {expandedId === row.id && (
                    <tr key={`${row.id}-detail`} className="border-t">
                      <td colSpan={isAdmin ? 7 : 6} className="p-0">
                        <ExpandedRow row={row} />
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ReviewModal
          request={modal.request}
          action={modal.action}
          onConfirm={handleConfirm}
          onClose={() => setModal(null)}
          loading={approveMutation.isPending || rejectMutation.isPending}
        />
      )}
    </div>
  );
}
