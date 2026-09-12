'use client';

import { useEffect, useState, useCallback } from 'react';
import TranscriptLine from './TranscriptLine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Mock transcript for MVP demonstration
const MOCK_TRANSCRIPT = [
  "00:00:05 - Alice: Good morning everyone. Let's kick off our weekly sprint planning.",
  "00:00:12 - Bob: Morning. I've reviewed the backlog items from last week.",
  "00:00:18 - Alice: Great. First item — Bob, can you finalize the API schema by end of day Thursday?",
  "00:00:25 - Bob: Yes, I'll have the API schema finalized by Thursday EOD. I'll share it in Confluence.",
  "00:00:34 - Charlie: I can help review it once it's posted.",
  "00:00:40 - Alice: Perfect. Second item — we need to decide on the database technology for the new service.",
  "00:00:48 - Bob: I've done the comparison. DynamoDB fits our access patterns best. It handles the single-table design we need.",
  "00:00:55 - Charlie: I agree. The on-demand pricing also makes sense for MVP traffic.",
  "00:01:02 - Alice: Alright, decision made — we're going with DynamoDB for the new service.",
  "00:01:10 - Alice: Charlie, can you set up the CI/CD pipeline for the new repo by next Monday?",
  "00:01:18 - Charlie: Sure. I'll have the GitHub Actions pipeline ready by Monday.",
  "00:01:25 - Alice: Last thing — we should deprecate the old v1 endpoint. Bob, can you draft the migration guide?",
  "00:01:33 - Bob: I can start it, but I'll need until next Wednesday to finish the full guide.",
  "00:01:40 - Alice: That works. Let's wrap up. Good meeting everyone.",
];

interface TranscriptViewerProps {
  meetingId: string;
}

export default function TranscriptViewer({ meetingId }: TranscriptViewerProps) {
  const [highlightedLines, setHighlightedLines] = useState<Set<number>>(new Set());

  const handleHighlight = useCallback(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#L')) {
      const parts = hash.replace('#L', '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : start;

      if (!isNaN(start)) {
        const lines = new Set<number>();
        for (let i = start; i <= (isNaN(end) ? start : end); i++) {
          lines.add(i);
        }
        setHighlightedLines(lines);

        // Scroll to the start line
        const el = document.querySelector(`[data-line-index="${start}"]`);
        if (el) {
          const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({
            behavior: prefersReducedMotion ? 'instant' : 'smooth',
            block: 'center',
          });
        }

        // Clear after 3 seconds
        setTimeout(() => {
          setHighlightedLines(new Set());
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }, 3000);
      }
    }
  }, []);

  useEffect(() => {
    handleHighlight();
    window.addEventListener('hashchange', handleHighlight);
    return () => window.removeEventListener('hashchange', handleHighlight);
  }, [handleHighlight]);

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Raw Transcript</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-y-auto px-4 pb-4 space-y-0.5">
          {MOCK_TRANSCRIPT.map((line, index) => (
            <TranscriptLine
              key={index}
              index={index}
              text={line}
              isHighlighted={highlightedLines.has(index)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
