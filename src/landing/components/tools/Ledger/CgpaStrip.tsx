interface CgpaStripProps {
  cgpaValue: number;
  percentage: number;
  totalCredits: number;
}

export default function CgpaStrip({ cgpaValue, percentage, totalCredits }: CgpaStripProps) {
  return (
    <div className="bg-white border-[3px] border-[#0b1120] rounded-2xl shadow-[4px_4px_0px_#0b1120] flex flex-wrap items-center justify-between gap-6 px-6 py-5 mb-8">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Cumulative CGPA</p>
        <p className="text-3xl font-black text-[#0b1120]">{cgpaValue.toFixed(2)}</p>
      </div>
      <div className="h-10 w-px bg-gray-100 hidden sm:block" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Equivalent %</p>
        <p className="text-2xl font-black text-[#0b1120]">{percentage.toFixed(1)}%</p>
      </div>
      <div className="h-10 w-px bg-gray-100 hidden sm:block" />
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Total Credits</p>
        <p className="text-2xl font-black text-[#0b1120]">{totalCredits}</p>
      </div>
    </div>
  );
}
