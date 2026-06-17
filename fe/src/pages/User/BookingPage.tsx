import { useState, useEffect, useRef, useCallback } from 'react';
import BookingWizard from './BookingWizard';
import { useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polyline } from 'react-leaflet';
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
  Navigation,
  Navigation2,
  Loader2,
  Route,
  X,
  CalendarCheck,
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

// ---------- Kiểu dữ liệu OSM ----------
interface OsmParkingLot {
  id: string; // osm element id
  name: string;
  address: string;
  lat: number;
  lng: number;
  access: string; // 'yes' | 'private' | 'customers' ...
  capacity: string | null;
  osmType: 'node' | 'way' | 'relation';
}

// ---------- Hàm fetch Overpass API ----------
async function fetchOsmParking(lat: number, lng: number, radiusM: number): Promise<OsmParkingLot[]> {
  const query = `
    [out:json][timeout:20];
    (
      node["amenity"="parking"](around:${radiusM},${lat},${lng});
      way["amenity"="parking"](around:${radiusM},${lat},${lng});
    );
    out center tags;
  `;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
  });
  if (!res.ok) throw new Error('Overpass API error');
  const data = await res.json();

  return (data.elements as any[]).map((el: any) => {
    const lat = el.type === 'node' ? el.lat : el.center?.lat;
    const lng = el.type === 'node' ? el.lon : el.center?.lon;
    const tags = el.tags ?? {};
    const name = tags.name || tags['name:vi'] || tags['name:en'] || 'Parking Lot';
    const addr = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:district'],
      tags['addr:city'],
    ].filter(Boolean).join(', ') || 'No address';
    return {
      id: `osm-${el.type}-${el.id}`,
      name,
      address: addr,
      lat,
      lng,
      access: tags.access ?? 'yes',
      capacity: tags.capacity ?? null,
      osmType: el.type,
    } as OsmParkingLot;
  }).filter((p) => p.lat && p.lng); // loại bỏ phần tử không có toạ độ
}

// ---------- Icon OSM bãi đỗ thực (xanh lá) ----------
const createOsmParkingIcon = (isSelected: boolean = false) =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        width: 32px; height: 32px;
        background: ${isSelected ? '#F59E0B' : '#22C55E'};
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
          font-size: 13px;
          line-height: 1;
        ">P</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36],
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

// ---------- Hàm fetch đường đi từ OSRM API ----------
async function fetchOsrmRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<[number, number][]> {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('OSRM error');
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found');
  // GeoJSON trả về [lng, lat] → đảo thành [lat, lng] cho Leaflet
  return (data.routes[0].geometry.coordinates as [number, number][]).map(
    ([lng, lat]) => [lat, lng]
  );
}

