import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface TimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  selectedTime: string; // HH:mm
  onSelectTime: (time: string) => void;
  title?: string;
  confirmText?: string;
  solidTheme?: boolean;
  minTimeLimit?: string; // HH:mm format for Exit Time constraints
  disablePastTime?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const ITEM_HEIGHT = 44; // px

export default function TimePickerModal({
  isOpen,
  onClose,
  selectedDate,
  selectedTime,
  onSelectTime,
  title = "Select Arrival Time",
  confirmText = "Confirm Time",
  solidTheme = false,
  minTimeLimit,
  disablePastTime = true,
}: TimePickerModalProps) {
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);

  const hourScrollRef = useRef<HTMLDivElement>(null);
  const minuteScrollRef = useRef<HTMLDivElement>(null);

  // To avoid circular updates between state and scroll position
  const isUserScrollingHour = useRef(false);
  const isUserScrollingMinute = useRef(false);

  useEffect(() => {
    if (isOpen) {
      let initH = 12;
      let initM = 0;

      if (selectedTime) {
        const [h, m] = selectedTime.split(':').map(Number);
        initH = !isNaN(h) ? h : 12;
        initM = !isNaN(m) ? m : 0;
      } else {
        const now = new Date();
        initH = now.getHours();
        initM = now.getMinutes();
      }

      // Check against min valid time
      let minH = 0;
      let minM = 0;

      if (disablePastTime) {
        if (minTimeLimit) {
          const [mh, mm] = minTimeLimit.split(':').map(Number);
          const minT = new Date();
          minT.setHours(mh, mm + 1, 0, 0);
          minH = minT.getHours();
          minM = minT.getMinutes();
          if (initH < minH || (initH === minH && initM < minM)) {
            initH = minH;
            initM = minM;
          }
        } else if (isToday(selectedDate)) {
          const minT = getMinTime();
          minH = minT.getHours();
          minM = minT.getMinutes();
          if (initH < minH || (initH === minH && initM < minM)) {
            initH = minH;
            initM = minM;
          }
        }
      }

      setSelectedHour(initH);
      setSelectedMinute(initM);
    }
  }, [isOpen, selectedTime, selectedDate, minTimeLimit, disablePastTime]);

  // Center the scroll on open or when state changes programmatically
  useEffect(() => {
    if (isOpen && hourScrollRef.current && !isUserScrollingHour.current) {
      const minHourLimit = disablePastTime && (isToday(selectedDate) || minTimeLimit) ? getMinHour() : 0;
      const validH = HOURS.filter(h => h >= minHourLimit);
      const index = validH.indexOf(selectedHour);
      if (index !== -1) hourScrollRef.current.scrollTop = index * ITEM_HEIGHT;
    }
  }, [isOpen, selectedHour, selectedDate, minTimeLimit, disablePastTime]);

  useEffect(() => {
    if (isOpen && minuteScrollRef.current && !isUserScrollingMinute.current) {
      const minMinuteLimit = disablePastTime && (isToday(selectedDate) || minTimeLimit) ? getMinMinute(selectedHour) : 0;
      const validM = MINUTES.filter(m => m >= minMinuteLimit);
      const index = validM.indexOf(selectedMinute);
      if (index !== -1) minuteScrollRef.current.scrollTop = index * ITEM_HEIGHT;
    }
  }, [isOpen, selectedMinute, selectedHour, selectedDate, minTimeLimit, disablePastTime]);

  const isToday = (dateStr: string) => {
    if (!dateStr) return false;
    const today = new Date();
    const d = new Date(dateStr);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const getMinTime = () => {
    if (minTimeLimit) {
      const [h, m] = minTimeLimit.split(':').map(Number);
      const t = new Date();
      t.setHours(h, m + 1, 0, 0); // At least 1 min after
      return t;
    }
    const t = new Date();
    t.setMinutes(t.getMinutes() + 5);
    return t;
  };

  const getMinHour = () => {
    if (!disablePastTime) return 0;
    if (minTimeLimit) return getMinTime().getHours();
    return isToday(selectedDate) ? getMinTime().getHours() : 0;
  };

  const getMinMinute = (hour: number) => {
    if (!disablePastTime) return 0;
    if (minTimeLimit) {
      const minTime = getMinTime();
      if (hour < minTime.getHours()) return 60;
      if (hour === minTime.getHours()) return minTime.getMinutes();
      return 0;
    }
    if (!isToday(selectedDate)) return 0;
    const minTime = getMinTime();
    if (hour < minTime.getHours()) return 60;
    if (hour === minTime.getHours()) return minTime.getMinutes();
    return 0;
  };

  const validHours = useMemo(() => {
    const minH = getMinHour();
    return HOURS.filter(h => h >= minH);
  }, [minTimeLimit, selectedDate, disablePastTime]);

  const validMinutes = useMemo(() => {
    const minM = getMinMinute(selectedHour);
    return MINUTES.filter(m => m >= minM);
  }, [selectedHour, minTimeLimit, selectedDate, disablePastTime]);

  const handleHourScroll = () => {
    if (!hourScrollRef.current) return;
    const scrollPos = hourScrollRef.current.scrollTop;
    const index = Math.round(scrollPos / ITEM_HEIGHT);
    if (index >= 0 && index < validHours.length) {
      const validHour = validHours[index];
      
      isUserScrollingHour.current = true;
      setSelectedHour(validHour);

      // Auto adjust minute if needed
      const minMin = getMinMinute(validHour);
      if (selectedMinute < minMin) {
        setSelectedMinute(minMin);
      }
      
      // Reset the flag shortly after scroll stops
      if (hourScrollRef.current.dataset.scrollTimeout) {
        clearTimeout(Number(hourScrollRef.current.dataset.scrollTimeout));
      }
      hourScrollRef.current.dataset.scrollTimeout = String(setTimeout(() => {
        isUserScrollingHour.current = false;
      }, 150));
    }
  };

  const handleMinuteScroll = () => {
    if (!minuteScrollRef.current) return;
    const scrollPos = minuteScrollRef.current.scrollTop;
    const index = Math.round(scrollPos / ITEM_HEIGHT);
    if (index >= 0 && index < validMinutes.length) {
      const validMinute = validMinutes[index];

      isUserScrollingMinute.current = true;
      setSelectedMinute(validMinute);
      
      if (minuteScrollRef.current.dataset.scrollTimeout) {
        clearTimeout(Number(minuteScrollRef.current.dataset.scrollTimeout));
      }
      minuteScrollRef.current.dataset.scrollTimeout = String(setTimeout(() => {
        isUserScrollingMinute.current = false;
      }, 150));
    }
  };

  const handleConfirm = () => {
    const hStr = String(selectedHour).padStart(2, '0');
    const mStr = String(selectedMinute).padStart(2, '0');
    onSelectTime(`${hStr}:${mStr}`);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-[320px] bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up">
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-center font-black text-stone-800 text-lg mb-6">{title}</h2>

          <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            {/* Headers */}
            <div className="flex bg-gray-50 border-b border-gray-100">
              <div className="flex-1 py-3 text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                Hour
              </div>
              <div className="w-[1px] bg-gray-100"></div>
              <div className="flex-1 py-3 text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                Minute
              </div>
            </div>

            {/* Picker Wheels */}
            <div className="flex h-[176px] relative bg-white">

              {/* Hour Column */}
              <div 
                ref={hourScrollRef}
                onScroll={handleHourScroll}
                className="flex-1 overflow-y-auto snap-y snap-mandatory scrollbar-none"
                style={{ scrollPaddingTop: ITEM_HEIGHT }}
              >
                <div style={{ height: ITEM_HEIGHT }} /> {/* Top padding */}
                {validHours.map((h) => {
                  const isSelected = selectedHour === h;
                  return (
                    <div 
                      key={`h-${h}`}
                      onClick={() => setSelectedHour(h)}
                      className={`h-[44px] flex items-center justify-center text-lg snap-start transition-colors duration-200 cursor-pointer hover:bg-gray-50
                        ${isSelected ? (solidTheme ? 'bg-blue-600' : 'bg-blue-200') + ' text-white font-black text-xl' : 'text-stone-600 font-bold'}
                      `}
                    >
                      {String(h).padStart(2, '0')}
                    </div>
                  );
                })}
                <div style={{ height: ITEM_HEIGHT }} /> {/* Bottom padding */}
              </div>

              <div className="w-[1px] bg-gray-100 z-10"></div>

              {/* Minute Column */}
              <div 
                ref={minuteScrollRef}
                onScroll={handleMinuteScroll}
                className="flex-1 overflow-y-auto snap-y snap-mandatory scrollbar-none"
                style={{ scrollPaddingTop: ITEM_HEIGHT }}
              >
                <div style={{ height: ITEM_HEIGHT }} /> {/* Top padding */}
                {validMinutes.map((m) => {
                  const isSelected = selectedMinute === m;
                  return (
                    <div 
                      key={`m-${m}`}
                      onClick={() => setSelectedMinute(m)}
                      className={`h-[44px] flex items-center justify-center text-lg snap-start transition-colors duration-200 cursor-pointer hover:bg-gray-50
                        ${isSelected ? (solidTheme ? 'bg-blue-600' : 'bg-blue-600') + ' text-white font-black text-xl' : 'text-stone-600 font-bold'}
                      `}
                    >
                      {String(m).padStart(2, '0')}
                    </div>
                  );
                })}
                <div style={{ height: ITEM_HEIGHT }} /> {/* Bottom padding */}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleConfirm}
            className="w-full py-3.5 bg-[#1E293B] hover:bg-stone-900 text-white rounded-2xl text-sm font-bold transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
