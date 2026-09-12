import { Separator } from '@/components/ui/separator';

export interface Correction {
  field: string;
  originalValue: string;
  correctedValue: string;
  correctedBy: string;
  correctedAt: string;
}

interface CorrectionTimelineProps {
  corrections: Correction[];
}

export default function CorrectionTimeline({ corrections }: CorrectionTimelineProps) {
  if (!corrections || corrections.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No corrections recorded.</p>;
  }

  return (
    <div className="space-y-3 py-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Corrections History</p>
      <div className="space-y-2">
        {corrections.map((c, i) => (
          <div key={i} className="flex flex-col gap-1 text-xs border-l-2 border-primary/30 pl-3">
            <span className="font-medium text-foreground">
              <span className="capitalize">{c.field}</span> changed by {c.correctedBy}
            </span>
            <div className="flex flex-wrap gap-x-4 text-muted-foreground">
              <span>From: <span className="line-through">{c.originalValue || '(empty)'}</span></span>
              <span>To: <span className="font-medium text-foreground">{c.correctedValue}</span></span>
            </div>
            <span className="text-muted-foreground">{new Date(c.correctedAt).toLocaleString()}</span>
            {i < corrections.length - 1 && <Separator className="mt-2" />}
          </div>
        ))}
      </div>
    </div>
  );
}
