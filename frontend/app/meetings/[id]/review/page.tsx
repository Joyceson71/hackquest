'use client';

import { useEffect, useState, use } from 'react';
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

  const participants = ['Alice (Engineering Manager)', 'Bob (Backend Developer)', 'Charlie (Designer)'];

  const fetchItems = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Also fetch meeting status
      const meetingRes = await authenticatedFetch(`${apiUrl}/meetings/${id}`);
      if (meetingRes.ok) {
        const meeting = await meetingRes.json();
        setExtractionStatus(meeting.extractionStatus || meeting.status || '');
      }

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
  };

  useEffect(() => {
    fetchItems();
  }, [id]);

  const handleProcessed = () => {
    // Re-fetch to update the list
    fetchItems();
    // Increment stats (simplified — in production this would track the specific action)
    setStats((prev) => ({ ...prev, confirmed: prev.confirmed + 1 }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading proposed items…</span>
      </div>
    );
  }

  // Extraction still in progress
  if (['PENDING', 'EXTRACTING', 'UPLOADING'].includes(extractionStatus)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <h3 className="text-lg font-semibold text-foreground">Extraction in progress</h3>
        <p className="text-sm text-muted-foreground mt-1">Proposed items will appear here when ready.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Review Proposed Actions</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Every commitment needs human confirmation before entering the action board.
        </p>
      </div>

      {/* Summary if any items have been actioned */}
      {(stats.confirmed > 0 || stats.rejected > 0) && (
        <ReviewSummary confirmed={stats.confirmed} modified={stats.modified} rejected={stats.rejected} />
      )}

      {/* Proposed items */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card rounded-xl border border-border text-center">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          {stats.confirmed > 0 || stats.rejected > 0 ? (
            <>
              <h3 className="text-lg font-semibold text-foreground">All caught up!</h3>
              <p className="text-sm text-muted-foreground mt-1">All proposed items have been reviewed.</p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-foreground">No action items identified</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No action items were identified in this transcript. You can still create actions manually from the Action Board.
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
              participants={participants}
              onProcessed={handleProcessed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
