'use client';

interface TrainerOverviewProps {
  hasBuild: boolean;
  buildName?: string | null;
  buildCats?: string[];
  onCreateBuild: () => void;
  onShareProfile: () => void;
}

export default function TrainerOverview({ hasBuild, buildName, buildCats = [], onCreateBuild, onShareProfile }: TrainerOverviewProps) {
  return (
    <div className="grid gap-4 sm:gap-5">
      {/* Signature Build - PRIMARY */}
      <section className="group relative rounded-2xl overflow-hidden">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/25 to-blue-500/25 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-all duration-300" />
        <div className="relative bg-gradient-to-br from-purple-600/12 via-purple-900/25 to-purple-950/40 rounded-2xl p-5 backdrop-blur-sm transition-all duration-300">
          <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5">⚔️ Signature Build</h3>
          {hasBuild ? (
            <>
              <p className="text-sm text-gray-400 mb-2.5">{buildName || 'Your elite team composition'}</p>
              {buildCats.length > 0 ? (
                <p className="text-xs text-gray-500 mb-3.5">{buildCats.slice(0, 3).join(' • ')}</p>
              ) : null}
              <button
                type="button"
                onClick={onCreateBuild}
                className="group/btn relative"
              >
                <div className="absolute -inset-0.5 bg-amber-400/25 rounded-lg blur-md opacity-0 group-hover/btn:opacity-100 transition-all" />
                <div className="relative px-5 py-2 rounded-lg bg-gradient-to-b from-amber-400 to-amber-500 text-black font-bold text-sm shadow-md shadow-amber-500/25 group-active/btn:scale-95 transition-all">
                  Edit Build
                </div>
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-3.5">Design your signature team composition</p>
              <button
                type="button"
                onClick={onCreateBuild}
                className="group/btn relative"
              >
                <div className="absolute -inset-0.5 bg-amber-400/25 rounded-lg blur-md opacity-0 group-hover/btn:opacity-100 transition-all" />
                <div className="relative px-6 py-2 rounded-lg bg-gradient-to-b from-amber-400 to-amber-500 text-black font-bold text-sm shadow-md shadow-amber-500/25 group-active/btn:scale-95 transition-all">
                  Create Build
                </div>
              </button>
            </>
          )}
        </div>
      </section>

      {/* Share Profile - SECONDARY (minimal weight) */}
      <section className="group relative rounded-xl overflow-hidden">
        <div className="relative bg-purple-500/5 rounded-xl p-4 transition-all">
          <h3 className="text-sm font-bold text-white/90 mb-1">👥 Share Your Profile</h3>
          <p className="text-xs text-gray-500 mb-2.5">Show your arena identity to the world</p>
          <button
            type="button"
            onClick={onShareProfile}
            className="px-3.5 py-1.5 rounded-lg border border-purple-400/20 text-xs text-gray-400 hover:text-white hover:border-purple-400/35 hover:bg-purple-500/5 transition-all"
          >
            Copy Link
          </button>
        </div>
      </section>
    </div>
  );
}
