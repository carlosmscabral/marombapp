import { CheckCircle2, Plus, History, Info, GripHorizontal, Flag } from 'lucide-react';

export function InGym() {
  return (
    <div className="px-4 py-6 space-y-8 max-w-2xl mx-auto w-full">
      {/* Large Sticky Timer & Status */}
      <section className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-surface-container-highest border border-outline-variant/20">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
          <span className="text-[10px] font-label font-bold tracking-[0.2em] uppercase text-secondary">Active Session</span>
        </div>
        <div className="flex items-center justify-center gap-4">
          <span className="font-headline text-7xl font-extrabold tracking-tighter text-white">42:18</span>
        </div>
        <p className="font-label text-sm text-on-surface-variant tracking-wide">Lower Body Hypertrophy • Thursday Session</p>
      </section>

      {/* Signature Kinetic Bar */}
      <div className="flex h-1 w-full rounded-full overflow-hidden">
        <span className="bg-primary flex-1"></span>
        <span className="bg-secondary flex-1"></span>
        <span className="bg-tertiary-fixed flex-1"></span>
        <span className="bg-primary-dim flex-1"></span>
      </div>

      {/* Exercise Focus: Squats */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <span className="font-label text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Current Exercise</span>
            <h2 className="font-headline text-3xl font-bold">Squats</h2>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-headline text-xl font-bold text-tertiary-fixed">120<span className="text-xs ml-1 text-on-surface-variant font-label">kg</span></span>
            <span className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Previous Best</span>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-xl overflow-hidden border-t-4 border-primary shadow-2xl">
          <div className="p-6 space-y-6">
            {/* Set Headers */}
            <div className="grid grid-cols-4 text-[10px] font-label font-black uppercase tracking-widest text-on-surface-variant/60">
              <div className="text-center">Set</div>
              <div className="text-center">Kg</div>
              <div className="text-center">Reps</div>
              <div className="text-center">Status</div>
            </div>

            {/* Set 1 (Completed) */}
            <div className="grid grid-cols-4 items-center py-2 bg-surface-container-highest/30 rounded-lg">
              <div className="text-center font-headline font-bold">1</div>
              <div className="text-center font-headline font-medium">100</div>
              <div className="text-center font-headline font-medium">10</div>
              <div className="flex justify-center">
                <CheckCircle2 className="text-primary w-6 h-6 fill-primary/20" />
              </div>
            </div>

            {/* Set 2 (Active/Current) */}
            <div className="grid grid-cols-4 items-center py-4 bg-surface-bright rounded-xl border border-primary/30 pulse-glow">
              <div className="text-center font-headline font-extrabold text-xl text-primary">2</div>
              <div className="px-2">
                <input 
                  className="w-full bg-surface-container-low border-none border-b-2 border-primary text-center font-headline text-xl font-bold focus:ring-0 focus:border-tertiary-fixed outline-none" 
                  type="number" 
                  defaultValue="105" 
                />
              </div>
              <div className="px-2">
                <input 
                  className="w-full bg-surface-container-low border-none border-b-2 border-primary text-center font-headline text-xl font-bold focus:ring-0 focus:border-tertiary-fixed outline-none" 
                  type="number" 
                  defaultValue="8" 
                />
              </div>
              <div className="flex justify-center">
                <button className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary hover:bg-primary-dim transition-colors">
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Set 3 (Upcoming) */}
            <div className="grid grid-cols-4 items-center py-2 opacity-40">
              <div className="text-center font-headline font-bold">3</div>
              <div className="text-center font-headline font-medium">105</div>
              <div className="text-center font-headline font-medium">8</div>
              <div className="flex justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-outline"></div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-high p-4 flex justify-between items-center">
            <button className="flex items-center gap-2 text-primary font-label text-sm font-bold hover:text-primary-dim transition-colors">
              <History className="w-4 h-4" />
              View History
            </button>
            <button className="flex items-center gap-2 text-on-surface-variant font-label text-sm font-bold hover:text-on-surface transition-colors">
              <Info className="w-4 h-4" />
              Form Guide
            </button>
          </div>
        </div>
      </section>

      {/* Queue List */}
      <section className="space-y-4">
        <h3 className="font-headline text-sm font-bold tracking-widest uppercase text-on-surface-variant/60">Coming Up Next</h3>
        <div className="space-y-3">
          {/* Exercise 2 */}
          <div className="group flex items-center justify-between p-4 bg-surface-container-low rounded-xl transition-all hover:bg-surface-container-high border-l-2 border-secondary">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center font-headline font-bold text-secondary">2</div>
              <div>
                <p className="font-headline font-semibold">Leg Press 45°</p>
                <p className="text-xs text-on-surface-variant">4 Sets • 10-12 Reps</p>
              </div>
            </div>
            <GripHorizontal className="text-outline w-5 h-5" />
          </div>

          {/* Exercise 3 */}
          <div className="group flex items-center justify-between p-4 bg-surface-container-low rounded-xl transition-all hover:bg-surface-container-high border-l-2 border-tertiary-fixed">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center font-headline font-bold text-tertiary-fixed">3</div>
              <div>
                <p className="font-headline font-semibold">Leg Extensions</p>
                <p className="text-xs text-on-surface-variant">3 Sets • AMRAP</p>
              </div>
            </div>
            <GripHorizontal className="text-outline w-5 h-5" />
          </div>
        </div>
      </section>

      {/* Primary CTA Area */}
      <div className="pt-8 pb-20">
        <button className="w-full py-5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-headline font-black text-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-3 hover:opacity-90 transition-opacity">
          FINISH WORKOUT
          <Flag className="w-5 h-5 fill-current" />
        </button>
        <p className="text-center mt-4 font-label text-[10px] text-on-surface-variant uppercase tracking-[0.3em]">Intensity Level: High</p>
      </div>
    </div>
  );
}
