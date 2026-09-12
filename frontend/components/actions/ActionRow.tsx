'use client';

import { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusDropdown from './StatusDropdown';
import EvidenceLink from './EvidenceLink';
import CorrectionTimeline, { Correction } from './CorrectionTimeline';

function formatDate(isoString: string) {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return isoString;
  }
}

export interface TimelineEvent {
  event: string;
  actor: string;
  timestamp: string;
  note: string;
}

export interface ConfirmedAction {
  actionId: string;
  task: string;
  owner: string;
  deadline: string;
  status: string;
  evidenceLineStart: number;
  evidenceLineEnd: number;
  corrections: Correction[];
  timeline: TimelineEvent[];
}

interface ActionRowProps {
  action: ConfirmedAction;
  meetingId: string;
  onStatusChange: (actionId: string, newStatus: string) => void;
  onDeleteAction: (actionId: string) => void;
}

export default function ActionRow({ action, meetingId, onStatusChange, onDeleteAction }: ActionRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow className="bg-card hover:bg-muted transition-colors duration-150 border-b-4 border-border">
        <TableCell className="w-12 border-r-4 border-border text-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded bg-foreground text-background hover:bg-primary transition-colors shadow-brutal-sm border-2 border-border"
            aria-label={expanded ? 'Collapse corrections' : 'Expand corrections'}
          >
            {expanded
              ? <ChevronDown className="h-5 w-5" />
              : <ChevronRight className="h-5 w-5" />
            }
          </button>
        </TableCell>
        <TableCell className="max-w-xs border-r-4 border-border p-4">
          <span className="line-clamp-2 text-lg font-bold uppercase text-foreground" title={action.task}>{action.task}</span>
        </TableCell>
        <TableCell className="text-lg font-bold text-foreground border-r-4 border-border uppercase p-4 bg-muted">{action.owner || '—'}</TableCell>
        <TableCell className="text-lg font-bold text-foreground whitespace-nowrap border-r-4 border-border uppercase p-4 bg-muted">{formatDate(action.deadline)}</TableCell>
        <TableCell className="p-4 border-r-4 border-border">
          <StatusDropdown value={action.status} onChange={(s) => onStatusChange(action.actionId, s)} />
        </TableCell>
        <TableCell className="p-4 border-r-4 border-border bg-secondary">
          <EvidenceLink meetingId={meetingId} lineStart={action.evidenceLineStart} lineEnd={action.evidenceLineEnd} />
        </TableCell>
        <TableCell className="p-4 text-center">
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
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted px-8 py-4 border-b-4 border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <CorrectionTimeline corrections={action.corrections || []} />
              
              <div className="space-y-3 py-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status Timeline</p>
                {(!action.timeline || action.timeline.length === 0) ? (
                  <p className="text-xs text-muted-foreground py-2">No timeline events recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {action.timeline.map((t, i) => (
                      <div key={i} className="flex flex-col gap-1 text-xs border-l-2 border-primary/30 pl-3">
                        <span className="font-medium text-foreground">{t.event}</span>
                        <span className="text-muted-foreground">
                          by {t.actor} at {new Date(t.timestamp).toLocaleString()}
                        </span>
                        {t.note && <span className="text-muted-foreground italic">Note: {t.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
