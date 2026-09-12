'use client';

import { useEffect, useState, use } from 'react';
import TranscriptViewer from '@/components/transcript/TranscriptViewer';
import ExtractionStatus from '@/components/transcript/ExtractionStatus';
import { authenticatedFetch } from '@/lib/api';

export default function TranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [status, setStatus] = useState<string>('PENDING');
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let elapsed = 0;

    const checkStatus = async () => {
      try {
        const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
        const res = await authenticatedFetch(`${apiUrl}/meetings/${id}`);
        if (res.ok) {
          const data = await res.json();
          const s = data.extractionStatus || data.status || 'PENDING';
          setStatus(s);
          if (s === 'READY' || s === 'REVIEW_READY' || s === 'FAILED' || s === 'EXTRACTION_FAILED') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Failed to poll meeting status', err);
      }
    };

    // Poll every 3 seconds, max 60 seconds
    const interval = setInterval(() => {
      elapsed += 3;
      setElapsedTime(elapsed);
      if (elapsed > 60) {
        clearInterval(interval);
        return;
      }
      checkStatus();
    }, 3000);

    checkStatus(); // initial check

    return () => clearInterval(interval);
  }, [id]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Transcript</h2>
        <p className="text-sm text-muted-foreground mt-1">View the meeting transcript. Click evidence links to highlight source lines.</p>
      </div>

      <ExtractionStatus
        status={status === 'REVIEW_READY' ? 'READY' : status === 'EXTRACTION_FAILED' ? 'FAILED' : status}
        elapsedTime={elapsedTime}
        meetingId={id}
        onRetry={() => window.location.reload()}
      />

      <TranscriptViewer meetingId={id} />
    </div>
  );
}
