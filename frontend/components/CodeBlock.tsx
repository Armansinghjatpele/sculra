'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'javascript', className, ...props }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="relative group rounded-md border border-border bg-black/60 overflow-hidden">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 select-none">
        <span className="text-4xs font-semibold text-muted-foreground uppercase tracking-widest">
          {language}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2.5 text-4xs font-medium gap-1.5 transition-all text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <>
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
                className="h-3 w-3 text-success"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied</span>
            </>
          ) : (
            <>
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
                className="h-3 w-3"
              >
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>

      {/* Code Text Area */}
      <pre
        className={cn(
          'overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground bg-transparent',
          className
        )}
        {...props}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
