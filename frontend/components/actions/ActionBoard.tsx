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
  onDeleteAction: (actionId: string) => void;
}

export default function ActionBoard({ actions, meetingId, participants, onStatusChange, onDeleteAction }: ActionBoardProps) {
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
      <div className="flex flex-col items-center justify-center py-16 bg-card border-4 border-border shadow-brutal text-center">
        <svg className="h-16 w-16 text-primary mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="text-3xl font-black text-foreground uppercase">NO CONFIRMED ACTIONS YET</h3>
        <p className="text-lg text-foreground/70 font-bold mt-2 mb-8 uppercase">
          Go to the Review screen to confirm proposed items.
        </p>
        <Button size="lg" className="bg-secondary text-foreground border-2 border-border font-black uppercase shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none hover:bg-secondary" onClick={() => window.location.href = `/meetings/${meetingId}/review`}>
          REVIEW PROPOSED ITEMS <ArrowRight className="h-5 w-5 ml-2 stroke-[3]" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-muted border-4 border-border p-4 shadow-brutal-sm">
        <div className="flex gap-4">
          <Select value={filterOwner} onValueChange={(val) => setFilterOwner(val || '__all__')}>
            <SelectTrigger className="w-[200px] h-10 border-2 border-border font-bold uppercase shadow-brutal-sm">
              <SelectValue placeholder="ALL OWNERS" />
            </SelectTrigger>
            <SelectContent className="border-4 border-border font-bold shadow-brutal">
              <SelectItem value="__all__">ALL OWNERS</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || '__all__')}>
            <SelectTrigger className="w-[200px] h-10 border-2 border-border font-bold uppercase shadow-brutal-sm">
              <SelectValue placeholder="ALL STATUSES" />
            </SelectTrigger>
            <SelectContent className="border-4 border-border font-bold shadow-brutal">
              <SelectItem value="__all__">ALL STATUSES</SelectItem>
              <SelectItem value="PENDING">PENDING</SelectItem>
              <SelectItem value="IN_PROGRESS">IN PROGRESS</SelectItem>
              <SelectItem value="DONE">DONE</SelectItem>
              <SelectItem value="CANCELLED">CANCELLED</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="lg" className="bg-primary text-background border-2 border-border font-black uppercase shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none hover:bg-primary" onClick={handleExportCSV}>
          <Download className="h-5 w-5 mr-2 stroke-[3]" />
          EXPORT CSV
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card border-4 border-border shadow-brutal overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-accent text-background border-b-4 border-border hover:bg-accent">
              <TableHead className="w-12 border-r-4 border-border"></TableHead>
              <TableHead className="font-black text-foreground border-r-4 border-border text-lg uppercase">TASK</TableHead>
              <TableHead className="font-black text-foreground border-r-4 border-border text-lg uppercase">OWNER</TableHead>
              <TableHead className="font-black text-foreground border-r-4 border-border text-lg uppercase">DUE DATE</TableHead>
              <TableHead className="font-black text-foreground border-r-4 border-border text-lg uppercase">STATUS</TableHead>
              <TableHead className="font-black text-foreground border-r-4 border-border text-lg uppercase">EVIDENCE</TableHead>
              <TableHead className="font-black text-foreground text-lg uppercase text-center">ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredActions.map((action) => (
              <ActionRow
                key={action.actionId}
                action={action}
                meetingId={meetingId}
                onStatusChange={onStatusChange}
                onDeleteAction={onDeleteAction}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
