'use client';

import * as React from 'react';
import { Badge } from './Badge';
import { Input } from './Input';
import { cn } from '@/lib/utils';

export interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({ tags, onTagsChange, placeholder = 'Add tag...', className }: TagInputProps) {
  const [inputValue, setInputValue] = React.useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const val = inputValue.trim();
      if (!tags.includes(val)) {
        onTagsChange([...tags, val]);
      }
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <div className={cn('flex flex-col gap-2.5 w-full', className)}>
      <Input
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-9"
      />

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border border-border/40 rounded-md p-2 bg-muted/20">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="flex items-center gap-1 py-0.5 px-2 text-2xs"
            >
              <span>{tag}</span>
              <span
                onClick={() => removeTag(tag)}
                className="hover:text-danger text-muted-foreground font-bold cursor-pointer select-none"
              >
                ×
              </span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
