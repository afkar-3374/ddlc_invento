import React, { useState, useEffect } from 'react';
import { Download, Sparkles, X, Smartphone, CheckCircle, Share, PlusSquare, ArrowRight } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const STORAGE_KEY = 'ddlc_pwa_install_dismissed';

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ forceOpen = false, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isOpen, setIsOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    // First use check: check localStorage
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      // If already installed, don't show
      if (isInstalled) {
        setIsOpen(false);
        return;
      }

      // Show after a gentle 1.5 second delay on first use if not previously dismissed
      if (!dismissed) {
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [forceOpen, isInstalled]);

  if (!isOpen || isInstalled) return null;

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setIsOpen(false);
    if (onClose) onClose();
  };

  const handleInstallClick = async () => {
    setInstalling(true);
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setInstalledSuccess(true);
        setTimeout(() => {
          handleDismiss();
        }, 1800);
      }
    }
    setInstalling(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#E6EDE7] overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Decorative Top Mint/Lavender Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#B9F2D0] via-[#E9DFFF] to-[#FFE3EF]" />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-full text-[#77857C] hover:text-[#25352C] hover:bg-[#F5F9F6] transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Main Content */}
        <div className="flex flex-col items-center text-center pt-2 pb-1">
          {/* App Icon Preview */}
          <div className="relative mb-4">
            <div className="w-18 h-18 rounded-3xl bg-gradient-to-br from-[#168653] to-[#0E5434] p-3 shadow-md flex items-center justify-center text-white ring-4 ring-[#E5F5E9]">
              <div className="relative">
                <Smartphone className="w-8 h-8 text-white" />
                <Sparkles className="w-4 h-4 text-[#B9F2D0] absolute -top-1 -right-1 animate-pulse" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-[#168653] text-[9px] font-bold text-white shadow-xs border border-white tracking-wider">
              PWA APP
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5F5E9] text-[#168653] text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fast Offline-Ready Experience</span>
          </div>

          <h3 className="text-xl font-bold text-[#174D35] tracking-tight">
            Install DDLC AI Application
          </h3>

          <p className="text-xs text-[#77857C] mt-2 max-w-xs leading-relaxed">
            Get instant camera barcode scanning, offline component lookup, and native home screen access without app store friction.
          </p>

          {/* Key Advantages Grid */}
          <div className="w-full grid grid-cols-2 gap-2.5 my-5 text-left">
            <div className="p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7]">
              <div className="text-xs font-bold text-[#174D35] flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#168653]" />
                Camera Scanning
              </div>
              <div className="text-[11px] text-[#77857C] mt-0.5">
                Optimized hardware access
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7]">
              <div className="text-xs font-bold text-[#174D35] flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#168653]" />
                One-Tap Launch
              </div>
              <div className="text-[11px] text-[#77857C] mt-0.5">
                Full-screen standalone window
              </div>
            </div>
          </div>

          {/* Action State: Native Install Prompt vs iOS Safari Instructions vs Fallback */}
          {installedSuccess ? (
            <div className="w-full py-3 px-4 rounded-2xl bg-[#E5F5E9] border border-[#C6E7D2] text-[#168653] text-xs font-bold flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#168653]" />
              Successfully Installed! Opening DDLC AI...
            </div>
          ) : isIOS ? (
            <div className="w-full p-4 rounded-2xl bg-[#F0F9F2] border border-[#CDE3D2] text-left space-y-2">
              <div className="text-xs font-bold text-[#174D35] flex items-center gap-1.5">
                <Share className="w-3.5 h-3.5 text-[#168653]" />
                Install on iPhone or iPad Safari:
              </div>
              <ol className="text-[11px] text-[#25352C] list-decimal list-inside space-y-1">
                <li>
                  Tap the Safari <strong className="text-[#168653]">Share</strong> button below.
                </li>
                <li>
                  Scroll and choose <strong className="text-[#168653]">Add to Home Screen</strong>.
                </li>
                <li>Tap <strong className="text-[#168653]">Add</strong> in the top right.</li>
              </ol>
              <button
                onClick={handleDismiss}
                className="w-full mt-2 py-2.5 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white text-xs font-bold transition-all cursor-pointer"
              >
                Got It
              </button>
            </div>
          ) : isInstallable ? (
            <div className="w-full space-y-2">
              <button
                onClick={handleInstallClick}
                disabled={installing}
                className="w-full py-3 px-4 rounded-2xl bg-[#168653] hover:bg-[#126E43] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>{installing ? 'Opening Install Dialog...' : 'Download / Install App'}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
              <button
                onClick={handleDismiss}
                className="w-full py-2 text-xs font-semibold text-[#77857C] hover:text-[#25352C] cursor-pointer"
              >
                Continue in Browser
              </button>
            </div>
          ) : (
            <div className="w-full space-y-2">
              <div className="p-3 rounded-2xl bg-[#F5F9F6] border border-[#E6EDE7] text-[11px] text-[#77857C] text-center">
                To install, use your browser's install icon in the URL address bar or select <strong className="text-[#174D35]">"Install DDLC AI"</strong> in the browser menu.
              </div>
              <button
                onClick={handleDismiss}
                className="w-full py-2.5 rounded-xl bg-[#168653] hover:bg-[#126E43] text-white font-semibold text-xs cursor-pointer"
              >
                Continue to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
