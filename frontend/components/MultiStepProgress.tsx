import * as React from 'react';
import { cn } from '@/lib/utils';

export interface MultiStepProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: string[];
  currentStepIndex: number;
}

export function MultiStepProgress({
  steps,
  currentStepIndex,
  className,
  ...props
}: MultiStepProgressProps) {
  return (
    <div className={cn('flex items-center w-full justify-between', className)} {...props}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isActive = index === currentStepIndex;

        return (
          <React.Fragment key={index}>
            {/* Step Line Connecting Nodes */}
            {index > 0 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-2 transition-colors duration-300',
                  index <= currentStepIndex ? 'bg-primary' : 'bg-border'
                )}
              />
            )}

            {/* Step Node */}
            <div className="flex items-center space-x-2 select-none">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold border transition-all duration-300',
                  isCompleted && 'bg-primary border-primary text-white',
                  isActive && 'bg-background border-accent text-accent scale-105 shadow-glass',
                  !isCompleted && !isActive && 'bg-muted border-border text-muted-foreground'
                )}
              >
                {isCompleted ? (
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
                    className="h-3 w-3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  'hidden md:inline text-xs font-medium',
                  isActive ? 'text-accent font-semibold' : 'text-muted-foreground'
                )}
              >
                {step}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
