'use client';

import { useState, useCallback, useEffect } from 'react';
import { Delete, MessageSquare } from 'lucide-react';
import { cn, haptic } from '@/lib/utils';

interface PinPadProps {
  onSubmit: (pin: string) => void;
  pinLength?: number;
  title?: string;
  subtitle?: string;
  error?: string | null;
  isLoading?: boolean;
  onEndShift?: () => void;
}

export function PinPad({
  onSubmit,
  pinLength = 4,
  title = 'Enter PIN',
  subtitle,
  error,
  isLoading,
  onEndShift,
}: PinPadProps) {
  const [pin, setPin] = useState('');

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length >= pinLength) return;
      haptic(10);
      const newPin = pin + digit;
      setPin(newPin);

      // Auto-submit when PIN is complete
      if (newPin.length === pinLength) {
        setTimeout(() => {
          onSubmit(newPin);
          setPin('');
        }, 150);
      }
    },
    [pin, pinLength, onSubmit]
  );

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
  }, []);

  // Haptic feedback on error
  useEffect(() => {
    if (error) haptic([50, 30, 50]);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-6">
      {/* Title */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🔐</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>

      {/* PIN Dots */}
      <div className="flex gap-3 mb-3">
        {Array.from({ length: pinLength }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-14 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all duration-150',
              i < pin.length
                ? 'border-blue-500 bg-blue-50 text-blue-600 scale-105'
                : 'border-gray-200 bg-white text-transparent'
            )}
          >
            {i < pin.length ? '●' : '○'}
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-red-500 text-sm font-medium mb-4 animate-fade-in">{error}</p>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <p className="text-blue-500 text-sm font-medium mb-4 animate-pulse">Checking...</p>
      )}

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            onClick={() => handleDigit(digit)}
            disabled={isLoading}
            className="numpad-btn bg-white rounded-2xl border border-gray-200 text-gray-900 font-bold text-2xl
                       min-h-[64px] active:scale-95 active:bg-gray-100 transition-all duration-100
                       hover:bg-gray-50 disabled:opacity-50 shadow-sm"
          >
            {digit}
          </button>
        ))}

        {/* Bottom row: Clear, 0, Backspace */}
        <button
          onClick={handleClear}
          disabled={isLoading}
          className="numpad-btn bg-gray-100 rounded-2xl text-gray-400 font-medium text-sm
                     min-h-[64px] active:scale-95 active:bg-gray-200 transition-all"
        >
          Clear
        </button>
        <button
          onClick={() => handleDigit('0')}
          disabled={isLoading}
          className="numpad-btn bg-white rounded-2xl border border-gray-200 text-gray-900 font-bold text-2xl
                     min-h-[64px] active:scale-95 active:bg-gray-100 transition-all shadow-sm"
        >
          0
        </button>
        <button
          onClick={handleBackspace}
          disabled={isLoading}
          className="numpad-btn bg-gray-100 rounded-2xl text-gray-500 font-medium
                     min-h-[64px] active:scale-95 active:bg-gray-200 transition-all
                     flex items-center justify-center"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {/* End Shift */}
      {onEndShift && (
        <button
          onClick={onEndShift}
          className="mt-8 flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition"
        >
          <MessageSquare className="w-4 h-4" />
          End Shift / Leave a Note
        </button>
      )}
    </div>
  );
}
