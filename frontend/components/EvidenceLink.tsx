'use client';

export default function EvidenceLink({ meetingId, lineStart }: { meetingId: string, lineStart: number }) {
  return (
    <a 
      href={`/meetings/${meetingId}/transcript#L${lineStart}`}
      target="_blank" rel="noreferrer"
      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-muted text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
      <span className="text-xs font-mono">L{lineStart}</span>
    </a>
  );
}
