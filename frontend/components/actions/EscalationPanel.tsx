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
    } catch (e) {
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
    <div className={`rounded-none border-4 p-5 space-y-4 ${isDeclined ? 'border-yellow-500 bg-yellow-500/5' : 'border-destructive bg-destructive/5'}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertTriangle className={`h-5 w-5 shrink-0 ${isDeclined ? 'text-yellow-500' : 'text-destructive'}`} />
        <h3 className="font-black uppercase text-sm text-foreground">
          {isDeclined
            ? 'Escalation Declined — Organizer Action Required'
            : isSuggestedReplacement
            ? 'You have been suggested as replacement owner'
            : 'Escalated — Awaiting Replacement Acceptance'}
        </h3>
      </div>

      {/* Escalation context */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-4 w-4 shrink-0" />
          <span>Original owner: <span className="font-bold text-foreground">{action.originalOwner || '—'}</span></span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <span>Original deadline: <span className="font-bold text-destructive">{formatDate(action.originalDeadline)} (missed)</span></span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground col-span-full">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Reason: <span className="font-bold text-foreground">{escalationReasonLabel(action.escalationReason)}</span></span>
        </div>
      </div>

      {/* Evidence */}
      {action.evidenceTimestamp && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground border-l-4 border-primary/40 pl-3 py-1">
          <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Evidence: [{action.evidenceTimestamp}]{action.speakerContext ? ` ${action.speakerContext}:` : ''} "{action.task}"
          </span>
        </div>
      )}

      {/* Suggested replacement + candidate ranking */}
      {action.replacementRankingSnapshot && action.replacementRankingSnapshot.length > 0 && !isDeclined && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Suggested Replacement</p>
          </div>
          {/* Highlight rank 1 */}
          <div className="border-2 border-primary/50 bg-primary/5 p-3 flex items-center justify-between">
            <span className="font-black text-foreground text-sm">{action.suggestedReplacementOwner || action.replacementRankingSnapshot[0]?.name}</span>
            <span className="text-xs text-muted-foreground">
              {action.replacementRankingSnapshot[0]?.openActionCount} open actions · Rank #1
            </span>
          </div>
          {/* Full list */}
          {action.replacementRankingSnapshot.length > 1 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-bold uppercase">All candidates:</p>
              {action.replacementRankingSnapshot.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-xs border-l-2 border-border pl-2 py-0.5">
                  <span className="text-foreground">#{c.rank} {c.name}</span>
                  <span className="text-muted-foreground">{c.openActionCount} open actions</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Waiting message — not the suggested replacement */}
      {!isSuggestedReplacement && !isDeclined && action.suggestedReplacementOwner && (
        <p className="text-sm text-muted-foreground italic border-l-4 border-border pl-3">
          Waiting for <span className="font-bold text-foreground">{action.suggestedReplacementOwner}</span> to accept or decline.
        </p>
      )}

      {/* Accept form — only shown to the suggested replacement */}
      {isSuggestedReplacement && !isDeclined && (
        <div className="space-y-3 pt-2 border-t-2 border-border">
          <p className="text-sm text-muted-foreground">
            Your current open actions: <span className="font-bold text-foreground">
              {action.replacementRankingSnapshot?.find(c => c.name.toLowerCase() === currentUserName?.toLowerCase())?.openActionCount ?? '—'}
            </span>
          </p>

          {error && (
            <p className="text-xs text-destructive font-bold bg-destructive/10 border border-destructive/30 px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-1">
            <Label htmlFor={`new-deadline-${action.actionId}`} className="text-xs font-black uppercase">
              Set a new deadline (required to accept)
            </Label>
            <Input
              id={`new-deadline-${action.actionId}`}
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="border-2 border-border font-bold max-w-xs shadow-brutal-sm"
              required
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleAccept}
              disabled={accepting || declining || !newDeadline}
              className="bg-primary text-background font-black uppercase border-2 border-border shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none cursor-pointer"
            >
              {accepting ? 'Accepting…' : 'Accept Ownership'}
            </Button>
            <Button
              variant="outline"
              onClick={handleDecline}
              disabled={accepting || declining}
              className="font-black uppercase border-2 border-border shadow-brutal bg-card text-foreground hover:bg-destructive hover:text-background hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none cursor-pointer"
            >
              {declining ? 'Declining…' : 'Decline'}
            </Button>
          </div>
        </div>
      )}

      {/* Declined state */}
      {isDeclined && (
        <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400 border-l-4 border-yellow-500 pl-3">
          Escalation was declined. Organizer must manually reassign this task to another participant.
        </p>
      )}
    </div>
  );
}
