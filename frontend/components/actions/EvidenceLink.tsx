'use client';

import { Link2 } from 'lucide-react';

interface EvidenceLinkProps {
  meetingId: string;
  lineStart: number;
  lineEnd?: number;
}

export default function EvidenceLink({ meetingId, lineStart, lineEnd }: EvidenceLinkProps) {
  const hash = `#L${lineStart}${lineEnd && lineEnd !== lineStart ? `-${lineEnd}` : ''}`;

  return (
    <a
      href={`/meetings/${meetingId}/transcript${hash}`}
      target="_blank"
      rel="noreferrer"
      className="
        inline-flex items-center gap-1.5
        px-2 py-1 rounded-md
        bg-muted text-muted-foreground
        hover:bg-accent/10 hover:text-accent
        transition-colors duration-200
        text-xs font-mono
      "
    >
      <Link2 className="h-3 w-3" />
      L{lineStart}{lineEnd && lineEnd !== lineStart ? `–${lineEnd}` : ''}
    </a>
  );
}
