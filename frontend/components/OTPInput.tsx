'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from './Input';

export interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function OTPInput({ length = 6, value, onChange, className }: OTPInputProps) {
  const inputRefs = React.useRef<HTMLInputElement[]>([]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const val = e.target.value;
    if (!val) return;

    const updatedOtp = value.split('');
    updatedOtp[idx] = val[val.length - 1]; // capture last entered character
    const newOtpValue = updatedOtp.join('');
    onChange(newOtpValue);

    // Auto-focus next input box
    if (idx < length - 1 && val) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
      const updatedOtp = value.split('');
      updatedOtp[idx] = '';
      const newOtpValue = updatedOtp.join('');
      onChange(newOtpValue);

      // Auto-focus previous input box
      if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
      }
    }
  };

  return (
    <div className={cn('flex gap-2.5', className)}>
      {Array.from({ length }).map((_, idx) => (
        <Input
          key={idx}
          ref={(el) => {
            if (el) inputRefs.current[idx] = el;
          }}
          type="text"
          maxLength={1}
          value={value[idx] || ''}
          onChange={(e) => handleInput(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          className="h-12 w-10 text-center text-lg font-bold border-border bg-input"
        />
      ))}
    </div>
  );
}
