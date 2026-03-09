interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl transform transition-all bg-white"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with gradient */}
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 md:px-12 py-8 rounded-t-2xl">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg transition-colors hover:bg-slate-700 text-gray-400 hover:text-white"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <h2
              className="text-3xl md:text-4xl font-bold text-white"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              About Lindy's Five
            </h2>
          </div>

          {/* Content */}
          <div className="px-8 md:px-12 py-8">
            <div className="space-y-6 text-left">
              <p className="text-gray-700 text-left">
                The "Lindy's Five" philosophy comes from Buffalo Sabres head coach Lindy Ruff's approach to the 2024-25 season: break the 82-game marathon into manageable 5-game sets.
              </p>

              <div>
                <h3
                  className="text-xl font-bold mb-3 text-gray-900 text-left"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  The Strategy
                </h3>
                <p className="text-gray-700 text-left">
                  Instead of obsessing over every single game, Ruff encouraged fans and players to think in chunks. The goal? <strong className="text-[#002654]">6+ points per 5-game set.</strong> That pace (averaging 1.17 points per game) projects to approximately 96 points over a full season—historically a strong playoff position.
                </p>
              </div>

              <div>
                <h3
                  className="text-xl font-bold mb-3 text-gray-900 text-left"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  Why It Works
                </h3>
                <p className="mb-3 text-gray-700 text-left">
                  This mindset shift accomplishes several things:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 text-left">
                  <li><strong className="text-gray-900">Reduces pressure</strong> - One loss won't sink the season</li>
                  <li><strong className="text-gray-900">Provides perspective</strong> - Track progress in 5-game chunks</li>
                  <li><strong className="text-gray-900">Creates checkpoints</strong> - Regular performance reviews</li>
                  <li><strong className="text-gray-900">Builds momentum</strong> - String together winning sets</li>
                </ul>
              </div>

              <div>
                <h3
                  className="text-xl font-bold mb-3 text-gray-900 text-left"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  The Tool
                </h3>
                <p className="text-gray-700 text-left">
                  Lindy's Five tracks your team's performance across every 5-game set throughout the season. See completed sets, current progress, and upcoming games at a glance. Target that 6-point benchmark and watch your team's playoff chances crystallize.
                </p>
              </div>

              <div>
                <h3
                  className="text-xl font-bold mb-3 text-gray-900 text-left"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  Explore the Features
                </h3>
                <ul className="list-disc list-inside space-y-2 text-gray-700 text-left">
                  <li><strong className="text-gray-900">What-If Mode</strong> - Test different scenarios by adjusting future game outcomes to see how they impact your team's point totals and set performance</li>
                  <li><strong className="text-gray-900">vs Last Year</strong> - Compare your team's current season performance against last year's results at the same point in the schedule</li>
                </ul>
              </div>

              <p className="italic text-gray-600 text-left">
                Whether you're tracking the Sabres or any of the other 31 NHL teams, Lindy's Five gives you a fresh way to follow the season—one set at a time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
