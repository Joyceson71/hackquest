'use client';

import { useEffect, useState, use, useCallback } from 'react';
import ActionBoard from '@/components/actions/ActionBoard';
import { ConfirmedAction } from '@/components/actions/ActionRow';
import { Loader2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';

export default function ActionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [actions, setActions] = useState<ConfirmedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<string[]>([]);
  const [currentUserName, setCurrentUserName] = useState<string | undefined>(undefined);

  const fetchActions = useCallback(async () => {
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

      // Fetch meeting to get participants
      const meetingRes = await authenticatedFetch(`${apiUrl}/meetings/${id}`);
      if (meetingRes.ok) {
        const meeting = await meetingRes.json();
        if (meeting.participants) {
          const parsed = meeting.participants
            .split(/[\r\n,]+/)
            .map((p: string) => p.trim())
            .filter(Boolean);
          if (parsed.length > 0) setParticipants(parsed);
        }
      }

      // Fetch confirmed actions
      const res = await authenticatedFetch(`${apiUrl}/meetings/${id}/confirmed-actions`);
      if (res.ok) {
        const data = await res.json();
        setActions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchActions();
  }, [fetchActions]);

  // Get current user's name from Cognito token claims (stored in localStorage by Amplify)
  useEffect(() => {
    try {
      // Try to get name from stored auth data — best-effort
      const keys = Object.keys(localStorage).filter(k => k.includes('CognitoIdentityServiceProvider') && k.endsWith('.userData'));
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const nameAttr = parsed?.UserAttributes?.find((a: Record<string, unknown>) => a.Name === 'name' || a.Name === 'email');
          if (nameAttr?.Value) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCurrentUserName(nameAttr.Value as string);
            break;
          }
        }
      }
    } catch { /* ignore */ }
  }, []);

  const handleStatusChange = async (actionId: string, newStatus: string) => {
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
      await authenticatedFetch(`${apiUrl}/meetings/${id}/confirmed-actions/${actionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      // Optimistic update
      setActions((prev) => prev.map((a) => (a.actionId === actionId ? { ...a, status: newStatus } : a)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
      await authenticatedFetch(`${apiUrl}/meetings/${id}/confirmed-actions/${actionId}`, {
        method: 'DELETE',
      });
      setActions((prev) => prev.filter((a) => a.actionId !== actionId));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-bold uppercase text-sm">Loading action board…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-4 mb-6">
        <h2 className="text-2xl font-bold text-foreground">Action Board</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Canonical record of all confirmed commitments from the meeting transcript.
        </p>
      </div>

      <ActionBoard
        actions={actions}
        meetingId={id}
        participants={participants}
        currentUserName={currentUserName}
        onStatusChange={handleStatusChange}
        onDeleteAction={handleDeleteAction}
        onRefresh={fetchActions}
      />
    </div>
  );
}
