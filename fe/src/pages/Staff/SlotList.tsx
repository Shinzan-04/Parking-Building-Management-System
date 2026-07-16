import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, AlertTriangle, Search, Building2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getFloorsByBuilding,
  getParkingSlotsByBuilding,
  isSlotOccupied,
  isSlotMaintenance,
} from '../../services/buildingsService';
import type { ParkingSlotSummary, FloorResponse } from '../../services/buildingsService';

type SlotStatus = 'Available' | 'Occupied' | 'Reserved' | 'Maintenance';

function getStatusLabel(status: string | number): SlotStatus {
  if (status === 'Available'    || status === 0) return 'Available';
  if (status === 'Reserved'     || status === 2) return 'Reserved';
  if (status === 'Occupied'     || status === 3) return 'Occupied';
  if (status === 'Maintenance'  || status === 4) return 'Maintenance';
  return 'Available'; // TemporaryHeld (1) fallback
}

const STATUS_COLORS: Record<SlotStatus, string> = {
  Available:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Occupied:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Reserved:    'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
  Maintenance: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const STATUS_VI: Record<SlotStatus, string> = {
  Available:   'Available',
  Occupied:    'Occupied',
  Reserved:    'Reserved',
  Maintenance: 'Maintenance',
};

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

import { getCurrentVehicle } from '../../services/buildingsService';

function SlotRow({ slot, floorName, token }: { slot: ParkingSlotSummary, floorName: string, token: string }) {
  const statusKey = getStatusLabel(slot.status);
  const [licensePlate, setLicensePlate] = useState<string | null>(null);
  const [loadingPlate, setLoadingPlate] = useState(false);
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (statusKey === 'Occupied' || statusKey === 'Reserved') {
      setLoadingPlate(true);
      getCurrentVehicle(slot.id, token)
        .then(res => {
          if (isMounted && res) {
            if (res.licensePlate) setLicensePlate(res.licensePlate);
            if (res.status === 'Overdue') setIsOverdue(true);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoadingPlate(false);
        });
    } else {
      setLicensePlate(null);
      setIsOverdue(false);
    }
    return () => { isMounted = false; };
  }, [slot.id, statusKey, token]);

  return (
    <tr
      className="border-b last:border-0 transition-colors hover:bg-white/[0.02]"
      style={{ borderColor: 'var(--admin-border)' }}
    >
      <td className="px-6 py-3.5">
        <span className="text-sm font-mono font-semibold" style={{ color: 'var(--admin-text-primary)' }}>
          {slot.slotNumber ?? slot.id.slice(0, 8)}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <span className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>{floorName}</span>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex flex-col">
          <span className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
            {slot.vehicleTypeName ?? '—'}
          </span>
          {loadingPlate ? (
            <span className="text-xs text-[#FF4C4C] mt-1 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Loading...
            </span>
          ) : licensePlate ? (
            <span className={`text-xs font-mono font-bold mt-1 px-2 py-0.5 rounded w-fit ${isOverdue ? 'bg-red-500/20 text-red-400' : 'bg-white/10'}`} style={isOverdue ? {} : { color: 'var(--admin-text-primary)' }}>
              {licensePlate}
            </span>
          ) : (statusKey === 'Occupied' || statusKey === 'Reserved') ? (
            <span className="text-xs font-mono mt-1 px-2 py-0.5 rounded bg-white/5 w-fit" style={{ color: 'var(--admin-text-muted)' }}>
              Unknown
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[statusKey]}`}>
            {STATUS_VI[statusKey]}
          </span>
          {isOverdue && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-500 uppercase tracking-wider">
              <AlertTriangle size={10} />
              Overdue
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function StaffSlotList() {
  const { user, token } = useAuth();
  const buildingId = user?.assignedBuildingId;

  const [slots,         setSlots]         = useState<ParkingSlotSummary[]>([]);
  const [floors,        setFloors]        = useState<FloorResponse[]>([]);
  const [buildingName,  setBuildingName]  = useState('');
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [apiError,      setApiError]      = useState('');
  const [search,        setSearch]        = useState('');
  const [filterFloor,   setFilterFloor]   = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');

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

  // Lắng nghe sự kiện Realtime (SignalR) được phát từ useNotification
  useEffect(() => {
    const handleUpdate = () => {
      // Refresh ngầm
      loadData(true);
    };

    window.addEventListener('dashboardUpdate', handleUpdate);
    window.addEventListener('slotUpdate', handleUpdate);

    return () => {
      window.removeEventListener('dashboardUpdate', handleUpdate);
      window.removeEventListener('slotUpdate', handleUpdate);
    };
  }, [loadData]);

  const filtered = slots.filter(s => {
    const statusStr = getStatusLabel(s.status);
    if (filterFloor  && s.floorId !== filterFloor)  return false;
    if (filterStatus && statusStr !== filterStatus)  return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(s.slotNumber ?? '').toLowerCase().includes(q) &&
          !(s.vehicleTypeName ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = {
    available:   slots.filter(s => getStatusLabel(s.status) === 'Available').length,
    occupied:    slots.filter(s => getStatusLabel(s.status) === 'Occupied').length,
    reserved:    slots.filter(s => getStatusLabel(s.status) === 'Reserved').length,
    maintenance: slots.filter(s => getStatusLabel(s.status) === 'Maintenance').length,
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={28} className="text-[#FF4C4C] animate-spin" />
        <p className="text-sm" style={{ color: 'var(--admin-text-faint)' }}>Loading slots...</p>
      </div>
    );
  }

  if (!buildingId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Building2 size={36} style={{ color: 'var(--admin-text-faint)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--admin-text-muted)' }}>
          Account is not assigned to a building. Please contact your Manager.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--admin-text-primary)' }}>
              Parking Slots
            </h2>
            {buildingName && (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#FF4C4C]/10 text-[#FF4C4C]">
                <Building2 size={12} />
                {buildingName}
              </span>
            )}
          </div>
          <p className="text-sm" style={{ color: 'var(--admin-text-faint)' }}>
            Total {slots.length} slots
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="p-2.5 rounded-xl transition-colors"
          style={{ backgroundColor: 'var(--admin-bg-card)', color: 'var(--admin-text-muted)' }}
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {apiError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-400/10 border border-red-400/20">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{apiError}</p>
        </div>
      )}

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {([
          { key: '',            label: `All (${slots.length})` },
          { key: 'Available',   label: `Available (${counts.available})` },
          { key: 'Occupied',    label: `Occupied (${counts.occupied})` },
          { key: 'Reserved',    label: `Reserved (${counts.reserved})` },
          { key: 'Maintenance', label: `Maintenance (${counts.maintenance})` },
        ] as { key: string; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
              filterStatus === key
                ? 'bg-[#FF4C4C]/10 text-[#FF4C4C] border-[#FF4C4C]/30'
                : 'border-transparent hover:border-white/10'
            }`}
            style={filterStatus === key ? {} : { backgroundColor: 'var(--admin-bg-card)', color: 'var(--admin-text-muted)' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--admin-text-faint)' }} />
          <input
            type="text"
            placeholder="Search by slot number, vehicle type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none transition-colors"
            style={{
              backgroundColor: 'var(--admin-bg-card)',
              color: 'var(--admin-text-primary)',
              borderColor: 'var(--admin-border)',
            }}
          />
        </div>

        <select
          value={filterFloor}
          onChange={e => setFilterFloor(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-sm border outline-none"
          style={{
            backgroundColor: 'var(--admin-bg-card)',
            color: 'var(--admin-text-primary)',
            borderColor: 'var(--admin-border)',
          }}
        >
          <option value="">All floors</option>
          {floors.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--admin-border)' }}>
                {['Slot', 'Floor', 'Vehicle Type', 'Status'].map(h => (
                  <th key={h} className="text-left text-xs font-medium px-4 py-3 first:pl-6" style={{ color: 'var(--admin-text-faint)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-sm" style={{ color: 'var(--admin-text-faint)' }}>
                    No matching slots found
                  </td>
                </tr>
              ) : filtered.map(slot => (
                <SlotRow 
                  key={slot.id} 
                  slot={slot} 
                  floorName={floors.find(f => f.id === slot.floorId)?.name ?? slot.floorId} 
                  token={token ?? ''} 
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t text-xs" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text-faint)' }}>
          Showing {filtered.length} / {slots.length} slots
        </div>
      </div>
    </div>
  );
}
