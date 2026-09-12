'use client';

import { useState } from 'react';
import ConfidenceBadge from './ConfidenceBadge';

export interface ProposedItem {
  itemId: string;
  type: string;
  rawText: string;
  suggestedOwner: string | null;
  suggestedDeadline: string | null;
  confidenceScore: number;
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
  const [isEditing, setIsEditing] = useState(false);
  const [task, setTask] = useState(item.rawText);
  const [owner, setOwner] = useState(item.suggestedOwner || '');
  const [deadline, setDeadline] = useState(item.suggestedDeadline || '');
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: 'CONFIRM' | 'REJECT') => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/meetings/${meetingId}/proposed-items/${item.itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          task,
          owner,
          deadline,
          evidenceLineStart: item.evidenceLineStart
        }),
      });
      if (!res.ok) throw new Error('Failed to update item');
      onProcessed();
    } catch (err) {
      console.error(err);
      alert('Failed to update item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">{item.type}</span>
          <ConfidenceBadge score={item.confidenceScore} />
        </div>
        <a 
          href={`/meetings/${meetingId}/transcript#L${item.evidenceLineStart}`}
          target="_blank" rel="noreferrer"
          className="text-sm font-medium text-accent hover:underline flex items-center space-x-1"
        >
          <span>View Evidence (L{item.evidenceLineStart})</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        </a>
      </div>

      {!isEditing ? (
        <div className="space-y-3">
          <p className="text-card-foreground text-lg">{task}</p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div><strong>Owner:</strong> {owner || 'Unassigned'}</div>
            <div><strong>Deadline:</strong> {deadline || 'None'}</div>
          </div>
          
          <div className="pt-4 flex flex-wrap gap-2">
            <button onClick={() => handleAction('CONFIRM')} disabled={loading} className="btn-primary">
              Confirm Task
            </button>
            <button onClick={() => setIsEditing(true)} disabled={loading} className="btn-secondary">
              Edit then Confirm
            </button>
            <button onClick={() => handleAction('REJECT')} disabled={loading} className="btn-secondary text-destructive border-destructive/30 hover:bg-destructive/10">
              Reject
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Task / Decision</label>
            <textarea className="input w-full min-h-[80px]" value={task} onChange={e => setTask(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Owner</label>
              <select className="input w-full bg-white" value={owner} onChange={e => setOwner(e.target.value)}>
                <option value="">Unassigned</option>
                {participants.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Deadline</label>
              <input type="date" className="input w-full" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="pt-2 flex gap-2">
            <button onClick={() => handleAction('CONFIRM')} disabled={loading} className="btn-primary">
              Save Changes
            </button>
            <button onClick={() => setIsEditing(false)} disabled={loading} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
