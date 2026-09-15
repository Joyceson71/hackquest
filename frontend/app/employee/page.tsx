'use client';

import { useEffect, useState, useCallback } from 'react';
import { authenticatedFetch } from '@/lib/api';
import { useRole } from '@/lib/role-context';
import { ConfirmedAction } from '@/components/actions/ActionRow';
import RoleGuard from '@/components/RoleGuard';
import { signOut } from 'aws-amplify/auth';
import { motion, Variants } from 'framer-motion';
import {
  Loader2,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  FileText,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MeetingMeta {
  PK: string;
  title: string;
  createdAt: string;
}

interface EmployeeAction extends ConfirmedAction {
  meetingTitle?: string;
  meetingId?: string;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: React.ElementType }> = {
  PENDING:     { label: 'Pending',     badgeClass: 'badge-pending',     icon: Clock },
  ACKNOWLEDGED:{ label: 'Acknowledged',badgeClass: 'badge-acknowledged',icon: CheckCircle },
  IN_PROGRESS: { label: 'In Progress', badgeClass: 'badge-inprogress',  icon: RefreshCw },
  DONE:        { label: 'Done',        badgeClass: 'badge-completed',   icon: CheckCircle },
  COMPLETED:   { label: 'Completed',   badgeClass: 'badge-completed',   icon: CheckCircle },
  BLOCKED:     { label: 'Blocked',     badgeClass: 'badge-blocked',     icon: AlertTriangle },
  ESCALATED:   { label: 'Escalated',   badgeClass: 'badge-overdue',     icon: AlertTriangle },
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants: Variants = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

function ActionCard({
  action,
  onStatusChange,
  updating,
}: {
  action: EmployeeAction;
  onStatusChange: (actionId: string, status: string, meetingId: string) => void;
  updating: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = action.status || 'PENDING';
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const StatusIcon = cfg.icon;
  const isUpdating = updating === action.actionId;
  const isOverdue =
    action.deadline && new Date(action.deadline) < new Date() && !['DONE', 'COMPLETED'].includes(status);

  let nextStatuses: string[] = [];
  if (status === 'PENDING') nextStatuses = ['ACKNOWLEDGED'];
  else if (status === 'ACKNOWLEDGED') nextStatuses = ['IN_PROGRESS'];
  else if (status === 'IN_PROGRESS') nextStatuses = ['COMPLETED', 'BLOCKED'];
  else if (status === 'BLOCKED') nextStatuses = ['IN_PROGRESS'];
  else if (status === 'COMPLETED' || status === 'DONE') nextStatuses = ['IN_PROGRESS'];

  return (
    <div className={`border-b border-border group ${isOverdue ? 'border-l-4 border-l-destructive' : ''} transition-all`}>
      <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-muted/30">
        
        <div className="flex-1 min-w-0">
          {/* Meeting badge */}
          {action.meetingTitle && (
            <div className="mb-3">
              <span className="meta-label text-muted-foreground border border-border px-2 py-1">{action.meetingTitle.toUpperCase()}</span>
            </div>
          )}
          {/* Task */}
          <p className="manga-header text-3xl text-foreground mb-4">{action.task}</p>
          
          <div className="flex flex-wrap items-center gap-6 meta-label text-muted-foreground">
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-foreground rounded-full"></div>
              ASSIGNED TO: {action.currentOwner || action.owner || 'UNASSIGNED'}
            </span>
            <span className={`flex items-center gap-2 ${isOverdue ? 'text-destructive font-bold' : ''}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isOverdue ? 'bg-destructive' : 'bg-muted-foreground'}`}></div>
              DUE: {formatDate(action.deadline).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-end gap-6 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-8">
          <span className={`meta-label font-bold tracking-widest ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
            {status === 'IN_PROGRESS' ? '[ IN PROGRESS ]' : status === 'COMPLETED' ? '[ COMPLETED ]' : status === 'BLOCKED' ? '[ BLOCKED ]' : `[ ${status.replace('_', ' ')} ]`}
          </span>
          
          <div className="flex flex-col gap-2 w-full md:w-auto">
            {nextStatuses.slice(0, 2).map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                disabled={isUpdating}
                onClick={() => onStatusChange(action.actionId, s, action.meetingId || '')}
                className="btn-secondary meta-label w-full justify-start md:justify-center"
              >
                {isUpdating ? 'PROCESSING...' : `MARK ${s}`}
              </Button>
            ))}
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="meta-label text-muted-foreground hover:text-foreground text-right w-full mt-2 font-bold"
            >
              {expanded ? 'HIDE LOG' : 'VIEW LOG'}
            </button>
          </div>
        </div>

      </div>

      {/* Evidence panel */}
      {expanded && (
        <div className="p-6 md:p-8 bg-muted/10 border-t border-border border-l-4 border-l-primary">
          <div className="flex items-start gap-4 meta-label">
            <span className="text-primary mt-1 font-bold">LOG_DATA:</span>
            <div>
              {action.speakerContext && (
                <span className="font-bold text-foreground mr-3">{action.speakerContext}</span>
              )}
              <span className="text-muted-foreground lowercase leading-relaxed font-mono">"{action.task}"</span>
              {action.evidenceTimestamp && (
                <span className="ml-4 text-primary font-bold">
                  [{action.evidenceTimestamp}]
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeDashboardInner() {
  const { userEmail, userName } = useRole();
  const [actions, setActions] = useState<EmployeeAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('ALL');

  const fetchMyActions = useCallback(async () => {
    setLoading(true);
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

      // 1. Fetch user's tasks
      const res = await authenticatedFetch(`${apiUrl}/me/tasks`);
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('meetingcompiler_user_role');
        localStorage.removeItem('meetingcompiler_user_email');
        localStorage.removeItem('meetingcompiler_user_name');
        try { await signOut(); } catch (e) { /* ignore */ }
        window.location.href = '/login';
        return;
      }
      if (!res.ok) return;
      const data: EmployeeAction[] = await res.json();

      // Sort: overdue first, then by deadline
      data.sort((a, b) => {
        const aDate = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bDate = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return aDate - bDate;
      });

      setActions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userName, userEmail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMyActions();
  }, [fetchMyActions]);

  const handleStatusChange = async (actionId: string, newStatus: string, meetingId: string) => {
    setUpdating(actionId);
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
      const endpoint = meetingId
        ? `${apiUrl}/meetings/${meetingId}/confirmed-actions/${actionId}`
        : `${apiUrl}/tasks/${actionId}`;

      await authenticatedFetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setActions((prev) =>
        prev.map((a) => (a.actionId === actionId ? { ...a, status: newStatus } : a))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  const statuses = ['ALL', 'PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'];
  const filtered =
    filter === 'ALL' ? actions : actions.filter((a) => a.status === filter || (filter === 'COMPLETED' && a.status === 'DONE'));

  const stats = {
    total: actions.length,
    pending: actions.filter((a) => a.status === 'PENDING' || a.status === 'ACKNOWLEDGED').length,
    inProgress: actions.filter((a) => a.status === 'IN_PROGRESS').length,
    done: actions.filter((a) => a.status === 'DONE' || a.status === 'COMPLETED').length,
    overdue: actions.filter(
      (a) => a.deadline && new Date(a.deadline) < new Date() && !['DONE', 'COMPLETED'].includes(a.status || '')
    ).length,
  };

  return (
    <div className="flex-1 w-full p-8 md:p-12 max-w-7xl mx-auto space-y-12">
      {/* Header */}
      <div className="manga-panel p-8 pb-10 border-b-2">
        <div className="absolute top-0 right-0 p-4 text-border opacity-20 manga-header text-6xl leading-none">
          // TEAM
        </div>
        <p className="meta-label text-primary font-bold tracking-widest mb-4">MEMBER OVERVIEW</p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10">
          <h1 className="manga-header text-5xl md:text-6xl text-foreground">
            GOOD MORNING,<br />{userName ? userName.toUpperCase() : 'MEMBER'}.
          </h1>
          <Button
            variant="outline"
            onClick={fetchMyActions}
            disabled={loading}
            className="btn-secondary h-12 px-6 meta-label"
          >
            {loading ? 'SYNCING...' : 'REFRESH DATA'}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {[
          { label: '01 / TOTAL', value: stats.total },
          { label: '02 / PENDING', value: stats.pending },
          { label: '03 / IN PROGRESS', value: stats.inProgress },
          { label: '04 / OVERDUE', value: stats.overdue, color: 'text-destructive', border: 'border-l-destructive' },
        ].map(({ label, value, color, border }, i) => (
          <div key={label} className={`manga-panel p-8 flex flex-col justify-center border-l-4 ${border || 'border-l-border'}`}>
            <div className={`meta-label mb-4 ${color || 'text-muted-foreground'}`}>
              {label}
            </div>
            <span className={`manga-header text-6xl ${color || 'text-foreground'}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-0 border border-border bg-card shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
        {statuses.map((s) => {
          const count = s === 'ALL' ? actions.length : actions.filter((a) => a.status === s).length;
          const isActive = filter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-6 py-4 meta-label font-bold transition-colors border-r last:border-r-0 border-border ${
                isActive
                  ? 'bg-foreground text-background'
                  : 'bg-transparent text-muted-foreground hover:bg-muted'
              }`}
            >
              {s === 'ALL' ? 'ALL' : s} <span className={isActive ? 'text-background opacity-70' : 'opacity-50'}>[{count}]</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-[30vh] items-center justify-center">
          <span className="meta-label text-muted-foreground">SYNCING LOGS...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="manga-panel p-16 flex flex-col items-center justify-center text-center space-y-6">
          <h3 className="manga-header text-3xl text-foreground">
            {filter === 'ALL' ? 'NO TASKS ASSIGNED' : `NO ${filter} TASKS`}
          </h3>
          <p className="meta-label text-muted-foreground mt-2 max-w-sm mx-auto">
            ALL OPERATIONS ARE CURRENTLY NOMINAL.
          </p>
        </div>
      ) : (
        <div className="flex flex-col border-t border-border mt-8 manga-panel">
          {filtered.map((action) => (
            <ActionCard
              key={action.actionId}
              action={action}
              onStatusChange={handleStatusChange}
              updating={updating}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EmployeePage() {
  return (
    <RoleGuard allowedRole="employee">
      <EmployeeDashboardInner />
    </RoleGuard>
  );
}
