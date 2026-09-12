'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, ArrowRight } from 'lucide-react';
import ActionRow, { ConfirmedAction } from './ActionRow';

interface ActionBoardProps {
  actions: ConfirmedAction[];
  meetingId: string;
  participants: string[];
  onStatusChange: (actionId: string, newStatus: string) => void;
}

export default function ActionBoard({ actions, meetingId, participants, onStatusChange }: ActionBoardProps) {
  const [filterOwner, setFilterOwner] = useState('__all__');
  const [filterStatus, setFilterStatus] = useState('__all__');

  const owners = Array.from(new Set(actions.map((a) => a.owner).filter(Boolean)));

  const filteredActions = actions.filter((a) => {
    if (filterOwner !== '__all__' && a.owner !== filterOwner) return false;
    if (filterStatus !== '__all__' && a.status !== filterStatus) return false;
    return true;
  });

  const handleExportCSV = () => {
    const headers = ['Task', 'Owner', 'Due Date', 'Status', 'Evidence Timestamp'];
    const rows = filteredActions.map((a) => [
      `"${a.task.replace(/"/g, '""')}"`,
      `"${a.owner || ''}"`,
      `"${a.deadline || ''}"`,
      `"${a.status}"`,
      `"L${a.evidenceLineStart}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `actions_${meetingId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-card rounded-xl border border-border text-center">
        <svg className="h-12 w-12 text-muted-foreground/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="text-lg font-semibold text-foreground">No confirmed actions yet.</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Go to the Review screen to confirm proposed items.
        </p>
        <Button variant="default" size="sm" onClick={() => window.location.href = `/meetings/${meetingId}/review`}>
          Review proposed items <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border rounded-lg p-3">
        <div className="flex gap-3">
          <Select value={filterOwner} onValueChange={(val) => setFilterOwner(val || '__all__')}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All Owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Owners</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || '__all__')}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-8"></TableHead>
              <TableHead className="font-semibold">Task</TableHead>
              <TableHead className="font-semibold">Owner</TableHead>
              <TableHead className="font-semibold">Due Date</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredActions.map((action) => (
              <ActionRow
                key={action.actionId}
                action={action}
                meetingId={meetingId}
                onStatusChange={onStatusChange}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
