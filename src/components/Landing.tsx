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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

          {/* Detroit Red Wings */}
          <Link
            to="/redwings"
            className="group relative bg-gradient-to-br from-[#CE1126] to-[#a00e1e] rounded-2xl p-8 shadow-2xl border-2 border-white hover:border-gray-200 transition-all duration-300 hover:scale-105 hover:shadow-[#CE1126]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.redwings.logo}
                alt="Detroit Red Wings"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.redwings.city} {TEAMS.redwings.name}
              </h2>
              <p className="text-white font-semibold">View →</p>
            </div>
          </Link>

          {/* Ottawa Senators */}
          <Link
            to="/senators"
            className="group relative bg-gradient-to-br from-[#C52032] to-[#9a1827] rounded-2xl p-8 shadow-2xl border-2 border-[#C8AA76] hover:border-[#d4b885] transition-all duration-300 hover:scale-105 hover:shadow-[#C52032]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.senators.logo}
                alt="Ottawa Senators"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.senators.city} {TEAMS.senators.name}
              </h2>
              <p className="text-[#C8AA76] font-semibold">View →</p>
            </div>
          </Link>

          {/* Florida Panthers */}
          <Link
            to="/panthers"
            className="group relative bg-gradient-to-br from-[#C8102E] to-[#9c0d24] rounded-2xl p-8 shadow-2xl border-2 border-[#B9975B] hover:border-[#c7a66a] transition-all duration-300 hover:scale-105 hover:shadow-[#C8102E]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.panthers.logo}
                alt="Florida Panthers"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.panthers.city} {TEAMS.panthers.name}
              </h2>
              <p className="text-[#B9975B] font-semibold">View →</p>
            </div>
          </Link>

          {/* Toronto Maple Leafs */}
          <Link
            to="/mapleleafs"
            className="group relative bg-gradient-to-br from-[#003E7E] to-[#002f61] rounded-2xl p-8 shadow-2xl border-2 border-white hover:border-gray-200 transition-all duration-300 hover:scale-105 hover:shadow-[#003E7E]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.mapleleafs.logo}
                alt="Toronto Maple Leafs"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.mapleleafs.city} {TEAMS.mapleleafs.name}
              </h2>
              <p className="text-white font-semibold">View →</p>
            </div>
          </Link>

          {/* Tampa Bay Lightning */}
          <Link
            to="/lightning"
            className="group relative bg-gradient-to-br from-[#002868] to-[#001d4d] rounded-2xl p-8 shadow-2xl border-2 border-white hover:border-gray-200 transition-all duration-300 hover:scale-105 hover:shadow-[#002868]/50"
          >
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 p-4 rounded-full bg-white">
                <img
                  src={TEAMS.lightning.logo}
                  alt="Tampa Bay Lightning"
                  className="w-24 h-24 group-hover:scale-110 transition-transform duration-300"
                />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.lightning.city} {TEAMS.lightning.name}
              </h2>
              <p className="text-white font-semibold">View →</p>
            </div>
          </Link>

          {/* Boston Bruins */}
          <Link
            to="/bruins"
            className="group relative bg-gradient-to-br from-[#000000] to-[#1a1a1a] rounded-2xl p-8 shadow-2xl border-2 border-[#FFB81C] hover:border-[#ffc94d] transition-all duration-300 hover:scale-105 hover:shadow-[#FFB81C]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.bruins.logo}
                alt="Boston Bruins"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.bruins.city} {TEAMS.bruins.name}
              </h2>
              <p className="text-[#FFB81C] font-semibold">View →</p>
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
