import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, RefreshCw, AlertTriangle, Search, Building2,
  Car, Bike, Truck, CircleParking, Wrench, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getFloorsByBuilding,
  getParkingSlotsByBuilding,
} from '../../services/buildingsService';
import { getCurrentVehicle } from '../../services/buildingsService';
import type { ParkingSlotSummary, FloorResponse } from '../../services/buildingsService';

/* ─────────────────────────── helpers ─────────────────────────── */

type SlotStatus = 'Available' | 'Occupied' | 'Reserved' | 'Maintenance';

function getStatusLabel(status: string | number): SlotStatus {
  if (status === 'Available'   || status === 0) return 'Available';
  if (status === 'Reserved'    || status === 2) return 'Reserved';
  if (status === 'Occupied'    || status === 3) return 'Occupied';
  if (status === 'Maintenance' || status === 4) return 'Maintenance';
  return 'Available';
}

// Màu nền + viền + text cho từng trạng thái (dark-mode friendly)
const STATUS_STYLE: Record<SlotStatus, { bg: string; border: string; text: string; dot: string; cardText: string }> = {
  Available:   { bg: 'rgba(16,185,129,0.18)',  border: 'rgba(16,185,129,0.55)', text: '#10b981', dot: '#10b981', cardText: '#0d1a14' },
  Occupied:    { bg: 'rgba(239,68,68,0.18)',   border: 'rgba(239,68,68,0.55)',  text: '#f87171', dot: '#ef4444', cardText: '#1a0a0a' },
  Reserved:    { bg: 'rgba(234, 179, 8, 0.18)',  border: 'rgba(234, 179, 8, 0.55)', text: '#facc15', dot: '#eab308', cardText: '#1a1600' },
  Maintenance: { bg: 'rgba(100,116,139,0.22)', border: 'rgba(100,116,139,0.5)', text: '#94a3b8', dot: '#64748b', cardText: '#1a1a1a' },
};

const STATUS_LABEL_VI: Record<SlotStatus, string> = {
  Available:   'Available',
  Occupied:    'Occupied',
  Reserved:    'Reserved',
  Maintenance: 'Maintenance',
};

