'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
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
  onProcessed: () => void;
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
      onProcessed();
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
      className="bg-card border-4 border-border p-6 shadow-brutal transition-all duration-200 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-16 h-16 bg-primary opacity-20 rotate-45 transform translate-x-8 -translate-y-8 pointer-events-none" />
      
      <div className="space-y-6">
        {/* Header: Type badge + Evidence link */}
        <div className="flex items-start justify-between gap-4 border-b-4 border-border pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-wider font-black bg-accent text-background px-3 py-1 border-2 border-border">
              {item.type}
            </span>
            <ConfidenceBadge score={item.confidenceScore} reason={item.confidenceReason} />
          </div>
          <a
            href={`/meetings/${meetingId}/transcript#L${item.evidenceLineStart}${item.evidenceLineEnd !== item.evidenceLineStart ? `-${item.evidenceLineEnd}` : ''}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm font-black text-foreground bg-secondary px-2 py-1 border-2 border-border hover:bg-primary hover:text-background transition-colors shrink-0"
          >
            <span>L{item.evidenceLineStart}{item.evidenceLineEnd !== item.evidenceLineStart ? `–${item.evidenceLineEnd}` : ''}</span>
            <ExternalLink className="h-4 w-4 stroke-[3]" />
          </a>
        </div>

        {/* Proposed text */}
        <p className="text-xl font-bold leading-relaxed text-foreground">{item.rawText}</p>

        {/* Metadata */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="bg-muted px-3 py-1 border-2 border-border font-bold uppercase"><strong className="text-primary mr-2">OWNER:</strong> {item.suggestedOwner || 'NONE'}</span>
          <span className="bg-muted px-3 py-1 border-2 border-border font-bold uppercase"><strong className="text-primary mr-2">DEADLINE:</strong> {formatDate(item.suggestedDeadline)}</span>
        </div>

        {/* Action buttons — View mode */}
        {mode === 'view' && (
          <div className="flex flex-wrap gap-3 pt-4 border-t-4 border-border">
            <Button size="lg" onClick={() => handleAction('CONFIRM')} disabled={loading} className="font-black uppercase border-2 border-border shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none bg-success text-foreground hover:bg-success">
              <Check className="h-5 w-5 mr-2 stroke-[3]" />
              CONFIRM
            </Button>
            <Button size="lg" onClick={() => setMode('edit')} disabled={loading} className="font-black uppercase border-2 border-border shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none bg-card text-foreground hover:bg-secondary">
              <Pencil className="h-5 w-5 mr-2 stroke-[3]" />
              EDIT
            </Button>
            <Button size="lg" onClick={() => setMode('reassign')} disabled={loading} className="font-black uppercase border-2 border-border shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none bg-card text-foreground hover:bg-secondary">
              <UserRound className="h-5 w-5 mr-2 stroke-[3]" />
              REASSIGN
            </Button>
            <Button size="lg" onClick={() => setMode('reject')} disabled={loading} className="font-black uppercase border-2 border-border shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none bg-destructive text-background hover:bg-destructive">
              <X className="h-5 w-5 mr-2 stroke-[3]" />
              REJECT
            </Button>
          </div>
        )}

        {/* Edit mode */}
        {mode === 'edit' && (
          <EditConfirmForm
            initialTask={item.rawText}
            initialOwner={item.suggestedOwner || ''}
            initialDeadline={item.suggestedDeadline || ''}
            participants={participants}
            loading={loading}
            onConfirm={(task, owner, deadline) => handleAction('CONFIRM', { task, owner, deadline })}
            onCancel={() => setMode('view')}
          />
        )}

        {/* Reassign mode */}
        {mode === 'reassign' && (
          <div className="space-y-4 pt-4 border-t-4 border-border bg-muted p-4">
            <Select value={reassignOwner} onValueChange={(val) => setReassignOwner(val || '')}>
              <SelectTrigger className="border-2 border-border font-bold shadow-brutal-sm">
                <SelectValue placeholder="SELECT NEW OWNER" />
              </SelectTrigger>
              <SelectContent className="border-4 border-border shadow-brutal">
                {participants.map((p) => (
                  <SelectItem key={p} value={p} className="font-bold">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Button size="lg" onClick={() => handleAction('CONFIRM', { owner: reassignOwner })} disabled={loading || !reassignOwner} className="bg-success text-foreground border-2 border-border font-black uppercase shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none hover:bg-success">
                CONFIRM REASSIGNMENT
              </Button>
              <Button size="lg" onClick={() => setMode('view')} disabled={loading} className="bg-card text-foreground border-2 border-border font-black uppercase shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none hover:bg-card">
                CANCEL
              </Button>
            </div>
          </div>
        )}

        {/* Reject mode */}
        {mode === 'reject' && (
          <div className="space-y-4 pt-4 border-t-4 border-border bg-muted p-4">
            <Textarea
              placeholder="OPTIONAL REJECTION NOTE..."
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              className="min-h-[80px] border-2 border-border font-bold shadow-brutal-sm uppercase"
            />
            <div className="flex gap-3">
              <Button size="lg" onClick={() => handleAction('REJECT')} disabled={loading} className="bg-destructive text-background border-2 border-border font-black uppercase shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none hover:bg-destructive">
                CONFIRM REJECTION
              </Button>
              <Button size="lg" onClick={() => setMode('view')} disabled={loading} className="bg-card text-foreground border-2 border-border font-black uppercase shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none hover:bg-card">
                CANCEL
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
