import { useState, useEffect, useRef, useCallback } from 'react';

import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../hooks/useAuth';
import { getBuildings, getFloorsByBuilding } from '../../services/buildingsService';
import type { BuildingResponse, FloorResponse } from '../../services/buildingsService';
import { getSlotsByFloor, SLOT_STATUS_COLORS, SLOT_STATUS_LABELS, SLOT_STATUS_FROM_ENUM } from '../../services/parkingService';
import type { ParkingSlotDetail, SlotStatus } from '../../services/parkingService';
import {
  Search,
  MapPin,
  ChevronDown,
  ChevronRight,
  Car,
  Bike,
  Zap,
  Star,
  LogOut,
  ArrowLeft,
  Navigation,
  Navigation2,
  Loader2,
  Route,
  X,
  CalendarCheck,
  Ticket,
  User,
} from 'lucide-react';

// ---------- Leaflet icon fix ----------
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom parking marker - Redesigned with white border and modern shadow
const createParkingIcon = (color: string = '#FF4C4C') =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        width: 36px; height: 36px;
        background: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid #ffffff;
        box-shadow: 0 6px 16px rgba(0,0,0,0.12);
        display: flex; align-items: center; justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: #ffffff;
          font-weight: 800;
          font-size: 14px;
          line-height: 1;
        ">P</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -40],
  });

// ---------- Hàm tính khoảng cách Haversine (km) ----------
function calcDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------- Types ----------
type VehicleFilter = 'all' | 'motorbike' | 'car' | 'ev';
type SortOption = 'relevance' | 'price' | 'distance' | 'rating';

interface ParkingLot {
  id: string;
  name: string;
  address: string;
  type: 'PUBLIC' | 'PRIVATE';
  lat: number;
  lng: number;
  availableSpots: number;
  totalSpots: number;
  pricePerHour: number;
  rating: number;
  openHours: string;
  vehicleTypes: VehicleFilter[];
  features: string[];
}

// ---------- Hàm sinh toạ độ nhất quán ở Hà Nội ----------
function getBuildingCoordinates(buildingId: string, address: string): { lat: number; lng: number } {
  let hash = 0;
  const str = buildingId + address;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Hanoi coordinates: lat 21.0285, lng 105.8542
  // Thêm offset nhất quán trong khoảng [-0.015, 0.015] để các toạ độ không bị trùng và tập trung gần khu trung tâm
  const latOffset = ((Math.abs(hash) % 300) / 10000) - 0.015;
  const lngOffset = ((Math.abs(hash >> 3) % 300) / 10000) - 0.015;

  return {
    lat: 21.0285 + latOffset,
    lng: 105.8542 + lngOffset,
  };
}

// ---------- Ánh xạ dữ liệu BuildingResponse sang ParkingLot ----------
function mapBuildingToParkingLot(b: BuildingResponse): ParkingLot {
  const coords = getBuildingCoordinates(b.id, b.address);
  // Giả định 70% số chỗ là còn trống
  const available = Math.max(1, Math.floor(b.totalCapacity * 0.7));
  return {
    id: b.id,
    name: b.name,
    address: b.address,
    type: 'PUBLIC',
    lat: coords.lat,
    lng: coords.lng,
    availableSpots: available,
    totalSpots: b.totalCapacity,
    pricePerHour: 10000, // Giá mặc định
    rating: 4.5,
    openHours: '24/7',
    vehicleTypes: ['all', 'motorbike', 'car', 'ev'],
    features: ['Camera 24/7', 'Bảo vệ', 'Có mái che'],
  };
}

// ---------- Map zoom helper (stores ref) ----------
function MapRefCapture({ onMap }: { onMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onMap(map); }, [map, onMap]);
  return null;
}

// ---------- Map fly-to helper ----------
function FlyToLot({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 16, { duration: 1.2 });
  }, [lat, lng, map]);
  return null;
}

// ---------- Fly-to vị trí người dùng ----------
function FlyToUser({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 15, { duration: 1.5 });
  }, [lat, lng, map]);
  return null;
}

