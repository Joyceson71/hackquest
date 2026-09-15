'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink, Check, Pencil, UserRound, X } from 'lucide-react';
import ConfidenceBadge from './ConfidenceBadge';
import EditConfirmForm from './EditConfirmForm';
import { authenticatedFetch } from '@/lib/api';

function formatDate(isoString: string | null) {
  if (!isoString) return 'No deadline stated';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return isoString;
  }
}

export interface ProposedItem {
  itemId: string;
  type: string;
  rawText: string;
  suggestedOwner: string | null;
  suggestedDeadline: string | null;
  confidenceScore: number;
  confidenceReason: string;
  evidenceLineStart: number;
  evidenceLineEnd: number;
}

interface Props {
  item: ProposedItem;
  participants: string[];
  meetingId: string;
  onProcessed: (itemId: string, action: 'CONFIRM' | 'REJECT') => void;
}

export default function ProposedItemCard({ item, participants, meetingId, onProcessed }: Props) {
  const [mode, setMode] = useState<'view' | 'edit' | 'reassign' | 'reject'>('view');
  const [loading, setLoading] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [reassignOwner, setReassignOwner] = useState(item.suggestedOwner || '');

  const handleAction = async (action: 'CONFIRM' | 'REJECT', overrides?: { task?: string; owner?: string; deadline?: string }) => {
    setLoading(true);
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
      await authenticatedFetch(`${apiUrl}/meetings/${meetingId}/proposed-items/${item.itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          task: overrides?.task || item.rawText,
          owner: overrides?.owner || item.suggestedOwner || '',
          deadline: overrides?.deadline || item.suggestedDeadline || '',
          evidenceLineStart: item.evidenceLineStart,
          evidenceLineEnd: item.evidenceLineEnd,
          rejectionNote: action === 'REJECT' ? rejectionNote : undefined,
        }),
      });
      onProcessed(item.itemId, action);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="manga-panel p-8 mb-4 hover:shadow-[12px_12px_0px_0px_rgba(26,26,26,1)] transition-shadow duration-300">
      <div className="space-y-6">
        {/* Header: Type badge + Evidence link */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-border pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="meta-label text-foreground font-bold border-2 border-foreground px-3 py-1">
              {item.type.toUpperCase()}
            </span>
            <ConfidenceBadge score={item.confidenceScore} reason={item.confidenceReason} />
          </div>
          <a
            href={`/meetings/${meetingId}/transcript#L${item.evidenceLineStart}${item.evidenceLineEnd !== item.evidenceLineStart ? `-${item.evidenceLineEnd}` : ''}`}
            target="_blank"
            rel="noreferrer"
            className="meta-label text-muted-foreground font-bold hover:text-primary transition-colors"
          >
            LINES {item.evidenceLineStart}{item.evidenceLineEnd !== item.evidenceLineStart ? `–${item.evidenceLineEnd}` : ''} &gt;
          </a>
        </div>

        {/* Proposed text */}
        <p className="manga-header text-3xl leading-snug text-foreground border-l-4 border-primary pl-6 py-2">{item.rawText}</p>

        {/* Metadata */}
        <div className="flex flex-wrap gap-x-8 gap-y-4 meta-label pt-4 font-bold tracking-widest">
          <span className="text-muted-foreground">OWNER: <strong className="text-foreground">{item.suggestedOwner || 'NONE'}</strong></span>
          <span className="text-muted-foreground">DEADLINE: <strong className="text-foreground">{formatDate(item.suggestedDeadline).toUpperCase()}</strong></span>
        </div>

        {/* Action buttons — View mode */}
        {mode === 'view' && (
          <div className="flex flex-wrap gap-0 pt-6 mt-4 border-t-2 border-border border-b-2">
            <Button onClick={() => handleAction('CONFIRM')} disabled={loading} className="btn-primary rounded-none meta-label flex-1 sm:flex-none h-12 px-8 border-r-2 border-border">
              CONFIRM
            </Button>
            <Button variant="outline" onClick={() => setMode('edit')} disabled={loading} className="rounded-none meta-label bg-transparent border-y-0 border-l-0 border-r-2 border-border hover:bg-muted flex-1 sm:flex-none h-12 px-8 text-foreground font-bold tracking-widest">
              EDIT
            </Button>
            <Button variant="outline" onClick={() => setMode('reassign')} disabled={loading} className="rounded-none meta-label bg-transparent border-y-0 border-l-0 border-r-2 border-border hover:bg-muted flex-1 sm:flex-none h-12 px-8 text-foreground font-bold tracking-widest">
              REASSIGN
            </Button>
            <Button variant="outline" onClick={() => setMode('reject')} disabled={loading} className="rounded-none meta-label font-bold tracking-widest bg-transparent border-y-0 border-x-0 border-border hover:bg-destructive hover:text-destructive-foreground text-destructive flex-1 sm:flex-none ml-auto h-12 px-8">
              REJECT
            </Button>
          </div>
        )}

        {/* Edit mode */}
        {mode === 'edit' && (
          <div className="pt-2">
            <EditConfirmForm
              initialTask={item.rawText}
              initialOwner={item.suggestedOwner || ''}
              initialDeadline={item.suggestedDeadline || ''}
              participants={participants}
              loading={loading}
              onConfirm={(task, owner, deadline) => handleAction('CONFIRM', { task, owner, deadline })}
              onCancel={() => setMode('view')}
            />
          </div>
        )}

        {/* Reassign mode */}
        {mode === 'reassign' && (
          <div className="space-y-6 pt-6 border-t-2 border-border mt-4">
            <Select value={reassignOwner} onValueChange={(val) => setReassignOwner(val || '')}>
              <SelectTrigger className="w-full bg-transparent border-b-2 border-t-0 border-x-0 border-border rounded-none meta-label h-12 px-0 focus:ring-0 font-bold tracking-widest">
                <SelectValue placeholder="SELECT NEW OWNER" />
              </SelectTrigger>
              <SelectContent className="rounded-none meta-label font-bold tracking-widest">
                {participants.map((p) => (
                  <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-4 justify-end">
              <Button variant="outline" onClick={() => setMode('view')} disabled={loading} className="meta-label rounded-none border-border font-bold">
                CANCEL
              </Button>
              <Button onClick={() => handleAction('CONFIRM', { owner: reassignOwner })} disabled={loading || !reassignOwner} className="btn-primary meta-label rounded-none h-10 px-6 font-bold">
                CONFIRM REASSIGNMENT
              </Button>
            </div>
          </div>
        )}

        {/* Reject mode */}
        {mode === 'reject' && (
          <div className="space-y-6 pt-6 border-t-2 border-border mt-4">
            <Textarea
              placeholder="OPTIONAL REJECTION NOTE..."
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              className="min-h-[100px] bg-transparent border-2 border-border rounded-none meta-label font-bold tracking-widest resize-none p-4"
            />
            <div className="flex gap-4 justify-end">
              <Button variant="outline" onClick={() => setMode('view')} disabled={loading} className="meta-label rounded-none border-border font-bold">
                CANCEL
              </Button>
              <Button variant="destructive" onClick={() => handleAction('REJECT')} disabled={loading} className="meta-label rounded-none h-10 px-6 font-bold border border-destructive">
                CONFIRM REJECTION
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
