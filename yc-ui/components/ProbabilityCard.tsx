export default function ProbabilityCard({ p }: { p: number }) {
  const pct = Math.round(p * 1000) / 10; // 1 decimal %
  return (
    <div className="result">
      <p className="section-label">YC-like probability</p>
      <div className="metric">
        {pct}
        <span className="metric__unit">%</span>
      </div>
      <div className="result__raw">raw {p.toFixed(4)}</div>
    </div>
  );
}
