'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FileUploadProps extends React.HTMLAttributes<HTMLDivElement> {
  onFileSelect?: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
}

export function FileUpload({
  onFileSelect,
  accept = '.zip,image/*',
  maxSizeMB = 10,
  className,
  ...props
}: FileUploadProps) {
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcess(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndProcess(e.target.files[0]);
    }
  };

  const validateAndProcess = (file: File) => {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      alert(`File size exceeds limit of ${maxSizeMB}MB.`);
      return;
    }
    onFileSelect?.(file);
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center bg-card/5 hover:bg-card/15 hover:border-accent/40 transition-all cursor-pointer select-none',
        dragActive && 'border-accent/60 bg-accent/5 scale-99',
        className
      )}
      {...props}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      {/* Upload Cloud SVG */}
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
        className="h-8 w-8 text-muted-foreground mb-3"
      >
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
        <path d="M12 12v9" />
        <path d="m15 15-3-3-3 3" />
      </svg>

      <p className="text-xs font-semibold text-foreground">
        Drag & drop file here or <span className="text-accent underline">browse</span>
      </p>
      <p className="text-4xs text-muted-foreground mt-1">
        Supports ZIP files or images up to {maxSizeMB}MB
      </p>
    </div>
  );
}
