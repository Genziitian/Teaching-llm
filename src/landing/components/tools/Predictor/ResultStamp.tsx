interface ResultStampProps {
  letter: 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U';
  T: number;
  points: number;
}

export default function ResultStamp({ letter, T, points }: ResultStampProps) {
  const isGold = letter === 'S';
  const ring = isGold ? '#f59e0b' : '#ef4444';
  const bg = isGold ? '#fffbeb' : '#fef2f2';
  const text = isGold ? '#b45309' : '#dc2626';

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center border-[4px] shadow-[4px_4px_0px_#0b1120]"
        style={{ borderColor: ring, background: bg, color: text }}
      >
        <span className="text-4xl font-black">{letter}</span>
      </div>
      <div className="text-center">
        <p className="text-2xl font-black text-[#0b1120]">{T.toFixed(2)}</p>
        <p className="text-xs text-gray-500 font-bold">
          Score T out of 100 · {points} grade point{points === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}
