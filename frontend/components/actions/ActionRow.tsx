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
      <TableRow className={`${rowBg} hover:bg-muted/60 transition-colors duration-150 border-b-4`}>
        {/* Expand toggle */}
        <TableCell className="w-12 border-r-4 border-border text-center p-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded bg-foreground text-background hover:bg-primary transition-colors shadow-brutal-sm border-2 border-border cursor-pointer"
            aria-label={expanded ? 'Collapse row' : 'Expand row'}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </TableCell>

        {/* Task */}
        <TableCell className="max-w-xs border-r-4 border-border p-3">
          <div className="flex items-start gap-2">
            {isEscalated && (
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-label="Escalated" />
            )}
            <span className="line-clamp-2 font-bold uppercase text-foreground text-sm" title={action.task}>
              {action.task}
            </span>
          </div>
        </TableCell>

        {/* Original Owner (muted, only if different from current) */}
        {ownerChanged ? (
          <>
            <TableCell className="border-r-4 border-border p-3 bg-muted/30">
              <span className="text-sm font-medium text-muted-foreground uppercase line-through" title="Original owner from transcript">
                {action.originalOwner}
              </span>
            </TableCell>
            <TableCell className="border-r-4 border-border p-3">
              <span className="text-sm font-bold text-foreground uppercase">{action.currentOwner || '—'}</span>
            </TableCell>
          </>
        ) : (
          <>
            <TableCell className="border-r-4 border-border p-3 hidden" />
            <TableCell className="border-r-4 border-border p-3 bg-muted">
              <span className="text-sm font-bold text-foreground uppercase">{action.currentOwner || action.owner || '—'}</span>
            </TableCell>
          </>
        )}

        {/* Deadline */}
        <TableCell className="border-r-4 border-border p-3 bg-muted whitespace-nowrap">
          <span className="text-sm font-bold text-foreground uppercase">{formatDate(action.deadline)}</span>
          {action.originalDeadline && action.deadline !== action.originalDeadline && (
            <div className="text-xs text-muted-foreground mt-0.5">
              orig: {formatDate(action.originalDeadline)}
            </div>
          )}
        </TableCell>

        {/* Status */}
        <TableCell className="p-3 border-r-4 border-border">
          <StatusDropdown value={action.status} onChange={(s) => onStatusChange(action.actionId, s)} />
        </TableCell>

        {/* Evidence */}
        <TableCell className="p-3 border-r-4 border-border">
          <EvidenceLink meetingId={meetingId} lineStart={action.evidenceLineStart} lineEnd={action.evidenceLineEnd} />
        </TableCell>

        {/* Actions */}
        <TableCell className="p-3 text-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onDeleteAction(action.actionId)}
            className="h-10 w-10 border-2 border-border shadow-brutal-sm bg-card text-foreground hover:bg-destructive hover:text-background transition-colors"
          >
            <Trash2 className="h-5 w-5 stroke-[3]" />
          </Button>
        </TableCell>
      </TableRow>

      {/* Expanded detail row */}
      {expanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/40 px-6 py-4 border-b-4 border-border">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ownership history */}
              {action.ownershipHistory && action.ownershipHistory.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b-2 border-border pb-1">
                    Ownership Chain
                  </p>
                  <div className="space-y-2">
                    {action.ownershipHistory.map((e, i) => (
                      <div key={i} className="flex flex-col gap-0.5 text-xs border-l-2 border-accent/50 pl-3">
                        <span className="font-bold text-foreground">
                          {e.fromOwner ? `${e.fromOwner} → ${e.toOwner}` : `Assigned to ${e.toOwner}`}
                        </span>
                        <span className="text-muted-foreground">
                          {e.reason} · {new Date(e.changedAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missed deadlines */}
              {action.missedDeadlines && action.missedDeadlines.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b-2 border-border pb-1">
                    Missed Deadlines
                  </p>
                  <div className="space-y-2">
                    {action.missedDeadlines.map((md, i) => (
                      <div key={i} className="flex flex-col gap-0.5 text-xs border-l-2 border-destructive/50 pl-3">
                        <span className="font-bold text-destructive">
                          {formatDate(md.deadline)} missed
                        </span>
                        <span className="text-muted-foreground">
                          Owner at time: {md.ownerAtTime} · {md.reason} · Detected {new Date(md.detectedAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status timeline */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b-2 border-border pb-1">
                  Activity Timeline
                </p>
                {(!action.timeline || action.timeline.length === 0) ? (
                  <p className="text-xs text-muted-foreground py-1">No timeline events.</p>
                ) : (
                  <div className="space-y-2">
                    {action.timeline.map((t, i) => (
                      <div key={i} className="flex flex-col gap-0.5 text-xs border-l-2 border-primary/30 pl-3">
                        <span className="font-medium text-foreground">{t.event}</span>
                        <span className="text-muted-foreground">
                          by {t.actor} · {new Date(t.timestamp).toLocaleString()}
                        </span>
                        {t.note && <span className="text-muted-foreground italic">Note: {t.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Corrections */}
              {action.corrections && action.corrections.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b-2 border-border pb-1">
                    Corrections Applied
                  </p>
                  <div className="space-y-2">
                    {action.corrections.map((c, i) => (
                      <div key={i} className="flex flex-col gap-0.5 text-xs border-l-2 border-secondary/50 pl-3">
                        <span className="font-medium text-foreground capitalize">
                          {c.field}: &quot;{c.originalValue}&quot; → &quot;{c.correctedValue}&quot;
                        </span>
                        <span className="text-muted-foreground">
                          {c.source || 'REVIEW'} · {new Date(c.correctedAt).toLocaleString()}
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
