import * as React from 'react';
import { cn } from '@/lib/utils';

export interface RadioItem {
  label: string;
  value: string;
  id: string;
}

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  items: RadioItem[];
  name: string;
  selectedValue?: string;
  onValueChange?: (value: string) => void;
}

export function Radio({
  items,
  name,
  selectedValue,
  onValueChange,
  className,
  ...props
}: RadioProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) => (
        <label
          key={item.id}
          className="flex items-center space-x-2.5 select-none cursor-pointer text-sm text-foreground"
        >
          <input
            type="radio"
            name={name}
            value={item.value}
            checked={selectedValue === item.value}
            onChange={() => onValueChange?.(item.value)}
            className="h-4 w-4 border border-border bg-input transition-colors focus:outline-none checked:bg-primary checked:border-primary accent-primary"
            {...props}
          />
          <span className="font-medium">{item.label}</span>
        </label>
      ))}
    </div>
  );
}
