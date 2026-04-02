'use client';

import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface ClinchCelebrationProps {
  teamColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export default function ClinchCelebration({ teamColors }: ClinchCelebrationProps) {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    const colors = [teamColors.primary, teamColors.secondary, teamColors.accent, '#FFD700', '#FFFFFF'];

    // Initial big burst
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.3 },
      colors,
    });

    // Follow-up bursts from sides
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });
    }, 300);

    // One more burst
    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.4 },
        colors,
      });
    }, 700);
  }, []);

  return null;
}
