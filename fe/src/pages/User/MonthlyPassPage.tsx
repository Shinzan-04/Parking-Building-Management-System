/**
 * User/MonthlyPassPage.tsx
 * Monthly Pass page — User registers, views status, requests cancellation
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getAllPolicies,
  getMySubscriptions,
  registerSubscription,
  requestCancelSubscription,
  verifySubscriptionPayment,
  type RegisterSubscriptionResult,
  type MonthlyPassPolicyResponse,
  type SubscriptionResponse,
  type SubscriptionStatus,
} from '../../services/subscriptionService';
import { getMyVehicles, type VehicleResponse } from '../../services/vehiclesService';
import {
  Loader2, AlertTriangle, CheckCircle2, Clock, XCircle,
  Car, CalendarDays, Banknote, ChevronRight, BadgeCheck,
  RefreshCw, X, ShieldCheck, Wallet,
} from 'lucide-react';
import { createPortal } from 'react-dom';

// ── Helpers ───────────────────────────────────────────────────────────────────

const vnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

function statusInfo(status: SubscriptionStatus): {
  label: string;
  color: string;
  bg: string;
  Icon: React.ElementType;
} {
  switch (status) {
    case 'Active':
      return { label: 'Active', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', Icon: CheckCircle2 };
    case 'PendingPayment':
      return { label: 'Awaiting Payment', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', Icon: Clock };
    case 'PendingCancel':
      return { label: 'Cancellation Pending', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', Icon: Clock };
    case 'Expired':
      return { label: 'Expired', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', Icon: XCircle };
    case 'Canceled':
      return { label: 'Canceled', color: '#ef4444', bg: 'rgba(239,68,68,0.10)', Icon: XCircle };
    default:
      return { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', Icon: Clock };
  }
}

function daysLeft(endDate: string): number {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PolicyCard({
  policy,
  onRegister,
  hasActiveForType,
}: {
  policy: MonthlyPassPolicyResponse;
  onRegister: (policy: MonthlyPassPolicyResponse) => void;
  hasActiveForType: boolean;
}) {
  return (
    <div
      className="relative flex flex-col rounded-2xl border overflow-hidden transition-all hover:-translate-y-0.5"
      style={{
        backgroundColor: 'var(--lp-card-bg, rgba(255,255,255,0.03))',
        borderColor: 'var(--lp-border)',
      }}
    >
      {/* Top accent */}
      <div className="h-1 w-full bg-gradient-to-r from-[#FF4C4C] to-[#ff8080]" />

      <div className="p-6 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF4C4C]/10 flex items-center justify-center">
              <Car size={18} className="text-[#FF4C4C]" />
            </div>
            <div>
              <p className="font-bold text-base" style={{ color: 'var(--lp-text)' }}>
                {policy.vehicleTypeName}
              </p>
              <p className="text-xs" style={{ color: 'var(--lp-text-muted)' }}>Unlimited monthly pass</p>
            </div>
          </div>
          {!policy.isActive && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-400/10 text-gray-400">Suspended</span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-end gap-1">
          <span className="text-3xl font-extrabold" style={{ color: 'var(--lp-text)' }}>
            {vnd(policy.monthlyPrice)}
          </span>
          <span className="text-sm mb-1" style={{ color: 'var(--lp-text-muted)' }}>/month</span>
        </div>

        {/* Description */}
        {policy.description && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-text-muted)' }}>
            {policy.description}
          </p>
        )}

        {/* Features */}
        <ul className="space-y-2 text-sm" style={{ color: 'var(--lp-text-muted)' }}>
          {[
            'Unlimited entry/exit for 30 days',
            'No need to buy per-visit tickets',
            'Priority parking slot',
          ].map(f => (
            <li key={f} className="flex items-center gap-2">
              <BadgeCheck size={14} className="text-[#FF4C4C] shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={() => onRegister(policy)}
          disabled={!policy.isActive}
          className="mt-auto w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          style={
            policy.isActive
              ? { backgroundColor: '#FF4C4C', color: '#fff' }
              : { backgroundColor: 'var(--lp-border)', color: 'var(--lp-text-muted)' }
          }
        >
          {hasActiveForType ? (
            <>
              <CheckCircle2 size={15} />
              Register / Renew
            </>
          ) : (
            <>
              Register Now
              <ChevronRight size={15} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SubscriptionCard({
  sub,
  onRequestCancel,
  onVerifyPayment,
  verifying,
}: {
  sub: SubscriptionResponse;
  onRequestCancel: (sub: SubscriptionResponse) => void;
  onVerifyPayment: (sub: SubscriptionResponse) => void;
  verifying: boolean;
}) {
  const info = statusInfo(sub.status);
  const Icon = info.Icon;
  const remaining = sub.status === 'Active' ? daysLeft(sub.endDate) : null;

  return (
    <div
      className="rounded-2xl border p-5 space-y-4 transition-all"
      style={{
        backgroundColor: 'var(--lp-card-bg, rgba(255,255,255,0.03))',
        borderColor: 'var(--lp-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: info.bg }}>
            <Icon size={16} style={{ color: info.color }} />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--lp-text)' }}>
              {sub.vehicleTypeName}
            </p>
            <p className="text-xs font-mono" style={{ color: 'var(--lp-text-muted)' }}>{sub.licensePlate}</p>
          </div>
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: info.bg, color: info.color }}
        >
          {info.label}
        </span>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--lp-input-bg)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--lp-text-muted)' }}>Start Date</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--lp-text)' }}>
            {new Date(sub.startDate).toLocaleDateString('vi-VN')}
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--lp-input-bg)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--lp-text-muted)' }}>End Date</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--lp-text)' }}>
            {new Date(sub.endDate).toLocaleDateString('vi-VN')}
          </p>
        </div>
      </div>

      {/* Remaining days */}
      {remaining !== null && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
          style={{
            backgroundColor: remaining <= 5 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
            color: remaining <= 5 ? '#ef4444' : '#22c55e',
          }}
        >
          <CalendarDays size={14} />
          <span>
            {remaining > 0
              ? `${remaining} days remaining`
              : 'Expires today'}
          </span>
        </div>
      )}

      {/* Cancel reason */}
      {sub.cancelReason && (
        <div className="px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: 'var(--lp-input-bg)', color: 'var(--lp-text-muted)' }}>
          <span className="font-semibold">Cancellation reason:</span> {sub.cancelReason}
        </div>
      )}
      {sub.cancelRejectReason && (
        <div className="px-3 py-2 rounded-xl text-xs bg-red-400/5 text-red-400">
          <span className="font-semibold">Rejection reason:</span> {sub.cancelRejectReason}
        </div>
      )}

      {/* Actions */}
      {sub.status === 'PendingPayment' && (
        <button
          onClick={() => onVerifyPayment(sub)}
          disabled={verifying}
          className="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}
        >
          {verifying && <Loader2 size={12} className="animate-spin" />}
          Check Payment
        </button>
      )}
      {sub.canCancel && sub.status === 'Active' && (
        <button
          onClick={() => onRequestCancel(sub)}
          className="w-full py-2 rounded-xl text-xs font-semibold border transition-all hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/30"
          style={{ borderColor: 'var(--lp-border)', color: 'var(--lp-text-muted)' }}
        >
          Request Cancellation
        </button>
      )}
    </div>
  );
}

