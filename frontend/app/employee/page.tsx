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
import SpatialCard from '@/components/SpatialCard';

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
    <motion.div variants={itemVariants} whileHover={{ scale: 1.02, translateZ: 10, rotateX: 2 }} className={`glass-panel overflow-hidden group ${isOverdue ? 'border-l-4 border-l-destructive' : ''} transition-all`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Meeting badge */}
            {action.meetingTitle && (
              <div className="flex items-center gap-1.5 mb-2">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium truncate">{action.meetingTitle}</span>
              </div>
            )}
            {/* Task */}
            <p className="text-base font-semibold text-foreground leading-snug">{action.task}</p>
          </div>
          {/* Status badge */}
          <span className={`shrink-0 ${cfg.badgeClass}`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {cfg.label}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            {action.currentOwner || action.owner || 'Unassigned'}
          </span>
          <span className={`flex items-center gap-1.5 ${isOverdue ? 'text-destructive font-medium' : ''}`}>
            <Calendar className="h-4 w-4" />
            {isOverdue ? 'Overdue — ' : ''}{formatDate(action.deadline)}
          </span>
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {expanded ? 'Hide evidence' : 'View evidence'}
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
                  className="h-8 px-3 text-xs"
                >
                  {isUpdating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    `Mark as ${c.label}`
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
            className="mt-4 p-4 rounded-md border border-border bg-muted/30"
          >
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <div>
                {action.speakerContext && (
                  <span className="font-semibold text-foreground mr-2">{action.speakerContext}:</span>
                )}
                <span className="italic">"{action.task}"</span>
                {action.evidenceTimestamp && (
                  <span className="ml-2 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {action.evidenceTimestamp}
                  </span>
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
    <div className="flex-1 w-full p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            My Tasks
          </h1>
          <p className="text-muted-foreground mt-1">
            Showing actions assigned to{' '}
            <span className="text-foreground font-medium">{userName || userEmail || 'you'}</span>
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchMyActions}
          disabled={loading}
          className="bg-card hover:bg-muted/50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 h-[140px]">
        {[
          { label: 'Total Tasks', value: stats.total, icon: Briefcase },
          { label: 'Pending', value: stats.pending, icon: Clock },
          { label: 'In Progress', value: stats.inProgress, icon: RefreshCw },
          { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-destructive' },
        ].map(({ label, value, icon: Icon, color }) => (
          <SpatialCard key={label} tiltIntensity={5} glowIntensity={0.1} className="p-0">
            <div className="flex flex-col gap-2 h-full justify-center">
              <div className={`flex items-center gap-2 text-muted-foreground mb-2 ${color || ''}`}>
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <span className={`text-3xl font-bold ${color || 'text-foreground'}`}>{value}</span>
            </div>
          </SpatialCard>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        {statuses.map((s) => {
          const count = s === 'ALL' ? actions.length : actions.filter((a) => a.status === s).length;
          const isActive = filter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {s === 'ALL' ? 'All Tasks' : STATUS_CONFIG[s]?.label || s} <span className="ml-1 opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="premium-card border-dashed p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-foreground">
              {filter === 'ALL' ? 'No tasks assigned to you' : `No ${filter.toLowerCase()} tasks found`}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {filter === 'ALL'
                ? 'Your active tasks will appear here once assigned.'
                : 'Try selecting a different status filter.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
