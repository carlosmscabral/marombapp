import { Search } from 'lucide-react';
import { SignatureBar } from '../components/Layout';

const categories = ['All', 'Barbell', 'Dumbbell', 'Machine', 'Bodyweight'];

const exercises = [
  {
    category: 'Chest',
    count: 12,
    items: [
      {
        name: 'Bench Press',
        muscle: 'Pectoralis Major',
        type: 'Compound',
        typeColor: 'bg-primary/20 text-primary-dim',
        image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=2070&auto=format&fit=crop',
      },
      {
        name: 'Dumbbell Flyes',
        muscle: 'Inner Chest',
        type: 'Isolation',
        typeColor: 'bg-secondary/20 text-secondary-dim',
        image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=2070&auto=format&fit=crop',
      }
    ]
  },
  {
    category: 'Back',
    count: 18,
    items: [
      {
        name: 'Pull Ups',
        muscle: 'Latissimus Dorsi',
        type: 'Bodyweight',
        typeColor: 'bg-primary/20 text-primary-dim',
        image: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?q=80&w=2069&auto=format&fit=crop',
      },
      {
        name: 'Seated Rows',
        muscle: 'Rhomboids',
        type: 'Compound',
        typeColor: 'bg-primary/20 text-primary-dim',
        image: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2069&auto=format&fit=crop',
      }
    ]
  },
  {
    category: 'Legs',
    count: 24,
    items: [
      {
        name: 'Barbell Squats',
        muscle: 'Quadriceps, Glutes',
        type: 'Compound',
        typeColor: 'bg-primary/20 text-primary-dim',
        image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop',
        large: true
      },
      {
        name: 'Leg Press',
        muscle: 'Quadriceps',
        type: 'Machine',
        typeColor: 'bg-primary/20 text-primary-dim',
        image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop', // Reusing image for demo
      }
    ]
  }
];

export function Library() {
  return (
    <div className="flex-1 pb-24">
      {/* Search Section */}
      <section className="px-6 pt-8 pb-6">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-primary font-label text-xs uppercase tracking-[0.3em]">Encyclopedia</span>
            <h2 className="font-headline text-4xl font-bold mt-1">Library</h2>
          </div>
          <div className="hidden md:block">
            <span className="text-on-surface-variant font-label text-sm">342 Exercises Available</span>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="text-outline w-5 h-5" />
          </div>
          <input 
            className="w-full bg-surface-container-low border-none border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-xl py-4 pl-12 pr-4 transition-all duration-300 text-on-surface placeholder:text-outline/50" 
            placeholder="Search movements, muscles, or equipment..." 
            type="text" 
          />
        </div>
      </section>

      {/* Featured / Quick Select */}
      <section className="px-6 mb-10">
        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
          {categories.map((cat, i) => (
            <button 
              key={cat}
              className={`flex-shrink-0 px-6 py-2 rounded-full font-label text-sm transition-colors ${
                i === 0 
                  ? 'bg-primary/10 border border-primary/20 text-primary' 
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Exercises by Category */}
      <div className="space-y-12 px-6">
        {exercises.map((section) => (
          <section key={section.category}>
            <div className="relative mb-6">
              <div className="absolute -top-2 left-0 w-24 rounded-full overflow-hidden">
                <SignatureBar />
              </div>
              <div className="flex items-center gap-3">
                <h3 className="font-headline text-2xl font-semibold">{section.category}</h3>
                <span className="text-outline text-sm font-label">({section.count})</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {section.items.map((exercise) => (
                <div 
                  key={exercise.name}
                  className={`group relative bg-surface-container-low rounded-xl overflow-hidden hover:bg-surface-container-high transition-all duration-300 cursor-pointer ${
                    exercise.large ? 'col-span-2 md:col-span-1' : ''
                  }`}
                >
                  <div className={`bg-surface-container-highest relative overflow-hidden ${exercise.large ? 'aspect-video md:aspect-square' : 'aspect-square'}`}>
                    <img 
                      className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500" 
                      src={exercise.image} 
                      alt={exercise.name} 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low to-transparent"></div>
                    <div className="absolute bottom-3 left-3">
                      <span className={`${exercise.typeColor} text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider`}>
                        {exercise.type}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h4 className="font-body font-semibold text-on-surface group-hover:text-primary transition-colors">{exercise.name}</h4>
                    <p className="text-xs text-outline mt-1 font-label">{exercise.muscle}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
