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
    } catch (e: any) {
      setError(e.message || 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  }, [id, apiUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      <div>
        <h2 className="text-xl font-black text-foreground uppercase flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Participant Directory
        </h2>
        <p className="text-sm text-muted-foreground mt-1 font-bold uppercase">
          Mark a participant unavailable to immediately escalate their open actions.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border-4 border-destructive/40 text-destructive font-bold uppercase text-sm">
          {error}
        </div>
      )}

      {participants.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 bg-card border-4 border-border shadow-brutal text-center">
          <User className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-black uppercase text-foreground">No participants listed</h3>
          <p className="text-sm text-muted-foreground font-bold uppercase mt-2">
            Add participant names when creating or editing the meeting.
          </p>
        </div>
      )}

      {/* Participant cards */}
      {participants.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {participants.map((p) => (
            <div
              key={p.name}
              className="bg-card border-4 border-border shadow-brutal p-5 flex flex-col gap-3"
            >
              {/* Name + role */}
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 border-2 border-primary/30 p-2 shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-black text-foreground uppercase text-sm">{p.name}</p>
                  {p.role && (
                    <p className="text-xs text-muted-foreground font-bold mt-0.5">{p.role}</p>
                  )}
                </div>
              </div>

              {/* Open action count */}
              <div className="flex items-center justify-between border-t-2 border-border pt-3">
                <div>
                  <span className="text-xs font-black uppercase text-muted-foreground">Open Actions</span>
                  <p className={`text-2xl font-black ${p.openActionCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {p.openActionCount}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openConfirmModal(p.name)}
                  disabled={p.openActionCount === 0}
                  className={`
                    font-black uppercase border-2 shadow-brutal-sm text-xs cursor-pointer
                    ${p.openActionCount > 0
                      ? 'border-destructive text-destructive hover:bg-destructive hover:text-background'
                      : 'border-border text-muted-foreground opacity-40 cursor-not-allowed'
                    }
                  `}
                  title={p.openActionCount === 0 ? 'No open actions to escalate' : `Mark ${p.name} unavailable`}
                >
                  <UserX className="h-4 w-4 mr-1.5" />
                  Mark Unavailable
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works explanation */}
      <div className="bg-card border-4 border-border p-5 space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">How This Works</p>
        <div className="space-y-2 text-sm text-muted-foreground">
          {[
            { icon: '1', text: 'Marking a participant unavailable immediately triggers the escalation engine for all their open actions.' },
            { icon: '2', text: 'The system ranks all other available participants by ascending open-action count (fewest = rank #1).' },
            { icon: '3', text: 'The suggested replacement receives a notification in the Escalation Inbox and must explicitly accept ownership (with a new deadline) or decline.' },
            { icon: '4', text: 'The original owner and missed deadline are permanently preserved in the action\'s immutable history — they cannot be erased.' },
          ].map((step) => (
            <div key={step.icon} className="flex items-start gap-3">
              <span className="bg-primary text-background text-xs font-black w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 border border-border">
                {step.icon}
              </span>
              <p>{step.text}</p>
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
        <DialogContent className="border-4 border-border shadow-brutal bg-card max-w-md">
          {!result ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase text-foreground flex items-center gap-3">
                  <AlertTriangle className="h-7 w-7 text-destructive" />
                  Mark {targetName} Unavailable?
                </DialogTitle>
                <DialogDescription className="text-sm font-bold text-muted-foreground pt-2 space-y-2">
                  <span className="block">
                    This will immediately escalate all open actions owned by{' '}
                    <span className="font-black text-foreground">{targetName}</span>{' '}
                    and suggest a replacement owner for each.
                  </span>
                  <span className="block text-xs">
                    The original owner and missed-deadline history will be permanently retained in each action's audit trail.
                  </span>
                </DialogDescription>
              </DialogHeader>

              {/* Affected actions preview */}
              {participants.find(p => p.name === targetName)?.openActionCount > 0 && (
                <div className="flex items-center gap-2 bg-destructive/10 border-2 border-destructive/30 p-3 mt-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm font-bold text-foreground">
                    {participants.find(p => p.name === targetName)?.openActionCount} open action{participants.find(p => p.name === targetName)?.openActionCount !== 1 ? 's' : ''} will be escalated
                  </span>
                </div>
              )}

              <DialogFooter className="mt-4 gap-3 flex-col sm:flex-row">
                <Button
                  onClick={handleMarkUnavailable}
                  disabled={marking}
                  className="bg-destructive text-background font-black uppercase border-2 border-border shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none cursor-pointer"
                >
                  {marking ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Escalating…</>
                  ) : (
                    'Confirm & Escalate'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmOpen(false)}
                  disabled={marking}
                  className="font-black uppercase border-2 border-border shadow-brutal bg-card text-foreground hover:bg-muted cursor-pointer"
                >
                  Cancel
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* Success state */
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase text-foreground flex items-center gap-3">
                  <CheckCircle className="h-7 w-7 text-primary" />
                  Escalations Triggered
                </DialogTitle>
                <DialogDescription className="pt-2 text-sm font-bold text-muted-foreground space-y-2">
                  <span className="block">
                    <span className="font-black text-foreground">{result.escalatedActions} action{result.escalatedActions !== 1 ? 's' : ''}</span>{' '}
                    owned by <span className="font-black text-foreground">{targetName}</span> have been escalated.
                  </span>
                  <span className="block text-xs">
                    Each suggested replacement owner will see the escalation in the Escalation Inbox and must explicitly accept or decline ownership.
                  </span>
                </DialogDescription>
              </DialogHeader>

              {result.escalatedActions > 0 && (
                <div className="flex items-center gap-2 bg-primary/10 border-2 border-primary/30 p-3 mt-2">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-bold text-foreground">
                    Original owner & missed-deadline history preserved in each action's audit trail.
                  </span>
                </div>
              )}

              <DialogFooter className="mt-4 gap-3 flex-col sm:flex-row">
                <Button
                  onClick={() => {
                    setConfirmOpen(false);
                    router.push(`/meetings/${id}/escalations`);
                  }}
                  className="bg-primary text-background font-black uppercase border-2 border-border shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none cursor-pointer"
                >
                  View Escalations <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setConfirmOpen(false); fetchData(); }}
                  className="font-black uppercase border-2 border-border shadow-brutal bg-card text-foreground hover:bg-muted cursor-pointer"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
