'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Download, ArrowRight, AlertTriangle } from 'lucide-react';
import ActionRow, { ConfirmedAction } from './ActionRow';

interface ActionBoardProps {
  actions: ConfirmedAction[];
  meetingId: string;
  participants: string[];
  currentUserName?: string;
  onStatusChange: (actionId: string, newStatus: string) => void;
  onDeleteAction: (actionId: string) => void;
  onRefresh: () => void;
}

export default function ActionBoard({
  actions,
  meetingId,
  participants,
  currentUserName,
  onStatusChange,
  onDeleteAction,
  onRefresh,
}: ActionBoardProps) {
  const router = useRouter();
  const [filterOwner, setFilterOwner] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEscalated, setFilterEscalated] = useState(false);

  // Build owner list from both currentOwner and originalOwner across all actions
  const owners = Array.from(new Set([
    ...actions.map((a) => a.currentOwner || a.owner),
    ...actions.map((a) => a.originalOwner),
    ...participants,
  ].filter((x): x is string => Boolean(x))));

  const filteredActions = actions.filter((a) => {
    if (filterOwner !== 'all' && a.currentOwner !== filterOwner && a.owner !== filterOwner) return false;
    if (filterEscalated && a.escalationStatus !== 'PENDING_ACCEPTANCE' && a.escalationStatus !== 'TRIGGERED') return false;
    if (!filterEscalated && filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  });

  const escalatedCount = actions.filter(
    a => a.escalationStatus === 'PENDING_ACCEPTANCE' || a.escalationStatus === 'TRIGGERED'
  ).length;

  // Check if any action has a reassigned owner (originalOwner ≠ currentOwner)
  const hasReassignments = actions.some(
    a => a.originalOwner && a.currentOwner && a.originalOwner !== a.currentOwner
  );

  const handleExportCSV = () => {
    // Spec-compliant 10 columns
    const headers = [
      'Task',
      'Original Owner',
      'Current Owner',
      'Original Deadline',
      'Current Deadline',
      'Status',
      'Escalation Status',
      'Evidence Timestamp',
      'Confirmed By',
      'Confirmed At',
    ];
    const rows = filteredActions.map((a) => [
      `"${(a.task || '').replace(/"/g, '""')}"`,
      `"${a.originalOwner || ''}"`,
      `"${a.currentOwner || a.owner || ''}"`,
      `"${a.originalDeadline || ''}"`,
      `"${a.deadline || ''}"`,
      `"${a.status || ''}"`,
      `"${a.escalationStatus || 'NONE'}"`,
      `"${a.evidenceTimestamp || `L${a.evidenceLineStart}`}"`,
      `"${a.confirmedBy || ''}"`,
      `"${a.confirmedAt || ''}"`,
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
    URL.revokeObjectURL(url);
  };

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-card border-4 border-border shadow-brutal text-center">
        <svg className="h-12 w-12 text-primary mb-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="text-2xl font-black text-foreground uppercase">No Confirmed Actions Yet</h3>
        <p className="text-sm text-foreground/70 font-bold mt-2 mb-6 uppercase">
          Go to the Review screen to confirm proposed items.
        </p>
        <Button
          size="lg"
          className="bg-secondary text-foreground border-2 border-border font-black uppercase shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none hover:bg-secondary cursor-pointer"
          onClick={() => router.push(`/meetings/${meetingId}/review`)}
        >
          Review Proposed Items <ArrowRight className="h-5 w-5 ml-2 stroke-[3]" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Escalation alert banner */}
      {escalatedCount > 0 && (
        <div className="flex items-center gap-3 bg-destructive/10 border-4 border-destructive/50 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <span className="font-black uppercase text-sm text-foreground">
            {escalatedCount} action{escalatedCount !== 1 ? 's' : ''} escalated — expand the highlighted row{escalatedCount !== 1 ? 's' : ''} to act
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto border-2 border-destructive text-destructive font-black uppercase shadow-brutal-sm hover:bg-destructive hover:text-background cursor-pointer"
            onClick={() => setFilterEscalated(!filterEscalated)}
          >
            {filterEscalated ? 'Show All' : 'Show Escalated Only'}
          </Button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted border-4 border-border p-4 shadow-brutal-sm">
        <div className="flex flex-wrap gap-3">
          <Select value={filterOwner} onValueChange={(val) => setFilterOwner(val || '__all__')}>
            <SelectTrigger className="w-[180px] h-9 border-2 border-border font-bold uppercase shadow-brutal-sm text-sm cursor-pointer">
              <SelectValue placeholder="ALL OWNERS" />
            </SelectTrigger>
            <SelectContent className="border-4 border-border font-bold shadow-brutal">
              <SelectItem value="all">ALL OWNERS</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || 'all')} disabled={filterEscalated}>
            <SelectTrigger className="w-[180px] h-9 border-2 border-border font-bold uppercase shadow-brutal-sm text-sm cursor-pointer">
              <SelectValue placeholder="ALL STATUSES" />
            </SelectTrigger>
            <SelectContent className="border-4 border-border font-bold shadow-brutal">
              <SelectItem value="all">ALL STATUSES</SelectItem>
              <SelectItem value="PENDING">PENDING</SelectItem>
              <SelectItem value="IN_PROGRESS">IN PROGRESS</SelectItem>
              <SelectItem value="DONE">DONE</SelectItem>
              <SelectItem value="CANCELLED">CANCELLED</SelectItem>
              <SelectItem value="ESCALATED">ESCALATED</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          size="sm"
          className="bg-primary text-background border-2 border-border font-black uppercase shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none hover:bg-primary cursor-pointer"
          onClick={handleExportCSV}
        >
          <Download className="h-4 w-4 mr-2 stroke-[3]" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card border-4 border-border shadow-brutal overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted text-foreground border-b-4 border-border hover:bg-muted">
              <TableHead className="w-12 border-r-4 border-border" />
              <TableHead className="font-black text-foreground border-r-4 border-border uppercase text-sm">Task</TableHead>
              {hasReassignments ? (
                <>
                  <TableHead className="font-black text-muted-foreground border-r-4 border-border uppercase text-sm">Orig. Owner</TableHead>
                  <TableHead className="font-black text-foreground border-r-4 border-border uppercase text-sm">Current Owner</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="hidden border-r-4 border-border" />
                  <TableHead className="font-black text-foreground border-r-4 border-border uppercase text-sm">Owner</TableHead>
                </>
              )}
              <TableHead className="font-black text-foreground border-r-4 border-border uppercase text-sm">Due Date</TableHead>
              <TableHead className="font-black text-foreground border-r-4 border-border uppercase text-sm">Status</TableHead>
              <TableHead className="font-black text-foreground border-r-4 border-border uppercase text-sm">Evidence</TableHead>
              <TableHead className="font-black text-foreground uppercase text-sm text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredActions.map((action) => (
              <ActionRow
                key={action.actionId}
                action={action}
                meetingId={meetingId}
                currentUserName={currentUserName}
                onStatusChange={onStatusChange}
                onDeleteAction={onDeleteAction}
                onEscalationAction={onRefresh}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredActions.length === 0 && (
        <p className="text-center text-muted-foreground font-bold uppercase py-6 text-sm">
          No actions match current filters.
        </p>
      )}
    </div>
  );
}
