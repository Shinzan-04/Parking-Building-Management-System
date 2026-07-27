/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarCheck, Check, X, Loader2, RefreshCw,
  AlertTriangle, Clock, MapPin, FileText,
  CheckCircle2, XCircle, ClipboardList, RefreshCcw, LayoutGrid
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getAllActiveReservations, reviewReservation, reassignSlot,
  normalizeReservationStatus,
  RESERVATION_STATUS_LABELS,
} from '../../services/reservationsService';
import type { ReservationResponse, ReviewReservationRequest } from '../../services/reservationsService';
import { getAllSlots } from '../../services/parkingService';
import type { ParkingSlotDetail } from '../../services/parkingService';
import { getBuildingById, updateBuildingApprovalMode } from '../../services/buildingsService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  PaymentPending: 'bg-amber-400/10 text-amber-400',
  Paid: 'bg-emerald-400/10 text-emerald-400',
  PendingReview: 'bg-amber-400/10 text-amber-400',
  Confirmed: 'bg-[#FF4C4C]/10 text-[#FF4C4C]',
  CheckedIn: 'bg-emerald-500/10 text-emerald-500',
  Cancelled: 'bg-white/10 text-white/50',
  Completed: 'bg-white/10 text-white/40',
  Rejected:  'bg-red-400/10 text-red-400',
  NoShow: 'bg-white/10 text-white/50',
  PaymentFailed: 'bg-red-400/10 text-red-400',
};

