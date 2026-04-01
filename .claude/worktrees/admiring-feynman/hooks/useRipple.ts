import { useCallback, useRef } from 'react';

interface RippleOptions {
  /**
   * Ripple color. Defaults based on button type:
   * - Light buttons: rgba(0, 0, 0, 0.15)
   * - Dark buttons: rgba(255, 255, 255, 0.3)
   * - Tab buttons: rgba(0, 0, 0, 0.1)
   */
  color?: string;
  /**
   * Animation duration in milliseconds. Default: 400ms
   */
  duration?: number;
}

interface RippleEvent {
  clientX: number;
  clientY: number;
}

/**
 * React hook for Material Design ripple effect on buttons
 * 
 * @param options - Configuration options for ripple effect
 * @returns Object with rippleProps (to spread on button) and createRipple function
 * 
 * @example
 * const { rippleProps, createRipple } = useRipple();
 * <button {...rippleProps} onClick={(e) => { createRipple(e); handleClick(e); }}>
 *   Click me
 * </button>
 */
export function useRipple(options: RippleOptions = {}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const rippleElementsRef = useRef<Set<HTMLSpanElement>>(new Set());

  const {
    color = 'rgba(0, 0, 0, 0.15)',
    duration = 400,
  } = options;

  const createRipple = useCallback((event: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    const button = buttonRef.current || event.currentTarget;
    
    // Don't create ripple if button is disabled
    if (button.hasAttribute('disabled') || button.classList.contains('disabled')) {
      return;
    }

    // Get button position
    const rect = button.getBoundingClientRect();
    
    // Get click position
    let clientX: number;
    let clientY: number;
    
    if ('touches' in event && event.touches.length > 0) {
      // Touch event
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if ('clientX' in event) {
      // Mouse event
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      // Fallback to center of button
      clientX = rect.left + rect.width / 2;
      clientY = rect.top + rect.height / 2;
    }

    // Calculate ripple position relative to button
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Calculate ripple size (should cover entire button)
    const size = Math.max(rect.width, rect.height);

    // Create ripple element
    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position: absolute;
      border-radius: 50%;
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      left: ${x - size / 2}px;
      top: ${y - size / 2}px;
      pointer-events: none;
      transform: scale(0);
      opacity: 1;
      transition: transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 0;
    `;

    // Ensure button has relative positioning
    const buttonPosition = window.getComputedStyle(button).position;
    if (buttonPosition === 'static') {
      button.style.position = 'relative';
    }

    // Ensure button has overflow hidden
    if (!button.style.overflow) {
      button.style.overflow = 'hidden';
    }

    // Append ripple to button
    button.appendChild(ripple);
    rippleElementsRef.current.add(ripple);

    // Trigger animation
    requestAnimationFrame(() => {
      ripple.style.transform = 'scale(2)';
      ripple.style.opacity = '0';
    });

    // Remove ripple after animation
    setTimeout(() => {
      ripple.remove();
      rippleElementsRef.current.delete(ripple);
    }, duration);
  }, [color, duration]);

  const rippleProps = {
    ref: buttonRef,
    onMouseDown: createRipple,
    onTouchStart: createRipple,
  };

  return {
    rippleProps,
    createRipple,
  };
}

