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
    <motion.div variants={itemVariants} className="glass-card overflow-hidden group">
      {/* Overdue top-bar indicator */}
      {isOverdue && (
        <div className="h-1.5 w-full bg-destructive" />
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Meeting badge */}
            {action.meetingTitle && (
              <div className="flex items-center gap-1.5 mb-2">
                <Briefcase className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate">{action.meetingTitle}</span>
              </div>
            )}
            {/* Task */}
            <p className="text-sm font-semibold text-foreground leading-snug">{action.task}</p>
          </div>
          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 border shrink-0 rounded-full ${cfg.badgeClass}`}>
            <StatusIcon className="h-3 w-3" />
            {cfg.label}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {action.currentOwner || action.owner || '—'}
          </span>
          <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400 font-bold' : ''}`}>
            <Calendar className="h-3 w-3" />
            {isOverdue ? '⚠ Overdue — ' : ''}{formatDate(action.deadline)}
          </span>
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? 'Hide' : 'View'} evidence
          </button>

          <div className="flex items-center gap-2">
            {nextStatuses.slice(0, 2).map((s) => {
              const c = STATUS_CONFIG[s];
              return (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  disabled={isUpdating}
                  onClick={() => onStatusChange(action.actionId, s, action.meetingId || '')}
                  className="text-xs h-8 px-3 font-medium border-white/10 bg-transparent text-foreground hover:bg-card/5 rounded-lg transition-all"
                >
                  {isUpdating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    `→ ${c.label}`
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Evidence panel */}
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 p-4 rounded-xl border border-white/10 bg-foreground/20"
          >
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
              <div>
                {action.speakerContext && (
                  <span className="font-bold text-foreground mr-1">{action.speakerContext}:</span>
                )}
                <span className="italic">&quot;{action.task}&quot;</span>
                {action.evidenceTimestamp && (
                  <span className="ml-2 text-muted-foreground">@ {action.evidenceTimestamp}</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight text-foreground">
              My Tasks
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Showing actions assigned to{' '}
              <span className="text-primary font-medium">{userName || userEmail || 'you'}</span>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMyActions}
            disabled={loading}
            className="font-medium text-sm border-white/10 bg-transparent text-foreground hover:bg-card/5 rounded-lg transition-all"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: stats.total,      color: 'text-foreground',  border: 'border-border' },
          { label: 'Pending',     value: stats.pending,    color: 'text-amber-400',   border: 'border-amber-400/50' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-secondary',   border: 'border-secondary/50' },
          { label: 'Overdue',     value: stats.overdue,    color: 'text-destructive', border: 'border-destructive/50' },
        ].map(({ label, value, color, border }) => (
          <div key={label} className={`glass-card p-5 border ${border} rounded-2xl`}>
            <div className={`text-3xl font-heading font-bold ${color}`}>{value}</div>
            <div className="text-xs font-medium text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </motion.div>

      {/* Filter tabs */}
      <motion.div variants={itemVariants} className="flex items-center gap-2 flex-wrap">
        {statuses.map((s) => {
          const count = s === 'ALL' ? actions.length : actions.filter((a) => a.status === s).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                filter === s
                  ? 'bg-primary/20 text-primary border-primary/30 shadow-md'
                  : 'bg-transparent text-muted-foreground border-white/10 hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {s === 'ALL' ? 'All' : STATUS_CONFIG[s]?.label || s} ({count})
            </button>
          );
        })}
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm font-medium">Loading your tasks…</span>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div variants={itemVariants} className="glass-card p-12 text-center">
          <div className="bg-primary/20 p-4 rounded-full inline-block mb-6">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-heading font-bold mb-2">
            {filter === 'ALL' ? 'No tasks assigned to you yet' : `No ${filter.toLowerCase()} tasks`}
          </h2>
          <p className="text-muted-foreground text-sm">
            {filter === 'ALL'
              ? 'Your admin will assign actions from meeting transcripts here.'
              : 'Try switching the filter above.'}
          </p>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-4">
          {filtered.map((action) => (
            <ActionCard
              key={action.actionId}
              action={action}
              onStatusChange={handleStatusChange}
              updating={updating}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

export default function EmployeePage() {
  return (
    <RoleGuard allowedRole="employee">
      <EmployeeDashboardInner />
    </RoleGuard>
  );
}
