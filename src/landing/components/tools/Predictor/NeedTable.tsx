import { NeedRow } from '@/landing/lib/grading';

interface NeedTableProps {
  rows: NeedRow[];
}

export default function NeedTable({ rows }: NeedTableProps) {
  return (
    <div className="bg-white border-[3px] border-[#0b1120] rounded-2xl overflow-hidden shadow-[4px_4px_0px_#0b1120]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-100 text-left text-[10px] font-black uppercase tracking-wider text-gray-400">
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">Points</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Final Needed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.letter} className="border-b border-gray-100 last:border-b-0">
                <td className="px-4 py-3 font-black text-[#0b1120]">{row.letter}</td>
                <td className="px-4 py-3 font-bold text-gray-500">{row.points}</td>
                <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                  {row.status === 'already' && <span className="text-[#10b981]">Already there</span>}
                  {row.status === 'unreachable' && <span className="text-red-500">Not reachable</span>}
                  {row.status === 'value' && <span className="text-[#0b1120]">{row.requiredFinal!.toFixed(1)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
