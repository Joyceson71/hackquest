'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';

interface EditConfirmFormProps {
  initialTask: string;
  initialOwner: string;
  initialDeadline: string;
  participants: string[];
  onConfirm: (task: string, owner: string, deadline: string) => void;
  onCancel: () => void;
  loading: boolean;
}

export default function EditConfirmForm({
  initialTask,
  initialOwner,
  initialDeadline,
  participants,
  onConfirm,
  onCancel,
  loading,
}: EditConfirmFormProps) {
  const [task, setTask] = useState(initialTask);
  const [owner, setOwner] = useState(initialOwner);
  const [deadline, setDeadline] = useState(initialDeadline);

  return (
    <div className="space-y-4 pt-2 border-t border-border">
      <div className="space-y-2">
        <Label htmlFor="edit-task">Task / Decision</Label>
        <Textarea
          id="edit-task"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className="min-h-[80px] resize-y"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-owner">Owner</Label>
          <Select value={owner} onValueChange={(val) => setOwner(val || '')}>
            <SelectTrigger id="edit-owner">
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {participants.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-deadline">Deadline</Label>
          <Input
            id="edit-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button onClick={() => onConfirm(task, owner === '__unassigned__' ? '' : owner, deadline)} disabled={loading}>
          Save Changes
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
