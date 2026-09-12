export default function ConfidenceBadge({ score, reason }: { score: number, reason?: string }) {
  let badgeClass = '';
  let label = '';
  
  if (score >= 80) {
    badgeClass = 'bg-green-100 text-green-800 border-green-200';
    label = `High Confidence (${score})`;
  } else if (score >= 50) {
    badgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    label = `Medium Confidence (${score})`;
  } else {
    badgeClass = 'bg-red-100 text-red-800 border-red-200';
    label = 'Low confidence — review carefully';
  }

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`} title={reason}>
        {label}
      </span>
    </div>
  );
}
