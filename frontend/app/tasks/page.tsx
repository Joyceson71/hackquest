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
    <div className="flex-1 w-full p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            My Tasks
          </h1>
          <p className="text-muted-foreground mt-1">
            Your active workload and assignments.
          </p>
        </div>
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
            <div key={task.actionId} className={`premium-card p-6 flex flex-col justify-between group ${isOverdue && !isCompleted ? 'border-l-4 border-l-destructive' : ''}`}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                    isPending ? 'bg-amber-500/10 text-amber-500' :
                    isInProgress ? 'bg-secondary/10 text-secondary' :
                    isCompleted ? 'bg-emerald-500/10 text-emerald-500' :
                    'bg-primary/10 text-primary'
                  }`}>
                    {task.status}
                  </span>
                  {isOverdue && !isCompleted && <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/> Overdue</span>}
                </div>
                
                <h3 className="font-semibold text-lg mb-2 leading-snug text-foreground tracking-tight group-hover:text-primary transition-colors" title={task.task}>{task.task}</h3>
                <p className="text-sm text-muted-foreground mb-6 line-clamp-3">{task.description}</p>
              </div>
              
              <div className="space-y-5 mt-auto">
                <div className="pt-4 border-t border-border text-xs text-muted-foreground">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Priority</span>
                    <span className={`px-2 py-0.5 rounded-md font-medium ${task.priority === 'HIGH' || task.priority === 'CRITICAL' ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>{task.priority || 'NORMAL'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Deadline</span>
                    <span className={isOverdue && !isCompleted ? 'text-destructive font-medium' : 'text-foreground'}>
                      {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'None'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {isPending && (
                    <button 
                      onClick={() => updateTaskStatus(task, 'ACKNOWLEDGED')}
                      className="col-span-2 btn-primary py-2.5 flex justify-center items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Acknowledge
                    </button>
                  )}

                  {(task.status === 'ACKNOWLEDGED' || task.status === 'BLOCKED') && (
                    <button 
                      onClick={() => updateTaskStatus(task, 'IN_PROGRESS')}
                      className="col-span-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-medium py-2.5 rounded-md flex justify-center items-center gap-2 transition-all shadow-sm"
                    >
                      <Play className="w-4 h-4 fill-current" /> Start Working
                    </button>
                  )}

                  {isInProgress && (
                    <>
                      <button 
                        onClick={() => updateTaskStatus(task, 'COMPLETED')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-md flex justify-center items-center gap-2 transition-all shadow-sm"
                      >
                        <CheckCircle className="w-4 h-4" /> Complete
                      </button>
                      <button 
                        onClick={() => updateTaskStatus(task, 'BLOCKED')}
                        className="bg-transparent border border-destructive text-destructive hover:bg-destructive/10 font-medium py-2.5 rounded-md flex justify-center items-center gap-2 transition-all"
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
          <div className="col-span-full premium-card border-dashed p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">You have no assigned tasks.</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Tasks assigned to you will appear here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
