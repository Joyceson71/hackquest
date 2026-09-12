'use client';

import { useEffect, useState, useCallback } from 'react';
import TranscriptLine from './TranscriptLine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';

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
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [loadingText, setLoadingText] = useState(true);

  useEffect(() => {
    const loadTranscriptText = async () => {
      try {
        setLoadingText(true);
        const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
        
        // 1. Get meeting metadata which includes the presigned URL
        const res = await authenticatedFetch(`${apiUrl}/meetings/${meetingId}`);
        if (!res.ok) throw new Error('Failed to fetch meeting metadata');
        const meeting = await res.json();
        
        // 2. Fetch the actual text file from S3 using the presigned URL
        if (meeting.transcriptUrl) {
          const textRes = await fetch(meeting.transcriptUrl);
          const rawText = await textRes.text();
          
          // Clean and split lines
          const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
          setTranscriptLines(lines);
        } else {
          // Fallback if no URL is present
          setTranscriptLines(MOCK_TRANSCRIPT);
        }
      } catch (err) {
        console.error('Failed to load transcript file', err);
        setTranscriptLines(MOCK_TRANSCRIPT);
      } finally {
        setLoadingText(false);
      }
    };
    
    loadTranscriptText();
  }, [meetingId]);

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
    const timer = setTimeout(() => {
      handleHighlight();
    }, 50);
    window.addEventListener('hashchange', handleHighlight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('hashchange', handleHighlight);
    };
  }, [handleHighlight]);

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Raw Transcript</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-y-auto px-4 pb-4 space-y-0.5">
          {loadingText ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-sm">Loading transcript file...</p>
            </div>
          ) : (
            transcriptLines.map((line, index) => (
              <TranscriptLine
                key={index}
                index={index}
                text={line}
                isHighlighted={highlightedLines.has(index)}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
