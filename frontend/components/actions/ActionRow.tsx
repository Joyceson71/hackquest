'use client';

import { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { ChevronDown, ChevronRight } from 'lucide-react';
import StatusDropdown from './StatusDropdown';
import EvidenceLink from './EvidenceLink';
import CorrectionTimeline, { Correction } from './CorrectionTimeline';

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
}

export default function ActionRow({ action, meetingId, onStatusChange }: ActionRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow className="hover:bg-muted/30 transition-colors duration-150">
        <TableCell className="w-8">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label={expanded ? 'Collapse corrections' : 'Expand corrections'}
          >
            {expanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
          </button>
        </TableCell>
        <TableCell className="max-w-xs">
          <span className="line-clamp-2 text-sm" title={action.task}>{action.task}</span>
        </TableCell>
        <TableCell className="text-sm">{action.owner || '—'}</TableCell>
        <TableCell className="text-sm whitespace-nowrap">{action.deadline || '—'}</TableCell>
        <TableCell>
          <StatusDropdown value={action.status} onChange={(s) => onStatusChange(action.actionId, s)} />
        </TableCell>
        <TableCell>
          <EvidenceLink meetingId={meetingId} lineStart={action.evidenceLineStart} lineEnd={action.evidenceLineEnd} />
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/20 px-8 py-4">
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
