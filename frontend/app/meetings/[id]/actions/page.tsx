'use client';

import { useEffect, useState, use } from 'react';
import ActionBoard from '@/components/actions/ActionBoard';
import { ConfirmedAction } from '@/components/actions/ActionRow';
import { Loader2 } from 'lucide-react';

export default function ActionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [actions, setActions] = useState<ConfirmedAction[]>([]);
  const [loading, setLoading] = useState(true);

  const participants = ['Alice (Engineering Manager)', 'Bob (Backend Developer)', 'Charlie (Designer)'];

  const fetchActions = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/meetings/${id}/confirmed-actions`);
      if (res.ok) {
        const data = await res.json();
        setActions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, [id]);

  const handleStatusChange = async (actionId: string, newStatus: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${apiUrl}/meetings/${id}/confirmed-actions/${actionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      // Optimistic update
      setActions((prev) =>
        prev.map((a) => (a.actionId === actionId ? { ...a, status: newStatus } : a))
      );
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading action board…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Action Board</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The canonical record of all confirmed commitments from the meeting.
        </p>
      </div>

      <ActionBoard
        actions={actions}
        meetingId={id}
        participants={participants}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