// ---------- Chuyển OsmParkingLot → ParkingLot cho BookingWizard ----------
function osmToBookingLot(osm: OsmParkingLot): any {
  const cap = osm.capacity ? parseInt(osm.capacity) : 20;
  return {
    id: osm.id,
    name: osm.name,
    address: osm.address,
    type: osm.access === 'private' ? 'PRIVATE' : 'PUBLIC',
    lat: osm.lat,
    lng: osm.lng,
    availableSpots: Math.max(1, Math.floor(cap * 0.6)),
    totalSpots: cap,
    pricePerHour: 5000,
    rating: 4.0,
    openHours: '06:00 – 22:00',
    vehicleTypes: ['all', 'motorbike', 'car'],
    features: ['OSM Data'],
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

// ---------- Icon vị trí người dùng ----------
const createUserIcon = () =>
  L.divIcon({
    className: '',
    html: `
      <div style="position:relative; width:22px; height:22px;">
        <div style="
          position:absolute; inset:0;
          background: rgba(59,130,246,0.25);
          border-radius:50%;
          animation: pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite;
        "></div>
        <div style="
          position:absolute; top:50%; left:50%;
          transform:translate(-50%,-50%);
          width:14px; height:14px;
          background:#3B82F6;
          border-radius:50%;
          border:3px solid #fff;
          box-shadow: 0 0 8px rgba(59,130,246,0.8);
        "></div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

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
  const [showWizard, setShowWizard] = useState(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const handleMapRef = useCallback((map: L.Map) => setMapInstance(map), []);


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

  // ── Route (OSRM) state ── (phải khai báo SAU userLocation)
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distKm: string; mins: number } | null>(null);

  const handleGetDirections = useCallback(async (toLat: number, toLng: number) => {
    if (!userLocation) {
      alert('Please enable location service first for directions!');
      return;
    }
    setIsLoadingRoute(true);
    setRouteCoords(null);
    setRouteError(null);
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
      setRouteError('Failed to calculate route. Check your connection.');
    } finally {
      setIsLoadingRoute(false);
    }
  }, [userLocation, mapInstance]);

  const handleCancelRoute = useCallback(() => {
    setRouteCoords(null);
    setRouteInfo(null);
    setRouteError(null);
  }, []);

  // ── Wizard cho OSM lot ──
  const [showOsmWizard, setShowOsmWizard] = useState(false);
  const [osmWizardLot, setOsmWizardLot] = useState<any>(null);

  const handleBookOsm = useCallback((osm: OsmParkingLot) => {
    setOsmWizardLot(osmToBookingLot(osm));
    setShowOsmWizard(true);
  }, []);

  // ── OSM (Overpass API) state ──
  const [osmLots, setOsmLots] = useState<OsmParkingLot[]>([]);
  const [isLoadingOsm, setIsLoadingOsm] = useState(false);
  const [osmError, setOsmError] = useState<string | null>(null);
  const [selectedOsmLot, setSelectedOsmLot] = useState<OsmParkingLot | null>(null);

  // Tự động định vị khi mở trang lần đầu
  useEffect(() => {
    // Chủ động request người dùng bấm nút thay vì auto-locate nếu muốn bảo quyền
  }, []);

  // Tự động fetch OSM khi có vị trí hoặc thay đổi bán kính
  useEffect(() => {
    if (!userLocation) {
      setOsmLots([]);
      setSelectedOsmLot(null);
      return;
    }
    let cancelled = false;
    setIsLoadingOsm(true);
    setOsmError(null);
    fetchOsmParking(userLocation.lat, userLocation.lng, nearbyRadius)
      .then((lots) => {
        if (!cancelled) {
          setOsmLots(lots);
          setIsLoadingOsm(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOsmError('Failed to load parking lot data. Check your internet connection.');
          setIsLoadingOsm(false);
        }
      });
    return () => { cancelled = true; };
  }, [userLocation, nearbyRadius]);

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

  // Filter & sort (khoảng cách tính theo Haversine nếu có vị trí người dùng)
  const filtered = PARKING_LOTS.filter((lot) => {
    const matchType =
      vehicleFilter === 'all' || lot.vehicleTypes.includes(vehicleFilter);
    const matchSearch =
      !searchText ||
      lot.name.toLowerCase().includes(searchText.toLowerCase()) ||
      lot.address.toLowerCase().includes(searchText.toLowerCase());
    // Khi bật "Gần tôi": chỉ giữ bãi trong bán kính
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
    return 0; // relevance
  });

  // Helper: lấy khoảng cách đến từng bãi (nếu có vị trí)
  const getDistance = (lot: ParkingLot): string | null => {
    if (!userLocation) return null;
    const d = calcDistanceKm(userLocation.lat, userLocation.lng, lot.lat, lot.lng);
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
  };

  const getOsmDistance = (lot: OsmParkingLot): string => {
    if (!userLocation) return '';
    const d = calcDistanceKm(userLocation.lat, userLocation.lng, lot.lat, lot.lng);
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
  };

  // Lọc OSM lots theo search text
  const osmFiltered = osmLots.filter((lot) =>
    !searchText ||
    lot.name.toLowerCase().includes(searchText.toLowerCase()) ||
    lot.address.toLowerCase().includes(searchText.toLowerCase())
  ).sort((a, b) => {
    if (!userLocation) return 0;
    return (
      calcDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
      calcDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
    );
  });

  // Tổng số bãi trong bán kính (để hiện thống kê) — dùng OSM khi có vị trí
  const totalNearby = userLocation ? osmLots.length : 0;

  const handleSelectLot = (lot: ParkingLot) => {
    setSelectedLot(lot);
    setShowDetailPanel(true);
  };

  const SORT_LABELS: Record<SortOption, string> = {
    relevance: 'Relevance',
    price: 'Lowest Price',
    rating: 'Highest Rating',
    distance: 'Closest',
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
                        <span>Log Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/auth"
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-2 rounded-full text-sm transition-all"
                >
                  Log In
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
              { key: 'all', label: 'All', icon: Filter },
              { key: 'motorbike', label: 'Motorbike', icon: Bike },
              { key: 'car', label: 'Car', icon: Car },
              { key: 'ev', label: 'EV', icon: Zap },
            ] as { key: VehicleFilter; label: string; icon: any }[]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setVehicleFilter(key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${vehicleFilter === key
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
              Sort by: <span className="text-amber-500">{SORT_LABELS[sortBy]}</span>
              <ChevronDown size={14} className={`transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>
            {isSortOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#121214] border border-white/10 rounded-2xl shadow-2xl py-2 z-50">
                {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setSortBy(opt); setIsSortOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${sortBy === opt
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
                placeholder="Search parking lots..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-amber-500/60 transition-colors"
              />
            </div>

            {/* Banner trạng thái */}
            {userLocation ? (
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 rounded-xl px-3 py-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${isLoadingOsm ? 'bg-blue-400' : 'bg-emerald-400 animate-pulse'}`} />
                <div className="flex-1 min-w-0">
                  {isLoadingOsm ? (
                    <p className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                      <Loader2 size={10} className="animate-spin" />
                      Loading parking lots from OpenStreetMap...
                    </p>
                  ) : osmError ? (
                    <p className="text-xs font-bold text-red-400">{osmError}</p>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-emerald-300">
                        {osmFiltered.length} real lots within {nearbyRadius >= 1000 ? `${nearbyRadius / 1000} km` : `${nearbyRadius}m`}
                      </p>
                      <p className="text-[10px] text-blue-400/70 truncate">from OpenStreetMap data</p>
                    </>
                  )}
                </div>
                <button
                  onClick={() => { setUserLocation(null); setFlyToUser(false); setSortBy('relevance'); }}
                  className="shrink-0 text-blue-400/60 hover:text-white transition-colors text-xs font-bold leading-none"
                  title="Turn off near me mode"
                >
                  ✕
                </button>
              </div>
            ) : null}
          </div>

          {/* Lot list */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 scrollbar-thin">

            {/* Chưa định vị: hiển invite state */}
            {!userLocation ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-center px-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-emerald-500/10 border border-blue-500/20 flex items-center justify-center mb-5 shadow-lg shadow-blue-500/10">
                  <Navigation size={32} className="text-blue-400" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Find Parking Near You</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  Allow location access to show the closest real parking lots from OpenStreetMap data.
                </p>
                <button
                  onClick={handleLocateMe}
                  disabled={locatingUser}
                  className="flex items-center gap-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-2xl text-sm transition-all shadow-lg shadow-blue-500/25 active:scale-95"
                >
                  {locatingUser ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Navigation size={16} />
                  )}
                  {locatingUser ? 'Locating...' : 'Find Near Me'}
                </button>
                {locationError && (
                  <p className="text-xs text-red-400 mt-3">{locationError}</p>
                )}
                <div className="mt-6 pt-5 border-t border-white/5 w-full">
                  <p className="text-[10px] text-slate-600 mb-3 uppercase tracking-wider font-semibold">Or select search radius</p>
                  <div className="flex gap-2 justify-center">
                    {RADIUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setNearbyRadius(opt.value); handleLocateMe(); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${nearbyRadius === opt.value
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : 'text-slate-500 border-white/10 hover:text-white hover:border-white/20'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Đã định vị: hiển kết quả OSM */
              <>
                {/* Loading OSM */}
                {isLoadingOsm && (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 size={28} className="text-blue-400 animate-spin" />
                    <p className="text-sm text-slate-400">Matching parking lots near you from OSM...</p>
                  </div>
                )}

                {/* Lỗi OSM */}
                {!isLoadingOsm && osmError && (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                    <MapPin size={28} className="text-red-400 opacity-60" />
                    <p className="text-sm text-red-400">{osmError}</p>
                    <button
                      onClick={() => setUserLocation({ ...userLocation })}
                      className="text-xs text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-full hover:bg-blue-500/10 transition-all"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Kết quả OSM */}
                {!isLoadingOsm && !osmError && osmFiltered.map((lot) => (
                  <button
                    key={lot.id}
                    onClick={() => {
                      setSelectedOsmLot(lot);
                      setSelectedLot(null);
                      setShowDetailPanel(false);
                      mapInstance?.flyTo([lot.lat, lot.lng], 17, { duration: 1.2 });
                    }}
                    className={`w-full text-left rounded-2xl border p-4 transition-all group ${selectedOsmLot?.id === lot.id
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.07] hover:border-emerald-500/20'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`text-sm font-bold leading-tight ${selectedOsmLot?.id === lot.id ? 'text-emerald-400' : 'text-slate-100 group-hover:text-white'
                        }`}>
                        {lot.name}
                      </span>
                      <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${lot.access === 'private'
                          ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        }`}>
                        {lot.access === 'private' ? 'PRIVATE' : 'PUBLIC'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-3">
                      <MapPin size={11} className="text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-500 truncate flex-1">{lot.address}</span>
                      <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <Navigation2 size={9} />
                        {getOsmDistance(lot)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      {/* Sức chứa */}
                      {lot.capacity && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-slate-400">≤ <span className="font-semibold text-slate-200">{lot.capacity}</span> spots</span>
                        </div>
                      )}
                      {/* Badge OSM */}
                      <span className="text-[10px] text-slate-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />OSM
                      </span>
                      {/* Mở Google Maps */}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${lot.lat},${lot.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-auto text-[10px] font-semibold text-blue-400 hover:text-blue-300 underline transition-colors"
                      >
                        Directions
                      </a>
                    </div>

                    <div className={`mt-3 text-center text-xs font-semibold py-1.5 rounded-lg border transition-all ${selectedOsmLot?.id === lot.id
                        ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                        : 'border-white/10 text-slate-400 bg-white/5 group-hover:text-emerald-400 group-hover:border-emerald-500/20'
                      }`}>
                      📍 View on Map
                    </div>
                  </button>
                ))}

                {/* Trống */}
                {!isLoadingOsm && !osmError && osmFiltered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3">
                      <Navigation size={24} className="text-blue-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-300 mb-1">No parking lots found near you</p>
                    <p className="text-xs text-slate-600 mb-3">within {nearbyRadius >= 1000 ? `${nearbyRadius / 1000} km` : `${nearbyRadius}m`}</p>
                    <button
                      onClick={() => setNearbyRadius(Math.min(nearbyRadius * 2, 5000))}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 rounded-full transition-all"
                    >
                      Expand search radius
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* ----- Map + Detail Panel ----- */}
        <div className="flex-1 relative overflow-hidden">
          {/* Leaflet Map */}
          <MapContainer
            center={[16.047, 108.206]}
            zoom={6}
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

            {/* Markers hardcoded: ẨN — chỉ hiển khi có userLocation (không dùng ở chế độ mới) */}
            {/* Markers OSM thực tế (khi đã định vị) */}
            {userLocation && !isLoadingOsm && osmFiltered.map((lot) => (
              <Marker
                key={lot.id}
                position={[lot.lat, lot.lng]}
                icon={createOsmParkingIcon(selectedOsmLot?.id === lot.id)}
                eventHandlers={{
                  click: () => {
                    setSelectedOsmLot(lot);
                    setSelectedLot(null);
                    setShowDetailPanel(false);
                  },
                }}
              >
                <Popup className="parking-popup" minWidth={220}>
                  <div className="bg-[#0E0E12] rounded-2xl overflow-hidden border border-white/10 shadow-2xl" style={{ minWidth: 220 }}>
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-bold text-emerald-300 text-sm leading-tight flex-1">{lot.name}</p>
                        <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${lot.access === 'private'
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                          {lot.access === 'private' ? 'PRIVATE' : 'PUBLIC'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">{lot.address}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px]">
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <Navigation2 size={10} />{getOsmDistance(lot)}
                        </span>
                        {lot.capacity && (
                          <span className="text-slate-400">≤ {lot.capacity} spots</span>
                        )}
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="p-3 space-y-2">
                      <button
                        onClick={() => handleGetDirections(lot.lat, lot.lng)}
                        disabled={isLoadingRoute}
                        className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-blue-500/20"
                      >
                        {isLoadingRoute ? <Loader2 size={13} className="animate-spin" /> : <Route size={13} />}
                        Get Directions
                      </button>
                      <button
                        onClick={() => handleBookOsm(lot)}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20"
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
                  pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.06, weight: 1.5, dashArray: '5,5' }}
                />
                <Marker
                  position={[userLocation.lat, userLocation.lng]}
                  icon={createUserIcon()}
                >
                  <Popup className="parking-popup">
                    <div className="bg-[#121214] rounded-xl p-3 min-w-[160px] border border-white/10">
                      <p className="font-bold text-blue-400 text-sm">📍 Your Location</p>
                      <p className="text-xs text-slate-400 mt-1">Showing nearby parking lots</p>
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

            {/* Nút Gần tôi */}
            <div className="mt-2">
              <button
                onClick={handleLocateMe}
                disabled={locatingUser}
                title="Tìm bãi đỗ gần tôi"
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-lg transition-all ${userLocation
                    ? 'bg-blue-500 border-blue-400 text-white hover:bg-blue-400'
                    : 'bg-[#121214] border-white/10 text-slate-300 hover:bg-white/10 hover:text-blue-400 hover:border-blue-500/40'
                  } ${locatingUser ? 'cursor-wait opacity-70' : ''}`}
              >
                {locatingUser
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Navigation size={16} />
                }
              </button>
              {/* Tooltip nhỏ bên cạnh */}
              {locationError && (
                <div className="absolute left-11 top-0 bg-red-900/90 border border-red-500/30 text-red-300 text-[10px] px-2 py-1 rounded-lg shadow-lg whitespace-nowrap max-w-[180px]">
                  {locationError}
                </div>
              )}
            </div>
          </div>

          {/* ===== Overlay "Find Parking" khi chưa định vị ===== */}
          {!userLocation && (
            <div className="absolute inset-0 z-[999] flex items-center justify-center pointer-events-none">
              <div className="pointer-events-auto flex flex-col items-center gap-4">
                {/* Vòng sóng nền */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping" style={{ width: 120, height: 120, margin: 'auto', top: 0, left: 0, right: 0, bottom: 0 }} />
                  <button
                    onClick={handleLocateMe}
                    disabled={locatingUser}
                    className="relative w-[72px] h-[72px] rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-70 text-white shadow-2xl shadow-blue-500/40 flex items-center justify-center transition-all active:scale-95 border-4 border-blue-400/30"
                  >
                    {locatingUser
                      ? <Loader2 size={28} className="animate-spin" />
                      : <Navigation size={28} />
                    }
                  </button>
                </div>
                <div className="bg-[#0E0E10]/90 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-3 text-center shadow-xl">
                  <p className="text-sm font-bold text-white mb-0.5">
                    {locatingUser ? 'Locating...' : 'Find Parking Near Me'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {locatingUser ? 'Please wait a moment' : 'Click to find parking near you'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Panel chọn bán kính "Gần tôi" khi đã có vị trí */}
          {userLocation && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2">
              {/* Bộ chọn bán kính */}
              <div className="flex items-center gap-1 bg-[#0E0E10]/95 backdrop-blur-md border border-blue-500/30 rounded-full px-2 py-1.5 shadow-xl">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse mx-1 shrink-0" />
                <span className="text-[11px] font-semibold text-blue-300 mr-1 whitespace-nowrap">Radius:</span>
                {RADIUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setNearbyRadius(opt.value)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${nearbyRadius === opt.value
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                        : 'text-slate-400 hover:text-blue-300 hover:bg-blue-500/10'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button
                  onClick={() => { setUserLocation(null); setFlyToUser(false); setSortBy('relevance'); handleCancelRoute(); }}
                  className="text-slate-500 hover:text-white transition-colors text-[11px] px-1.5 font-bold"
                  title="Turn off Near Me"
                >
                  ✕
                </button>
              </div>
              {/* Số bãi tìm thấy */}
              <div className="text-[10px] text-blue-400/70 font-medium">
                Found <span className="text-blue-300 font-bold">{osmFiltered.length}</span> parking lots within {nearbyRadius >= 1000 ? `${nearbyRadius / 1000} km` : `${nearbyRadius}m`}
              </div>
            </div>
          )}

          {/* Route info bar */}
          {routeCoords && routeInfo && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-[#0E0E10]/95 backdrop-blur-md border border-blue-500/30 rounded-full px-4 py-2.5 shadow-xl">
              <Route size={14} className="text-blue-400 shrink-0" />
              <span className="text-sm font-bold text-white">{routeInfo.distKm}</span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-sm text-slate-300">{routeInfo.mins} mins driving</span>
              <button
                onClick={handleCancelRoute}
                className="ml-2 flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-xs font-bold transition-all"
              >
                <X size={11} /> Cancel Directions
              </button>
            </div>
          )}

          {/* Loading route */}
          {isLoadingRoute && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-[#0E0E10]/95 backdrop-blur-md border border-blue-500/30 rounded-full px-4 py-2.5 shadow-xl">
              <Loader2 size={14} className="text-blue-400 animate-spin" />
              <span className="text-sm text-slate-300">Calculating route...</span>
            </div>
          )}

          {/* ===== Detail Panel (slides in from right) ===== */}
          {showDetailPanel && selectedLot && (
            <div className="absolute top-0 right-0 h-full w-80 bg-[#0E0E10]/95 backdrop-blur-xl border-l border-white/10 z-[500] flex flex-col shadow-2xl animate-slide-in-right overflow-y-auto">
              {/* Close */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h3 className="text-sm font-bold text-white">Parking Lot Details</h3>
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
                      className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${selectedLot.type === 'PUBLIC'
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
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Available Spots</p>
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
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Rating</p>
                    <div className="flex items-center gap-1.5">
                      <Star size={14} className="text-amber-400 fill-amber-400" />
                      <span className="text-xl font-black text-white">{selectedLot.rating}</span>
                    </div>
                    <p className="text-[10px] text-slate-600">/ 5.0</p>
                  </div>

                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Hourly Rate</p>
                    <p className="text-base font-black text-amber-400">
                      {selectedLot.pricePerHour.toLocaleString('vi-VN')}đ
                    </p>
                    <p className="text-[10px] text-slate-600">per hour</p>
                  </div>

                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Open Hours</p>
                    <p className="text-sm font-bold text-white">{selectedLot.openHours}</p>
                  </div>
                </div>

                {/* Vehicle types */}
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">
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
                          ev: 'EV',
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
                    Amenities
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
                    onClick={() => setShowWizard(true)}
                  >
                    BOOK NOW
                  </button>
                  <button
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-semibold py-3 rounded-2xl text-sm transition-all"
                    onClick={() => alert('Directions feature will be integrated!')}
                  >
                    🗺️ Directions to here
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== Booking Wizard (hardcoded lot) ===== */}
      {showWizard && selectedLot && (
        <BookingWizard
          lot={selectedLot}
          onClose={() => setShowWizard(false)}
        />
      )}

      {/* ===== Booking Wizard (OSM lot) ===== */}
      {showOsmWizard && osmWizardLot && (
        <BookingWizard
          lot={osmWizardLot}
          onClose={() => { setShowOsmWizard(false); setOsmWizardLot(null); }}
        />
      )}
    </div>
  );
}
