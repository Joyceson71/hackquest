'use client';

import { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, UserX, AlertTriangle, Loader2, CheckCircle, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { authenticatedFetch } from '@/lib/api';

interface Participant {
  name: string;
  role?: string;
  openActionCount: number;
}

interface MarkUnavailableResult {
  escalatedActions: number;
}

export default function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetName, setTargetName] = useState('');
  const [marking, setMarking] = useState(false);
  const [result, setResult] = useState<MarkUnavailableResult | null>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Get meeting participants string
      const meetingRes = await authenticatedFetch(`${apiUrl}/meetings/${id}`);
      if (!meetingRes.ok) throw new Error('Failed to load meeting');
      const meeting = await meetingRes.json();
      const participantsStr: string = meeting.participants || '';

      // Parse participant lines: "Name (Role)" or "Name"
      const lines = participantsStr
        .split(/[\r\n]+/)
        .map((l: string) => l.trim())
        .filter(Boolean)
        .slice(0, 20);

      const parsed: Participant[] = lines.map((line: string) => {
        const match = line.match(/^(.+?)\s*\((.+?)\)\s*$/);
        return {
          name: (match ? match[1] : line).trim(),
          role: match ? match[2].trim() : undefined,
          openActionCount: 0,
        };
      });

      // 2. Get confirmed actions to count open tasks per participant
      const actionsRes = await authenticatedFetch(`${apiUrl}/meetings/${id}/confirmed-actions`);
      if (actionsRes.ok) {
        const actions = await actionsRes.json();
        const openByOwner = new Map<string, number>();
        for (const a of actions) {
          if (['PENDING', 'IN_PROGRESS'].includes(a.status)) {
            const owner = a.currentOwner || a.owner;
            if (owner) openByOwner.set(owner, (openByOwner.get(owner) || 0) + 1);
          }
        }
        for (const p of parsed) {
          p.openActionCount = openByOwner.get(p.name) || 0;
        }
      }

      setParticipants(parsed);
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  }, [id, apiUrl]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const openConfirmModal = (name: string) => {
    setTargetName(name);
    setResult(null);
    setConfirmOpen(true);
  };

  const handleMarkUnavailable = async () => {
    setMarking(true);
    try {
      const res = await authenticatedFetch(`${apiUrl}/meetings/${id}/participants/unavailable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: targetName }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to mark participant unavailable');
        setConfirmOpen(false);
        return;
      }

      const data: MarkUnavailableResult = await res.json();
      setResult(data);
    } catch {
      setError('Network error. Please try again.');
      setConfirmOpen(false);
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-bold uppercase text-sm">Loading participants…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Participant Directory
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Mark a participant unavailable to immediately escalate their open actions.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {participants.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 premium-card border-dashed text-center">
          <User className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold text-foreground">No participants listed</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add participant names when creating or editing the meeting.
          </p>
        </div>
      )}

      {/* Participant cards */}
      {participants.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {participants.map((p) => (
            <div
              key={p.name}
              className="premium-card p-5 flex flex-col justify-between group"
            >
              {/* Name + role */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 bg-muted flex items-center justify-center shrink-0 rounded-full text-muted-foreground">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-foreground tracking-tight text-lg leading-tight group-hover:text-primary transition-colors">{p.name}</p>
                  {p.role && (
                    <p className="text-xs text-muted-foreground mt-1">{p.role}</p>
                  )}
                </div>
              </div>

              {/* Open action count */}
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Open Actions</span>
                  <p className={`text-xl font-bold mt-0.5 ${p.openActionCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {p.openActionCount}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openConfirmModal(p.name)}
                  disabled={p.openActionCount === 0}
                  className={`
                    font-medium text-xs h-8 px-3 transition-colors
                    ${p.openActionCount > 0
                      ? 'border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive'
                      : 'border-border text-muted-foreground opacity-50 cursor-not-allowed'
                    }
                  `}
                  title={p.openActionCount === 0 ? 'No open actions to escalate' : `Mark ${p.name} unavailable`}
                >
                  <UserX className="h-3.5 w-3.5 mr-1.5" />
                  Mark Unavailable
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works explanation */}
      <div className="premium-card p-6 space-y-4">
        <p className="text-sm font-semibold text-foreground border-b border-border pb-3">How Escalation Works</p>
        <div className="space-y-4 text-sm text-muted-foreground">
          {[
            { icon: '1', text: 'Marking a participant unavailable immediately triggers the escalation engine for all their open actions.' },
            { icon: '2', text: 'The system ranks all other available participants by ascending open-action count (fewest = rank #1).' },
            { icon: '3', text: 'The suggested replacement receives a notification in the Escalation Inbox and must explicitly accept ownership (with a new deadline) or decline.' },
            { icon: '4', text: 'The original owner and missed deadline are permanently preserved in the action\'s immutable history.' },
          ].map((step) => (
            <div key={step.icon} className="flex items-start gap-3">
              <span className="bg-muted text-foreground text-xs font-semibold w-6 h-6 rounded-md flex items-center justify-center shrink-0">
                {step.icon}
              </span>
              <p className="pt-0.5 leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm Modal */}
      <Dialog open={confirmOpen} onOpenChange={(open) => {
        if (!marking) setConfirmOpen(open);
        if (!open && result) {
          setResult(null);
          fetchData(); // Refresh counts after escalation
        }
      }}>
        <DialogContent className="premium-card border-none max-w-md bg-card">
          {!result ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2 border-b border-border pb-4">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Mark {targetName} Unavailable?
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground pt-4 space-y-3">
                  <span className="block">
                    This will immediately escalate all open actions owned by{' '}
                    <span className="font-medium text-foreground">{targetName}</span>{' '}
                    and suggest a replacement owner for each.
                  </span>
                  <span className="block text-xs">
                    The original owner and missed-deadline history will be permanently retained in each action&apos;s audit trail.
                  </span>
                </DialogDescription>
              </DialogHeader>

              {/* Affected actions preview */}
              {(participants.find(p => p.name === targetName)?.openActionCount ?? 0) > 0 && (
                <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/20 rounded-md p-4 mt-2">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {participants.find(p => p.name === targetName)?.openActionCount} open action{participants.find(p => p.name === targetName)?.openActionCount !== 1 ? 's' : ''} will be escalated
                  </span>
                </div>
              )}

              <DialogFooter className="mt-6 gap-3">
                <Button
                  variant="outline"
                  onClick={() => setConfirmOpen(false)}
                  disabled={marking}
                  className="font-medium bg-transparent border-border hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleMarkUnavailable}
                  disabled={marking}
                  className="bg-destructive hover:bg-destructive/90 text-white font-medium border-none"
                >
                  {marking ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Escalating…</>
                  ) : (
                    'Confirm & Escalate'
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* Success state */
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2 border-b border-border pb-4">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  Escalations Triggered
                </DialogTitle>
                <DialogDescription className="pt-4 text-sm text-muted-foreground space-y-3">
                  <span className="block">
                    <span className="font-medium text-foreground">{result.escalatedActions} action{result.escalatedActions !== 1 ? 's' : ''}</span>{' '}
                    owned by <span className="font-medium text-foreground">{targetName}</span> have been escalated.
                  </span>
                  <span className="block text-xs">
                    Each suggested replacement owner will see the escalation in the Escalation Inbox and must explicitly accept or decline ownership.
                  </span>
                </DialogDescription>
              </DialogHeader>

              {result.escalatedActions > 0 && (
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-4 mt-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    Original owner & missed-deadline history preserved.
                  </span>
                </div>
              )}

              <DialogFooter className="mt-6 gap-3 flex-col sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => { setConfirmOpen(false); fetchData(); }}
                  className="font-medium bg-transparent border-border hover:bg-muted"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setConfirmOpen(false);
                    router.push(`/meetings/${id}/escalations`);
                  }}
                  className="btn-primary"
                >
                  View Escalations <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
}
