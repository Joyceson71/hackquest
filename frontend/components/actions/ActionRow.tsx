'use client';

import { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
}

export default function ActionRow({ action, meetingId, onStatusChange }: ActionRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow className="bg-white hover:bg-muted transition-colors duration-150 border-b-4 border-black">
        <TableCell className="w-12 border-r-4 border-black text-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded bg-black text-white hover:bg-primary transition-colors shadow-brutal-sm border-2 border-black"
            aria-label={expanded ? 'Collapse corrections' : 'Expand corrections'}
          >
            {expanded
              ? <ChevronDown className="h-5 w-5" />
              : <ChevronRight className="h-5 w-5" />
            }
          </button>
        </TableCell>
        <TableCell className="max-w-xs border-r-4 border-black p-4">
          <span className="line-clamp-2 text-lg font-bold uppercase text-black" title={action.task}>{action.task}</span>
        </TableCell>
        <TableCell className="text-lg font-bold text-black border-r-4 border-black uppercase p-4 bg-muted">{action.owner || '—'}</TableCell>
        <TableCell className="text-lg font-bold text-black whitespace-nowrap border-r-4 border-black uppercase p-4 bg-muted">{formatDate(action.deadline)}</TableCell>
        <TableCell className="p-4 border-r-4 border-black">
          <StatusDropdown value={action.status} onChange={(s) => onStatusChange(action.actionId, s)} />
        </TableCell>
        <TableCell className="p-4 bg-secondary">
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
