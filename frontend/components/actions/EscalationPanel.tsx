'use client';

import { useState } from 'react';
import { AlertTriangle, Clock, User, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authenticatedFetch } from '@/lib/api';
import type { ConfirmedAction } from './ActionRow';

interface EscalationPanelProps {
  action: ConfirmedAction;
  meetingId: string;
  currentUserName?: string;
  onAction: () => void;
}

function formatDate(isoString: string | null | undefined) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return isNaN(d.getTime()) ? isoString : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return isoString ?? '—'; }
}

function escalationReasonLabel(reason: string | null | undefined) {
  switch (reason) {
    case 'DEADLINE_PASSED_INACTIVE': return '24h passed with no status update after deadline';
    case 'OWNER_UNAVAILABLE': return 'Owner marked as unavailable';
    case 'BOTH': return 'Deadline missed and owner marked unavailable';
    default: return 'Escalation triggered';
  }
}

export default function EscalationPanel({ action, meetingId, currentUserName, onAction }: EscalationPanelProps) {
  const [newDeadline, setNewDeadline] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState('');

  const isDeclined = action.escalationStatus === 'DECLINED';
  const isSuggestedReplacement =
    currentUserName &&
    action.suggestedReplacementOwner &&
    action.suggestedReplacementOwner.toLowerCase() === currentUserName.toLowerCase();

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

  const handleAccept = async () => {
    if (!newDeadline) {
      setError('You must set a new deadline to accept ownership.');
      return;
    }
    setError('');
    setAccepting(true);
    try {
      const res = await authenticatedFetch(
        `${apiUrl}/meetings/${meetingId}/confirmed-actions/${action.actionId}/escalation/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newDeadline }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to accept. Please try again.');
        return;
      }
      onAction();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    setError('');
    try {
      const res = await authenticatedFetch(
        `${apiUrl}/meetings/${meetingId}/confirmed-actions/${action.actionId}/escalation/decline`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      );
      if (!res.ok) {
        setError('Failed to decline. Please try again.');
        return;
      }
      onAction();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setDeclining(false);
    }
  };

  return (
    <div className={`rounded-xl border p-5 space-y-5 transition-all ${isDeclined ? 'border-amber-500/30 bg-amber-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/5 pb-3">
        <AlertTriangle className={`h-5 w-5 shrink-0 ${isDeclined ? 'text-amber-500' : 'text-destructive'}`} />
        <h3 className="font-heading font-semibold text-foreground tracking-tight">
          {isDeclined
            ? 'Escalation Declined — Organizer Action Required'
            : isSuggestedReplacement
            ? 'You have been suggested as replacement owner'
            : 'Escalated — Awaiting Replacement Acceptance'}
        </h3>
      </div>

      {/* Escalation context */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-foreground/10 rounded-lg p-4">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <User className="h-4 w-4 shrink-0 text-foreground/50" />
          <span>Original owner: <span className="font-semibold text-foreground">{action.originalOwner || '—'}</span></span>
        </div>
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0 text-foreground/50" />
          <span>Original deadline: <span className="font-semibold text-destructive">{formatDate(action.originalDeadline)} (missed)</span></span>
        </div>
        <div className="flex items-center gap-2.5 text-muted-foreground col-span-full pt-2 border-t border-white/5 mt-1">
          <AlertTriangle className="h-4 w-4 shrink-0 text-foreground/50" />
          <span>Reason: <span className="font-semibold text-foreground">{escalationReasonLabel(action.escalationReason)}</span></span>
        </div>
      </div>

      {/* Evidence */}
      {action.evidenceTimestamp && (
        <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-primary/5 rounded-lg border border-primary/10 p-3">
          <FileText className="h-4 w-4 shrink-0 mt-0.5 text-primary/70" />
          <span className="leading-relaxed">
            Evidence: [{action.evidenceTimestamp}]{action.speakerContext ? ` ${action.speakerContext}:` : ''} &quot;{action.task}&quot;
          </span>
        </div>
      )}

      {/* Suggested replacement + candidate ranking */}
      {action.replacementRankingSnapshot && action.replacementRankingSnapshot.length > 0 && !isDeclined && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Suggested Replacement</p>
          </div>
          {/* Highlight rank 1 */}
          <div className="border border-primary/30 bg-primary/10 rounded-lg p-3.5 flex items-center justify-between shadow-sm">
            <span className="font-semibold text-foreground text-sm">{action.suggestedReplacementOwner || action.replacementRankingSnapshot[0]?.name}</span>
            <span className="text-xs text-muted-foreground font-medium">
              {action.replacementRankingSnapshot[0]?.openActionCount} open actions · Rank #1
            </span>
          </div>
          {/* Full list */}
          {action.replacementRankingSnapshot.length > 1 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase px-1">All candidates:</p>
              {action.replacementRankingSnapshot.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-xs border-l-2 border-white/10 pl-3 py-1">
                  <span className="text-foreground font-medium">#{c.rank} {c.name}</span>
                  <span className="text-muted-foreground">{c.openActionCount} open actions</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Waiting message — not the suggested replacement */}
      {!isSuggestedReplacement && !isDeclined && action.suggestedReplacementOwner && (
        <p className="text-sm text-muted-foreground italic border-l-2 border-white/20 pl-3 py-1">
          Waiting for <span className="font-semibold text-foreground">{action.suggestedReplacementOwner}</span> to accept or decline.
        </p>
      )}

      {/* Accept form — only shown to the suggested replacement */}
      {isSuggestedReplacement && !isDeclined && (
        <div className="space-y-4 pt-4 border-t border-white/10 mt-2">
          <p className="text-sm text-muted-foreground">
            Your current open actions: <span className="font-semibold text-foreground">
              {action.replacementRankingSnapshot?.find(c => c.name.toLowerCase() === currentUserName?.toLowerCase())?.openActionCount ?? '—'}
            </span>
          </p>

          {error && (
            <p className="text-xs text-destructive font-medium bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor={`new-deadline-${action.actionId}`} className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
              Set a new deadline (required to accept)
            </Label>
            <Input
              id={`new-deadline-${action.actionId}`}
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="border-white/10 bg-foreground/20 rounded-xl font-medium max-w-xs focus-visible:border-primary h-11 transition-colors"
              required
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              onClick={handleAccept}
              disabled={accepting || declining || !newDeadline}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 rounded-xl shadow-lg shadow-primary/20 transition-all border-none"
            >
              {accepting ? 'Accepting…' : 'Accept Ownership'}
            </Button>
            <Button
              variant="outline"
              onClick={handleDecline}
              disabled={accepting || declining}
              className="font-semibold bg-transparent border border-white/10 text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 rounded-xl transition-all"
            >
              {declining ? 'Declining…' : 'Decline'}
            </Button>
          </div>
        </div>
      )}

      {/* Declined state */}
      {isDeclined && (
        <p className="text-sm font-medium text-amber-500 border-l-2 border-amber-500/50 bg-amber-500/10 p-3 rounded-r-lg">
          Escalation was declined. Organizer must manually reassign this task to another participant.
        </p>
      )}
    </div>
  );
}
