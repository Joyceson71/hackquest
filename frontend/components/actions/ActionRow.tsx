'use client';

import { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { ChevronDown, ChevronRight, AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusDropdown from './StatusDropdown';
import EvidenceLink from './EvidenceLink';
import EscalationPanel from './EscalationPanel';

function formatDate(isoString: string | null | undefined) {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return isoString;
  }
}

export interface ReplacementCandidate {
  name: string;
  openActionCount: number;
  rank: number;
}

export interface TimelineEvent {
  event: string;
  actor: string;
  timestamp: string;
  note: string;
}

export interface Correction {
  field: string;
  originalValue: string;
  correctedValue: string;
  correctedBy: string;
  correctedAt: string;
  source?: string;
}

export interface MissedDeadline {
  deadline: string;
  detectedAt: string;
  ownerAtTime: string;
  reason: string;
  gracePeriodHours: number;
}

export interface OwnershipEvent {
  fromOwner: string | null;
  toOwner: string;
  changedBy: string;
  changedAt: string;
  reason: string;
  escalationEventId?: string | null;
}

export interface ConfirmedAction {
  actionId: string;
  sourceProposedItemId?: string | null;
  task: string;
  // Immutable original fields from extraction
  originalOwner: string | null;
  originalDeadline: string | null;
  // Mutable current fields
  currentOwner: string | null;
  owner: string | null; // backward compat alias
  deadline: string | null;
  // Evidence
  evidenceLineStart: number;
  evidenceLineEnd: number;
  evidenceTimestamp?: string | null;
  speakerContext?: string | null;
  resolvedFromRelative?: string | null;
  // Status
  status: string;
  // Escalation
  escalationStatus: string;
  escalationTriggeredAt?: string | null;
  escalationReason?: string | null;
  suggestedReplacementOwner?: string | null;
  replacementRankingSnapshot?: ReplacementCandidate[];
  replacementConfirmedBy?: string | null;
  replacementConfirmedAt?: string | null;
  // History
  corrections: Correction[];
  missedDeadlines: MissedDeadline[];
  ownershipHistory: OwnershipEvent[];
  timeline: TimelineEvent[];
  // Metadata
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  completedAt?: string | null;
}

interface ActionRowProps {
  action: ConfirmedAction;
  meetingId: string;
  currentUserName?: string;
  onStatusChange: (actionId: string, newStatus: string) => void;
  onDeleteAction: (actionId: string) => void;
  onEscalationAction: () => void; // Refresh parent after accept/decline
}

export default function ActionRow({
  action,
  meetingId,
  currentUserName,
  onStatusChange,
  onDeleteAction,
  onEscalationAction,
}: ActionRowProps) {
  const [expanded, setExpanded] = useState(false);

  const isEscalated = action.escalationStatus === 'PENDING_ACCEPTANCE' || action.escalationStatus === 'TRIGGERED';
  const isDeclined = action.escalationStatus === 'DECLINED';
  const ownerChanged = action.originalOwner && action.currentOwner && action.originalOwner !== action.currentOwner;

  const rowBg = isEscalated
    ? 'bg-destructive/10 border-destructive/40'
    : isDeclined
    ? 'bg-yellow-500/10 border-yellow-500/40'
    : 'bg-card border-border';

  return (
    <>
      <TableRow className={`${rowBg} hover:bg-muted/30 transition-colors duration-0 border-b border-border`}>
        {/* Expand toggle */}
        <TableCell className="w-12 border-r border-border text-center p-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 meta-label font-bold text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
            aria-label={expanded ? 'Collapse row' : 'Expand row'}
          >
            {expanded ? '[-]' : '[+]'}
          </button>
        </TableCell>

        {/* Task */}
        <TableCell className="max-w-xs border-r border-border p-4">
          <div className="flex items-start gap-2">
            {isEscalated && (
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-label="Escalated" />
            )}
            <span className="manga-header text-xl text-foreground uppercase leading-relaxed" title={action.task}>
              {action.task}
            </span>
          </div>
        </TableCell>

        {/* Original Owner */}
        {ownerChanged ? (
          <>
            <TableCell className="border-r border-border p-4 bg-muted/20">
              <span className="meta-label text-muted-foreground line-through" title="Original owner from transcript">
                {action.originalOwner}
              </span>
            </TableCell>
            <TableCell className="border-r border-border p-4">
              <span className="meta-label font-bold text-foreground">{action.currentOwner || '—'}</span>
            </TableCell>
          </>
        ) : (
          <>
            <TableCell className="border-r border-border p-4 hidden" />
            <TableCell className="border-r border-border p-4">
              <span className="meta-label font-bold text-foreground">{action.currentOwner || action.owner || '—'}</span>
            </TableCell>
          </>
        )}

        {/* Deadline */}
        <TableCell className="border-r border-border p-4 whitespace-nowrap">
          <span className="meta-label font-bold text-foreground">{formatDate(action.deadline).toUpperCase()}</span>
          {action.originalDeadline && action.deadline !== action.originalDeadline && (
            <div className="meta-label text-[10px] uppercase text-muted-foreground mt-1 tracking-wider opacity-70">
              ORIG: {formatDate(action.originalDeadline).toUpperCase()}
            </div>
          )}
        </TableCell>

        {/* Status */}
        <TableCell className="p-4 border-r border-border">
          <StatusDropdown value={action.status} onChange={(s) => onStatusChange(action.actionId, s)} />
        </TableCell>

        {/* Evidence */}
        <TableCell className="p-4 border-r border-border">
          <EvidenceLink meetingId={meetingId} lineStart={action.evidenceLineStart} lineEnd={action.evidenceLineEnd} />
        </TableCell>

        {/* Actions */}
        <TableCell className="p-4 text-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onDeleteAction(action.actionId)}
            className="h-8 w-8 meta-label font-bold text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors rounded-none"
          >
            [X]
          </Button>
        </TableCell>
      </TableRow>

      {/* Expanded detail row */}
      {expanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/10 px-8 py-8 border-b border-border shadow-inner">
            {/* Escalation Panel — shown first if escalated */}
            {(isEscalated || isDeclined) && (
              <div className="mb-6">
                <EscalationPanel
                  action={action}
                  meetingId={meetingId}
                  currentUserName={currentUserName}
                  onAction={onEscalationAction}
                />
              </div>
            )}

            {/* History Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Ownership history */}
              {action.ownershipHistory && action.ownershipHistory.length > 0 && (
                <div className="space-y-4">
                  <p className="meta-label font-bold text-foreground border-b-2 border-border pb-2">
                    OWNERSHIP CHAIN
                  </p>
                  <div className="space-y-3">
                    {action.ownershipHistory.map((e, i) => (
                      <div key={i} className="flex flex-col meta-label border-l-4 border-foreground pl-4">
                        <span className="font-bold text-foreground">
                          {e.fromOwner ? `${e.fromOwner} → ${e.toOwner}` : `ASSIGNED TO ${e.toOwner}`}
                        </span>
                        <span className="text-muted-foreground">
                          {e.reason.toUpperCase()} // {new Date(e.changedAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missed deadlines */}
              {action.missedDeadlines && action.missedDeadlines.length > 0 && (
                <div className="space-y-4 mt-6 md:mt-0">
                  <p className="meta-label font-bold text-destructive border-b-2 border-border pb-2">
                    MISSED DEADLINES
                  </p>
                  <div className="space-y-3">
                    {action.missedDeadlines.map((md, i) => (
                      <div key={i} className="flex flex-col meta-label border-l-4 border-destructive pl-4 bg-destructive/5 p-2">
                        <span className="font-bold text-destructive">
                          {formatDate(md.deadline).toUpperCase()} MISSED
                        </span>
                        <span className="text-muted-foreground">
                          OWNER: {md.ownerAtTime} // {md.reason.toUpperCase()} // LOGGED: {new Date(md.detectedAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status timeline */}
              <div className="space-y-4">
                <p className="meta-label font-bold text-foreground border-b-2 border-border pb-2">
                  MISSION TIMELINE
                </p>
                {(!action.timeline || action.timeline.length === 0) ? (
                  <p className="meta-label text-muted-foreground py-1">NO EVENTS DETECTED.</p>
                ) : (
                  <div className="space-y-3">
                    {action.timeline.map((t, i) => (
                      <div key={i} className="flex flex-col meta-label border-l-4 border-primary pl-4">
                        <span className="font-bold text-foreground">{t.event.toUpperCase()}</span>
                        <span className="text-muted-foreground">
                          OP: {t.actor} // {new Date(t.timestamp).toLocaleString()}
                        </span>
                        {t.note && <span className="text-muted-foreground">NOTE: {t.note.toUpperCase()}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Corrections */}
              {action.corrections && action.corrections.length > 0 && (
                <div className="space-y-4 mt-6">
                  <p className="meta-label font-bold text-foreground border-b-2 border-border pb-2">
                    SYSTEM CORRECTIONS
                  </p>
                  <div className="space-y-3">
                    {action.corrections.map((c, i) => (
                      <div key={i} className="flex flex-col meta-label border-l-4 border-foreground pl-4">
                        <span className="font-bold text-foreground">
                          {c.field.toUpperCase()}: &quot;{c.originalValue}&quot; &gt; &quot;{c.correctedValue}&quot;
                        </span>
                        <span className="text-muted-foreground">
                          SOURCE: {c.source || 'REVIEW'} // {new Date(c.correctedAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
