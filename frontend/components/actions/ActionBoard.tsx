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
      <div className="flex flex-col items-center justify-center py-20 border border-border">
        <h3 className="editorial-heading text-2xl text-foreground">NO ACTIONS EXTRACTED</h3>
        <p className="meta-text text-muted-foreground mt-2 mb-8">
          AWAITING REVIEW OF PROPOSED ITEMS.
        </p>
        <Button
          className="btn-primary meta-text h-12 px-8"
          onClick={() => router.push(`/meetings/${meetingId}/review`)}
        >
          REVIEW PROPOSED ITEMS &gt;
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Escalation alert banner */}
      {escalatedCount > 0 && (
        <div className="flex items-center gap-4 bg-destructive/10 border-l-4 border-destructive p-4">
          <span className="editorial-heading text-destructive shrink-0 tracking-widest">
            ATTENTION REQUIRED
          </span>
          <span className="meta-text text-foreground">
            {escalatedCount} ESCALATED ACTIONS PENDING
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto text-destructive border-destructive/30 hover:bg-destructive/10 rounded-none meta-text"
            onClick={() => setFilterEscalated(!filterEscalated)}
          >
            {filterEscalated ? 'SHOW ALL' : 'FILTER ESCALATED'}
          </Button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex flex-wrap gap-4">
          <Select value={filterOwner} onValueChange={(val) => setFilterOwner(val || '__all__')}>
            <SelectTrigger className="w-[200px] h-10 meta-text rounded-none border-t-0 border-x-0 bg-transparent px-0 focus:ring-0">
              <SelectValue placeholder="OWNER: ALL" />
            </SelectTrigger>
            <SelectContent className="rounded-none meta-text">
              <SelectItem value="all">OWNER: ALL</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o} value={o}>{o.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val || 'all')} disabled={filterEscalated}>
            <SelectTrigger className="w-[200px] h-10 meta-text rounded-none border-t-0 border-x-0 bg-transparent px-0 focus:ring-0">
              <SelectValue placeholder="STATUS: ALL" />
            </SelectTrigger>
            <SelectContent className="rounded-none meta-text">
              <SelectItem value="all">STATUS: ALL</SelectItem>
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
          variant="outline"
          className="meta-text rounded-none border-border h-10 px-4"
          onClick={handleExportCSV}
        >
          [EXPORT_CSV]
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border">
        <Table>
          <TableHeader>
            <TableRow className="meta-text text-muted-foreground border-b border-border hover:bg-transparent">
              <TableHead className="w-12 border-r border-border" />
              <TableHead className="py-4 font-normal">TASK</TableHead>
              {hasReassignments ? (
                <>
                  <TableHead className="py-4 font-normal">ORIG. OWNER</TableHead>
                  <TableHead className="py-4 font-normal">CURRENT OWNER</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="hidden" />
                  <TableHead className="py-4 font-normal">OWNER</TableHead>
                </>
              )}
              <TableHead className="py-4 font-normal">DUE DATE</TableHead>
              <TableHead className="py-4 font-normal">STATUS</TableHead>
              <TableHead className="py-4 font-normal">EVIDENCE</TableHead>
              <TableHead className="py-4 font-normal text-right pr-6">OPERATIONS</TableHead>
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
