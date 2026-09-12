import { CheckCircle2, XCircle } from 'lucide-react';

interface ReviewSummaryProps {
  confirmed: number;
  modified: number;
  rejected: number;
}

export default function ReviewSummary({ confirmed, modified, rejected }: ReviewSummaryProps) {
  const total = confirmed + rejected;
  if (total === 0) return null;

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-4 flex flex-wrap gap-6 items-center">
      <span className="text-sm font-semibold text-foreground">Review Complete</span>
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-[var(--color-success)]">
          <CheckCircle2 className="h-4 w-4" />
          {confirmed} confirmed {modified > 0 && `(${modified} edited)`}
        </span>
        <span className="flex items-center gap-1.5 text-destructive">
          <XCircle className="h-4 w-4" />
          {rejected} rejected
        </span>
      </div>
    </div>
  );
}
