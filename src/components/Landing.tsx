import { Link } from 'react-router-dom';
import { TEAMS } from '../teamConfig';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            Lindy's Five
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-2">
            Track Your Team's Road to the Playoffs
          </p>
          <p className="text-sm md:text-base text-gray-400">
            5-Game Set Analysis • Target: 6+ points per set
          </p>
        </div>

        {/* Team Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Buffalo Sabres */}
          <Link
            to="/sabres"
            className="group relative bg-gradient-to-br from-[#002654] to-[#001a3d] rounded-2xl p-8 shadow-2xl border-2 border-[#FCB514] hover:border-[#FFD700] transition-all duration-300 hover:scale-105 hover:shadow-[#FCB514]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.sabres.logo}
                alt="Buffalo Sabres"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.sabres.city} {TEAMS.sabres.name}
              </h2>
              <p className="text-[#FCB514] font-semibold">View →</p>
            </div>
          </Link>

          {/* Montreal Canadiens */}
          <Link
            to="/canadiens"
            className="group relative bg-gradient-to-br from-[#AF1E2D] to-[#8a1824] rounded-2xl p-8 shadow-2xl border-2 border-[#192168] hover:border-[#2a3678] transition-all duration-300 hover:scale-105 hover:shadow-[#AF1E2D]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.canadiens.logo}
                alt="Montreal Canadiens"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.canadiens.city} {TEAMS.canadiens.name}
              </h2>
              <p className="text-white font-semibold">View →</p>
            </div>
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-400 text-sm">
          <p className="mb-2">More teams coming soon.</p>
          <p>© {new Date().getFullYear()} JRR Apps. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
