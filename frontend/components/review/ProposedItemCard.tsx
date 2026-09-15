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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, x: -4, boxShadow: '8px 8px 0px 0px #000000' }}
      className="premium-card p-6 relative overflow-hidden transition-all duration-200"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-3xl transform translate-x-8 -translate-y-8 pointer-events-none" />
      
      <div className="space-y-5">
        {/* Header: Type badge + Evidence link */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-bold tracking-widest uppercase bg-primary/10 text-primary px-2.5 py-1 rounded-md">
              {item.type}
            </span>
            <ConfidenceBadge score={item.confidenceScore} reason={item.confidenceReason} />
          </div>
          <a
            href={`/meetings/${meetingId}/transcript#L${item.evidenceLineStart}${item.evidenceLineEnd !== item.evidenceLineStart ? `-${item.evidenceLineEnd}` : ''}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors bg-muted px-2.5 py-1.5 rounded-md border border-border"
          >
            <span>Lines {item.evidenceLineStart}{item.evidenceLineEnd !== item.evidenceLineStart ? `–${item.evidenceLineEnd}` : ''}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Proposed text */}
        <p className="text-lg font-medium leading-relaxed text-foreground">{item.rawText}</p>

        {/* Metadata */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm pt-2">
          <span className="flex items-center gap-2 text-muted-foreground"><strong className="font-semibold text-foreground">Owner:</strong> {item.suggestedOwner || 'None'}</span>
          <span className="flex items-center gap-2 text-muted-foreground"><strong className="font-semibold text-foreground">Deadline:</strong> {formatDate(item.suggestedDeadline)}</span>
        </div>

        {/* Action buttons — View mode */}
        {mode === 'view' && (
          <div className="flex flex-wrap gap-3 pt-4 border-t border-border mt-2">
            <Button size="sm" onClick={() => handleAction('CONFIRM')} disabled={loading} className="btn-primary flex-1 sm:flex-none">
              <Check className="h-4 w-4 mr-2" />
              Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode('edit')} disabled={loading} className="flex-1 sm:flex-none">
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode('reassign')} disabled={loading} className="flex-1 sm:flex-none">
              <UserRound className="h-4 w-4 mr-2" />
              Reassign
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode('reject')} disabled={loading} className="text-destructive hover:bg-destructive/10 hover:border-destructive flex-1 sm:flex-none ml-auto border-destructive/30">
              <X className="h-4 w-4 mr-2" />
              Reject
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
          <div className="space-y-4 pt-4 border-t border-border mt-2">
            <Select value={reassignOwner} onValueChange={(val) => setReassignOwner(val || '')}>
              <SelectTrigger className="w-full bg-muted/50 border-border">
                <SelectValue placeholder="Select New Owner" />
              </SelectTrigger>
              <SelectContent>
                {participants.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-3 justify-end">
              <Button size="sm" variant="outline" onClick={() => setMode('view')} disabled={loading}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => handleAction('CONFIRM', { owner: reassignOwner })} disabled={loading || !reassignOwner} className="btn-primary">
                Confirm Reassignment
              </Button>
            </div>
          </div>
        )}

        {/* Reject mode */}
        {mode === 'reject' && (
          <div className="space-y-4 pt-4 border-t border-border mt-2">
            <Textarea
              placeholder="Optional rejection note..."
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              className="min-h-[80px] bg-muted/50 border-border resize-none"
            />
            <div className="flex gap-3 justify-end">
              <Button size="sm" variant="outline" onClick={() => setMode('view')} disabled={loading}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleAction('REJECT')} disabled={loading}>
                Confirm Rejection
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
