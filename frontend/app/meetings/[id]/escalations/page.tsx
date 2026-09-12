'use client';

import { useEffect, useState, use, useCallback } from 'react';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import EscalationPanel from '@/components/actions/EscalationPanel';
import type { ConfirmedAction } from '@/components/actions/ActionRow';

export default function EscalationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [escalations, setEscalations] = useState<ConfirmedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserName, setCurrentUserName] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  // Get current user's name from Cognito stored data
  useEffect(() => {
    try {
      const keys = Object.keys(localStorage).filter(
        k => k.includes('CognitoIdentityServiceProvider') && k.endsWith('.userData')
      );
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const nameAttr = parsed?.UserAttributes?.find(
            (a: Record<string, unknown>) => a.Name === 'name' || a.Name === 'email'
          );
          if (nameAttr?.Value) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCurrentUserName(nameAttr.Value as string);
            break;
          }
        }
      }
    } catch { /* ignore */ }
  }, []);

  const fetchEscalations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
      const res = await authenticatedFetch(`${apiUrl}/meetings/${id}/escalations`);
      if (res.ok) {
        const data = await res.json();
        setEscalations(data);
      } else {
        setError('Failed to load escalations.');
      }
    } catch {
      setError('Network error loading escalations.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEscalations();
  }, [fetchEscalations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-bold uppercase text-sm">Loading escalations…</span>
      </div>
    );
  }

  // Filter to only show escalations addressed to current user
  const myEscalations = currentUserName
    ? escalations.filter(
        e => e.suggestedReplacementOwner?.toLowerCase() === currentUserName.toLowerCase()
      )
    : escalations;

  const otherEscalations = currentUserName
    ? escalations.filter(
        e => e.suggestedReplacementOwner?.toLowerCase() !== currentUserName.toLowerCase()
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-foreground uppercase flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Escalation Inbox
          </h2>
          <p className="text-sm text-muted-foreground mt-1 font-bold uppercase">
            Actions awaiting replacement owner acceptance.
          </p>
        </div>
        {escalations.length > 0 && (
          <span className="shrink-0 bg-destructive text-background text-xs font-black px-3 py-1 border-2 border-border shadow-brutal-sm uppercase">
            {escalations.length} pending
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border-4 border-destructive/40 text-destructive font-bold uppercase text-sm">
          {error}
        </div>
      )}

      {escalations.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 bg-card border-4 border-border shadow-brutal text-center">
          <CheckCircle className="h-12 w-12 text-primary mb-4" />
          <h3 className="text-xl font-black uppercase text-foreground">No escalations pending your review</h3>
          <p className="text-sm text-muted-foreground font-bold uppercase mt-2">
            All actions are being tracked by their owners.
          </p>
        </div>
      )}

      {/* My escalations — addressed to current user */}
      {myEscalations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-destructive border-b-4 border-destructive/40 pb-2">
            Addressed To You ({myEscalations.length})
          </h3>
          <div className="space-y-4">
            {myEscalations.map((esc) => (
              <div key={esc.actionId} className="border-4 border-destructive/50 bg-destructive/5 p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black uppercase text-sm text-foreground">{esc.task}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Action ID: {esc.actionId.slice(0, 8)}…
                      {esc.evidenceTimestamp && ` · Evidence: [${esc.evidenceTimestamp}]`}
                    </p>
                  </div>
                  <span className="shrink-0 bg-destructive text-background text-xs font-black px-2 py-0.5 border border-border uppercase">
                    Pending Acceptance
                  </span>
                </div>
                <EscalationPanel
                  action={esc}
                  meetingId={id}
                  currentUserName={currentUserName}
                  onAction={fetchEscalations}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other escalations — for organizer visibility */}
      {otherEscalations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground border-b-2 border-border pb-2">
            Other Pending Escalations ({otherEscalations.length})
          </h3>
          <div className="space-y-3">
            {otherEscalations.map((esc) => (
              <div key={esc.actionId} className="border-4 border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black uppercase text-sm text-foreground">{esc.task}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Original owner: {esc.originalOwner || '—'} · 
                      Suggested replacement: <span className="font-bold text-foreground">{esc.suggestedReplacementOwner || 'None'}</span>
                    </p>
                  </div>
                  <span className="shrink-0 bg-muted text-foreground text-xs font-black px-2 py-0.5 border border-border uppercase">
                    Waiting for {esc.suggestedReplacementOwner || 'replacement'}
                  </span>
                </div>
                <EscalationPanel
                  action={esc}
                  meetingId={id}
                  currentUserName={currentUserName}
                  onAction={fetchEscalations}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
