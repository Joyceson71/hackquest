'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${apiUrl}/meetings/${meetingId}/proposed-items/${item.itemId}`, {
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
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardContent className="pt-5 space-y-4">
        {/* Header: Type badge + Evidence link */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              {item.type}
            </Badge>
            <ConfidenceBadge score={item.confidenceScore} reason={item.confidenceReason} />
          </div>
          <a
            href={`/meetings/${meetingId}/transcript#L${item.evidenceLineStart}${item.evidenceLineEnd !== item.evidenceLineStart ? `-${item.evidenceLineEnd}` : ''}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm font-medium text-accent hover:underline shrink-0"
          >
            <span>L{item.evidenceLineStart}{item.evidenceLineEnd !== item.evidenceLineStart ? `–${item.evidenceLineEnd}` : ''}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Proposed text */}
        <p className="text-foreground leading-relaxed">{item.rawText}</p>

        {/* Metadata */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span><strong className="font-medium text-foreground">Owner:</strong> {item.suggestedOwner || 'No owner identified'}</span>
          <span><strong className="font-medium text-foreground">Deadline:</strong> {item.suggestedDeadline || 'No deadline stated'}</span>
        </div>

        {/* Action buttons — View mode */}
        {mode === 'view' && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" onClick={() => handleAction('CONFIRM')} disabled={loading}>
              <Check className="h-4 w-4 mr-1.5" />
              Confirm Task
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode('edit')} disabled={loading}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit then Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode('reassign')} disabled={loading}>
              <UserRound className="h-4 w-4 mr-1.5" />
              Reassign
            </Button>
            <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setMode('reject')} disabled={loading}>
              <X className="h-4 w-4 mr-1.5" />
              Reject
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
          <div className="space-y-3 pt-2 border-t border-border">
            <Select value={reassignOwner} onValueChange={(val) => setReassignOwner(val || '')}>
              <SelectTrigger>
                <SelectValue placeholder="Select new owner" />
              </SelectTrigger>
              <SelectContent>
                {participants.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleAction('CONFIRM', { owner: reassignOwner })} disabled={loading || !reassignOwner}>
                Confirm Reassignment
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode('view')} disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Reject mode */}
        {mode === 'reject' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <Textarea
              placeholder="Optional rejection note…"
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              className="min-h-[60px]"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => handleAction('REJECT')} disabled={loading}>
                Confirm Rejection
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode('view')} disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