// Icon loại xe nhỏ gọn
function VehicleIcon({ name }: { name?: string }) {
  const n = (name ?? '').toLowerCase();
  if (n.includes('bike') || n.includes('motor') || n.includes('xe máy')) return <Bike size={10} />;
  if (n.includes('truck') || n.includes('tải'))                           return <Truck size={10} />;
  return <Car size={10} />;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

/* ─────────────────────────── Tooltip ─────────────────────────── */
interface TooltipProps { content: React.ReactNode; children: React.ReactElement }

function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const show = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.top - 8, left: r.left + r.width / 2 });
    }
    setVisible(true);
  };

  return (
    <div ref={ref} onMouseEnter={show} onMouseLeave={() => setVisible(false)} style={{ position: 'relative', display: 'inline-block' }}>
      {children}
      {visible && (
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
            background: '#1e2130',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '10px 14px',
            minWidth: 180,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── SlotCard ─────────────────────────── */
interface SlotCardProps {
  slot: ParkingSlotSummary;
  floorName: string;
  token: string;
}

function SlotCard({ slot, floorName, token }: SlotCardProps) {
  const statusKey = getStatusLabel(slot.status);
  const style = STATUS_STYLE[statusKey];
  const [licensePlate, setLicensePlate] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [isOverdue, setIsOverdue]       = useState(false);

  useEffect(() => {
    let mounted = true;
    if (statusKey === 'Occupied' || statusKey === 'Reserved') {
      getCurrentVehicle(slot.id)
        .then(res => {
          if (!mounted || !res) return;
          if (res.licensePlate) setLicensePlate(res.licensePlate);
          if (res.driverName) setDriverName(res.driverName);
          if (res.phoneNumber) setPhoneNumber(res.phoneNumber);
          if (res.status === 'Overdue') setIsOverdue(true);
        })
        .catch(() => {});
    } else {
      setLicensePlate(null);
      setDriverName(null);
      setPhoneNumber(null);
      setIsOverdue(false);
    }
    return () => { mounted = false; };
  }, [slot.id, statusKey, token]);

  // Tooltip nội dung đầy đủ
  const tooltipContent = (
    <div style={{ fontSize: 12, lineHeight: 1.6 }}>
      <div style={{ color: '#fff', fontWeight: 700, fontFamily: 'monospace', fontSize: 14, marginBottom: 6 }}>
        {slot.slotNumber ?? slot.id.slice(0, 8)}
      </div>
      <div style={{ color: '#94a3b8' }}>
        <span style={{ color: '#64748b' }}>Floor: </span>
        <span style={{ color: '#e2e8f0' }}>{floorName}</span>
      </div>
      <div style={{ color: '#94a3b8' }}>
        <span style={{ color: '#64748b' }}>Vehicle Type: </span>
        <span style={{ color: '#e2e8f0' }}>{slot.vehicleTypeName ?? '—'}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8, height: 8, borderRadius: '50%',
            background: style.dot,
            flexShrink: 0,
          }}
        />
        <span style={{ color: style.text, fontWeight: 600 }}>
          {STATUS_LABEL_VI[statusKey]}
        </span>
        {isOverdue && (
          <span style={{ color: '#f87171', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
            · Overdue
          </span>
        )}
      </div>
      {licensePlate && (
        <div style={{ marginTop: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 6, padding: '3px 8px', fontFamily: 'monospace', fontSize: 13, color: isOverdue ? '#f87171' : '#fff', display: 'inline-block' }}>
          {licensePlate}
        </div>
      )}
      {driverName && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ color: '#94a3b8', fontSize: 11 }}>Driver: <span style={{ color: '#fff' }}>{driverName}</span></div>
          {phoneNumber && (
            <div style={{ marginTop: 2 }}>
              <a href={`tel:${phoneNumber}`} style={{ color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                📞 {phoneNumber}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent}>
      <div
        className={isOverdue ? 'animate-overdue-pulse' : ''}
        style={{
          width: '100%',
          minWidth: 90,
          minHeight: 72,
          borderRadius: 10,
          border: `1.5px solid ${isOverdue ? '#ef4444' : style.border}`,
          background: isOverdue ? 'rgba(239,68,68,0.18)' : style.bg,
          padding: '7px 8px 6px',
          cursor: 'default',
          transition: 'transform 0.15s, box-shadow 0.15s',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          position: 'relative',
          boxSizing: 'border-box',
          textAlign: 'center',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 20px ${style.dot}33`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.transform = '';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '';
        }}
      >
        {/* Header: vehicle icon + slot code */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}>
          <span style={{ color: style.cardText, opacity: 0.85, display: 'flex', transform: 'scale(1.2)' }}>
            <VehicleIcon name={slot.vehicleTypeName} />
          </span>
          <span style={{
            fontFamily: 'monospace',
            fontWeight: 800,
            fontSize: 14,
            color: style.cardText,
            letterSpacing: '0.02em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}>
            {slot.slotNumber ?? slot.id.slice(0, 8)}
          </span>
          {isOverdue && (
            <AlertTriangle size={12} style={{ color: '#f87171', flexShrink: 0 }} />
          )}
        </div>

        {/* Vehicle type */}
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: style.cardText,
          opacity: 0.75,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          width: '100%',
        }}>
          {slot.vehicleTypeName ?? '—'}
        </div>

        {/* License plate or status dot */}
        {licensePlate ? (
          <div style={{
            fontFamily: 'monospace',
            fontSize: 12,
            fontWeight: 800,
            color: isOverdue ? '#b91c1c' : style.cardText,
            background: 'rgba(0,0,0,0.08)',
            borderRadius: 6,
            padding: '2px 8px',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}>
            {licensePlate}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 2, width: '100%' }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: style.dot, flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: style.cardText, opacity: 0.9, fontWeight: 700 }}>
              {STATUS_LABEL_VI[statusKey]}
            </span>
          </div>
        )}
      </div>
    </Tooltip>
  );
}

/* ─────────────────────────── FloorSection ─────────────────────────── */
interface FloorSectionProps {
  floor: FloorResponse;
  slots: ParkingSlotSummary[];
  token: string;
  filterStatus: string;
  search: string;
}

function FloorSection({ floor, slots, token, filterStatus, search }: FloorSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const filtered = slots
    .sort((a, b) => (a.slotNumber ?? '').localeCompare(b.slotNumber ?? '', undefined, { numeric: true, sensitivity: 'base' }))
    .filter(s => {
      const st = getStatusLabel(s.status);
      if (filterStatus && st !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(s.slotNumber ?? '').toLowerCase().includes(q) &&
            !(s.vehicleTypeName ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });

  const COLS = 8;
  const rows: ParkingSlotSummary[][] = [];
  for (let i = 0; i < filtered.length; i += COLS) {
    rows.push(filtered.slice(i, i + COLS));
  }

  const counts = {
    available:   slots.filter(s => getStatusLabel(s.status) === 'Available').length,
    occupied:    slots.filter(s => getStatusLabel(s.status) === 'Occupied').length,
    reserved:    slots.filter(s => getStatusLabel(s.status) === 'Reserved').length,
    maintenance: slots.filter(s => getStatusLabel(s.status) === 'Maintenance').length,
  };

  return (
    <div
      style={{
        background: 'var(--admin-bg-card)',
        border: '1px solid var(--admin-border)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Floor header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid var(--admin-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(255,76,76,0.12)',
          }}>
            <CircleParking size={17} style={{ color: '#FF4C4C' }} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: 'var(--admin-text-primary)', fontWeight: 700, fontSize: 15 }}>
              {floor.name.toString().toLowerCase().includes('floor') || floor.name.toString().toLowerCase().includes('tầng') 
                ? floor.name 
                : `Floor ${floor.name}`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 11, color: STATUS_STYLE.Available.text }}>
                ● {counts.available} available
              </span>
              <span style={{ fontSize: 11, color: STATUS_STYLE.Occupied.text }}>
                ● {counts.occupied} occupied
              </span>
              {counts.reserved > 0 && (
                <span style={{ fontSize: 11, color: STATUS_STYLE.Reserved.text }}>
                  ● {counts.reserved} reserved
                </span>
              )}
              {counts.maintenance > 0 && (
                <span style={{ fontSize: 11, color: STATUS_STYLE.Maintenance.text }}>
                  <Wrench size={9} style={{ display: 'inline', marginRight: 2 }} />
                  {counts.maintenance} maintenance
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
            background: 'rgba(255,255,255,0.06)', color: 'var(--admin-text-muted)',
          }}>
            {slots.length} slots
          </span>
          {collapsed
            ? <ChevronDown size={16} style={{ color: 'var(--admin-text-faint)' }} />
            : <ChevronUp   size={16} style={{ color: 'var(--admin-text-faint)' }} />
          }
        </div>
      </button>

      {/* Slot grid */}
      {!collapsed && (
        <div style={{ padding: '16px 20px 20px' }}>
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--admin-text-faint)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              No matching slots found
            </p>
          ) : (
            <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
              <div style={{ minWidth: 'max-content' }}>
                {/* Column Headers */}
                <div
                  style={{
                    display: 'grid',
                    gap: 10,
                    marginBottom: 8,
                    gridTemplateColumns: `30px repeat(${Math.min(COLS, filtered.length)}, minmax(0, 1fr))`,
                  }}
                >
                  <div />
                  {Array.from({ length: Math.min(COLS, filtered.length) }, (_, c) => (
                    <div
                      key={c}
                      style={{
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--admin-text-faint)',
                      }}
                    >
                      {String.fromCharCode(65 + c)}
                    </div>
                  ))}
                </div>

                {/* Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {rows.map((row, rowIdx) => (
                    <div
                      key={rowIdx}
                      style={{
                        display: 'grid',
                        gap: 10,
                        alignItems: 'center',
                        gridTemplateColumns: `30px repeat(${COLS}, minmax(0, 1fr))`,
                      }}
                    >
                      <div
                        style={{
                          textAlign: 'center',
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--admin-text-faint)',
                        }}
                      >
                        {rowIdx + 1}
                      </div>
                      {row.map(slot => (
                        <SlotCard key={slot.id} slot={slot} floorName={floor.name} token={token} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Main Page ─────────────────────────── */
export default function StaffSlotList() {
  const { user, token } = useAuth();
  const buildingId = user?.assignedBuildingId;

  const [slots,        setSlots]        = useState<ParkingSlotSummary[]>([]);
  const [floors,       setFloors]       = useState<FloorResponse[]>([]);
  const [buildingName, setBuildingName] = useState('');
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [apiError,     setApiError]     = useState('');
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadData = useCallback(async (silent = false) => {
    if (!buildingId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setApiError('');

    try {
      const [slotsData, floorsData, buildingRes] = await Promise.all([
        getParkingSlotsByBuilding(buildingId),
        getFloorsByBuilding(buildingId),
        fetch(`${BASE_URL}/api/buildings/${buildingId}`),
      ]);
      setSlots(slotsData);
      setFloors(floorsData);
      if (buildingRes.ok) {
        const b = await buildingRes.json();
        setBuildingName(b.name ?? '');
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Unable to load data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildingId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Lắng nghe realtime (SignalR)
  useEffect(() => {
    const handle = () => loadData(true);
    window.addEventListener('dashboardUpdate', handle);
    window.addEventListener('slotUpdate', handle);
    return () => {
      window.removeEventListener('dashboardUpdate', handle);
      window.removeEventListener('slotUpdate', handle);
    };
  }, [loadData]);

  // Tổng thống kê toàn bộ
  const totals = {
    available:   slots.filter(s => getStatusLabel(s.status) === 'Available').length,
    occupied:    slots.filter(s => getStatusLabel(s.status) === 'Occupied').length,
    reserved:    slots.filter(s => getStatusLabel(s.status) === 'Reserved').length,
    maintenance: slots.filter(s => getStatusLabel(s.status) === 'Maintenance').length,
  };

  // Sắp xếp tầng theo floorIndex
  const sortedFloors = [...floors].sort((a, b) => a.floorIndex - b.floorIndex);

  /* ── Loading ── */
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 12 }}>
      <Loader2 size={28} style={{ color: '#FF4C4C', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: 'var(--admin-text-faint)', fontSize: 13 }}>Loading parking map...</p>
    </div>
  );

  if (!buildingId) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 12 }}>
      <Building2 size={36} style={{ color: 'var(--admin-text-faint)' }} />
      <p style={{ color: 'var(--admin-text-muted)', fontSize: 13, fontWeight: 500 }}>
        Your account has not been assigned to a building. Please contact a manager.
      </p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--admin-text-primary)' }}>
              Parking Map
            </h2>
            {buildingName && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                background: 'rgba(255,76,76,0.12)', color: '#FF4C4C',
              }}>
                <Building2 size={11} /> {buildingName}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--admin-text-faint)' }}>
            {slots.length} slots • {floors.length} floors
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          style={{
            padding: '8px 10px', borderRadius: 10, border: '1px solid var(--admin-border)',
            background: 'var(--admin-bg-card)', color: 'var(--admin-text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}
          title="Refresh"
        >
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* ── Error ── */}
      {apiError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <AlertTriangle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, color: '#f87171' }}>{apiError}</p>
        </div>
      )}

      {/* ── Summary Bar + Filter Status chips ── */}
      <div style={{
        background: 'var(--admin-bg-card)',
        border: '1px solid var(--admin-border)',
        borderRadius: 14,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {/* Legend tổng quan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {(
            [
              { key: 'Available',   label: 'Available',   count: totals.available,   color: STATUS_STYLE.Available.dot },
              { key: 'Occupied',    label: 'Occupied',   count: totals.occupied,    color: STATUS_STYLE.Occupied.dot },
              { key: 'Reserved',    label: 'Reserved', count: totals.reserved,  color: STATUS_STYLE.Reserved.dot },
              { key: 'Maintenance', label: 'Maintenance', count: totals.maintenance, color: STATUS_STYLE.Maintenance.dot },
            ] as { key: string; label: string; count: number; color: string }[]
          ).map(({ key, label, count, color }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(f => f === key ? '' : key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: filterStatus === key ? `${color}22` : 'transparent',
                border: filterStatus === key ? `1.5px solid ${color}55` : '1.5px solid transparent',
                borderRadius: 20, padding: '4px 12px 4px 8px',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: filterStatus === key ? color : 'var(--admin-text-muted)' }}>
                {label}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, minWidth: 22, textAlign: 'center',
                background: filterStatus === key ? `${color}33` : 'rgba(255,255,255,0.07)',
                color: filterStatus === key ? color : 'var(--admin-text-faint)',
                padding: '0 6px', borderRadius: 10,
              }}>
                {count}
              </span>
            </button>
          ))}

          {filterStatus && (
            <button
              onClick={() => setFilterStatus('')}
              style={{
                fontSize: 11, color: 'var(--admin-text-faint)', background: 'transparent',
                border: 'none', cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              Clear filter
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', minWidth: 200 }}>
          <Search size={13} style={{
            position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--admin-text-faint)',
          }} />
          <input
            type="text"
            placeholder="Search slot, license plate..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
              borderRadius: 10, fontSize: 12, border: '1px solid var(--admin-border)',
              background: 'var(--admin-bg-base)', color: 'var(--admin-text-primary)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* ── Floor sections ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sortedFloors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--admin-text-faint)', fontSize: 13 }}>
            No floors have been configured yet.
          </div>
        ) : sortedFloors.map(floor => {
          const floorSlots = slots.filter(s => s.floorId === floor.id);
          return (
            <FloorSection
              key={floor.id}
              floor={floor}
              slots={floorSlots}
              token={token ?? ''}
              filterStatus={filterStatus}
              search={search}
            />
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--admin-text-faint)', paddingBottom: 8 }}>
        Hover over a slot for full details · Click a label to filter by status
      </div>
    </div>
  );
}
