'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, User, ChevronRight, Check, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import type { StaffRole } from '@/types';

type SetupStep = 'name' | 'camera' | 'pin' | 'role' | 'confirm';

interface StaffSetupProps {
  onComplete: () => void;
}

export function StaffSetup({ onComplete }: StaffSetupProps) {
  const [step, setStep] = useState<SetupStep>('name');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<StaffRole>('foh');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const createStaff = useAuthStore((s) => s.createStaff);
  const isLoading = useAuthStore((s) => s.isLoading);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 400, height: 400 },
        audio: false,
      });
      streamRef.current = stream;
      setIsStreaming(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      setStep('pin');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    const size = Math.min(video.videoWidth, video.videoHeight);
    const x = (video.videoWidth - size) / 2;
    const y = (video.videoHeight - size) / 2;
    ctx.drawImage(video, x, y, size, size, 0, 0, 400, 400);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setPhotoBlob(blob);
          setPhotoPreview(URL.createObjectURL(blob));
        }
      },
      'image/jpeg',
      0.8
    );
    stopCamera();
    setStep('pin');
  }, [stopCamera]);

  useEffect(() => {
    if (step === 'camera') startCamera();
    return () => stopCamera();
  }, [step, startCamera, stopCamera]);

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) {
      setTimeout(() => setStep('role'), 200);
    }
  };

  const handleSubmit = async () => {
    const photoFile = photoBlob
      ? new File([photoBlob], `${name.replace(/\s+/g, '_')}.jpg`, { type: 'image/jpeg' })
      : undefined;
    const staff = await createStaff({ name, pin, role, photoFile });
    if (staff) onComplete();
    else setError('Failed to create staff profile. Please try again.');
  };

  const roles: { id: StaffRole; label: string; desc: string; emoji: string }[] = [
    { id: 'foh', label: 'FOH (Server)', desc: 'Takes orders, manages tables', emoji: '🍽️' },
    { id: 'boh', label: 'BOH (Kitchen/Bar)', desc: 'Prepares items, sends to FOH', emoji: '👨‍🍳' },
    { id: 'admin', label: 'Admin (Owner)', desc: 'Full access, manage inventory', emoji: '👑' },
  ];

  // Shared wrapper
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-6 py-8">
      {children}
    </div>
  );

  // ===== NAME STEP =====
  if (step === 'name') {
    return (
      <Wrapper>
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">New Staff Member</h1>
        <p className="text-sm text-gray-500 mb-8">What&apos;s your name?</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          autoFocus
          className="w-full max-w-xs text-center text-xl font-semibold border-2 border-gray-200 rounded-2xl px-4 py-4 focus:border-blue-500 focus:outline-none transition"
        />
        <Button
          className="mt-6 w-full max-w-xs"
          size="lg"
          disabled={!name.trim()}
          onClick={() => setStep('camera')}
        >
          Next <ChevronRight className="w-5 h-5" />
        </Button>
      </Wrapper>
    );
  }

  // ===== CAMERA STEP =====
  if (step === 'camera') {
    return (
      <Wrapper>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Take a Photo</h1>
        <p className="text-sm text-gray-500 mb-6">So your team knows who you are</p>
        <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-gray-200 mb-6 bg-gray-100">
          {isStreaming ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
              playsInline
              muted
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Camera className="w-12 h-12 text-gray-300" />
            </div>
          )}
        </div>
        <div className="flex gap-3 w-full max-w-xs">
          <Button variant="secondary" className="flex-1" onClick={() => { stopCamera(); setStep('pin'); }}>
            <SkipForward className="w-4 h-4" /> Skip
          </Button>
          <Button className="flex-1" onClick={capturePhoto} disabled={!isStreaming}>
            <Camera className="w-4 h-4" /> Capture
          </Button>
        </div>
      </Wrapper>
    );
  }

  // ===== PIN STEP =====
  if (step === 'pin') {
    return (
      <Wrapper>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your PIN</h1>
        <p className="text-sm text-gray-500 mb-6">4-digit PIN for quick login</p>
        {/* PIN dots */}
        <div className="flex gap-3 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-14 h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all duration-150 ${
                i < pin.length
                  ? 'border-blue-500 bg-blue-50 text-blue-600 scale-105'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {i < pin.length ? '●' : ''}
            </div>
          ))}
        </div>
        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {['1','2','3','4','5','6','7','8','9','',  '0', 'del'].map((key) => {
            if (key === '') return <div key="empty" />;
            if (key === 'del') {
              return (
                <button
                  key="del"
                  onClick={() => setPin((p) => p.slice(0, -1))}
                  className="min-h-[64px] bg-gray-100 rounded-2xl text-gray-500 font-medium active:scale-95 transition-all text-sm"
                >
                  Delete
                </button>
              );
            }
            return (
              <button
                key={key}
                onClick={() => handlePinDigit(key)}
                className="min-h-[64px] bg-white rounded-2xl border border-gray-200 text-gray-900 font-bold text-2xl active:scale-95 active:bg-gray-100 transition-all shadow-sm"
              >
                {key}
              </button>
            );
          })}
        </div>
      </Wrapper>
    );
  }

  // ===== ROLE STEP =====
  if (step === 'role') {
    return (
      <Wrapper>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Your Role</h1>
        <p className="text-sm text-gray-500 mb-8">This determines what you see in the app</p>
        <div className="w-full max-w-xs space-y-3">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                role === r.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className="text-2xl">{r.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{r.label}</div>
                <div className="text-xs text-gray-500">{r.desc}</div>
              </div>
              {role === r.id && (
                <Check className="w-5 h-5 text-blue-600" />
              )}
            </button>
          ))}
        </div>
        <Button className="mt-6 w-full max-w-xs" size="lg" onClick={() => setStep('confirm')}>
          Next <ChevronRight className="w-5 h-5" />
        </Button>
      </Wrapper>
    );
  }

  // ===== CONFIRM STEP =====
  return (
    <Wrapper>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Confirm Your Profile</h1>
      {/* Photo */}
      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-200 mb-4 bg-gray-100">
        {photoPreview ? (
          <img src={photoPreview} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-10 h-10 text-gray-300" />
          </div>
        )}
      </div>
      <div className="text-center mb-6">
        <div className="text-xl font-bold text-gray-900">{name}</div>
        <div className="text-sm text-gray-500 mt-1">
          {roles.find((r) => r.id === role)?.emoji}{' '}
          {roles.find((r) => r.id === role)?.label}
        </div>
        <div className="text-sm text-gray-400 mt-1">PIN: ●●●●</div>
      </div>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="flex gap-3 w-full max-w-xs">
        <Button variant="secondary" className="flex-1" onClick={() => { setPin(''); setStep('name'); }}>
          Start Over
        </Button>
        <Button className="flex-1" isLoading={isLoading} onClick={handleSubmit}>
          <Check className="w-4 h-4" /> Create
        </Button>
      </div>
    </Wrapper>
  );
}
