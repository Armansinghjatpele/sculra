'use client';

import * as React from 'react';
import { Input } from './Input';
import { cn } from '@/lib/utils';

export interface URLInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  isGitHubUrl?: boolean;
}

export function URLInput({
  value,
  onChange,
  isGitHubUrl = false,
  className,
  placeholder,
  ...props
}: URLInputProps) {
  const [isValid, setIsValid] = React.useState(true);

  const validateUrl = (val: string): boolean => {
    if (!val) return true; // clean state when empty
    try {
      if (isGitHubUrl) {
        return /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w-]+(\.git)?\/?$/.test(val);
      }
      // General URL validation
      new URL(val);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const valid = validateUrl(val);
    setIsValid(valid);
    onChange(val, valid);
  };

  return (
    <div className={cn('relative w-full flex flex-col space-y-1', className)}>
      <div className="relative">
        <Input
          type="url"
          value={value}
          onChange={handleChange}
          placeholder={placeholder || (isGitHubUrl ? 'https://github.com/org/repo' : 'https://myapp.com')}
          className={cn(
            !isValid && 'border-danger focus-visible:ring-danger/45 border-r-4 border-r-danger'
          )}
          {...props}
        />
      </div>
      {!isValid && (
        <span className="text-4xs text-danger font-medium select-none">
          {isGitHubUrl ? 'Must be a valid GitHub repository URL' : 'Must be a valid URL (include http:// or https://)'}
        </span>
      )}
    </div>
  );
}
