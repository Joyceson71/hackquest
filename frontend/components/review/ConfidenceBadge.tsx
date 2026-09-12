import { Badge } from '@/components/ui/badge';

interface ConfidenceBadgeProps {
  score: number;
  reason?: string;
}

export default function ConfidenceBadge({ score, reason }: ConfidenceBadgeProps) {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
  let label = '';
  let className = '';

  if (score >= 80) {
    className = 'bg-[var(--color-success)] text-white border-transparent';
    label = 'High confidence';
  } else if (score >= 50) {
    className = 'bg-[var(--color-warning)] text-white border-transparent';
    label = 'Medium confidence';
  } else {
    variant = 'destructive';
    label = 'Low confidence — review carefully';
  }

  return (
    <div className="flex flex-col gap-1">
      <Badge variant={variant} className={`${className} whitespace-nowrap`}>
        {label} ({score})
      </Badge>
      {reason && (
        <span className="text-xs text-muted-foreground leading-tight">{reason}</span>
      )}
    </div>
  );
}
