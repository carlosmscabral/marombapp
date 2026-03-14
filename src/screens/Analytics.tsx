import { MoreVertical, Trophy, Activity, Calendar, ChevronRight, ArrowRight } from 'lucide-react';
import { SignatureBar } from '../components/Layout';

const data = [
  { name: 'Chest & Shoulders', value: 42, color: '#6ab2ff' },
  { name: 'Back & Core', value: 38, color: '#ff716c' },
  { name: 'Legs & Glutes', value: 48, color: '#ffeb3b' },
];

export function Analytics() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10">
      {/* Kinetic Performance Hero Section (Bento Style) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Chart Card: Sets per Muscle Group */}
        <div className="md:col-span-2 bg-surface-container-low rounded-xl overflow-hidden relative group">
          <SignatureBar />
          <div className="p-6">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="font-headline text-2xl font-bold">Weekly Distribution</h2>
                <p className="text-on-surface-variant text-sm font-label">Total Volume: 142 Sets</p>
              </div>
              <MoreVertical className="text-outline w-6 h-6" />
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-10">
              {/* Kinetic Ring Visualization */}
              <div className="relative w-48 h-48 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full kinetic-ring opacity-20"></div>
                <div className="absolute inset-2 rounded-full kinetic-ring"></div>
                <div className="absolute inset-8 rounded-full bg-surface-container-low flex flex-col items-center justify-center z-10">
                  <span className="font-headline text-4xl font-bold text-primary">74%</span>
                  <span className="text-[10px] font-label tracking-widest text-on-surface-variant uppercase">Efficiency</span>
                </div>
              </div>
              
              {/* Legend Items */}
              <div className="flex-1 w-full space-y-4">
                {data.map((item) => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex justify-between items-center text-sm font-label">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span>{item.name}</span>
                      </div>
                      <span className="font-headline font-semibold">{item.value} Sets</span>
                    </div>
                    <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
                      <div 
                        className="h-full" 
                        style={{ backgroundColor: item.color, width: `${(item.value / 142) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Column */}
        <div className="space-y-6">
          {/* PR Box */}
          <div className="bg-surface-container-high p-6 rounded-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full flex items-center justify-center">
              <Trophy className="text-primary w-6 h-6 fill-primary/20" />
            </div>
            <p className="text-[10px] font-label tracking-[0.2em] text-on-surface-variant uppercase mb-2">New Personal Record</p>
            <h3 className="font-headline text-3xl font-bold flex items-baseline gap-2">
              140 <span className="text-xs font-label font-normal text-on-surface-variant uppercase tracking-widest">kg</span>
            </h3>
            <p className="text-sm font-label mt-1">Deadlift Max</p>
            <div className="mt-4 bg-primary/20 text-primary-dim text-[10px] font-bold py-1 px-3 rounded-full inline-block">
              +15% FROM LAST MONTH
            </div>
          </div>

          {/* Recovery Score */}
          <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-secondary">
            <p className="text-[10px] font-label tracking-[0.2em] text-on-surface-variant uppercase mb-2">Recovery Status</p>
            <div className="flex items-center gap-4">
              <Activity className="text-secondary w-8 h-8" />
              <div>
                <h3 className="font-headline text-2xl font-bold">Optimal</h3>
                <p className="text-xs font-label text-on-surface-variant">Ready for High Intensity</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workout History Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-xl font-semibold tracking-tight">Recent Sessions</h2>
          <button className="text-primary text-xs font-label font-bold tracking-widest uppercase flex items-center gap-2">
            View Full History <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {/* History Item 1 */}
          <div className="bg-surface-container-low group hover:bg-surface-container-high transition-colors rounded-xl overflow-hidden flex flex-col md:flex-row items-stretch">
            <div className="w-full md:w-1.5 h-1 md:h-auto signature-bar flex-row md:flex-col">
              <div className="bar-blue"></div><div className="bar-red"></div><div className="bar-yellow"></div><div className="bar-green"></div>
            </div>
            <div className="p-5 flex-1 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-xl bg-surface-bright flex items-center justify-center">
                  <Calendar className="text-primary w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-headline font-semibold text-lg">Push Day - Hypertrophy</h4>
                  <p className="text-xs font-label text-on-surface-variant">Today • 1h 12m • 2,450 kg Volume</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-surface-container-highest rounded-lg text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Chest</span>
                <span className="px-3 py-1 bg-surface-container-highest rounded-lg text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Triceps</span>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs font-label text-on-surface-variant uppercase tracking-tighter">Intensity</p>
                  <div className="flex gap-0.5 mt-1">
                    <div className="w-3 h-1 bg-primary rounded-full"></div>
                    <div className="w-3 h-1 bg-primary rounded-full"></div>
                    <div className="w-3 h-1 bg-primary rounded-full"></div>
                    <div className="w-3 h-1 bg-primary rounded-full"></div>
                    <div className="w-3 h-1 bg-surface-container-highest rounded-full"></div>
                  </div>
                </div>
                <button className="w-10 h-10 rounded-full border border-outline-variant/30 flex items-center justify-center hover:bg-primary hover:border-primary group/btn transition-all">
                  <ChevronRight className="w-5 h-5 text-outline group-hover/btn:text-on-primary" />
                </button>
              </div>
            </div>
          </div>

          {/* History Item 2 */}
          <div className="bg-surface-container-low group hover:bg-surface-container-high transition-colors rounded-xl overflow-hidden flex flex-col md:flex-row items-stretch">
            <div className="w-full md:w-1.5 h-1 md:h-auto signature-bar flex-row md:flex-col">
              <div className="bar-blue"></div><div className="bar-red"></div><div className="bar-yellow"></div><div className="bar-green"></div>
            </div>
            <div className="p-5 flex-1 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-xl bg-surface-bright flex items-center justify-center">
                  <Calendar className="text-secondary w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-headline font-semibold text-lg">Heavy Pull Session</h4>
                  <p className="text-xs font-label text-on-surface-variant">Yesterday • 58m • 3,100 kg Volume</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-surface-container-highest rounded-lg text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Back</span>
                <span className="px-3 py-1 bg-surface-container-highest rounded-lg text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Biceps</span>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs font-label text-on-surface-variant uppercase tracking-tighter">Intensity</p>
                  <div className="flex gap-0.5 mt-1">
                    <div className="w-3 h-1 bg-secondary rounded-full"></div>
                    <div className="w-3 h-1 bg-secondary rounded-full"></div>
                    <div className="w-3 h-1 bg-secondary rounded-full"></div>
                    <div className="w-3 h-1 bg-secondary rounded-full"></div>
                    <div className="w-3 h-1 bg-secondary rounded-full"></div>
                  </div>
                </div>
                <button className="w-10 h-10 rounded-full border border-outline-variant/30 flex items-center justify-center hover:bg-secondary hover:border-secondary group/btn transition-all">
                  <ChevronRight className="w-5 h-5 text-outline group-hover/btn:text-on-secondary" />
                </button>
              </div>
            </div>
          </div>

          {/* History Item 3 */}
          <div className="bg-surface-container-low group hover:bg-surface-container-high transition-colors rounded-xl overflow-hidden flex flex-col md:flex-row items-stretch">
            <div className="w-full md:w-1.5 h-1 md:h-auto signature-bar flex-row md:flex-col">
              <div className="bar-blue"></div><div className="bar-red"></div><div className="bar-yellow"></div><div className="bar-green"></div>
            </div>
            <div className="p-5 flex-1 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-xl bg-surface-bright flex items-center justify-center">
                  <Calendar className="text-tertiary-fixed w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-headline font-semibold text-lg">Leg Destruction</h4>
                  <p className="text-xs font-label text-on-surface-variant">3 days ago • 1h 25m • 5,600 kg Volume</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-surface-container-highest rounded-lg text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Quads</span>
                <span className="px-3 py-1 bg-surface-container-highest rounded-lg text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Hamstrings</span>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs font-label text-on-surface-variant uppercase tracking-tighter">Intensity</p>
                  <div className="flex gap-0.5 mt-1">
                    <div className="w-3 h-1 bg-tertiary-fixed rounded-full"></div>
                    <div className="w-3 h-1 bg-tertiary-fixed rounded-full"></div>
                    <div className="w-3 h-1 bg-tertiary-fixed rounded-full"></div>
                    <div className="w-3 h-1 bg-tertiary-fixed rounded-full"></div>
                    <div className="w-3 h-1 bg-surface-container-highest rounded-full"></div>
                  </div>
                </div>
                <button className="w-10 h-10 rounded-full border border-outline-variant/30 flex items-center justify-center hover:bg-tertiary-fixed hover:border-tertiary-fixed group/btn transition-all">
                  <ChevronRight className="w-5 h-5 text-outline group-hover/btn:text-on-tertiary-fixed" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
