import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../hooks/useAuth';
import {
  Search,
  MapPin,
  ChevronDown,
  Filter,
  ChevronRight,
  Car,
  Bike,
  Zap,
  Star,
  LogOut,
  ArrowLeft,
} from 'lucide-react';

// ---------- Leaflet icon fix ----------
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom parking marker
const createParkingIcon = (color: string = '#F59E0B') =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        width: 36px; height: 36px;
        background: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid #0A0A0C;
        box-shadow: 0 4px 14px rgba(0,0,0,0.6);
        display: flex; align-items: center; justify-content: center;
      ">
        <span style="
          transform: rotate(45deg);
          color: #0A0A0C;
          font-weight: 900;
          font-size: 14px;
          line-height: 1;
        ">P</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -40],
  });

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

// ---------- Hardcoded data ----------
const PARKING_LOTS: ParkingLot[] = [
  {
    id: '1',
    name: 'Gửi xe A5 - Công viên Thống Nhất',
    address: 'Đường Lê Duẩn, Đống Đa, Hà Nội',
    type: 'PUBLIC',
    lat: 21.0285,
    lng: 105.8542,
    availableSpots: 34,
    totalSpots: 80,
    pricePerHour: 5000,
    rating: 4.2,
    openHours: '06:00 – 22:00',
    vehicleTypes: ['all', 'motorbike', 'car'],
    features: ['Camera 24/7', 'Có mái che'],
  },
  {
    id: '2',
    name: 'Building / Sidewalk Parking – Trần Hưng Đạo',
    address: '45 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội',
    type: 'PUBLIC',
    lat: 21.032,
    lng: 105.8493,
    availableSpots: 12,
    totalSpots: 50,
    pricePerHour: 8000,
    rating: 3.8,
    openHours: '07:00 – 23:00',
    vehicleTypes: ['all', 'motorbike', 'car', 'ev'],
    features: ['Sạc EV', 'Bảo vệ 24/7'],
  },
  {
    id: '3',
    name: 'SmartPark – Vincom Center',
    address: '191 Bà Triệu, Hai Bà Trưng, Hà Nội',
    type: 'PRIVATE',
    lat: 21.0231,
    lng: 105.8452,
    availableSpots: 68,
    totalSpots: 150,
    pricePerHour: 15000,
    rating: 4.7,
    openHours: '24/7',
    vehicleTypes: ['all', 'car', 'ev'],
    features: ['Sạc EV', 'Camera AI', 'Thang máy', 'Valet'],
  },
  {
    id: '4',
    name: 'Bãi xe Hoàn Kiếm Xanh',
    address: '78 Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội',
    type: 'PUBLIC',
    lat: 21.0278,
    lng: 105.852,
    availableSpots: 5,
    totalSpots: 30,
    pricePerHour: 6000,
    rating: 3.5,
    openHours: '06:00 – 21:00',
    vehicleTypes: ['all', 'motorbike'],
    features: ['Mái che'],
  },
  {
    id: '5',
    name: 'Landmark 72 Parking',
    address: 'Keangnam Landmark, Mễ Trì, Nam Từ Liêm, Hà Nội',
    type: 'PRIVATE',
    lat: 21.0073,
    lng: 105.7825,
    availableSpots: 120,
    totalSpots: 300,
    pricePerHour: 20000,
    rating: 4.9,
    openHours: '24/7',
    vehicleTypes: ['all', 'car', 'ev'],
    features: ['Sạc EV', 'Camera AI', 'Valet', 'Premium'],
  },
  {
    id: '6',
    name: 'Bãi đỗ xe Nguyễn Du',
    address: '25 Nguyễn Du, Hai Bà Trưng, Hà Nội',
    type: 'PUBLIC',
    lat: 21.025,
    lng: 105.847,
    availableSpots: 20,
    totalSpots: 60,
    pricePerHour: 5000,
    rating: 4.0,
    openHours: '06:00 – 22:00',
    vehicleTypes: ['all', 'motorbike', 'car'],
    features: ['Bảo vệ 24/7'],
  },
  {
    id: '7',
    name: 'Bãi xe Hồ Gươm Plaza',
    address: '110 Trần Phú, Hà Đông, Hà Nội',
    type: 'PRIVATE',
    lat: 21.0408,
    lng: 105.8393,
    availableSpots: 45,
    totalSpots: 100,
    pricePerHour: 12000,
    rating: 4.4,
    openHours: '07:00 – 22:00',
    vehicleTypes: ['all', 'motorbike', 'car'],
    features: ['Mái che', 'Camera 24/7'],
  },
  {
    id: '8',
    name: 'Parking – Lotte Center Hà Nội',
    address: '54 Liễu Giai, Ba Đình, Hà Nội',
    type: 'PRIVATE',
    lat: 21.0351,
    lng: 105.8182,
    availableSpots: 90,
    totalSpots: 200,
    pricePerHour: 18000,
    rating: 4.6,
    openHours: '24/7',
    vehicleTypes: ['all', 'car', 'ev'],
    features: ['Sạc EV', 'Valet', 'Camera AI'],
  },
  {
    id: '9',
    name: 'Bãi xe Cầu Giấy Center',
    address: '7 Trần Thái Tông, Cầu Giấy, Hà Nội',
    type: 'PUBLIC',
    lat: 21.0306,
    lng: 105.7987,
    availableSpots: 8,
    totalSpots: 40,
    pricePerHour: 7000,
    rating: 3.6,
    openHours: '06:00 – 23:00',
    vehicleTypes: ['all', 'motorbike', 'car'],
    features: ['Bảo vệ'],
  },
  {
    id: '10',
    name: 'SmartPark Mỹ Đình',
    address: 'Đường Lê Quang Đạo, Nam Từ Liêm, Hà Nội',
    type: 'PRIVATE',
    lat: 21.0232,
    lng: 105.7764,
    availableSpots: 55,
    totalSpots: 120,
    pricePerHour: 10000,
    rating: 4.3,
    openHours: '24/7',
    vehicleTypes: ['all', 'car', 'ev', 'motorbike'],
    features: ['Sạc EV', 'Mái che', 'Camera AI'],
  },
];

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