function StatusBadge({ status }: { status: string }) {
  const label = RESERVATION_STATUS_LABELS[status] ?? status;
  const style = STATUS_STYLE[status] ?? 'bg-white/10 text-white/50';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

// ─── Reservation Card ─────────────────────────────────────────────────────────

function ReservationCard({
  r, onApprove, onReject, onReassign
}: {
  r: ReservationResponse;
  onApprove: (r: ReservationResponse) => void;
  onReject:  (r: ReservationResponse) => void;
  onReassign: (r: ReservationResponse) => void;
}) {
  const status = normalizeReservationStatus(r.status);
  const isPending = status === 'PendingReview';
  const isConfirmed = status === 'Confirmed' || status === 'Paid';

  return (
    <div className="glass-card p-5 rounded-2xl space-y-4 hover:border-white/20 transition-all">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 flex items-center justify-center shrink-0">
            <CalendarCheck size={18} className="text-[#FF4C4C]" />
          </div>
          <div>
            <p className="font-bold font-mono text-white text-base">{r.licensePlate}</p>
            <p className="text-xs text-white/40 mt-0.5">{r.bookingCode}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Info rows */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5 px-3 py-2 bg-white/[0.04] rounded-xl">
          <MapPin size={13} className="text-white/40 shrink-0" />
          <span className="text-xs text-white/70">Slot: <span className="font-semibold text-white">{r.slotNumber}</span></span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-start gap-2 px-3 py-2 bg-white/[0.04] rounded-xl">
            <Clock size={12} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Start</p>
              <p className="text-xs text-white font-medium">{fmtDateTime(r.startTime)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 px-3 py-2 bg-white/[0.04] rounded-xl">
            <Clock size={12} className="text-[#FF4C4C] shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">End</p>
              <p className="text-xs text-white font-medium">{fmtDateTime(r.endTime)}</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-white/30 border-t border-white/5 pt-2">
        Requested at: {fmtDateTime(r.createdAt)}
      </p>

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(r)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-black bg-[#FF4C4C] hover:bg-[#ff3333] hover:opacity-90 transition-opacity"
          >
            <Check size={14} /> Approve
          </button>
          <button
            onClick={() => onReject(r)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-all"
          >
            <X size={14} /> Reject
          </button>
        </div>
      )}

      {isConfirmed && (
        <div className="flex gap-2">
          <button
            onClick={() => onReassign(r)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 transition-all border border-blue-400/20"
          >
            <RefreshCcw size={14} /> Reassign Customer's Slot
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ManagerReservations() {
  const { token, user } = useAuth();

  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState('');
  
  const [activeTab, setActiveTab] = useState<'pending' | 'active'>('pending');

  // Approve modal
  const [approveTarget, setApproveTarget] = useState<ReservationResponse | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState('');

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<ReservationResponse | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  // Reassign modal
  const [reassignTarget, setReassignTarget] = useState<ReservationResponse | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState('');
  const [availableSlots, setAvailableSlots] = useState<ParkingSlotDetail[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Approval Mode
  const [approvalMode, setApprovalMode] = useState<number>(0);
  const [updatingMode, setUpdatingMode] = useState(false);

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');
    try {
      if (user?.assignedBuildingId) {
        const building = await getBuildingById(user.assignedBuildingId);
        let mode = 0;
        if (building.approvalMode === 'AutoApprove' || building.approvalMode === 1) mode = 1;
        else if (building.approvalMode === 'AutoReject' || building.approvalMode === 2) mode = 2;
        setApprovalMode(mode);
      }
      const data = await getAllActiveReservations();
      setReservations(data);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unable to load the reservation list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, user?.assignedBuildingId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Listen for realtime events (SignalR) dispatched from useNotification
  useEffect(() => {
    const handleUpdate = () => loadData(true);
    window.addEventListener('dashboardUpdate', handleUpdate);
    return () => window.removeEventListener('dashboardUpdate', handleUpdate);
  }, [loadData]);

  const loadSlots = async () => {
    if (!token) return;
    setLoadingSlots(true);
    try {
      const slots = await getAllSlots(user?.assignedBuildingId);
      setAvailableSlots(slots.filter(s => s.status === 'Available'));
    } catch (err) {
      setReassignError('Unable to load the list of available slots.');
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (reassignTarget) {
      loadSlots();
      setSelectedSlotId('');
      setReassignError('');
    }
  }, [reassignTarget]);

  // ─── Approve ──────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!approveTarget || !token) return;
    setApproving(true);
    setApproveError('');
    try {
      const payload: ReviewReservationRequest = { isAccepted: true };
      await reviewReservation(approveTarget.id, payload);
      await loadData(true);
      setApproveTarget(null);
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Approval failed.');
      setApproving(false);
    }
  };

  // ─── Reject ───────────────────────────────────────────────────────────────

  const handleReject = async () => {
    if (!rejectTarget || !token) return;
    if (!rejectReason.trim()) { setRejectError('Please enter a rejection reason.'); return; }
    setRejecting(true);
    setRejectError('');
    try {
      const payload: ReviewReservationRequest = { isAccepted: false, reason: rejectReason.trim() };
      await reviewReservation(rejectTarget.id, payload);
      await loadData(true);
      setRejectTarget(null);
      setRejectReason('');
    } catch (e) {
      setRejectError(e instanceof Error ? e.message : 'Rejection failed.');
      setRejecting(false);
    }
  };

  // ─── Reassign ─────────────────────────────────────────────────────────────

  const handleReassign = async () => {
    if (!reassignTarget || !token || !selectedSlotId) {
      setReassignError('Please select a new parking slot.');
      return;
    }
    setReassigning(true);
    setReassignError('');
    try {
      await reassignSlot(reassignTarget.id, selectedSlotId);
      await loadData(true);
      setReassignTarget(null);
    } catch (e) {
      setReassignError(e instanceof Error ? e.message : 'Reassignment failed.');
    } finally {
      setReassigning(false);
    }
  };

  // ─── Update Approval Mode ───────────────────────────────────────────────────

  const handleModeChange = async (mode: number) => {
    if (!token || !user?.assignedBuildingId) return;
    setUpdatingMode(true);
    try {
      await updateBuildingApprovalMode(user.assignedBuildingId, mode);
      setApprovalMode(mode);
    } catch (e) {
      setApiError('Error updating approval mode.');
    } finally {
      setUpdatingMode(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const pendingList = reservations.filter(r => normalizeReservationStatus(r.status) === 'PendingReview');
  const activeList = reservations.filter(r => {
    const s = normalizeReservationStatus(r.status);
    return s === 'Confirmed' || s === 'Paid' || s === 'CheckedIn';
  });

  const displayList = activeTab === 'pending' ? pendingList : activeList;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
        <p className="text-sm text-white/40">Loading reservation list...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Reservation Management</h2>
          <p className="text-sm text-white/40 mt-0.5">
            Review requests and assist customers with slot changes
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {user?.assignedBuildingId && (
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="text-xs font-semibold text-white/50">Approval Mode:</span>
              <select
                value={approvalMode}
                onChange={(e) => handleModeChange(Number(e.target.value))}
                disabled={updatingMode}
                className="bg-transparent text-sm font-bold text-white outline-none disabled:opacity-50 cursor-pointer"
              >
                <option value={0} style={{ color: '#000', backgroundColor: '#fff' }}>Manual</option>
                <option value={1} style={{ color: '#000', backgroundColor: '#fff' }}>Auto-Approve All</option>
                <option value={2} style={{ color: '#000', backgroundColor: '#fff' }}>Auto-Reject All</option>
              </select>
            </div>
          )}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white/50 hover:text-white"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{apiError}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'pending' ? 'bg-[#FF4C4C]/10 text-[#FF4C4C]' : 'text-white/50 hover:bg-white/5'
          }`}
        >
          <CalendarCheck size={16} /> Pending Review
          {pendingList.length > 0 && (
            <span className="ml-1 bg-[#FF4C4C] text-black px-1.5 py-0.5 rounded-md text-[10px]">{pendingList.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'active' ? 'bg-blue-400/10 text-blue-400' : 'text-white/50 hover:bg-white/5'
          }`}
        >
          <CheckCircle2 size={16} /> Approved / Active
          {activeList.length > 0 && (
            <span className="ml-1 bg-white/20 text-white px-1.5 py-0.5 rounded-md text-[10px]">{activeList.length}</span>
          )}
        </button>
      </div>

      {/* List */}
      <div>
        {displayList.length === 0 ? (
          <div className="glass-card rounded-2xl flex flex-col items-center justify-center py-16 gap-3 text-white/30">
            <ClipboardList size={28} />
            <p className="text-sm">No data in this section</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayList.map(r => (
              <ReservationCard
                key={r.id}
                r={r}
                onApprove={r => setApproveTarget(r)}
                onReject={r => { setRejectTarget(r); setRejectReason(''); setRejectError(''); }}
                onReassign={r => setReassignTarget(r)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ══ APPROVE MODAL ══ */}
      {approveTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-[#FF4C4C]/20 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5 bg-white dark:bg-[#0E0E10]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} className="text-[#FF4C4C]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">Confirm Approval</h3>
                <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">The reservation will be accepted</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 dark:text-white/70">
              Approve the reservation request for license plate{' '}
              <span className="font-bold font-mono text-gray-800 dark:text-white">{approveTarget.licensePlate}</span>{' '}
              at slot <span className="font-semibold text-gray-800 dark:text-white">{approveTarget.slotNumber}</span>?
            </p>

            <div className="text-xs text-gray-400 dark:text-white/40 space-y-1 px-3 py-2.5 bg-gray-50 dark:bg-white/5 rounded-xl">
              <p>📅 From: {fmtDateTime(approveTarget.startTime)}</p>
              <p>📅 To: {fmtDateTime(approveTarget.endTime)}</p>
            </div>

            {approveError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertTriangle size={12} /> {approveError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setApproveTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-white/60 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-black bg-[#FF4C4C] hover:bg-[#ff3333] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {approving && <Loader2 size={14} className="animate-spin" />}
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ══ REJECT MODAL ══ */}
      {rejectTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-red-400/20 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5 bg-white dark:bg-[#0E0E10]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center shrink-0">
                <XCircle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">Reject Reservation</h3>
                <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">License Plate: {rejectTarget.licensePlate}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">
                <FileText size={11} className="inline mr-1" />
                Rejection Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Enter the reason for rejecting this reservation request..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-300 dark:placeholder-white/20 focus:outline-none focus:border-red-400/50 transition-colors resize-none"
              />
            </div>

            {rejectError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertTriangle size={12} /> {rejectError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-white/60 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {rejecting && <Loader2 size={14} className="animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ══ REASSIGN MODAL ══ */}
      {reassignTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="border border-blue-400/20 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5 bg-white dark:bg-[#0E0E10]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-400/10 flex items-center justify-center shrink-0">
                <RefreshCcw size={20} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">Reassign Customer's Slot</h3>
                <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">Handle a slot occupancy issue</p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-200 dark:border-white/10 text-sm text-gray-600 dark:text-white/70">
              <p>License Plate: <span className="font-bold text-gray-800 dark:text-white">{reassignTarget.licensePlate}</span></p>
              <p>Current Slot: <span className="font-semibold text-red-400">{reassignTarget.slotNumber}</span> (Having an issue)</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-white/50 mb-1.5">
                <LayoutGrid size={11} className="inline mr-1" />
                Select New Slot (available) <span className="text-red-400">*</span>
              </label>

              {loadingSlots ? (
                <div className="text-xs text-gray-400 dark:text-white/40 flex items-center gap-2 py-2"><Loader2 size={12} className="animate-spin" /> Loading...</div>
              ) : (
                <select
                  value={selectedSlotId}
                  onChange={e => setSelectedSlotId(e.target.value)}
                  className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:border-blue-400/50 transition-colors"
                >
                  <option value="" disabled style={{ color: '#000', backgroundColor: '#fff' }}>-- Please select an available slot --</option>
                  {availableSlots.map(s => (
                    <option key={s.id} value={s.id} style={{ color: '#000', backgroundColor: '#fff' }}>
                      Slot {s.slotNumber} (Floor {s.floorName})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {reassignError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertTriangle size={12} /> {reassignError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setReassignTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 dark:text-white/60 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                disabled={reassigning || !selectedSlotId}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {reassigning && <Loader2 size={14} className="animate-spin" />}
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      , document.body)}

    </div>
  );
}
