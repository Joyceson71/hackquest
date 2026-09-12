'use client';

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExtractionStatusProps {
  status: string;
  elapsedTime: number;
  meetingId: string;
  onRetry?: () => void;
}

export default function ExtractionStatus({ status, elapsedTime, meetingId, onRetry }: ExtractionStatusProps) {
  const router = useRouter();

  if (status === 'UPLOADING' || status === 'EXTRACTING' || status === 'PENDING') {
    return (
      <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-lg px-4 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="text-sm font-medium text-foreground">Extracting action items…</span>
          {elapsedTime > 10 && (
            <span className="text-xs text-muted-foreground">{elapsedTime}s elapsed</span>
          )}
          {elapsedTime > 30 && (
            <span className="text-xs text-warning font-medium">Taking longer than expected…</span>
          )}
        </div>
      </div>
    );
  }

  if (status === 'READY') {
    return (
      <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="bg-primary text-primary-foreground">
            Review Ready
          </Badge>
          <span className="text-sm text-muted-foreground">Proposed items are ready for review.</span>
        </div>
        <Button variant="default" size="sm" onClick={() => router.push(`/meetings/${meetingId}/review`)}>
          Go to Review
        </Button>
      </div>
    );
  }

  if (status === 'FAILED') {
    return (
      <div className="bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-3 space-y-2">
        <p className="text-sm font-medium text-destructive">
          We couldn&apos;t extract items from this transcript.
        </p>
        <p className="text-sm text-muted-foreground">
          Make sure the file contains timestamped lines and try uploading again.
        </p>
        {onRetry && (
          <Button variant="destructive" size="sm" onClick={onRetry}>
            Retry Extraction
          </Button>
        )}
      </div>
    );
  }

  return null;
}
