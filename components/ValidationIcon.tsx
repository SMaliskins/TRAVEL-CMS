import React from 'react';

export type ValidationStatus = 'valid' | 'invalid' | 'warning' | null;

interface ValidationIconProps {
  status: ValidationStatus;
  show?: boolean;
  className?: string;
}

/**
 * Inline validation icon component for form fields
 * Displays ✓ (valid), ✗ (invalid), or ⚠ (warning) icons
 */
export function ValidationIcon({ status, show = true, className = '' }: ValidationIconProps) {
  if (!show || !status) return null;

  const iconClasses = `absolute right-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] pointer-events-none transition-all duration-200 ease-out ${className}`;

  switch (status) {
    case 'valid':
      return (
        <div 
          className={`${iconClasses} opacity-0 animate-[fadeInScale_0.2s_ease-out_forwards]`}
          aria-label="Field is valid"
        >
          <svg className="w-full h-full text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    
    case 'invalid':
      return (
        <div 
          className={`${iconClasses} opacity-0 animate-[fadeInScale_0.2s_ease-out_forwards]`}
          aria-label="Field is invalid"
        >
          <svg className="w-full h-full text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      );
    
    case 'warning':
      return (
        <div 
          className={`${iconClasses} opacity-0 animate-[fadeInScale_0.2s_ease-out_forwards]`}
          aria-label="Field has warning"
        >
          <svg className="w-full h-full text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      );
    
    default:
      return null;
  }
}

