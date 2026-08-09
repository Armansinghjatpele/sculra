import * as React from 'react';
import { Input } from './Input';
import { cn } from '@/lib/utils';

export interface SearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (term: string) => void;
}

export function Search({ onSearch, className, ...props }: SearchProps) {
  const [value, setValue] = React.useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    onSearch?.(e.target.value);
  };

  return (
    <div className={cn('relative w-full max-w-sm', className)}>
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
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground select-none pointer-events-none"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <Input
        type="search"
        value={value}
        onChange={handleChange}
        className="pl-9"
        {...props}
      />
    </div>
  );
}
