import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onValueChange?: (val: number) => void;
}

export function Slider({
  min = 0,
  max = 100,
  step = 1,
  value,
  onValueChange,
  className,
  ...props
}: SliderProps) {
  return (
    <div className={cn('relative w-full flex items-center select-none', className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onValueChange?.(Number(e.target.value))}
        className="w-full h-1.5 rounded-lg border-transparent bg-muted cursor-pointer accent-primary focus:outline-none"
        {...props}
      />
    </div>
  );
}
