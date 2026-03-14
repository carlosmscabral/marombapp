import { Timer, Dumbbell, Link as LinkIcon, GripVertical, PlusCircle, Play } from 'lucide-react';
import { SignatureBar } from '../components/Layout';

export function Plan() {
  return (
    <div className="px-4 py-6 space-y-10 max-w-4xl mx-auto w-full">
      {/* Header Section */}
      <section className="space-y-2">
        <p className="text-primary font-label text-sm tracking-[0.2em] uppercase">Current Routine</p>
        <h2 className="font-headline text-4xl font-bold tracking-tight">Push Day A</h2>
        <div className="flex items-center gap-4 text-on-surface-variant text-sm pt-2">
          <span className="flex items-center gap-1"><Timer className="w-4 h-4" /> 75 min</span>
          <span className="flex items-center gap-1"><Dumbbell className="w-4 h-4" /> 6 Exercises</span>
        </div>
      </section>

      {/* Planning Canvas */}
      <div className="space-y-6">
        {/* Super-set Group */}
        <div className="relative pl-6 border-l-2 border-primary/30 space-y-4">
          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-background"></span>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-lg font-medium text-tertiary-fixed flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Super-set
            </h3>
            <span className="text-xs font-label uppercase tracking-widest text-on-surface-variant">Drag to reorder</span>
          </div>

          {/* Exercise Card 1: Bench Press */}
          <div className="bg-surface-container-low rounded-xl overflow-hidden group hover:scale-[1.01] transition-transform cursor-grab active:cursor-grabbing">
            <SignatureBar />
            <div className="p-5 flex items-center gap-4">
              <GripVertical className="text-outline-variant group-hover:text-primary transition-colors w-6 h-6" />
              <div className="flex-1">
                <h4 className="font-headline text-xl font-semibold">Bench Press</h4>
                <p className="text-on-surface-variant text-sm">Flat Barbell</p>
              </div>
              <div className="text-right">
                <span className="font-headline text-2xl font-bold text-primary">4</span>
                <span className="text-xs font-label text-on-surface-variant block uppercase tracking-tighter">Sets</span>
              </div>
            </div>
            <div className="px-5 pb-5 grid grid-cols-2 gap-3">
              <div className="bg-surface-container-highest/40 p-3 rounded-lg">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1">Target Reps</span>
                <span className="font-headline text-lg font-medium">8-12</span>
              </div>
              <div className="bg-surface-container-highest/40 p-3 rounded-lg">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1">Rest</span>
                <span className="font-headline text-lg font-medium">90s</span>
              </div>
            </div>
          </div>

          {/* Exercise Card 2: Incline Fly */}
          <div className="bg-surface-container-low rounded-xl overflow-hidden group hover:scale-[1.01] transition-transform cursor-grab active:cursor-grabbing">
            <SignatureBar />
            <div className="p-5 flex items-center gap-4">
              <GripVertical className="text-outline-variant group-hover:text-primary transition-colors w-6 h-6" />
              <div className="flex-1">
                <h4 className="font-headline text-xl font-semibold">Incline Fly</h4>
                <p className="text-on-surface-variant text-sm">Dumbbell Upper Chest</p>
              </div>
              <div className="text-right">
                <span className="font-headline text-2xl font-bold text-primary">3</span>
                <span className="text-xs font-label text-on-surface-variant block uppercase tracking-tighter">Sets</span>
              </div>
            </div>
            <div className="px-5 pb-5 grid grid-cols-2 gap-3">
              <div className="bg-surface-container-highest/40 p-3 rounded-lg">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1">Target Reps</span>
                <span className="font-headline text-lg font-medium">12-15</span>
              </div>
              <div className="bg-surface-container-highest/40 p-3 rounded-lg">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1">Rest</span>
                <span className="font-headline text-lg font-medium">0s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Single Exercise: Overhead Press */}
        <div className="bg-surface-container-low rounded-xl overflow-hidden group hover:scale-[1.01] transition-transform cursor-grab active:cursor-grabbing">
          <SignatureBar />
          <div className="p-5 flex items-center gap-4">
            <GripVertical className="text-outline-variant group-hover:text-primary transition-colors w-6 h-6" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-headline text-xl font-semibold">Overhead Press</h4>
                <span className="bg-secondary/10 text-secondary text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">High Intensity</span>
              </div>
              <p className="text-on-surface-variant text-sm">Standing Barbell</p>
            </div>
            <div className="text-right">
              <span className="font-headline text-2xl font-bold text-primary">4</span>
              <span className="text-xs font-label text-on-surface-variant block uppercase tracking-tighter">Sets</span>
            </div>
          </div>
          <div className="px-5 pb-5 grid grid-cols-2 gap-3">
            <div className="bg-surface-container-highest/40 p-3 rounded-lg border-l-2 border-primary">
              <span className="text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1">Target Reps</span>
              <span className="font-headline text-lg font-medium">6-8</span>
            </div>
            <div className="bg-surface-container-highest/40 p-3 rounded-lg border-l-2 border-secondary">
              <span className="text-[10px] text-on-surface-variant uppercase tracking-widest block mb-1">Rest</span>
              <span className="font-headline text-lg font-medium">120s</span>
            </div>
          </div>
        </div>

        {/* Add Button Container */}
        <div className="flex justify-center py-4">
          <button className="flex items-center gap-2 bg-surface-container-highest text-primary font-headline font-medium px-6 py-3 rounded-xl border border-primary/20 hover:bg-surface-bright transition-colors">
            <PlusCircle className="w-5 h-5" />
            Add Exercise
          </button>
        </div>
      </div>

      {/* Progress Summary Bento */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="col-span-2 bg-surface-container-low p-6 rounded-xl border-t-4 border-[#6ab2ff]">
          <h5 className="text-on-surface-variant text-xs uppercase tracking-widest mb-4">Volume Load</h5>
          <div className="flex items-end gap-2">
            <span className="font-headline text-4xl font-bold tracking-tighter">4,850</span>
            <span className="text-on-surface-variant text-sm mb-1 uppercase tracking-widest">kg</span>
          </div>
        </div>
        <div className="bg-surface-container-low p-6 rounded-xl border-t-4 border-[#ff716c]">
          <h5 className="text-on-surface-variant text-xs uppercase tracking-widest mb-4">Difficulty</h5>
          <span className="font-headline text-2xl font-bold">8.5</span>
          <div className="h-1.5 w-full bg-surface-container-highest mt-2 rounded-full overflow-hidden">
            <div className="h-full bg-secondary w-[85%]"></div>
          </div>
        </div>
        <div className="bg-surface-container-low p-6 rounded-xl border-t-4 border-[#ffeb3b]">
          <h5 className="text-on-surface-variant text-xs uppercase tracking-widest mb-4">Focus</h5>
          <span className="font-headline text-lg font-medium">Chest / Shoulder</span>
        </div>
      </div>

      {/* Floating Action Button for In-Gym */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
        <button className="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-full flex items-center justify-center shadow-[0_16px_32px_rgba(106,178,255,0.15)] ring-4 ring-background">
          <Play className="text-on-primary-fixed w-8 h-8 fill-on-primary-fixed ml-1" />
        </button>
      </div>
    </div>
  );
}
