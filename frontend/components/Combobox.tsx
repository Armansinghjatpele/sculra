'use client';

import * as React from 'react';
import { Input } from './Input';
import { cn } from '@/lib/utils';

export interface ComboboxProps {
  options: { label: string; value: string }[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function Combobox({
  options,
  selectedValue,
  onValueChange,
  placeholder = 'Select option...',
  className,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
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

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = options.find((o) => o.value === selectedValue)?.label || '';

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {/* Box display */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-input px-3 py-1 text-sm shadow-sm cursor-pointer select-none text-foreground"
      >
        <span>{selectedLabel || placeholder}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-muted-foreground"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <div className="absolute z-20 mt-1.5 w-full rounded-md border border-border bg-popover p-1 shadow-lg max-h-48 overflow-y-auto glass-panel">
          <div className="border-b border-border/40 p-1 mb-1">
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs px-2"
              autoFocus
            />
          </div>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.value}
                onClick={() => {
                  onValueChange(opt.value);
                  setIsOpen(false);
                  setSearch('');
                }}
                className={cn(
                  'flex items-center justify-between rounded-sm px-2.5 py-1.5 text-sm cursor-pointer select-none text-foreground hover:bg-muted transition-colors',
                  selectedValue === opt.value && 'bg-muted/80'
                )}
              >
                <span>{opt.label}</span>
                {selectedValue === opt.value && (
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
            ))
          ) : (
            <div className="p-2 text-center text-xs text-muted-foreground">No options found.</div>
          )}
        </div>
      )}
    </div>
  );
}