// ---------- Main Component ----------
export default function BookingPage() {
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
  const handleMapRef = (map: L.Map) => setMapInstance(map);

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

  // Filter & sort
  const filtered = PARKING_LOTS.filter((lot) => {
    const matchType =
      vehicleFilter === 'all' || lot.vehicleTypes.includes(vehicleFilter);
    const matchSearch =
      !searchText ||
      lot.name.toLowerCase().includes(searchText.toLowerCase()) ||
      lot.address.toLowerCase().includes(searchText.toLowerCase());
    return matchType && matchSearch;
  }).sort((a, b) => {
    if (sortBy === 'price') return a.pricePerHour - b.pricePerHour;
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'distance') return 0; // placeholder
    return 0; // relevance
  });

  const handleSelectLot = (lot: ParkingLot) => {
    setSelectedLot(lot);
    setShowDetailPanel(true);
  };

  const SORT_LABELS: Record<SortOption, string> = {
    relevance: 'Liên quan',
    price: 'Giá thấp nhất',
    rating: 'Đánh giá cao nhất',
    distance: 'Gần nhất',
  };

  const availabilityColor = (lot: ParkingLot) => {
    const ratio = lot.availableSpots / lot.totalSpots;
    if (ratio > 0.5) return '#22c55e';
    if (ratio > 0.2) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0C] text-slate-100 overflow-hidden">
      {/* ===== Top Navigation ===== */}
      <nav className="flex-shrink-0 z-50 bg-[#0E0E10]/95 backdrop-blur-md border-b border-white/5 shadow-lg">
        <div className="max-w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo + Back */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                title="Về trang chủ"
              >
                <ArrowLeft size={18} />
              </button>
              <Link to="/" className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-wider text-white">
                  PARKING <span className="text-amber-500">BUILDING</span>
                </span>
              </Link>
            </div>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                to="/"
                className="text-sm font-semibold text-slate-300 hover:text-amber-500 transition-colors"
              >
                Find Parking
              </Link>
              <span className="text-sm font-semibold text-amber-500 cursor-pointer">
                Book a Slot
              </span>
              <span className="text-sm font-semibold text-slate-300 hover:text-amber-500 transition-colors cursor-pointer">
                Support & Feedback
              </span>
            </div>

            {/* User badge */}
            <div className="flex items-center gap-3">
              {token && user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-full py-1.5 pl-2 pr-3 hover:bg-white/10 transition-all"
                  >
                    <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold text-xs shrink-0">
                      {initials}
                    </div>
                    <span className="text-sm text-slate-200 font-semibold hidden sm:block">
                      {user.fullName}
                    </span>
                    <ChevronDown
                      size={13}
                      className={`text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-44 bg-[#121214] border border-white/10 rounded-2xl shadow-2xl py-2 z-[9999]">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-red-500 hover:bg-red-500/10 transition-colors text-left"
                      >
                        <LogOut size={15} />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/auth"
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-2 rounded-full text-sm transition-all"
                >
                  Đăng nhập
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ===== Filter Bar ===== */}
      <div className="flex-shrink-0 z-40 bg-[#0E0E10]/90 border-b border-white/5 px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Vehicle type filters */}
          {(
            [
              { key: 'all', label: 'Tất cả', icon: Filter },
              { key: 'motorbike', label: 'Xe máy', icon: Bike },
              { key: 'car', label: 'Ô tô', icon: Car },
              { key: 'ev', label: 'Xe điện', icon: Zap },
            ] as { key: VehicleFilter; label: string; icon: any }[]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setVehicleFilter(key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                vehicleFilter === key
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}

          {/* Sort dropdown */}
          <div className="relative ml-auto" ref={sortRef}>
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            >
              Sắp xếp: <span className="text-amber-500">{SORT_LABELS[sortBy]}</span>
              <ChevronDown size={14} className={`transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>
            {isSortOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#121214] border border-white/10 rounded-2xl shadow-2xl py-2 z-50">
                {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setSortBy(opt); setIsSortOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      sortBy === opt
                        ? 'text-amber-500 bg-amber-500/10'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
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
        <aside className="w-80 flex-shrink-0 bg-[#0E0E10] border-r border-white/5 flex flex-col overflow-hidden">
          {/* Search + count */}
          <div className="px-4 pt-4 pb-3 space-y-3">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                placeholder="Tìm bãi đỗ xe..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-amber-500/60 transition-colors"
              />
            </div>
            <p className="text-xs text-slate-500 font-medium">
              <span className="text-amber-500 font-bold">{filtered.length}</span> bãi đỗ xe phù hợp
            </p>
          </div>

          {/* Lot list */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 scrollbar-thin">
            {filtered.map((lot) => (
              <button
                key={lot.id}
                onClick={() => handleSelectLot(lot)}
                className={`w-full text-left rounded-2xl border p-4 transition-all group ${
                  selectedLot?.id === lot.id
                    ? 'bg-amber-500/10 border-amber-500/40'
                    : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07] hover:border-white/10'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className={`text-sm font-bold leading-tight ${
                      selectedLot?.id === lot.id ? 'text-amber-400' : 'text-slate-100 group-hover:text-white'
                    }`}
                  >
                    {lot.name}
                  </span>
                  <span
                    className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${
                      lot.type === 'PUBLIC'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                    }`}
                  >
                    {lot.type}
                  </span>
                </div>

                {/* Address */}
                <div className="flex items-center gap-1.5 mb-3">
                  <MapPin size={11} className="text-slate-500 shrink-0" />
                  <span className="text-xs text-slate-500 truncate">{lot.address}</span>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 text-xs">
                  {/* Availability */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: availabilityColor(lot) }}
                    />
                    <span className="text-slate-400">
                      <span className="font-semibold text-slate-200">{lot.availableSpots}</span>/{lot.totalSpots} chỗ
                    </span>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1">
                    <Star size={10} className="text-amber-400 fill-amber-400" />
                    <span className="text-slate-300 font-semibold">{lot.rating}</span>
                  </div>

                  {/* Price */}
                  <div className="ml-auto font-bold text-amber-400 text-xs">
                    {lot.pricePerHour.toLocaleString('vi-VN')}đ/h
                  </div>
                </div>

                {/* View on map button */}
                <div
                  className={`mt-3 text-center text-xs font-semibold py-1.5 rounded-lg border transition-all ${
                    selectedLot?.id === lot.id
                      ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                      : 'border-white/10 text-slate-400 bg-white/5 group-hover:text-slate-200'
                  }`}
                >
                  📍 Xem trên bản đồ
                </div>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-600">
                <MapPin size={32} className="mb-3 opacity-40" />
                <p className="text-sm">Không tìm thấy bãi đỗ xe phù hợp</p>
              </div>
            )}
          </div>
        </aside>

        {/* ----- Map + Detail Panel ----- */}
        <div className="flex-1 relative overflow-hidden">
          {/* Leaflet Map */}
          <MapContainer
            center={[21.028, 105.852]}
            zoom={14}
            className="w-full h-full"
            style={{ background: '#0A0A0C' }}
            zoomControl={false}
          >
            {/* Dark-style tile layer */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
              maxZoom={20}
            />

            {/* Capture map instance */}
            <MapRefCapture onMap={handleMapRef} />

            {/* Markers */}
            {filtered.map((lot) => (
              <Marker
                key={lot.id}
                position={[lot.lat, lot.lng]}
                icon={createParkingIcon(
                  selectedLot?.id === lot.id ? '#F59E0B' : availabilityColor(lot)
                )}
                eventHandlers={{
                  click: () => handleSelectLot(lot),
                }}
              >
                <Popup className="parking-popup">
                  <div className="bg-[#121214] rounded-xl p-3 min-w-[200px] border border-white/10">
                    <p className="font-bold text-white text-sm mb-1">{lot.name}</p>
                    <p className="text-xs text-slate-400 mb-2">{lot.address}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{lot.availableSpots}/{lot.totalSpots} chỗ trống</span>
                      <span className="text-amber-400 font-bold">{lot.pricePerHour.toLocaleString('vi-VN')}đ/h</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Fly to selected */}
            {selectedLot && <FlyToLot lat={selectedLot.lat} lng={selectedLot.lng} />}
          </MapContainer>

          {/* Zoom buttons overlay (outside MapContainer, uses mapInstance) */}
          <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-1">
            <button
              onClick={() => mapInstance?.zoomIn()}
              className="w-9 h-9 bg-[#121214] border border-white/10 rounded-xl text-white text-xl font-bold hover:bg-white/10 transition-all flex items-center justify-center shadow-lg"
            >
              +
            </button>
            <button
              onClick={() => mapInstance?.zoomOut()}
              className="w-9 h-9 bg-[#121214] border border-white/10 rounded-xl text-white text-xl font-bold hover:bg-white/10 transition-all flex items-center justify-center shadow-lg"
            >
              −
            </button>
          </div>

          {/* ===== Detail Panel (slides in from right) ===== */}
          {showDetailPanel && selectedLot && (
            <div className="absolute top-0 right-0 h-full w-80 bg-[#0E0E10]/95 backdrop-blur-xl border-l border-white/10 z-[500] flex flex-col shadow-2xl animate-slide-in-right overflow-y-auto">
              {/* Close */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h3 className="text-sm font-bold text-white">Chi tiết bãi đỗ xe</h3>
                <button
                  onClick={() => { setShowDetailPanel(false); setSelectedLot(null); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Name + type */}
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <h2 className="text-base font-bold text-white leading-tight flex-1">
                      {selectedLot.name}
                    </h2>
                    <span
                      className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${
                        selectedLot.type === 'PUBLIC'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                      }`}
                    >
                      {selectedLot.type}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin size={13} className="text-slate-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-400 leading-relaxed">{selectedLot.address}</p>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Chỗ trống</p>
                    <div className="flex items-end gap-1">
                      <span
                        className="text-xl font-black"
                        style={{ color: availabilityColor(selectedLot) }}
                      >
                        {selectedLot.availableSpots}
                      </span>
                      <span className="text-xs text-slate-500 mb-0.5">/ {selectedLot.totalSpots}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(selectedLot.availableSpots / selectedLot.totalSpots) * 100}%`,
                          background: availabilityColor(selectedLot),
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Đánh giá</p>
                    <div className="flex items-center gap-1.5">
                      <Star size={14} className="text-amber-400 fill-amber-400" />
                      <span className="text-xl font-black text-white">{selectedLot.rating}</span>
                    </div>
                    <p className="text-[10px] text-slate-600">/ 5.0</p>
                  </div>

                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Giá/giờ</p>
                    <p className="text-base font-black text-amber-400">
                      {selectedLot.pricePerHour.toLocaleString('vi-VN')}đ
                    </p>
                    <p className="text-[10px] text-slate-600">mỗi giờ</p>
                  </div>

                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Giờ mở cửa</p>
                    <p className="text-sm font-bold text-white">{selectedLot.openHours}</p>
                  </div>
                </div>

                {/* Vehicle types */}
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">
                    Loại xe được phép
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
                          motorbike: 'Xe máy',
                          car: 'Ô tô',
                          ev: 'Xe điện',
                        };
                        const Icon = icons[v] || Car;
                        return (
                          <span
                            key={v}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-slate-300"
                          >
                            <Icon size={12} className="text-amber-500" />
                            {labels[v]}
                          </span>
                        );
                      })}
                  </div>
                </div>

                {/* Features */}
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">
                    Tiện ích
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedLot.features.map((f) => (
                      <span
                        key={f}
                        className="text-xs px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 font-semibold"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                {/* CTA buttons */}
                <div className="space-y-3 pt-2">
                  <button
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-3.5 rounded-2xl text-sm tracking-wide transition-all shadow-lg shadow-amber-500/20"
                    onClick={() => alert('Tính năng đặt chỗ sẽ được tích hợp!')}
                  >
                    ĐẶT CHỖ NGAY
                  </button>
                  <button
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-semibold py-3 rounded-2xl text-sm transition-all"
                    onClick={() => alert('Tính năng chỉ đường sẽ được tích hợp!')}
                  >
                    🗺️ Chỉ đường đến đây
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
