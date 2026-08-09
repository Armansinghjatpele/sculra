'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CalendarProps {
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  className?: string;
}

export function Calendar({ selectedDate, onDateChange, className }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Get number of days in active month
  const totalDays = new Date(year, month + 1, 0).getDate();
  // Get week index offset of 1st day of month
  const startOffset = new Date(year, month, 1).getDay();

  const handleDaySelect = (day: number) => {
    const d = new Date(year, month, day);
    onDateChange?.(d);
  };

  const changeMonth = (offset: number) => {
    setCurrentMonth(new Date(year, month + offset, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className={cn('p-3 rounded-md border border-border bg-popover w-64 select-none', className)}>
      {/* Month Selector Bar */}
      <div className="flex items-center justify-between mb-3 text-sm font-semibold text-foreground">
        <button onClick={() => changeMonth(-1)} className="hover:text-accent font-bold cursor-pointer">
          &lt;
        </button>
        <span>{monthNames[month]} {year}</span>
        <button onClick={() => changeMonth(1)} className="hover:text-accent font-bold cursor-pointer">
          &gt;
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-4xs font-semibold text-muted-foreground uppercase mb-1.5">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {Array.from({ length: startOffset }).map((_, idx) => (
          <span key={`empty-${idx}`} />
        ))}
        {Array.from({ length: totalDays }).map((_, idx) => {
          const day = idx + 1;
          const isSelected = selectedDate &&
            selectedDate.getDate() === day &&
            selectedDate.getMonth() === month &&
            selectedDate.getFullYear() === year;

          return (
            <button
              key={day}
              onClick={() => handleDaySelect(day)}
              className={cn(
                'h-7 w-7 rounded-sm flex items-center justify-center transition-colors cursor-pointer select-none',
                isSelected
                  ? 'bg-primary text-white font-semibold'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
