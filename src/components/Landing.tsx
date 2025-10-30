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

        {/* Buffalo Sabres - Featured */}
        <div className="flex justify-center mb-16">
          <Link
            to="/sabres"
            className="group relative bg-gradient-to-br from-[#002654] to-[#001a3d] rounded-2xl p-12 shadow-2xl border-4 border-[#FCB514] hover:border-[#FFD700] transition-all duration-300 hover:scale-105 hover:shadow-[#FCB514]/50 w-full max-w-md"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.sabres.logo}
                alt="Buffalo Sabres"
                className="w-40 h-40 mb-8 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-3" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.sabres.city} {TEAMS.sabres.name}
              </h2>
              <p className="text-[#FCB514] font-bold text-lg">View →</p>
            </div>
          </Link>
        </div>

        {/* Everyone Else Section */}
        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-400 text-center mb-12" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            Everyone Else
          </h2>

          {/* All teams alphabetically by city */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Anaheim Ducks */}
          <Link
            to="/ducks"
            className="group relative bg-gradient-to-br from-[#F47A38] to-[#d66530] rounded-2xl p-8 shadow-2xl border-2 border-[#B9975B] hover:border-[#c7a66a] transition-all duration-300 hover:scale-105 hover:shadow-[#F47A38]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.ducks.logo}
                alt="Anaheim Ducks"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.ducks.city} {TEAMS.ducks.name}
              </h2>
              <p className="text-[#B9975B] font-semibold">View →</p>
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

          {/* Calgary Flames */}
          <Link
            to="/flames"
            className="group relative bg-gradient-to-br from-[#C8102E] to-[#9c0d24] rounded-2xl p-8 shadow-2xl border-2 border-[#F1BE48] hover:border-[#f4ca66] transition-all duration-300 hover:scale-105 hover:shadow-[#C8102E]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.flames.logo}
                alt="Calgary Flames"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.flames.city} {TEAMS.flames.name}
              </h2>
              <p className="text-[#F1BE48] font-semibold">View →</p>
            </div>
          </Link>

          {/* Carolina Hurricanes */}
          <Link
            to="/hurricanes"
            className="group relative bg-gradient-to-br from-[#CE1126] to-[#a00e1e] rounded-2xl p-8 shadow-2xl border-2 border-[#000000] hover:border-[#1a1a1a] transition-all duration-300 hover:scale-105 hover:shadow-[#CE1126]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.hurricanes.logo}
                alt="Carolina Hurricanes"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.hurricanes.city} {TEAMS.hurricanes.name}
              </h2>
              <p className="text-white font-semibold">View →</p>
            </div>
          </Link>

          {/* Chicago Blackhawks */}
          <Link
            to="/blackhawks"
            className="group relative bg-gradient-to-br from-[#CF0A2C] to-[#a00822] rounded-2xl p-8 shadow-2xl border-2 border-[#000000] hover:border-[#1a1a1a] transition-all duration-300 hover:scale-105 hover:shadow-[#CF0A2C]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.blackhawks.logo}
                alt="Chicago Blackhawks"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.blackhawks.city} {TEAMS.blackhawks.name}
              </h2>
              <p className="text-white font-semibold">View →</p>
            </div>
          </Link>

          {/* Columbus Blue Jackets */}
          <Link
            to="/bluejackets"
            className="group relative bg-gradient-to-br from-[#002654] to-[#001b3d] rounded-2xl p-8 shadow-2xl border-2 border-[#CE1126] hover:border-[#e11936] transition-all duration-300 hover:scale-105 hover:shadow-[#CE1126]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.bluejackets.logo}
                alt="Columbus Blue Jackets"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.bluejackets.city} {TEAMS.bluejackets.name}
              </h2>
              <p className="text-[#CE1126] font-semibold">View →</p>
            </div>
          </Link>

          {/* Colorado Avalanche */}
          <Link
            to="/avalanche"
            className="group relative bg-gradient-to-br from-[#6F263D] to-[#561d30] rounded-2xl p-8 shadow-2xl border-2 border-[#236192] hover:border-[#3477ad] transition-all duration-300 hover:scale-105 hover:shadow-[#236192]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.avalanche.logo}
                alt="Colorado Avalanche"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.avalanche.city} {TEAMS.avalanche.name}
              </h2>
              <p className="text-[#236192] font-semibold">View →</p>
            </div>
          </Link>

          {/* Dallas Stars */}
          <Link
            to="/stars"
            className="group relative bg-gradient-to-br from-[#006847] to-[#004d35] rounded-2xl p-8 shadow-2xl border-2 border-[#8F8F8C] hover:border-[#a5a5a2] transition-all duration-300 hover:scale-105 hover:shadow-[#8F8F8C]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.stars.logo}
                alt="Dallas Stars"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.stars.city} {TEAMS.stars.name}
              </h2>
              <p className="text-[#8F8F8C] font-semibold">View →</p>
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

          {/* Edmonton Oilers */}
          <Link
            to="/oilers"
            className="group relative bg-gradient-to-br from-[#041E42] to-[#02152e] rounded-2xl p-8 shadow-2xl border-2 border-[#FF4C00] hover:border-[#ff6a2e] transition-all duration-300 hover:scale-105 hover:shadow-[#FF4C00]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.oilers.logo}
                alt="Edmonton Oilers"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.oilers.city} {TEAMS.oilers.name}
              </h2>
              <p className="text-[#FF4C00] font-semibold">View →</p>
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

          {/* Los Angeles Kings */}
          <Link
            to="/kings"
            className="group relative bg-gradient-to-br from-[#111111] to-[#000000] rounded-2xl p-8 shadow-2xl border-2 border-[#A2AAAD] hover:border-[#b5bcc0] transition-all duration-300 hover:scale-105 hover:shadow-[#A2AAAD]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.kings.logo}
                alt="Los Angeles Kings"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.kings.city} {TEAMS.kings.name}
              </h2>
              <p className="text-[#A2AAAD] font-semibold">View →</p>
            </div>
          </Link>

          {/* Minnesota Wild */}
          <Link
            to="/wild"
            className="group relative bg-gradient-to-br from-[#154734] to-[#0f3526] rounded-2xl p-8 shadow-2xl border-2 border-[#A6192E] hover:border-[#bf1f37] transition-all duration-300 hover:scale-105 hover:shadow-[#A6192E]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.wild.logo}
                alt="Minnesota Wild"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.wild.city} {TEAMS.wild.name}
              </h2>
              <p className="text-[#A6192E] font-semibold">View →</p>
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

          {/* Nashville Predators */}
          <Link
            to="/predators"
            className="group relative bg-gradient-to-br from-[#FFB81C] to-[#d99915] rounded-2xl p-8 shadow-2xl border-2 border-[#041E42] hover:border-[#072d5c] transition-all duration-300 hover:scale-105 hover:shadow-[#FFB81C]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.predators.logo}
                alt="Nashville Predators"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.predators.city} {TEAMS.predators.name}
              </h2>
              <p className="text-[#041E42] font-semibold">View →</p>
            </div>
          </Link>

          {/* New Jersey Devils */}
          <Link
            to="/devils"
            className="group relative bg-gradient-to-br from-[#CE1126] to-[#a00e1e] rounded-2xl p-8 shadow-2xl border-2 border-[#000000] hover:border-[#1a1a1a] transition-all duration-300 hover:scale-105 hover:shadow-[#CE1126]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.devils.logo}
                alt="New Jersey Devils"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.devils.city} {TEAMS.devils.name}
              </h2>
              <p className="text-white font-semibold">View →</p>
            </div>
          </Link>

          {/* New York Islanders */}
          <Link
            to="/islanders"
            className="group relative bg-gradient-to-br from-[#00539B] to-[#003d75] rounded-2xl p-8 shadow-2xl border-2 border-[#F47D30] hover:border-[#f59050] transition-all duration-300 hover:scale-105 hover:shadow-[#F47D30]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.islanders.logo}
                alt="New York Islanders"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.islanders.city} {TEAMS.islanders.name}
              </h2>
              <p className="text-[#F47D30] font-semibold">View →</p>
            </div>
          </Link>

          {/* New York Rangers */}
          <Link
            to="/rangers"
            className="group relative bg-gradient-to-br from-[#0038A8] to-[#002a7f] rounded-2xl p-8 shadow-2xl border-2 border-[#CE1126] hover:border-[#e11936] transition-all duration-300 hover:scale-105 hover:shadow-[#CE1126]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.rangers.logo}
                alt="New York Rangers"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.rangers.city} {TEAMS.rangers.name}
              </h2>
              <p className="text-[#CE1126] font-semibold">View →</p>
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

          {/* Philadelphia Flyers */}
          <Link
            to="/flyers"
            className="group relative bg-gradient-to-br from-[#F74902] to-[#c93a02] rounded-2xl p-8 shadow-2xl border-2 border-[#000000] hover:border-[#1a1a1a] transition-all duration-300 hover:scale-105 hover:shadow-[#F74902]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.flyers.logo}
                alt="Philadelphia Flyers"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.flyers.city} {TEAMS.flyers.name}
              </h2>
              <p className="text-white font-semibold">View →</p>
            </div>
          </Link>

          {/* Pittsburgh Penguins */}
          <Link
            to="/penguins"
            className="group relative bg-gradient-to-br from-[#000000] to-[#1a1a1a] rounded-2xl p-8 shadow-2xl border-2 border-[#FCB514] hover:border-[#ffc94d] transition-all duration-300 hover:scale-105 hover:shadow-[#FCB514]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.penguins.logo}
                alt="Pittsburgh Penguins"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.penguins.city} {TEAMS.penguins.name}
              </h2>
              <p className="text-[#FCB514] font-semibold">View →</p>
            </div>
          </Link>

          {/* San Jose Sharks */}
          <Link
            to="/sharks"
            className="group relative bg-gradient-to-br from-[#006D75] to-[#005159] rounded-2xl p-8 shadow-2xl border-2 border-[#EA7200] hover:border-[#ff8619] transition-all duration-300 hover:scale-105 hover:shadow-[#006D75]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.sharks.logo}
                alt="San Jose Sharks"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.sharks.city} {TEAMS.sharks.name}
              </h2>
              <p className="text-[#EA7200] font-semibold">View →</p>
            </div>
          </Link>

          {/* Seattle Kraken */}
          <Link
            to="/kraken"
            className="group relative bg-gradient-to-br from-[#001628] to-[#000a14] rounded-2xl p-8 shadow-2xl border-2 border-[#96D8D8] hover:border-[#adeaea] transition-all duration-300 hover:scale-105 hover:shadow-[#96D8D8]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.kraken.logo}
                alt="Seattle Kraken"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.kraken.city} {TEAMS.kraken.name}
              </h2>
              <p className="text-[#96D8D8] font-semibold">View →</p>
            </div>
          </Link>

          {/* St. Louis Blues */}
          <Link
            to="/blues"
            className="group relative bg-gradient-to-br from-[#002F87] to-[#00226b] rounded-2xl p-8 shadow-2xl border-2 border-[#FCB514] hover:border-[#fdc845] transition-all duration-300 hover:scale-105 hover:shadow-[#FCB514]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.blues.logo}
                alt="St. Louis Blues"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.blues.city} {TEAMS.blues.name}
              </h2>
              <p className="text-[#FCB514] font-semibold">View →</p>
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

          {/* Utah Mammoth */}
          <Link
            to="/utah"
            className="group relative bg-gradient-to-br from-[#69B3E7] to-[#4a9cd4] rounded-2xl p-8 shadow-2xl border-2 border-[#000000] hover:border-[#1a1a1a] transition-all duration-300 hover:scale-105 hover:shadow-[#69B3E7]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.utah.logo}
                alt="Utah Mammoth"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.utah.city} {TEAMS.utah.name}
              </h2>
              <p className="text-white font-semibold">View →</p>
            </div>
          </Link>

          {/* Vancouver Canucks */}
          <Link
            to="/canucks"
            className="group relative bg-gradient-to-br from-[#00205B] to-[#001543] rounded-2xl p-8 shadow-2xl border-2 border-[#00843D] hover:border-[#00a04c] transition-all duration-300 hover:scale-105 hover:shadow-[#00843D]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.canucks.logo}
                alt="Vancouver Canucks"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.canucks.city} {TEAMS.canucks.name}
              </h2>
              <p className="text-[#00843D] font-semibold">View →</p>
            </div>
          </Link>

          {/* Vegas Golden Knights */}
          <Link
            to="/goldenknights"
            className="group relative bg-gradient-to-br from-[#333F42] to-[#1f2628] rounded-2xl p-8 shadow-2xl border-2 border-[#B4975A] hover:border-[#c5a96f] transition-all duration-300 hover:scale-105 hover:shadow-[#B4975A]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.goldenknights.logo}
                alt="Vegas Golden Knights"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.goldenknights.city} {TEAMS.goldenknights.name}
              </h2>
              <p className="text-[#B4975A] font-semibold">View →</p>
            </div>
          </Link>

          {/* Washington Capitals */}
          <Link
            to="/capitals"
            className="group relative bg-gradient-to-br from-[#041E42] to-[#02152e] rounded-2xl p-8 shadow-2xl border-2 border-[#C8102E] hover:border-[#d91b36] transition-all duration-300 hover:scale-105 hover:shadow-[#C8102E]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.capitals.logo}
                alt="Washington Capitals"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.capitals.city} {TEAMS.capitals.name}
              </h2>
              <p className="text-[#C8102E] font-semibold">View →</p>
            </div>
          </Link>

          {/* Winnipeg Jets */}
          <Link
            to="/jets"
            className="group relative bg-gradient-to-br from-[#041E42] to-[#02152e] rounded-2xl p-8 shadow-2xl border-2 border-[#AC162C] hover:border-[#c51b36] transition-all duration-300 hover:scale-105 hover:shadow-[#AC162C]/50"
          >
            <div className="flex flex-col items-center text-center">
              <img
                src={TEAMS.jets.logo}
                alt="Winnipeg Jets"
                className="w-32 h-32 mb-6 group-hover:scale-110 transition-transform duration-300"
              />
              <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {TEAMS.jets.city} {TEAMS.jets.name}
              </h2>
              <p className="text-[#AC162C] font-semibold">View →</p>
            </div>
          </Link>
          </div>
        </div>

        {/* Footer - KEEP THIS */}
        <div className="text-center mt-12 text-gray-400 text-sm">
          <p>© {new Date().getFullYear()} JRR Apps. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
