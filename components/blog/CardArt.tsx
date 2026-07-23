import { findTeam } from '@/lib/teamConfig';

// Fallback card art for posts without a generated image: team-colored gradient
// with a large watermarked logo. Rights-safe and deterministic, so no blog
// card ever renders bare.

const BILLS_ART = {
  logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
  primary: '#00338D',
};

export function getCardArt(team: string): { logo: string; primary: string } {
  if (team === 'bills') return BILLS_ART;
  const config = findTeam(team);
  if (config) return { logo: config.logo, primary: config.colors.primary };
  return { logo: '', primary: '#003087' };
}

export default function CardArt({
  team,
  typeLabel,
  className = '',
}: {
  team: string;
  typeLabel?: string;
  className?: string;
}) {
  const art = getCardArt(team);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(135deg, ${art.primary} 0%, #0a1128 100%)`,
      }}
      aria-hidden="true"
    >
      {/* Oversized watermark logo bleeding off the right edge */}
      {art.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art.logo}
          alt=""
          className="absolute -right-6 -top-4 h-[150%] w-auto opacity-20"
        />
      )}
      {/* Crisp centered logo */}
      {art.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art.logo} alt="" className="relative h-1/2 w-auto drop-shadow-lg" />
      )}
      {typeLabel && (
        <span className="absolute bottom-2 left-3 text-[10px] font-bold uppercase tracking-widest text-white/60">
          {typeLabel}
        </span>
      )}
    </div>
  );
}
