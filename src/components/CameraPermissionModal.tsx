import React, { useState } from 'react';
import {
  Camera,
  AlertCircle,
  Keyboard,
  RefreshCw,
  X,
  Scan,
  CheckCircle,
} from 'lucide-react';

export interface CameraPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted: () => void;
  onUseManualInput?: () => void;
  initialError?: string | null;
}

export const CameraPermissionModal: React.FC<CameraPermissionModalProps> = ({
  isOpen,
  onClose,
  onPermissionGranted,
  onUseManualInput,
  initialError,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Active trigger: requests browser camera permission directly from user gesture
  const handleAllowCamera = async () => {
    setIsRequesting(true);
    setErrorMessage(null);

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        throw new Error('Camera hardware/API is not supported by this browser.');
      }

      // Explicitly trigger getUserMedia on this click event so browser prompts the user
      // We use a very simple constraint first to maximize prompt success
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err: any) {
        // If it fails, check if it's a specific hardware error or a permission error
        const name = err?.name || '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          throw new Error('Camera access is currently blocked. Please click the button again to try requesting permission.');
        }
        throw err;
      }

      if (!stream) {
        throw new Error('No video stream received from camera.');
      }

      // Stop tracks immediately so scanner component can attach cleanly
      stream.getTracks().forEach((track) => track.stop());

      setIsRequesting(false);
      onPermissionGranted();
      onClose();
    } catch (err: any) {
      setIsRequesting(false);
      const name = err?.name || '';
      const msg = (err?.message || '').toLowerCase();

      if (
        name === 'NotAllowedError' ||
        name === 'PermissionDeniedError' ||
        msg.includes('denied') ||
        msg.includes('not allowed') ||
        msg.includes('permission')
      ) {
        setErrorMessage(err.message || 'Camera access was not granted. Please allow access in the browser prompt or site settings.');
      } else if (name === 'NotFoundError' || msg.includes('not found')) {
        setErrorMessage('No camera hardware detected on this device.');
      } else {
        setErrorMessage(err?.message || 'Unable to start camera.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E6EDE7] overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-modal-title"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 border-b border-[#E6EDE7] bg-gradient-to-b from-[#F5F9F6] to-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white border border-[#E6EDE7] flex items-center justify-center text-[#55695E] hover:text-[#25352C] hover:bg-[#F5F9F6] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-[#E5F5E9] text-[#168653] border border-[#D4EED9] shadow-xs">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#E5F5E9] text-[#168653] mb-1">
                <Scan className="w-3 h-3" />
                <span>Barcode & QR Scanner</span>
              </div>
              <h3
                id="camera-modal-title"
                className="text-base font-bold text-[#25352C] leading-snug"
              >
                Allow Camera Access
              </h3>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-[#55695E] leading-relaxed">
            Allow camera access to scan electronic components, IC reels, project boxes, and parts directly with your device camera.
          </p>

          {/* Key perks */}
          <div className="bg-[#F5F9F6] border border-[#E6EDE7] rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-2.5 text-[#25352C]">
              <CheckCircle className="w-4 h-4 text-[#168653] shrink-0" />
              <span className="font-medium text-[11px]">Instant optical barcode & 2D QR decoding</span>
            </div>
            <div className="flex items-center gap-2.5 text-[#25352C]">
              <CheckCircle className="w-4 h-4 text-[#168653] shrink-0" />
              <span className="font-medium text-[11px]">Automatic stock matching & project allocation</span>
            </div>
          </div>

          {/* Primary Action Button directly inside app */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleAllowCamera}
              disabled={isRequesting}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#168653] hover:bg-[#126E43] text-white text-sm font-bold transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              {isRequesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Requesting Camera Access...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Allow Camera from App</span>
                </>
              )}
            </button>
          </div>

          {/* Error notice if user denied or blocked */}
          {(errorMessage || initialError) && (
            <div className="p-3 rounded-xl text-xs flex items-start gap-2 bg-[#FFF9E6] text-[#7A5B04] border border-[#FFE8A3]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#B88700]" />
              <div className="flex-1">
                <span className="leading-relaxed font-medium">
                  {errorMessage || initialError}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#F5F9F6] border-t border-[#E6EDE7] flex items-center justify-between gap-2.5">
          {onUseManualInput ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onUseManualInput();
              }}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#E6EDE7]/60 text-[#55695E] hover:text-[#25352C] border border-[#E6EDE7] text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Use SKU / USB Scanner</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#55695E] hover:text-[#25352C] hover:bg-black/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
