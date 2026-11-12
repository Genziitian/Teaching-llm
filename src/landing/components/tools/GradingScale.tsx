import { GRADE_BANDS, U_GRADE, W_GRADE } from '@/landing/lib/grading';

const BADGE_COLORS: Record<string, string> = {
  S: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  A: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  B: 'bg-blue-50 text-blue-600 border-blue-200',
  C: 'bg-blue-50 text-blue-600 border-blue-200',
  D: 'bg-amber-50 text-amber-600 border-amber-200',
  E: 'bg-amber-50 text-amber-600 border-amber-200',
  U: 'bg-red-50 text-red-600 border-red-200',
  W: 'bg-red-50 text-red-600 border-red-200',
};

function GradeBadge({ letter }: { letter: string }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full border text-xs font-black ${BADGE_COLORS[letter]}`}>
      {letter}
    </span>
  );
}

export default function GradingScale() {
  return (
    <div>
      <div className="bg-white border-[3px] border-[#0b1120] rounded-2xl overflow-hidden shadow-[4px_4px_0px_#0b1120] mb-10">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-100 text-left text-[10px] font-black uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3">Score (T)</th>
                <th className="px-4 py-3">Letter</th>
                <th className="px-4 py-3">Points</th>
                <th className="px-4 py-3">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {GRADE_BANDS.map((band, i) => {
                const next = GRADE_BANDS[i - 1];
                const rangeLabel = i === 0 ? `≥ ${band.min}` : `${band.min} – ${(next.min - 0.01).toFixed(2)}`;
                return (
                  <tr key={band.letter} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-bold text-gray-600">{rangeLabel}</td>
                    <td className="px-4 py-3">
                      <GradeBadge letter={band.letter} />
                    </td>
                    <td className="px-4 py-3 font-black text-[#0b1120]">{band.points}</td>
                    <td className="px-4 py-3 text-gray-500 font-medium">{band.label}</td>
                  </tr>
                );
              })}
              <tr className="border-b border-gray-100">
                <td className="px-4 py-3 font-bold text-gray-600">&lt; 40</td>
                <td className="px-4 py-3">
                  <GradeBadge letter={U_GRADE.letter} />
                </td>
                <td className="px-4 py-3 font-black text-[#0b1120]">{U_GRADE.points}</td>
                <td className="px-4 py-3 text-gray-500 font-medium">{U_GRADE.label}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-gray-600">Attendance &lt; 85%</td>
                <td className="px-4 py-3">
                  <GradeBadge letter={W_GRADE.letter} />
                </td>
                <td className="px-4 py-3 font-black text-[#0b1120]">{W_GRADE.points}</td>
                <td className="px-4 py-3 text-gray-500 font-medium">{W_GRADE.label}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div>
          <h3 className="font-black text-[#0b1120] mb-1.5">Absolute grading</h3>
          <p className="text-gray-500 font-medium text-sm leading-relaxed">
            These cutoffs are fixed, not curved against the batch's performance. Instructors retain discretion to
            moderate grades in exceptional cases (e.g. a visibly miscalibrated exam), but by default your score T maps
            directly to the table above.
          </p>
        </div>
        <div>
          <h3 className="font-black text-[#0b1120] mb-1.5">How U and W affect your CGPA</h3>
          <p className="text-gray-500 font-medium text-sm leading-relaxed">
            Both U (score below 40) and W (attendance below 85%) carry 0 grade points — but the course's credits still
            count in the CGPA denominator until you re-register for and pass that course. They don't just disappear
            from your record; they actively pull your CGPA down until cleared.
          </p>
        </div>
        <div>
          <h3 className="font-black text-[#0b1120] mb-1.5">CGPA × 10 = Percentage</h3>
          <p className="text-gray-500 font-medium text-sm leading-relaxed">
            The program's rule of thumb for an equivalent percentage is simply your CGPA multiplied by 10 — e.g. a
            CGPA of 8.5 is quoted as 85%.
          </p>
        </div>
      </div>
    </div>
  );
}
