import * as React from 'react';
import { cn } from '@/lib/utils';

// ------------------------------------------------------------------------------
// Container Primitive
// ------------------------------------------------------------------------------
export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  clean?: boolean;
}

export function Container({ className, clean = false, ...props }: ContainerProps) {
  return (
    <div
      className={cn(
        !clean && 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8',
        className
      )}
      {...props}
    />
  );
}

// ------------------------------------------------------------------------------
// Section Primitive
// ------------------------------------------------------------------------------
export function Section({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('py-12 sm:py-16 lg:py-20', className)}
      {...props}
    />
  );
}

// ------------------------------------------------------------------------------
// Page Primitive
// ------------------------------------------------------------------------------
export function Page({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col min-h-screen bg-background text-foreground', className)}
      {...props}
    />
  );
}

// ------------------------------------------------------------------------------
// Grid Primitive
// ------------------------------------------------------------------------------
export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  colsSm?: 1 | 2 | 3 | 4;
  colsMd?: 1 | 2 | 3 | 4 | 6;
  colsLg?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: 2 | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48;
}

export function Grid({
  className,
  cols = 1,
  colsSm,
  colsMd,
  colsLg,
  gap = 16,
  ...props
}: GridProps) {
  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
    12: 'grid-cols-12',
  };

  const smColClasses = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
  };

  const mdColClasses = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    6: 'md:grid-cols-6',
  };

  const lgColClasses = {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    6: 'lg:grid-cols-6',
    12: 'lg:grid-cols-12',
  };

  const gapClasses = {
    2: 'gap-0.5',
    4: 'gap-1',
    8: 'gap-2',
    12: 'gap-3',
    16: 'gap-4',
    20: 'gap-5',
    24: 'gap-6',
    32: 'gap-8',
    40: 'gap-10',
    48: 'gap-12',
  };

  return (
    <div
      className={cn(
        'grid',
        colClasses[cols],
        colsSm && smColClasses[colsSm],
        colsMd && mdColClasses[colsMd],
        colsLg && lgColClasses[colsLg],
        gapClasses[gap],
        className
      )}
      {...props}
    />
  );
}

// ------------------------------------------------------------------------------
// Flex Primitive
// ------------------------------------------------------------------------------
export interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
}

export function Flex({
  className,
  align = 'center',
  justify = 'start',
  wrap = false,
  ...props
}: FlexProps) {
  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
    baseline: 'items-baseline',
  };

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  };

  return (
    <div
      className={cn(
        'flex',
        alignClasses[align],
        justifyClasses[justify],
        wrap && 'flex-wrap',
        className
      )}
      {...props}
    />
  );
}

// ------------------------------------------------------------------------------
// Stack Primitive
// ------------------------------------------------------------------------------
export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  spacing?: 2 | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48;
}

export function Stack({ className, spacing = 16, ...props }: StackProps) {
  const spacingClasses = {
    2: 'space-y-0.5',
    4: 'space-y-1',
    8: 'space-y-2',
    12: 'space-y-3',
    16: 'space-y-4',
    20: 'space-y-5',
    24: 'space-y-6',
    32: 'space-y-8',
    40: 'space-y-10',
    48: 'space-y-12',
  };

  return (
    <div
      className={cn('flex flex-col', spacingClasses[spacing], className)}
      {...props}
    />
  );
}

// ------------------------------------------------------------------------------
// Divider Primitive
// ------------------------------------------------------------------------------
export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Divider({ className, orientation = 'horizontal', ...props }: DividerProps) {
  return (
    <div
      className={cn(
        'bg-border shrink-0',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'w-[1px] h-full',
        className
      )}
      {...props}
    />
  );
}
