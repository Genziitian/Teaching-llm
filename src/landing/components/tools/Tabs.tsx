import { LucideIcon } from 'lucide-react';

export interface TabDef<T extends string> {
  key: T;
  label: string;
  icon: LucideIcon;
  activeColor: string;
}

interface TabsProps<T extends string> {
  tabs: TabDef<T>[];
  active: T;
  onChange: (key: T) => void;
}

export default function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
  return (
    <div className="w-full bg-white border-y-2 border-gray-100 -mx-6 px-6 sm:mx-0 sm:px-0 sm:rounded-xl mb-8">
      <div className="flex items-center gap-8 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              style={isActive ? { borderColor: tab.activeColor } : undefined}
              className={`flex items-center gap-2 py-3 text-xs font-black whitespace-nowrap border-b-[3px] transition-colors ${
                isActive ? 'text-[#0b1120]' : 'border-transparent text-gray-500 hover:text-[#0b1120]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
