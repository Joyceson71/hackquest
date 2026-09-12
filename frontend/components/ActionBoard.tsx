'use client';

import { useState } from 'react';
import EvidenceLink from './EvidenceLink';

export interface ConfirmedAction {
  actionId: string;
  task: string;
  owner: string;
  deadline: string;
  status: string;
  evidenceLineStart: number;
}

interface Props {
  actions: ConfirmedAction[];
  meetingId: string;
  onStatusChange: (actionId: string, newStatus: string) => void;
}

export default function ActionBoard({ actions, meetingId, onStatusChange }: Props) {
  const [filterOwner, setFilterOwner] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const owners = Array.from(new Set(actions.map(a => a.owner).filter(Boolean)));
  
  const filteredActions = actions.filter(a => {
    if (filterOwner && a.owner !== filterOwner) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    return true;
  });

  const handleExportCSV = () => {
    const headers = ['Task', 'Owner', 'Due Date', 'Status', 'Evidence Timestamp (Line)'];
    const rows = filteredActions.map(a => [
      `"${a.task.replace(/"/g, '""')}"`,
      `"${a.owner || ''}"`,
      `"${a.deadline || ''}"`,
      `"${a.status}"`,
      `"L${a.evidenceLineStart}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
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
      <div className="text-center py-16 bg-card rounded-xl border border-border shadow-sm">
        <h3 className="text-lg font-medium text-foreground">No confirmed actions yet.</h3>
        <p className="text-muted-foreground mt-2 mb-4">Review proposed items to create commitments.</p>
        <a href={`/meetings/${meetingId}/review`} className="btn-primary inline-block">Go to Review</a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters & Actions */}
      <div className="flex flex-wrap gap-4 justify-between items-center bg-card p-4 rounded-xl shadow-sm border border-border">
        <div className="flex gap-4">
          <select className="input text-sm py-2" value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
            <option value="">All Owners</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select className="input text-sm py-2" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <button onClick={handleExportCSV} className="btn-secondary text-sm py-2">
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground uppercase tracking-wider">
              <th className="p-4 font-semibold">Task</th>
              <th className="p-4 font-semibold">Owner</th>
              <th className="p-4 font-semibold">Due Date</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredActions.map(action => (
              <tr key={action.actionId} className="hover:bg-muted/20 transition-colors">
                <td className="p-4 text-card-foreground align-top max-w-xs truncate" title={action.task}>{action.task}</td>
                <td className="p-4 align-top">{action.owner || '-'}</td>
                <td className="p-4 align-top text-sm">{action.deadline || '-'}</td>
                <td className="p-4 align-top">
                  <select 
                    className="input text-sm py-1 px-2 border-transparent hover:border-border cursor-pointer bg-transparent"
                    value={action.status}
                    onChange={(e) => onStatusChange(action.actionId, e.target.value)}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </td>
                <td className="p-4 align-top">
                  <EvidenceLink meetingId={meetingId} lineStart={action.evidenceLineStart} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
