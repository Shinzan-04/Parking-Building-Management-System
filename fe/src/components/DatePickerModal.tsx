import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function DatePickerModal({
  isOpen,
  onClose,
  selectedDate,
  onSelectDate,
}: DatePickerModalProps) {
  // Parse the selected date or default to today
  const initialDate = selectedDate ? new Date(selectedDate) : new Date();
  
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());

  // Reset internal state when opened
  useEffect(() => {
    if (isOpen) {
      const date = selectedDate ? new Date(selectedDate) : new Date();
      if (!isNaN(date.getTime())) {
        setCurrentMonth(date.getMonth());
        setCurrentYear(date.getFullYear());
      }
    }
  }, [isOpen, selectedDate]);

  const currentYearOptions = useMemo(() => {
    const today = new Date();
    const currentY = today.getFullYear();
    // Allow booking up to 2 years in advance
    return Array.from({ length: 3 }, (_, i) => currentY + i);
  }, []);

  const daysGrid = useMemo(() => {
    const grid: { date: Date; isCurrentMonth: boolean }[] = [];
    
    // First day of current month
    const firstDay = new Date(currentYear, currentMonth, 1);
    // Last day of current month
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    // Day of the week of the first day (0-6)
    const firstDayOfWeek = firstDay.getDay();
    
    // Previous month's trailing days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      grid.push({
        date: new Date(currentYear, currentMonth - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }
    
    // Current month's days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      grid.push({
        date: new Date(currentYear, currentMonth, i),
        isCurrentMonth: true,
      });
    }
    
    // Next month's leading days to complete the 6x7 grid (42 cells)
    const remainingCells = 42 - grid.length;
    for (let i = 1; i <= remainingCells; i++) {
      grid.push({
        date: new Date(currentYear, currentMonth + 1, i),
        isCurrentMonth: false,
      });
    }
    
    return grid;
  }, [currentMonth, currentYear]);

  if (!isOpen) return null;

  const handleSelect = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    onSelectDate(`${year}-${month}-${day}`);
    onClose();
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    const sDate = new Date(selectedDate);
    return (
      date.getDate() === sDate.getDate() &&
      date.getMonth() === sDate.getMonth() &&
      date.getFullYear() === sDate.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };
  
  // Disable past dates
  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-[360px] bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up">
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-center font-black text-stone-800 text-lg mb-6">Select Booking Date</h2>
          
          {/* Controls */}
          <div className="flex justify-center gap-3 mb-6">
            {/* Month Select */}
            <div className="relative">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(Number(e.target.value))}
                className="appearance-none bg-gray-50 border border-gray-200/80 rounded-xl px-4 py-2 pr-10 text-sm font-bold text-stone-800 outline-none focus:border-[#FF4C4C] cursor-pointer transition-colors"
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown size={14} className="text-stone-500" strokeWidth={3} />
              </div>
            </div>
            
            {/* Year Select */}
            <div className="relative">
              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(Number(e.target.value))}
                className="appearance-none bg-gray-50 border border-gray-200/80 rounded-xl px-4 py-2 pr-10 text-sm font-bold text-stone-800 outline-none focus:border-[#FF4C4C] cursor-pointer transition-colors"
              >
                {currentYearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown size={14} className="text-stone-500" strokeWidth={3} />
              </div>
            </div>
          </div>
          
          {/* Days of week header */}
          <div className="grid grid-cols-7 mb-4">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="text-center">
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{day}</span>
              </div>
            ))}
          </div>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-y-2">
            {daysGrid.map((dayObj, i) => {
              const selected = isSelected(dayObj.date);
              const past = isPastDate(dayObj.date);
              const today = isToday(dayObj.date);
              
              return (
                <div key={i} className="flex items-center justify-center aspect-square">
                  <button
                    disabled={past}
                    onClick={() => handleSelect(dayObj.date)}
                    className={`
                      relative w-10 h-10 flex items-center justify-center rounded-full text-sm transition-all
                      ${selected ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-600/30 scale-100' : ''}
                      ${!selected && !past && dayObj.isCurrentMonth ? 'text-stone-800 font-bold hover:bg-gray-100' : ''}
                      ${!selected && !past && !dayObj.isCurrentMonth ? 'text-stone-300 font-bold hover:bg-gray-50' : ''}
                      ${past && !selected ? 'text-stone-200 font-medium cursor-not-allowed' : ''}
                      ${today && !selected ? 'ring-2 ring-blue-600/30' : ''}
                    `}
                  >
                    {dayObj.date.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-red-50 hover:bg-red-100 text-[#FF4C4C] rounded-2xl text-sm font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