// ── Register Modal ────────────────────────────────────────────────────────────

type Step = 'select-vehicle' | 'select-payment' | 'confirm' | 'payos-pending' | 'payos-success';

// Payment method info
const PAYMENT_METHODS: {
  value: 4 | 5;
  label: string;
  sublabel: string;
  icon: string;
}[] = [
  { value: 5, label: 'System Wallet',   sublabel: 'Deduct directly from your wallet',    icon: '👛' },
  { value: 4, label: 'QR Bank Transfer', sublabel: 'Pay via bank QR code',                icon: '🏦' },
];

function RegisterModal({
  policy,
  vehicles,
  onClose,
  onSuccess,
  onPaid,
}: {
  policy: MonthlyPassPolicyResponse;
  vehicles: VehicleResponse[];
  onClose: () => void;
  onSuccess: () => void;
  /** Called when polling detects the PayOS payment succeeded — only refreshes data in the background, doesn't close the modal */
  onPaid: () => void;
}) {
  const { token } = useAuth();
  const [step, setStep] = useState<Step>('select-vehicle');
  const [vehicleId, setVehicleId] = useState(
    vehicles.find(v => v.vehicleTypeId === policy.vehicleTypeId)?.id
    ?? vehicles[0]?.id
    ?? ''
  );
  const [paymentMethod, setPaymentMethod] = useState<4 | 5>(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [rawQrCode, setRawQrCode] = useState('');
  const [pendingSubscriptionId, setPendingSubscriptionId] = useState('');
  const [checkingPayment, setCheckingPayment] = useState(false);

  const eligibleVehicles = vehicles.filter(v => v.vehicleTypeId === policy.vehicleTypeId);
  const selectedVehicle = vehicles.find(v => v.id === vehicleId);

  const handleRegister = async () => {
    if (!token || !vehicleId) return;
    setSubmitting(true);
    setError('');
    try {
      const result: RegisterSubscriptionResult = await registerSubscription({ vehicleId, paymentMethod }, token);

      if (paymentMethod === 4) {
        // PayOS: backend returns checkoutUrl and qrCode
        if (result.checkoutUrl) {
          setCheckoutUrl(result.checkoutUrl);
          setRawQrCode(result.qrCode || '');
          setPendingSubscriptionId(result.subscriptionId);
          setStep('payos-pending');
        } else {
          // fallback when there's no URL
          setError('Failed to create the payment link. Please try again.');
        }
      } else {
        // Wallet: deducted immediately, done
        onSuccess();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Poll payment status while waiting on PayOS, to auto-close the modal & report success.
  // Calls the PayOS verify API directly (doesn't rely on the webhook — important when the backend runs
  // locally since PayOS can't send webhooks to localhost); the backend activates the pass once payment is confirmed.
  useEffect(() => {
    if (step !== 'payos-pending' || !token || !pendingSubscriptionId) return;

    let cancelled = false;
    const poll = async () => {
      setCheckingPayment(true);
      try {
        const result = await verifySubscriptionPayment(pendingSubscriptionId, token);
        if (!cancelled && result.isActive) {
          onPaid();
          setStep('payos-success');
        }
      } catch {
        // ignore transient errors, will retry on the next poll
      } finally {
        if (!cancelled) setCheckingPayment(false);
      }
    };

    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [step, token, pendingSubscriptionId, onPaid]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className={`w-full rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${step === 'payos-pending' ? 'max-w-2xl' : 'max-w-md'}`}
        style={{ backgroundColor: 'var(--lp-nav-bg)', borderColor: 'var(--lp-border)', maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--lp-border)' }}
        >
          <h3 className="font-bold text-base" style={{ color: 'var(--lp-text)' }}>
            {step === 'select-vehicle'  ? 'Select Vehicle' :
             step === 'select-payment'  ? 'Payment Method' :
             step === 'payos-pending'   ? 'Pay via PayOS' :
             step === 'payos-success'   ? 'Payment Successful' :
             'Confirm Registration'}
          </h3>
          {step !== 'payos-success' && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl transition-colors"
              style={{ color: 'var(--lp-text-muted)' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {step === 'select-vehicle' ? (
            <>
              <p className="text-sm" style={{ color: 'var(--lp-text-muted)' }}>
                Select a <strong style={{ color: 'var(--lp-text)' }}>{policy.vehicleTypeName}</strong> vehicle to register for a monthly pass.
              </p>

              {eligibleVehicles.length === 0 ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-400/10 border border-amber-400/20">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                  <p className="text-sm text-amber-400">
                    You don't have a {policy.vehicleTypeName} vehicle yet. Please add one first.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {eligibleVehicles.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setVehicleId(v.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left"
                      style={{
                        borderColor: vehicleId === v.id ? '#FF4C4C' : 'var(--lp-border)',
                        backgroundColor: vehicleId === v.id ? 'rgba(255,76,76,0.06)' : 'var(--lp-input-bg)',
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: vehicleId === v.id ? '#FF4C4C' : 'var(--lp-border)' }}
                      >
                        <Car size={14} style={{ color: vehicleId === v.id ? '#fff' : 'var(--lp-text-muted)' }} />
                      </div>
                      <div>
                        <p className="font-mono font-semibold text-sm" style={{ color: 'var(--lp-text)' }}>{v.plateNumber}</p>
                        <p className="text-xs" style={{ color: 'var(--lp-text-muted)' }}>{v.vehicleTypeName}</p>
                      </div>
                      {vehicleId === v.id && <CheckCircle2 size={16} className="ml-auto text-[#FF4C4C]" />}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : step === 'select-payment' ? (
            // ── Select payment method ────────────────────────────────────
            <>
              <p className="text-sm" style={{ color: 'var(--lp-text-muted)' }}>
                Choose how to pay for the <strong style={{ color: 'var(--lp-text)' }}>{policy.vehicleTypeName}</strong> monthly pass.
              </p>
              <div className="space-y-2.5">
                {PAYMENT_METHODS.map(pm => (
                  <button
                    key={pm.value}
                    onClick={() => setPaymentMethod(pm.value)}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all text-left"
                    style={{
                      borderColor: paymentMethod === pm.value ? '#FF4C4C' : 'var(--lp-border)',
                      backgroundColor: paymentMethod === pm.value ? 'rgba(255,76,76,0.06)' : 'var(--lp-input-bg)',
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{
                        backgroundColor: paymentMethod === pm.value ? 'rgba(255,76,76,0.12)' : 'var(--lp-border)',
                      }}
                    >
                      {pm.icon}
                    </div>
                    {/* Labels */}
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: 'var(--lp-text)' }}>{pm.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--lp-text-muted)' }}>{pm.sublabel}</p>
                    </div>
                    {/* Selected radio */}
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: paymentMethod === pm.value ? '#FF4C4C' : 'var(--lp-border)' }}
                    >
                      {paymentMethod === pm.value && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#FF4C4C]" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {/* Note per payment method */}
              {paymentMethod === 5 && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs border"
                  style={{ backgroundColor: 'rgba(96,165,250,0.06)', borderColor: 'rgba(96,165,250,0.2)', color: '#60a5fa' }}>
                  <ShieldCheck size={13} className="shrink-0 mt-0.5" />
                  The amount will be deducted automatically from your wallet. The pass becomes active right after confirmation.
                </div>
              )}
              {paymentMethod === 4 && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs border"
                  style={{ backgroundColor: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.2)', color: '#22c55e' }}>
                  <ShieldCheck size={13} className="shrink-0 mt-0.5" />
                  You'll be redirected to the QR payment page. The pass becomes active once payment succeeds.
                </div>
              )}
            </>
          ) : step === 'confirm' ? (
            <>
              {/* Confirm summary */}
              <div className="space-y-3">
                <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--lp-input-bg)' }}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--lp-text-muted)' }}>Vehicle Type</span>
                    <span className="font-semibold" style={{ color: 'var(--lp-text)' }}>{policy.vehicleTypeName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--lp-text-muted)' }}>License Plate</span>
                    <span className="font-mono font-semibold" style={{ color: 'var(--lp-text)' }}>{selectedVehicle?.plateNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--lp-text-muted)' }}>Duration</span>
                    <span className="font-semibold" style={{ color: 'var(--lp-text)' }}>30 days</span>
                  </div>
                  <div
                    className="flex justify-between text-sm pt-3 border-t"
                    style={{ borderColor: 'var(--lp-border)' }}
                  >
                    <span style={{ color: 'var(--lp-text-muted)' }}>Payment</span>
                    <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--lp-text)' }}>
                      {paymentMethod === 5 ? <>👛 System Wallet</> : <>🏦 QR Bank Transfer</>}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold" style={{ color: 'var(--lp-text)' }}>Total</span>
                    <span className="font-extrabold text-[#FF4C4C]">{vnd(policy.monthlyPrice)}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs border"
                  style={{
                    backgroundColor: paymentMethod === 5 ? 'rgba(96,165,250,0.06)' : 'rgba(34,197,94,0.06)',
                    borderColor:     paymentMethod === 5 ? 'rgba(96,165,250,0.2)'  : 'rgba(34,197,94,0.2)',
                    color:           paymentMethod === 5 ? '#60a5fa'                : '#22c55e',
                  }}
                >
                  <ShieldCheck size={13} className="shrink-0 mt-0.5" />
                  {paymentMethod === 5
                    ? 'The amount will be deducted automatically from your wallet. The pass becomes active right after confirmation.'
                    : "You'll be redirected to the QR payment page. The pass becomes active once payment succeeds."
                  }
                </div>
              </div>
            </>
          ) : step === 'payos-pending' ? (
            // ── PayOS payment QR code ──────────────────────────────────────
            <div className="space-y-4">
              {/* Title */}
              <div className="text-center">
                <p className="font-bold text-base" style={{ color: 'var(--lp-text)' }}>
                  Scan the QR code to pay
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--lp-text-muted)' }}>
                  Use your banking app or e-wallet to scan the code below
                </p>
              </div>

              {/* QR Code — generated from the raw qrCode via qrserver.com */}
              {rawQrCode ? (
                <div className="flex justify-center">
                  <div
                    className="p-3 rounded-2xl border"
                    style={{ backgroundColor: '#ffffff', borderColor: 'var(--lp-border)' }}
                  >
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=4&data=${encodeURIComponent(rawQrCode)}`}
                      alt="PayOS payment QR"
                      width={250}
                      height={250}
                      className="rounded-xl"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="w-[250px] h-[250px] bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 border border-dashed">
                    <span className="text-xs">Failed to load QR code</span>
                  </div>
                </div>
              )}

              {/* Amount info */}
              <div
                className="rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: 'var(--lp-input-bg)' }}
              >
                <div>
                  <p className="text-xs" style={{ color: 'var(--lp-text-muted)' }}>Amount</p>
                  <p className="font-extrabold text-[#FF4C4C] text-lg">{vnd(policy.monthlyPrice)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: 'var(--lp-text-muted)' }}>License Plate</p>
                  <p className="font-mono font-semibold text-sm" style={{ color: 'var(--lp-text)' }}>
                    {selectedVehicle?.plateNumber}
                  </p>
                </div>
              </div>

              {/* Fallback link */}
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border transition-colors"
                style={{
                  borderColor: 'var(--lp-border)',
                  color: 'var(--lp-text-muted)',
                  backgroundColor: 'var(--lp-input-bg)',
                }}
              >
                <ChevronRight size={13} />
                Or open the PayOS link in a new tab
              </a>

              {/* Note */}
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs border"
                style={{ backgroundColor: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}
              >
                {checkingPayment
                  ? <Loader2 size={13} className="shrink-0 mt-0.5 animate-spin" />
                  : <AlertTriangle size={13} className="shrink-0 mt-0.5" />}
                <span>Automatically checking payment status... The monthly pass will activate and this window will close automatically once payment succeeds.</span>
              </div>
            </div>
          ) : step === 'payos-success' ? (
            // ── Payment successful ──────────────────────────────────────────
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-400/10 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <div>
                <p className="font-bold text-base" style={{ color: 'var(--lp-text)' }}>
                  Payment successful!
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--lp-text-muted)' }}>
                  The {policy.vehicleTypeName} monthly pass for {selectedVehicle?.plateNumber} has been activated.
                </p>
              </div>
            </div>
          ) : null}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-400/10 border border-red-400/20 rounded-xl">
              <AlertTriangle size={13} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex gap-3"
          style={{ borderColor: 'var(--lp-border)' }}
        >
          {step === 'payos-pending' ? (
            // While waiting for PayOS payment: only a close button
            <button
              onClick={onSuccess} // reload the pass list
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: 'var(--lp-input-bg)', color: 'var(--lp-text-muted)' }}
            >
              Close and Check Later
            </button>
          ) : step === 'payos-success' ? (
            <button
              onClick={onSuccess}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: '#22c55e' }}
            >
              Close
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  if (step === 'confirm') setStep('select-payment');
                  else if (step === 'select-payment') setStep('select-vehicle');
                  else onClose();
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ backgroundColor: 'var(--lp-input-bg)', color: 'var(--lp-text-muted)' }}
              >
                {step === 'select-vehicle' ? 'Cancel' : 'Back'}
              </button>
              <button
                onClick={() => {
                  if (step === 'select-vehicle') setStep('select-payment');
                  else if (step === 'select-payment') setStep('confirm');
                  else handleRegister();
                }}
                disabled={!vehicleId || submitting || eligibleVehicles.length === 0}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ backgroundColor: '#FF4C4C', color: '#fff' }}
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {step === 'select-vehicle'  ? 'Next' :
                 step === 'select-payment'  ? 'Confirm Method' :
                 'Confirm & Pay'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Cancel Modal ──────────────────────────────────────────────────────────────

function CancelModal({
  sub,
  onClose,
  onSuccess,
}: {
  sub: SubscriptionResponse;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { token } = useAuth();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!reason.trim()) { setError('Please enter a cancellation reason.'); return; }
    if (!token) return;
    setSubmitting(true);
    setError('');
    try {
      await requestCancelSubscription(sub.id, reason, token);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit the cancellation request.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4"
        style={{ backgroundColor: 'var(--lp-nav-bg)', borderColor: 'var(--lp-border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center">
            <XCircle size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="font-bold" style={{ color: 'var(--lp-text)' }}>Request Monthly Pass Cancellation</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--lp-text-muted)' }}>
              {sub.vehicleTypeName} · {sub.licensePlate}
            </p>
          </div>
        </div>

        <div className="px-3 py-2.5 rounded-xl text-xs bg-amber-400/8 border border-amber-400/15 text-amber-400">
          Your cancellation request will be reviewed by an Admin. Any refund will be processed within 1–3 business days.
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--lp-text-muted)' }}>
            Cancellation Reason <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={3}
            placeholder="Enter the reason you want to cancel this monthly pass..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none transition-colors border"
            style={{
              backgroundColor: 'var(--lp-input-bg)',
              borderColor: 'var(--lp-border)',
              color: 'var(--lp-text)',
            }}
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <AlertTriangle size={12} />{error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--lp-input-bg)', color: 'var(--lp-text-muted)' }}
          >
            Close
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Submit Request
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MonthlyPassPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [policies, setPolicies] = useState<MonthlyPassPolicyResponse[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionResponse[]>([]);
  const [vehicles, setVehicles] = useState<VehicleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [registerPolicy, setRegisterPolicy] = useState<MonthlyPassPolicyResponse | null>(null);
  const [cancelSub, setCancelSub] = useState<SubscriptionResponse | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [verifyingSubId, setVerifyingSubId] = useState('');

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const policiesData = await getAllPolicies();
      setPolicies(policiesData);

      if (token) {
        const [subsData, vehiclesData] = await Promise.all([
          getMySubscriptions(token),
          getMyVehicles(token),
        ]);
        setSubscriptions(subsData || []);
        setVehicles(vehiclesData || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // Get the vehicle type IDs that already have an active pass
  const activeVehicleTypeIds = subscriptions
    .filter(s => s.status === 'Active')
    .map(s => s.vehicleTypeId);

  const handleRegisterSuccess = () => {
    setRegisterPolicy(null);
    setSuccessMsg('Monthly pass registered successfully! Your pass is now active.');
    loadData(true);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleCancelSuccess = () => {
    setCancelSub(null);
    setSuccessMsg('Cancellation request submitted. An Admin will review it shortly.');
    loadData(true);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleVerifyPayment = async (sub: SubscriptionResponse) => {
    if (!token || verifyingSubId) return;
    setVerifyingSubId(sub.id);
    try {
      const result = await verifySubscriptionPayment(sub.id, token);
      if (result.isActive) {
        setSuccessMsg('Monthly pass activated! Payment has been confirmed.');
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        setError('Payment not yet recorded. Please try again after completing the payment.');
        setTimeout(() => setError(''), 5000);
      }
      loadData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check payment status.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setVerifyingSubId('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
      </div>
    );
  }

  const activeSubscriptions = subscriptions.filter(s => s.status === 'Active' || s.status === 'PendingCancel' || s.status === 'PendingPayment');
  const pastSubscriptions   = subscriptions.filter(s => s.status === 'Expired' || s.status === 'Canceled');

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--lp-bg)', color: 'var(--lp-text)' }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

        {/* Hero Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-extrabold" style={{ color: 'var(--lp-text)' }}>
              Monthly Pass
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--lp-text-muted)' }}>
              Register for a monthly pass — enter and exit freely, no need to buy per-visit tickets
            </p>
          </div>
          <div className="flex items-center gap-2">
            {token && (
              <button
                onClick={() => navigate('/wallet')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors"
                style={{
                  backgroundColor: 'var(--lp-input-bg)',
                  borderColor: 'var(--lp-border)',
                  color: 'var(--lp-text-muted)',
                }}
              >
                <Wallet size={14} />
                My Wallet
              </button>
            )}
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2 rounded-xl border transition-colors"
              style={{
                backgroundColor: 'var(--lp-input-bg)',
                borderColor: 'var(--lp-border)',
                color: 'var(--lp-text-muted)',
              }}
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Success banner */}
        {successMsg && (
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-400/10 border border-emerald-400/20 rounded-xl">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-400">{successMsg}</p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl">
            <AlertTriangle size={15} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Not logged in prompt */}
        {!token && (
          <div
            className="flex items-center justify-between px-6 py-4 rounded-2xl border"
            style={{ backgroundColor: 'rgba(255,76,76,0.04)', borderColor: 'rgba(255,76,76,0.2)' }}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-[#FF4C4C]" />
              <p className="text-sm" style={{ color: 'var(--lp-text)' }}>
                Log in to register for a monthly pass and view your status
              </p>
            </div>
            <button
              onClick={() => navigate('/auth')}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-[#FF4C4C] hover:opacity-90 transition-opacity shrink-0"
            >
              Log In
            </button>
          </div>
        )}

        {/* Policy cards */}
        <section>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--lp-text)' }}>
            Monthly Pass Plans
          </h2>
          {policies.filter(p => p.isActive).length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--lp-text-muted)' }}>
              No monthly pass plans available yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {policies
                .filter(p => p.isActive)
                .map(policy => (
                  <PolicyCard
                    key={policy.id}
                    policy={policy}
                    onRegister={setRegisterPolicy}
                    hasActiveForType={activeVehicleTypeIds.includes(policy.vehicleTypeId)}
                  />
                ))}
            </div>
          )}
        </section>

        {/* My subscriptions — only when logged in */}
        {token && (
          <>
            {/* Active / Pending subscriptions */}
            {activeSubscriptions.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--lp-text)' }}>
                  Active Passes
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeSubscriptions.map(sub => (
                    <SubscriptionCard
                      key={sub.id}
                      sub={sub}
                      onRequestCancel={setCancelSub}
                      onVerifyPayment={handleVerifyPayment}
                      verifying={verifyingSubId === sub.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Past subscriptions */}
            {pastSubscriptions.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--lp-text)' }}>
                  Pass History
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pastSubscriptions.map(sub => (
                    <SubscriptionCard
                      key={sub.id}
                      sub={sub}
                      onRequestCancel={setCancelSub}
                      onVerifyPayment={handleVerifyPayment}
                      verifying={verifyingSubId === sub.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {subscriptions.length === 0 && (
              <div
                className="flex flex-col items-center justify-center py-16 rounded-2xl border"
                style={{ borderColor: 'var(--lp-border)' }}
              >
                <Banknote size={36} className="mb-3 opacity-20" style={{ color: 'var(--lp-text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--lp-text-muted)' }}>
                  You haven't registered for any monthly pass yet.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {registerPolicy && (
        <RegisterModal
          policy={registerPolicy}
          vehicles={vehicles}
          onClose={() => setRegisterPolicy(null)}
          onSuccess={handleRegisterSuccess}
          onPaid={() => loadData(true)}
        />
      )}
      {cancelSub && (
        <CancelModal
          sub={cancelSub}
          onClose={() => setCancelSub(null)}
          onSuccess={handleCancelSuccess}
        />
      )}
    </div>
  );
}
