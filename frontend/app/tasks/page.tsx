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
      <header className="mb-12 border-b-4 border-white pb-6">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-2">
          My Tasks
        </h1>
        <p className="text-xl font-bold uppercase text-muted-foreground">
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
            <div key={task.actionId} className={`bg-card border-4 ${isOverdue && !isCompleted ? 'border-destructive shadow-[4px_4px_0px_0px_theme(colors.red.700)]' : 'border-border shadow-brutal'} p-5 flex flex-col justify-between`}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-2 py-1 text-xs font-black uppercase border-2 ${
                    isPending ? 'badge-pending' :
                    isInProgress ? 'badge-inprogress' :
                    isCompleted ? 'badge-completed' :
                    'badge-pending'
                  }`}>
                    {task.status}
                  </span>
                  {isOverdue && !isCompleted && <span className="bg-destructive text-destructive-foreground px-2 py-1 text-xs font-black uppercase flex items-center gap-1 border-2 border-destructive"><AlertTriangle className="w-3 h-3"/> Overdue</span>}
                </div>
                
                <h3 className="font-black text-xl uppercase mb-2 line-clamp-2 text-foreground" title={task.task}>{task.task}</h3>
                <p className="text-sm font-bold text-muted-foreground mb-6 line-clamp-3">{task.description}</p>
              </div>
              
              <div className="space-y-4">
                <div className="pt-4 border-t-2 border-white/20 text-xs font-bold uppercase text-muted-foreground">
                  <div className="flex justify-between mb-1">
                    <span>Priority</span>
                    <span className={task.priority === 'HIGH' || task.priority === 'CRITICAL' ? 'text-destructive' : ''}>{task.priority || 'NORMAL'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deadline</span>
                    <span className={isOverdue && !isCompleted ? 'text-destructive' : ''}>
                      {task.deadline ? new Date(task.deadline).toLocaleString() : 'None'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {isPending && (
                    <button 
                      onClick={() => updateTaskStatus(task, 'ACKNOWLEDGED')}
                      className="col-span-2 bg-primary text-primary-foreground font-black uppercase py-2 border-4 border-border hover:bg-foreground hover:text-background flex justify-center items-center gap-2 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" /> Acknowledge
                    </button>
                  )}

                  {(task.status === 'ACKNOWLEDGED' || task.status === 'BLOCKED') && (
                    <button 
                      onClick={() => updateTaskStatus(task, 'IN_PROGRESS')}
                      className="col-span-2 bg-secondary text-secondary-foreground font-black uppercase py-2 border-4 border-border hover:bg-foreground hover:text-background flex justify-center items-center gap-2 transition-colors"
                    >
                      <Play className="w-4 h-4" /> Start Working
                    </button>
                  )}

                  {isInProgress && (
                    <>
                      <button 
                        onClick={() => updateTaskStatus(task, 'COMPLETED')}
                        className="bg-accent text-accent-foreground font-black uppercase py-2 border-4 border-border hover:bg-foreground hover:text-background flex justify-center items-center gap-2 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" /> Complete
                      </button>
                      <button 
                        onClick={() => updateTaskStatus(task, 'BLOCKED')}
                        className="bg-destructive text-destructive-foreground font-black uppercase py-2 border-4 border-destructive hover:bg-foreground hover:text-background hover:border-foreground flex justify-center items-center gap-2 transition-colors"
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
          <div className="col-span-full text-center py-12 border-4 border-white/20 border-dashed font-black uppercase text-2xl text-muted-foreground">
            You have no assigned tasks.
          </div>
        )}
      </div>
    </div>
  );
}
