'use client';

import { useEffect, useState } from 'react';

export default function SteamEffect() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <style jsx>{`
        @keyframes steam-rise {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.4);
          }
          15% {
            opacity: 0.6;
          }
          50% {
            opacity: 0.3;
            transform: translateY(-18px) scale(0.8);
          }
          100% {
            opacity: 0;
            transform: translateY(-35px) scale(1.2);
          }
        }
        @keyframes steam-rise-2 {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.3) translateX(2px);
          }
          20% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.25;
            transform: translateY(-20px) scale(0.7) translateX(-3px);
          }
          100% {
            opacity: 0;
            transform: translateY(-40px) scale(1) translateX(1px);
          }
        }
        @keyframes steam-rise-3 {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.35);
          }
          10% {
            opacity: 0.4;
          }
          60% {
            opacity: 0.2;
            transform: translateY(-15px) scale(0.6);
          }
          100% {
            opacity: 0;
            transform: translateY(-30px) scale(0.9);
          }
        }
        .steam-puff-1 {
          animation: steam-rise 2.5s ease-out infinite;
        }
        .steam-puff-2 {
          animation: steam-rise-2 3s ease-out infinite;
          animation-delay: 0.8s;
        }
        .steam-puff-3 {
          animation: steam-rise-3 2.8s ease-out infinite;
          animation-delay: 1.5s;
        }
        .steam-puff-4 {
          animation: steam-rise 3.2s ease-out infinite;
          animation-delay: 0.4s;
        }
        .steam-puff-5 {
          animation: steam-rise-2 2.6s ease-out infinite;
          animation-delay: 1.2s;
        }
        .steam-puff-6 {
          animation: steam-rise-3 2.9s ease-out infinite;
          animation-delay: 2s;
        }
      `}</style>
      {/* Left nostril steam */}
      <div className="absolute pointer-events-none" style={{ bottom: '18%', left: '22%' }}>
        <div className="steam-puff-1 absolute rounded-full" style={{ width: 8, height: 8, background: 'radial-gradient(circle, rgba(255,255,255,0.5), transparent)', filter: 'blur(3px)' }} />
        <div className="steam-puff-2 absolute rounded-full" style={{ width: 6, height: 6, left: -3, background: 'radial-gradient(circle, rgba(255,255,255,0.4), transparent)', filter: 'blur(2px)' }} />
        <div className="steam-puff-3 absolute rounded-full" style={{ width: 7, height: 7, left: 2, background: 'radial-gradient(circle, rgba(255,255,255,0.35), transparent)', filter: 'blur(3px)' }} />
      </div>
      {/* Right nostril steam */}
      <div className="absolute pointer-events-none" style={{ bottom: '22%', left: '32%' }}>
        <div className="steam-puff-4 absolute rounded-full" style={{ width: 7, height: 7, background: 'radial-gradient(circle, rgba(255,255,255,0.45), transparent)', filter: 'blur(3px)' }} />
        <div className="steam-puff-5 absolute rounded-full" style={{ width: 5, height: 5, left: 3, background: 'radial-gradient(circle, rgba(255,255,255,0.35), transparent)', filter: 'blur(2px)' }} />
        <div className="steam-puff-6 absolute rounded-full" style={{ width: 6, height: 6, left: -2, background: 'radial-gradient(circle, rgba(255,255,255,0.3), transparent)', filter: 'blur(3px)' }} />
      </div>
    </>
  );
}
