'use client';

// trigger hmr
import { useEffect, useState, use, useCallback } from 'react';
import ProposedItemCard, { ProposedItem } from '@/components/review/ProposedItemCard';
import ReviewSummary from '@/components/review/ReviewSummary';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [items, setItems] = useState<ProposedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [extractionStatus, setExtractionStatus] = useState('');
  const [stats, setStats] = useState({ confirmed: 0, modified: 0, rejected: 0 });

  const [participantsList, setParticipantsList] = useState<string[]>([
    'Alice (Engineering Manager)',
    'Bob (Backend Developer)',
    'Charlie (Designer)',
  ]);

  const fetchItems = useCallback(async () => {
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

      // Fetch meeting record
      const meetingRes = await authenticatedFetch(`${apiUrl}/meetings/${id}`);
      let currentStatus = '';
      if (meetingRes.ok) {
        const meeting = await meetingRes.json();
        currentStatus = meeting.extractionStatus || meeting.status || '';
        setExtractionStatus(currentStatus);

        if (meeting.participants) {
          const parsed = meeting.participants.split(/[\r\n,]+/).map((p: string) => p.trim()).filter(Boolean);
          if (parsed.length > 0) {
            setParticipantsList(parsed);
          }
        }
      }

      // Fetch proposed items
      const res = await authenticatedFetch(`${apiUrl}/meetings/${id}/proposed-items`);
      if (res.ok) {
        const data = await res.json();
        const pending = data.filter((item: ProposedItem & { reviewStatus?: string }) =>
          !item.reviewStatus || item.reviewStatus === 'PENDING'
        );
        setItems(pending);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchItems();
  }, [fetchItems]);

  // Polling if extraction is still in progress
  useEffect(() => {
    if (!['PENDING', 'EXTRACTING', 'UPLOADING'].includes(extractionStatus)) return;

    const interval = setInterval(() => {
      fetchItems();
    }, 3000);

    return () => clearInterval(interval);
  }, [extractionStatus, fetchItems]);

  const handleProcessed = (itemId: string, action: 'CONFIRM' | 'REJECT') => {
    setItems((prev) => prev.filter(i => i.itemId !== itemId));
    setStats((prev) => ({ 
      ...prev, 
      confirmed: action === 'CONFIRM' ? prev.confirmed + 1 : prev.confirmed,
      rejected: action === 'REJECT' ? prev.rejected + 1 : prev.rejected 
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 meta-label font-bold">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>LOADING PROPOSED ITEMS...</span>
      </div>
    );
  }

  // Extraction still in progress
  if (['PENDING', 'EXTRACTING', 'UPLOADING'].includes(extractionStatus)) {
    return (
      <div className="manga-panel flex flex-col items-center justify-center py-16 text-center space-y-6 max-w-2xl mx-auto mt-12">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <h3 className="manga-header text-3xl text-foreground tracking-widest">EXTRACTION IN PROGRESS</h3>
        <p className="meta-label text-muted-foreground mt-1">PROPOSED ITEMS WILL APPEAR HERE WHEN READY.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-border pb-4">
        <h2 className="manga-header text-3xl text-foreground">REVIEW PROPOSED ACTIONS</h2>
        <p className="meta-label text-muted-foreground mt-2 opacity-70 font-bold">
          EVERY COMMITMENT NEEDS HUMAN CONFIRMATION BEFORE ENTERING THE ACTION BOARD.
        </p>
      </div>

      {/* Summary if any items have been actioned */}
      {(stats.confirmed > 0 || stats.rejected > 0) && (
        <ReviewSummary confirmed={stats.confirmed} modified={stats.modified} rejected={stats.rejected} />
      )}

      {/* Proposed items */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 manga-panel text-center max-w-3xl mx-auto mt-8">
          <CheckCircle2 className="h-12 w-12 text-primary mb-4" />
          {stats.confirmed > 0 || stats.rejected > 0 ? (
            <>
              <h3 className="manga-header text-3xl text-foreground">ALL CAUGHT UP!</h3>
              <p className="meta-label text-muted-foreground mt-2">ALL PROPOSED ITEMS HAVE BEEN REVIEWED.</p>
            </>
          ) : (
            <>
              <h3 className="manga-header text-3xl text-foreground">NO ACTION ITEMS IDENTIFIED</h3>
              <p className="meta-label text-muted-foreground mt-2 max-w-sm mx-auto">
                NO ACTION ITEMS WERE IDENTIFIED IN THIS TRANSCRIPT. YOU CAN STILL CREATE ACTIONS MANUALLY FROM THE ACTION BOARD.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <ProposedItemCard
              key={item.itemId}
              item={item}
              meetingId={id}
              participants={participantsList}
              onProcessed={handleProcessed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
