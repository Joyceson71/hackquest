'use client';

import { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api';
import { useRole } from '@/lib/role-context';
import { Loader2, CheckCircle, Clock, AlertTriangle, Play, AlertCircle } from 'lucide-react';

interface Task {
  actionId: string;
  task: string;
  description: string;
  priority: string;
  status: string;
  currentOwner: string | null;
  deadline: string | null;
}

export default function MyTasksPage() {
  const { userEmail } = useRole();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyTasks = async () => {
    try {
      // Use the /me/tasks endpoint (GSI2) — single efficient query, no N+1
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/me/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      } else {
        console.error('[MyTasksPage] Failed to fetch tasks, status:', res.status);
        setTasks([]);
      }
    } catch (e) {
      console.error('[MyTasksPage] Error fetching tasks:', e);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMyTasks();
  }, []);

  const updateTaskStatus = async (task: Task, newStatus: string) => {
    try {
      // pk and actor are NOT sent — the backend derives identity from the auth token
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${task.actionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          previousStatus: task.status,
        })
      });

      if (res.ok) {
        fetchMyTasks();
      } else {
        console.error('[MyTasksPage] Failed to update task status:', res.status);
      }
    } catch (e) {
      console.error('[MyTasksPage] Error updating task:', e);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-[40vh]">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
    </div>
  );

  const now = new Date();

  return (
    <div className="container mx-auto px-6 py-12 max-w-6xl">
      <header className="mb-12 border-b border-white/10 pb-6">
        <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-2">
          My Tasks
        </h1>
        <p className="text-lg font-medium text-muted-foreground">
          Your active workload and assignments
        </p>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasks.map(task => {
          const isOverdue = task.deadline && new Date(task.deadline) < now;
          const isPending = task.status === 'PENDING';
          const isInProgress = task.status === 'IN_PROGRESS';
          const isCompleted = task.status === 'COMPLETED';
          const isReassigned = task.status === 'REASSIGNMENT_PENDING' || task.status === 'REASSIGNED';

          if (isReassigned) return null; // Don't show reassigned tasks in the active inbox

          return (
            <div key={task.actionId} className={`glass-card ${isOverdue && !isCompleted ? 'border-destructive/50 bg-destructive/5' : 'border-white/10'} p-6 flex flex-col justify-between hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 rounded-2xl`}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                    isPending ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                    isInProgress ? 'bg-secondary/10 text-secondary border-secondary/20' :
                    isCompleted ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                    'bg-primary/10 text-primary border-primary/20'
                  }`}>
                    {task.status}
                  </span>
                  {isOverdue && !isCompleted && <span className="bg-destructive/10 text-destructive px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-destructive/20"><AlertTriangle className="w-3.5 h-3.5"/> Overdue</span>}
                </div>
                
                <h3 className="font-heading font-semibold text-xl mb-2 line-clamp-2 text-foreground tracking-tight" title={task.task}>{task.task}</h3>
                <p className="text-sm text-muted-foreground mb-6 line-clamp-3">{task.description}</p>
              </div>
              
              <div className="space-y-5">
                <div className="pt-5 border-t border-white/10 text-xs font-medium text-muted-foreground">
                  <div className="flex justify-between mb-2">
                    <span className="uppercase tracking-wider">Priority</span>
                    <span className={`px-2 py-0.5 rounded-md ${task.priority === 'HIGH' || task.priority === 'CRITICAL' ? 'bg-destructive/10 text-destructive' : 'bg-card/5'}`}>{task.priority || 'NORMAL'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="uppercase tracking-wider">Deadline</span>
                    <span className={isOverdue && !isCompleted ? 'text-destructive font-semibold' : ''}>
                      {task.deadline ? new Date(task.deadline).toLocaleString() : 'None'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {isPending && (
                    <button 
                      onClick={() => updateTaskStatus(task, 'ACKNOWLEDGED')}
                      className="col-span-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl flex justify-center items-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-primary/20"
                    >
                      <CheckCircle className="w-4 h-4" /> Acknowledge
                    </button>
                  )}

                  {(task.status === 'ACKNOWLEDGED' || task.status === 'BLOCKED') && (
                    <button 
                      onClick={() => updateTaskStatus(task, 'IN_PROGRESS')}
                      className="col-span-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold py-2.5 rounded-xl flex justify-center items-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-secondary/20"
                    >
                      <Play className="w-4 h-4 fill-current" /> Start Working
                    </button>
                  )}

                  {isInProgress && (
                    <>
                      <button 
                        onClick={() => updateTaskStatus(task, 'COMPLETED')}
                        className="bg-emerald-500 hover:bg-emerald-600 text-background font-semibold py-2.5 rounded-xl flex justify-center items-center gap-2 transition-all hover:scale-[1.02] shadow-lg shadow-emerald-500/20"
                      >
                        <CheckCircle className="w-4 h-4" /> Complete
                      </button>
                      <button 
                        onClick={() => updateTaskStatus(task, 'BLOCKED')}
                        className="bg-transparent border border-destructive text-destructive hover:bg-destructive/10 font-semibold py-2.5 rounded-xl flex justify-center items-center gap-2 transition-all"
                      >
                        <AlertCircle className="w-4 h-4" /> Blocked
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <div className="col-span-full text-center py-20 border border-white/10 bg-card/30 rounded-3xl border-dashed font-heading font-medium text-xl text-muted-foreground">
            You have no assigned tasks.
          </div>
        )}
      </div>
    </div>
  );
}
