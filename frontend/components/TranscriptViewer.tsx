'use client';

import { useEffect, useState } from 'react';

// Mock data for MVP
const mockTranscript = [
  "00:00:00 - Alice: Let's start the meeting.",
  "00:00:05 - Bob: Okay, I reviewed the design docs.",
  "00:00:10 - Alice: Great. Bob, can you finalize the API schema by tomorrow?",
  "00:00:15 - Bob: Yes, I will finalize the API schema by EOD tomorrow.",
  "00:00:20 - Alice: Perfect. We also need to decide on the database.",
  "00:00:25 - Bob: I think we should go with DynamoDB for this project.",
  "00:00:30 - Alice: Agreed. Decision made, we will use DynamoDB."
];

export default function TranscriptViewer({ meetingId }: { meetingId: string }) {
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  useEffect(() => {
    // Listen for hash changes to highlight lines
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#L')) {
        const lineStr = hash.replace('#L', '');
        const lineIndex = parseInt(lineStr, 10);
        if (!isNaN(lineIndex)) {
          setHighlightedLine(lineIndex);
          
          // Scroll into view (smooth)
          const element = document.getElementById(`L${lineIndex}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }

          // Clear highlight after 3 seconds
          setTimeout(() => {
            setHighlightedLine(null);
            // Optionally clear hash to allow clicking same link again
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }, 3000);
        }
      }
    };

    // Check on mount
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden mt-6 shadow-sm">
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="font-semibold text-card-foreground">Raw Transcript</h3>
      </div>
      <div className="p-4 max-h-[600px] overflow-y-auto space-y-1 font-mono text-sm">
        {mockTranscript.map((line, index) => (
          <div 
            key={index} 
            id={`L${index}`}
            className={`p-2 rounded transition-colors duration-300 ${
              highlightedLine === index ? 'bg-accent/20 border-l-4 border-accent' : 'hover:bg-muted/50 border-l-4 border-transparent'
            }`}
          >
            <span className="text-muted-foreground mr-4 select-none">{index.toString().padStart(3, '0')}</span>
            <span className="text-card-foreground">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