// ---------- Icon vị trí người dùng (Đổi thành viền trắng) ----------
const createUserIcon = () =>
  L.divIcon({
    className: '',
    html: `
      <div style="position:relative; width:22px; height:22px;">
        <div style="
          position:absolute; inset:0;
          background: rgba(59,130,246,0.2);
          border-radius:50%;
          animation: pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite;
        "></div>
        <div style="
          position:absolute; top:50%; left:50%;
          transform:translate(-50%,-50%);
          width:14px; height:14px;
          background:#3B82F6;
          border-radius:50%;
          border:2.5px solid #ffffff;
          box-shadow: 0 0 10px rgba(59,130,246,0.5);
        "></div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

// ---------- Main Component ----------
export default function FindParkingPage() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [searchText, setSearchText] = useState('');
  const [selectedLot, setSelectedLot] = useState<ParkingLot | null>(null);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const handleMapRef = useCallback((map: L.Map) => setMapInstance(map), []);

  const [buildingFloors, setBuildingFloors] = useState<FloorResponse[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [floorSlots, setFloorSlots] = useState<ParkingSlotDetail[]>([]);
  const [isLoadingFloors, setIsLoadingFloors] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [flyToUser, setFlyToUser] = useState(false);
  // Bán kính lọc (mét)
  const [nearbyRadius, setNearbyRadius] = useState<number>(1000);

  const RADIUS_OPTIONS = [
    { label: '500m', value: 500 },
    { label: '1 km', value: 1000 },
    { label: '2 km', value: 2000 },
    { label: '5 km', value: 5000 },
  ];

  // ── Route (OSRM) state ──
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distKm: string; mins: number } | null>(null);

  const handleGetDirections = useCallback(async (toLat: number, toLng: number) => {
    if (!userLocation) {
      alert('Please enable location service first for directions!');
      return;
    }
    setIsLoadingRoute(true);
    setRouteCoords(null);
    setRouteInfo(null);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${toLng},${toLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes?.length) throw new Error();
      const coords: [number, number][] = (data.routes[0].geometry.coordinates as [number, number][]).map(
        ([lng, lat]) => [lat, lng]
      );
      const distM: number = data.routes[0].distance;
      const durS: number = data.routes[0].duration;
      setRouteCoords(coords);
      setRouteInfo({
        distKm: distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(1)} km`,
        mins: Math.ceil(durS / 60),
      });
      mapInstance?.flyTo([toLat, toLng], 16, { duration: 1 });
    } catch {
      alert('Failed to calculate route. Check your connection.');
    } finally {
      setIsLoadingRoute(false);
    }
  }, [userLocation, mapInstance]);

  const handleCancelRoute = useCallback(() => {
    setRouteCoords(null);
    setRouteInfo(null);
  }, []);

  // ── API Buildings state ──
  const [buildingsList, setBuildingsList] = useState<ParkingLot[]>([]);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState(false);
  const [buildingsError, setBuildingsError] = useState<string | null>(null);

  // Fetch buildings khi mount
  useEffect(() => {
    let cancelled = false;
    setIsLoadingBuildings(true);
    setBuildingsError(null);
    getBuildings()
      .then((data) => {
        if (!cancelled) {
          const mapped = data.map(mapBuildingToParkingLot);
          setBuildingsList(mapped);
          setIsLoadingBuildings(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setBuildingsError(err.message || 'Failed to load buildings from database.');
          setIsLoadingBuildings(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Fetch floors when selectedLot changes
  useEffect(() => {
    if (selectedLot) {
      setIsLoadingFloors(true);
      setSelectedFloorId(null);
      setFloorSlots([]);
      getFloorsByBuilding(selectedLot.id)
        .then((floors) => {
          setBuildingFloors(floors.sort((a, b) => a.floorIndex - b.floorIndex));
        })
        .catch((err) => console.error('Failed to fetch floors:', err))
        .finally(() => setIsLoadingFloors(false));
    } else {
      setBuildingFloors([]);
      setSelectedFloorId(null);
      setFloorSlots([]);
    }
  }, [selectedLot]);

  // Fetch slots when selectedFloorId changes
  useEffect(() => {
    if (selectedFloorId) {
      setIsLoadingSlots(true);
      getSlotsByFloor(selectedFloorId)
        .then((slots) => {
          setFloorSlots(slots.sort((a, b) => a.slotNumber.localeCompare(b.slotNumber)));
        })
        .catch((err) => console.error('Failed to fetch slots:', err))
        .finally(() => setIsLoadingSlots(false));
    } else {
      setFloorSlots([]);
    }
  }, [selectedFloorId]);

  // Hàm lấy vị trí người dùng
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Your browser does not support geolocation.');
      return;
    }
    setLocatingUser(true);
    setLocationError(null);
    setFlyToUser(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setLocatingUser(false);
        setFlyToUser(true);
        setSortBy('distance');
      },
      (err) => {
        setLocatingUser(false);
        if (err.code === 1) setLocationError('Location access denied.');
        else setLocationError('Failed to get location. Try again later.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Click outside handlers
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const initials = user?.fullName?.slice(0, 2)?.toUpperCase() ?? 'PD';

  // Filter & sort dựa trên danh sách tòa nhà lấy từ API
  const filtered = buildingsList.filter((lot) => {
    const matchType =
      vehicleFilter === 'all' || lot.vehicleTypes.includes(vehicleFilter);
    const matchSearch =
      !searchText ||
      lot.name.toLowerCase().includes(searchText.toLowerCase()) ||
      lot.address.toLowerCase().includes(searchText.toLowerCase());
    const matchNearby = !userLocation
      ? true
      : calcDistanceKm(userLocation.lat, userLocation.lng, lot.lat, lot.lng) <= nearbyRadius / 1000;
    return matchType && matchSearch && matchNearby;
  }).sort((a, b) => {
    if (sortBy === 'price') return a.pricePerHour - b.pricePerHour;
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'distance' && userLocation) {
      const dA = calcDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng);
      const dB = calcDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng);
      return dA - dB;
    }
    return 0;
  });

  const getDistanceStr = (lot: ParkingLot): string => {
    if (!userLocation) return '';
    const d = calcDistanceKm(userLocation.lat, userLocation.lng, lot.lat, lot.lng);
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
  };

  const SORT_LABELS: Record<SortOption, string> = {
    relevance: 'Relevance',
    price: 'Lowest Price',
    rating: 'Highest Rating',
    distance: 'Closest',
  };

  const availabilityColor = (lot: ParkingLot) => {
    const ratio = lot.availableSpots / lot.totalSpots;
    if (ratio > 0.5) return '#10B981'; // Emerald
    if (ratio > 0.2) return '#F59E0B'; // Amber
    return '#FF4C4C'; // Coral Red
  };

  return (
    <div className="flex flex-col h-screen bg-[#F3F3F5] text-stone-900 overflow-hidden font-sans antialiased selection:bg-[#FF4C4C]/25 selection:text-[#FF4C4C]">

      {/* ===== Top Navigation ===== */}
      <nav className="relative flex-shrink-0 z-[9999] bg-white/95 backdrop-blur-md border-b border-gray-200/60 shadow-sm">
        <div className="max-w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo + Back */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-900 hover:bg-gray-100 transition-all"
                title="Về trang chủ"
              >
                <ArrowLeft size={18} />
              </button>
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FF4C4C] flex items-center justify-center text-white font-extrabold text-sm shadow-sm shadow-[#FF4C4C]/20">
                  P
                </div>
                <span className="text-lg font-bold tracking-tight text-stone-900">
                  Parking<span className="text-[#FF4C4C]">.</span>
                </span>
              </Link>
            </div>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                to="/my-tickets"
                className="text-sm font-semibold text-stone-600 hover:text-[#FF4C4C] transition-colors"
              >
                My Ticket
              </Link>
              <span className="text-sm font-semibold text-[#FF4C4C] cursor-pointer">
                Find Parking
              </span>

            </div>

            {/* User badge */}
            <div className="flex items-center gap-3">
              {token && user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2.5 bg-gray-100 border border-gray-200/50 rounded-full py-1.5 pl-2 pr-3 hover:bg-gray-200 transition-all focus:outline-none"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#FF4C4C] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm shadow-[#FF4C4C]/25">
                      {initials}
                    </div>
                    <span className="text-sm text-stone-800 font-semibold hidden sm:block">
                      {user.fullName}
                    </span>
                    <ChevronDown
                      size={13}
                      className={`text-stone-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-[9999]">
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/profile'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                      >
                        <User size={15} />
                        <span>Profile</span>
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        type="button"
                        onClick={() => { setIsDropdownOpen(false); navigate('/my-vehicles'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                      >
                        <Car size={15} />
                        <span>My Vehicles</span>
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-stone-700 hover:text-[#FF4C4C] hover:bg-red-50 transition-colors text-left"
                      >
                        <LogOut size={15} />
                        <span>Log Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/auth"
                  className="bg-stone-900 hover:bg-stone-800 text-white font-bold px-5 py-2 rounded-full text-sm transition-all"
                >
                  Log In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ===== Filter Bar ===== */}
      <div className="relative flex-shrink-0 z-[9998] bg-white/80 border-b border-gray-200/50 px-4 sm:px-6 lg:px-8 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3 flex-wrap">

          {/* Vehicle type filters */}
          {(
            [
              { key: 'all', label: 'All Vehicles', icon: Car },
              { key: 'motorbike', label: 'Motorbike', icon: Bike },
              { key: 'car', label: 'Car', icon: Car },
              { key: 'ev', label: 'EV Charger', icon: Zap },
            ] as { key: VehicleFilter; label: string; icon: any }[]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setVehicleFilter(key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${vehicleFilter === key
                ? 'bg-[#FF4C4C] text-white border-[#FF4C4C] shadow-sm shadow-[#FF4C4C]/15'
                : 'bg-gray-100 text-stone-600 border-gray-200 hover:bg-gray-200/60 hover:text-stone-900'
                }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}

          {/* Sort dropdown */}
          <div className="relative ml-auto" ref={sortRef}>
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-gray-100 border border-gray-200 text-stone-700 hover:bg-gray-200/60 transition-all"
            >
              Sort by: <span className="text-[#FF4C4C]">{SORT_LABELS[sortBy]}</span>
              <ChevronDown size={13} className={`transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>
            {isSortOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-50">
                {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setSortBy(opt); setIsSortOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${sortBy === opt
                      ? 'text-[#FF4C4C] bg-[#FF4C4C]/5'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-gray-50'
                      }`}
                  >
                    {SORT_LABELS[opt]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Main Content: Sidebar + Map ===== */}
      <div className="flex flex-1 overflow-hidden">

        {/* ----- Sidebar ----- */}
        <aside className="w-80 flex-shrink-0 bg-[#F8F8FA] border-r border-gray-200/60 flex flex-col overflow-hidden">

          {/* Search + count */}
          <div className="px-4 pt-4 pb-3 space-y-3">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              />
              <input
                type="text"
                placeholder="Search parking lots..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-[#FF4C4C]/60 transition-colors"
              />
            </div>

            {/* Banner trạng thái */}
            <div className="flex items-center gap-2 bg-[#FF4C4C]/5 border border-[#FF4C4C]/10 rounded-xl px-3 py-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${isLoadingBuildings ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'}`} />
              <div className="flex-1 min-w-0">
                {isLoadingBuildings ? (
                  <p className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                    <Loader2 size={10} className="animate-spin" />
                    Loading buildings from database...
                  </p>
                ) : buildingsError ? (
                  <p className="text-xs font-bold text-red-500">{buildingsError}</p>
                ) : (
                  <>
                    <p className="text-xs font-bold text-emerald-600">
                      {filtered.length} building(s) managed
                    </p>
                    <p className="text-[10px] text-[#FF4C4C] font-semibold truncate">Active Building Network</p>
                  </>
                )}
              </div>
              {userLocation && (
                <button
                  onClick={() => { setUserLocation(null); setFlyToUser(false); setSortBy('relevance'); handleCancelRoute(); }}
                  className="shrink-0 text-blue-500 hover:text-blue-800 transition-colors text-xs font-bold leading-none"
                  title="Turn off near me mode"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Lot list */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2.5 scrollbar-thin">
            {isLoadingBuildings && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 size={24} className="text-[#FF4C4C] animate-spin" />
                <p className="text-xs text-stone-500">Loading building data...</p>
              </div>
            )}

            {!isLoadingBuildings && buildingsError && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <MapPin size={28} className="text-red-400 opacity-60" />
                <p className="text-xs text-red-500">{buildingsError}</p>
              </div>
            )}

            {!isLoadingBuildings && !buildingsError && filtered.map((lot) => (
              <button
                key={lot.id}
                onClick={() => {
                  setSelectedLot(lot);
                  setShowDetailPanel(true);
                  mapInstance?.flyTo([lot.lat, lot.lng], 16, { duration: 1.2 });
                }}
                className={`w-full text-left rounded-2xl border p-4 transition-all group ${selectedLot?.id === lot.id
                  ? 'bg-red-50/80 border-[#FF4C4C]/40 shadow-sm'
                  : 'bg-white border-gray-205/80 hover:border-[#FF4C4C]/30 hover:shadow-md hover:shadow-gray-200/10'
                  }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-sm font-extrabold leading-tight ${selectedLot?.id === lot.id ? 'text-[#FF4C4C]' : 'text-stone-800 group-hover:text-stone-950'
                    }`}>
                    {lot.name}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/50">
                    {lot.type}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mb-3">
                  <MapPin size={11} className="text-stone-400 shrink-0" />
                  <span className="text-xs text-stone-400 truncate flex-1">{lot.address}</span>
                  {userLocation && (
                    <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-[#FF4C4C] bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                      <Navigation2 size={9} />
                      {getDistanceStr(lot)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-stone-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF4C4C]" />
                    <span>Spots: <span className="font-bold text-stone-700">{lot.availableSpots} / {lot.totalSpots}</span></span>
                  </div>
                  {/* Google Maps link */}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${lot.lat},${lot.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="ml-auto text-[10px] font-bold text-blue-500 hover:text-blue-700 underline transition-colors"
                  >
                    Directions
                  </a>
                </div>

                <div className={`mt-3 text-center text-xs font-bold py-1.5 rounded-lg border transition-all ${selectedLot?.id === lot.id
                  ? 'border-[#FF4C4C]/40 text-[#FF4C4C] bg-red-50'
                  : 'border-gray-200 text-stone-500 bg-gray-50 group-hover:text-[#FF4C4C] group-hover:border-[#FF4C4C]/20 group-hover:bg-red-50/30'
                  }`}>
                  📍 View Details
                </div>
              </button>
            ))}

            {!isLoadingBuildings && !buildingsError && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-3">
                  <MapPin size={24} className="text-[#FF4C4C]" />
                </div>
                <p className="text-sm font-bold text-stone-850 mb-1">No buildings found</p>
                <p className="text-xs text-stone-500 mb-3">Try adjusting your search criteria</p>
              </div>
            )}
          </div>
        </aside>

        {/* ----- Map + Detail Panel ----- */}
        <div className="flex-1 relative overflow-hidden">
          {/* Leaflet Map */}
          <MapContainer
            center={[21.0285, 105.8542]}
            zoom={13}
            className="w-full h-full"
            style={{ background: '#F3F3F5' }}
            zoomControl={false}
          >
            {/* Light CartoDB theme tiles matching our design */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
              maxZoom={20}
            />

            {/* Capture map instance */}
            <MapRefCapture onMap={handleMapRef} />

            {/* Markers của các tòa nhà trong hệ thống */}
            {filtered.map((lot) => (
              <Marker
                key={lot.id}
                position={[lot.lat, lot.lng]}
                icon={createParkingIcon(selectedLot?.id === lot.id ? '#FF4C4C' : '#3B82F6')}
                eventHandlers={{
                  click: () => {
                    setSelectedLot(lot);
                    setShowDetailPanel(true);
                  },
                }}
              >
                <Popup className="parking-popup" minWidth={240}>
                  <div className="bg-white rounded-2xl overflow-hidden shadow-xl" style={{ minWidth: 220 }}>
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-extrabold text-[#FF4C4C] text-sm leading-tight flex-1">{lot.name}</p>
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                          {lot.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-400 leading-snug">{lot.address}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px]">
                        {userLocation && (
                          <span className="flex items-center gap-1 text-blue-600 font-bold">
                            <Navigation2 size={10} />{getDistanceStr(lot)}
                          </span>
                        )}
                        <span className="text-stone-500 font-medium">Spots: {lot.availableSpots} / {lot.totalSpots}</span>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="p-3 space-y-2">
                      {userLocation && (
                        <button
                          onClick={() => handleGetDirections(lot.lat, lot.lng)}
                          disabled={isLoadingRoute}
                          className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm shadow-blue-500/10"
                        >
                          {isLoadingRoute ? <Loader2 size={13} className="animate-spin" /> : <Route size={13} />}
                          Get Directions
                        </button>
                      )}
                      <button
                        onClick={() => navigate('/booking', { state: { lot } })}
                        className="w-full flex items-center justify-center gap-2 bg-[#FF4C4C] hover:bg-[#E13B3B] text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm shadow-[#FF4C4C]/10"
                      >
                        <CalendarCheck size={13} />
                        Book Now
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Route polyline */}
            {routeCoords && (
              <Polyline
                positions={routeCoords}
                pathOptions={{
                  color: '#3B82F6',
                  weight: 5,
                  opacity: 0.85,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            )}

            {/* Marker vị trí người dùng */}
            {userLocation && (
              <>
                <Circle
                  center={[userLocation.lat, userLocation.lng]}
                  radius={nearbyRadius}
                  pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.04, weight: 1.5, dashArray: '5,5' }}
                />
                <Marker
                  position={[userLocation.lat, userLocation.lng]}
                  icon={createUserIcon()}
                >
                  <Popup className="parking-popup">
                    <div className="bg-white rounded-xl p-3 min-w-[160px] border border-gray-200">
                      <p className="font-bold text-blue-600 text-sm">📍 Your Location</p>
                      <p className="text-xs text-stone-500 mt-1 font-medium">Searching nearby lots</p>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}

            {/* Fly to selected */}
            {selectedLot && <FlyToLot lat={selectedLot.lat} lng={selectedLot.lng} />}

            {/* Fly to vị trí người dùng */}
            {flyToUser && userLocation && (
              <FlyToUser
                lat={userLocation.lat}
                lng={userLocation.lng}
              />
            )}
          </MapContainer>

          {/* Zoom + Locate Me buttons overlay */}
          <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-1.5">
            <button
              onClick={() => mapInstance?.zoomIn()}
              className="w-9 h-9 bg-white border border-gray-200/80 rounded-xl text-stone-850 text-xl font-bold hover:bg-gray-100 transition-all flex items-center justify-center shadow-md"
            >
              +
            </button>
            <button
              onClick={() => mapInstance?.zoomOut()}
              className="w-9 h-9 bg-white border border-gray-200/80 rounded-xl text-stone-850 text-xl font-bold hover:bg-gray-100 transition-all flex items-center justify-center shadow-md"
            >
              −
            </button>

            {/* Nút Gần tôi */}
            <div className="mt-2">
              <button
                onClick={handleLocateMe}
                disabled={locatingUser}
                title="Tìm bãi đỗ gần tôi"
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-md transition-all ${userLocation
                  ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500'
                  : 'bg-white border-gray-200 text-stone-600 hover:bg-gray-100 hover:text-blue-500 hover:border-blue-200'
                  } ${locatingUser ? 'cursor-wait opacity-70' : ''}`}
              >
                {locatingUser
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Navigation size={16} />
                }
              </button>
              {/* Tooltip nhỏ bên cạnh */}
              {locationError && (
                <div className="absolute left-11 top-0 bg-red-50 border border-red-200 text-red-600 text-[10px] px-2 py-1.5 rounded-lg shadow-lg whitespace-nowrap max-w-[180px] font-bold">
                  {locationError}
                </div>
              )}
            </div>
          </div>

          {/* Panel chọn bán kính "Gần tôi" khi đã có vị trí */}
          {userLocation && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2">
              {/* Bộ chọn bán kính */}
              <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md border border-gray-200 shadow-lg rounded-full px-2 py-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse mx-1 shrink-0" />
                <span className="text-[11px] font-bold text-stone-500 mr-1 whitespace-nowrap">Radius:</span>
                {RADIUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setNearbyRadius(opt.value)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${nearbyRadius === opt.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-stone-500 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <button
                  onClick={() => { setUserLocation(null); setFlyToUser(false); setSortBy('relevance'); handleCancelRoute(); }}
                  className="text-stone-400 hover:text-stone-900 transition-colors text-[11px] px-1.5 font-bold"
                  title="Turn off Near Me"
                >
                  ✕
                </button>
              </div>
              {/* Số bãi tìm thấy */}
              <div className="text-[10px] text-blue-600 font-bold bg-blue-50/80 px-3 py-1 rounded-full border border-blue-100 shadow-sm">
                Found <span className="text-blue-700">{filtered.length}</span> building(s) within {nearbyRadius >= 1000 ? `${nearbyRadius / 1000} km` : `${nearbyRadius}m`}
              </div>
            </div>
          )}

          {/* Route info bar */}
          {routeCoords && routeInfo && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-white border border-blue-200 rounded-full px-4 py-2.5 shadow-lg">
              <Route size={14} className="text-blue-500 shrink-0" />
              <span className="text-sm font-bold text-stone-900">{routeInfo.distKm}</span>
              <span className="text-gray-300 text-xs">•</span>
              <span className="text-sm text-stone-600">{routeInfo.mins} mins driving</span>
              <button
                onClick={handleCancelRoute}
                className="ml-2 flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 px-3 py-1 rounded-full text-xs font-bold transition-all"
              >
                <X size={11} /> Cancel Directions
              </button>
            </div>
          )}

          {/* Loading route */}
          {isLoadingRoute && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-white border border-blue-100 rounded-full px-4 py-2.5 shadow-lg">
              <Loader2 size={14} className="text-blue-500 animate-spin" />
              <span className="text-sm text-stone-500 font-semibold">Calculating route...</span>
            </div>
          )}

          {/* ===== Detail Panel (slides in from right) ===== */}
          {showDetailPanel && selectedLot && (
            <div className="absolute top-0 right-0 h-full w-80 bg-white/95 backdrop-blur-md border-l border-gray-200 z-[500] flex flex-col shadow-2xl animate-slide-in-right overflow-y-auto">
              {/* Close */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-stone-800">Parking Lot Details</h3>
                <button
                  onClick={() => { setShowDetailPanel(false); setSelectedLot(null); }}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-gray-100 transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Name + type */}
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <h2 className="text-base font-extrabold text-stone-900 leading-tight flex-1">
                      {selectedLot.name}
                    </h2>
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedLot.type === 'PUBLIC'
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-sky-50 text-sky-600 border border-sky-200'
                        }`}
                    >
                      {selectedLot.type}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin size={13} className="text-stone-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-stone-500 leading-relaxed">{selectedLot.address}</p>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 border border-gray-200/50 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Available Spots</p>
                    <div className="flex items-end gap-1">
                      <span
                        className="text-xl font-extrabold"
                        style={{ color: availabilityColor(selectedLot) }}
                      >
                        {selectedLot.availableSpots}
                      </span>
                      <span className="text-xs text-stone-400 mb-0.5">/ {selectedLot.totalSpots}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(selectedLot.availableSpots / selectedLot.totalSpots) * 100}%`,
                          background: availabilityColor(selectedLot),
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200/50 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Rating</p>
                    <div className="flex items-center gap-1.5">
                      <Star size={14} className="text-amber-500 fill-amber-500" />
                      <span className="text-xl font-extrabold text-stone-900">{selectedLot.rating}</span>
                    </div>
                    <p className="text-[10px] text-stone-400 font-medium">/ 5.0</p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200/50 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Hourly Rate</p>
                    <p className="text-base font-extrabold text-[#FF4C4C]">
                      {selectedLot.pricePerHour.toLocaleString('vi-VN')}đ
                    </p>
                    <p className="text-[10px] text-stone-400 font-medium">per hour</p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200/50 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Open Hours</p>
                    <p className="text-xs font-bold text-stone-800">{selectedLot.openHours}</p>
                  </div>
                </div>

                {/* Allowed vehicles */}
                <div>
                  <p className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-2">
                    Allowed Vehicles
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedLot.vehicleTypes
                      .filter((v) => v !== 'all')
                      .map((v) => {
                        const icons: Record<string, any> = {
                          motorbike: Bike,
                          car: Car,
                          ev: Zap,
                        };
                        const labels: Record<string, string> = {
                          motorbike: 'Motorbike',
                          car: 'Car',
                          ev: 'EV Charger',
                        };
                        const Icon = icons[v] || Car;
                        return (
                          <span
                            key={v}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-gray-50 border border-gray-200/60 rounded-full text-stone-600"
                          >
                            <Icon size={12} className="text-[#FF4C4C]" />
                            {labels[v]}
                          </span>
                        );
                      })}
                  </div>
                </div>

                {/* Features */}
                <div>
                  <p className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-2">
                    Amenities
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedLot.features.map((f) => (
                      <span
                        key={f}
                        className="text-xs px-3 py-1.5 bg-[#FF4C4C]/5 border border-[#FF4C4C]/10 rounded-full text-[#FF4C4C] font-semibold"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Floors & Slots */}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-3">
                    Floors & Parking Slots
                  </p>
                  
                  {isLoadingFloors ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size={18} className="text-[#FF4C4C] animate-spin" />
                    </div>
                  ) : buildingFloors.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">No floors data available.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {buildingFloors.map(floor => (
                          <button
                            key={floor.id}
                            onClick={() => setSelectedFloorId(floor.id === selectedFloorId ? null : floor.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedFloorId === floor.id
                              ? 'bg-[#FF4C4C] text-white border-[#FF4C4C] shadow-sm'
                              : 'bg-white text-stone-600 border-gray-200 hover:border-[#FF4C4C]/50 hover:text-[#FF4C4C]'
                            }`}
                          >
                            {floor.name}
                          </button>
                        ))}
                      </div>

                      {/* Slots for selected floor */}
                      {selectedFloorId && (
                        <div className="mt-3 bg-gray-50 border border-gray-200/60 rounded-xl p-3">
                          {isLoadingSlots ? (
                            <div className="flex items-center gap-2 text-xs text-stone-500 justify-center py-2">
                              <Loader2 size={14} className="animate-spin text-[#FF4C4C]" />
                              Loading slots...
                            </div>
                          ) : floorSlots.length === 0 ? (
                            <p className="text-xs text-stone-500 text-center py-2">No slots on this floor.</p>
                          ) : (
                            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                              {floorSlots.map(slot => {
                                const statusStr: SlotStatus = typeof slot.status === 'number' 
                                  ? SLOT_STATUS_FROM_ENUM[slot.status as number] || 'Available'
                                  : slot.status || 'Available';
                                const colors = SLOT_STATUS_COLORS[statusStr] || SLOT_STATUS_COLORS['Available'];
                                
                                return (
                                  <div
                                    key={slot.id}
                                    title={SLOT_STATUS_LABELS[statusStr]}
                                    className={`relative flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-bold transition-all ${
                                      statusStr === 'Available'
                                        ? 'bg-white border-emerald-200 hover:border-emerald-400 text-stone-700'
                                        : 'bg-gray-100/50 border-gray-200 text-stone-400 cursor-not-allowed opacity-70'
                                    }`}
                                  >
                                    <span className="mb-0.5">{slot.slotNumber}</span>
                                    <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* CTA buttons */}
                <div className="space-y-3 pt-2">
                  <button
                    className="w-full bg-[#FF4C4C] hover:bg-[#E13B3B] text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-md shadow-[#FF4C4C]/10"
                    onClick={() => navigate('/booking', { state: { lot: selectedLot } })}
                  >
                    BOOK NOW
                  </button>
                  <button
                    className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold py-3 rounded-2xl text-xs uppercase tracking-widest transition-all"
                    onClick={() => handleGetDirections(selectedLot.lat, selectedLot.lng)}
                  >
                    🗺️ Directions
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>


    </div>
  );
}
