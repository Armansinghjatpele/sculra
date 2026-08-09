'use client';

import * as React from 'react';
import { Badge } from './Badge';
import { cn } from '@/lib/utils';

export interface MultiSelectProps {
  options: { label: string; value: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selectedValues,
  onChange,
  placeholder = 'Select items...',
  className,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('click', handleOutsideClick);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  const toggleSelect = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {/* Box display */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-[36px] w-full wrap items-center gap-1.5 rounded-md border border-border bg-input px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer select-none text-foreground"
      >
        {selectedValues.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedValues.map((val) => {
              const label = options.find((o) => o.value === val)?.label || val;
              return (
                <Badge
                  key={val}
                  variant="secondary"
                  className="flex items-center gap-1 py-0.5 px-2 text-2xs"
                >
                  <span>{label}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(val);
                    }}
                    className="hover:text-danger text-muted-foreground font-bold cursor-pointer select-none"
                  >
                    ×
                  </span>
                </Badge>
              );
            })}
          </div>
        ) : (
          <span className="text-muted-foreground select-none">{placeholder}</span>
        )}
      </div>

      {/* Popover overlay options */}
      {isOpen && (
        <div className="absolute z-20 mt-1.5 w-full rounded-md border border-border bg-popover p-1 shadow-lg max-h-48 overflow-y-auto glass-panel">
          {options.map((opt) => {
            const isSelected = selectedValues.includes(opt.value);
            return (
              <div
                key={opt.value}
                onClick={() => toggleSelect(opt.value)}
                className={cn(
                  'flex items-center justify-between rounded-sm px-2.5 py-1.5 text-sm cursor-pointer select-none text-foreground hover:bg-muted transition-colors',
                  isSelected && 'bg-muted/80'
                )}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 text-accent"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
