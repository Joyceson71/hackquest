'use client';

import { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api';
import { useRole } from '@/lib/role-context';
import { Loader2, CheckCircle, Clock, AlertTriangle, Play, AlertCircle } from 'lucide-react';

interface Task {
  actionId: string;
  PK: string;
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
    if (!userEmail) return;
    
    try {
      // 1. Get user's teams
      const teamRes = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${encodeURIComponent(userEmail)}/teams`);
      const myTeams = await teamRes.json();
      
      // 2. Fetch tasks for all those teams
      let allTasks: Task[] = [];
      for (const team of myTeams) {
        const taskRes = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/teams/${team.teamId}/tasks`);
        if (taskRes.ok) {
          const teamTasks = await taskRes.json();
          allTasks = [...allTasks, ...teamTasks];
        }
      }

      // 3. Filter down to only tasks assigned to ME
      const myTasks = allTasks.filter(t => t.currentOwner?.toLowerCase() === userEmail.toLowerCase());
      setTasks(myTasks);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTasks();
  }, [userEmail]);

  const updateTaskStatus = async (task: Task, newStatus: string) => {
    if (!userEmail) return;

    // Use the stored PK (which could be TASK#id or meetingId)
    const pk = task.PK || `TASK#${task.actionId}`;

    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/tasks/${task.actionId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pk: pk,
          status: newStatus,
          previousStatus: task.status,
          actor: userEmail
        })
      });

      if (res.ok) {
        fetchMyTasks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin" /></div>;

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
            <div key={task.actionId} className={`bg-card border-4 ${isOverdue && !isCompleted ? 'border-destructive bg-destructive/10' : 'border-white'} p-5 shadow-brutal flex flex-col justify-between ${isCompleted ? 'opacity-70 grayscale' : ''}`}>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-2 py-1 text-xs font-black uppercase border-2 ${isPending ? 'bg-yellow-300 text-black border-yellow-300' : isInProgress ? 'bg-secondary text-secondary-foreground border-secondary' : 'bg-primary text-primary-foreground border-primary'}`}>
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
                      className="col-span-2 bg-primary text-primary-foreground font-black uppercase py-2 border-4 border-white hover:bg-white hover:text-black flex justify-center items-center gap-2 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" /> Acknowledge
                    </button>
                  )}

                  {(task.status === 'ACKNOWLEDGED' || task.status === 'BLOCKED') && (
                    <button 
                      onClick={() => updateTaskStatus(task, 'IN_PROGRESS')}
                      className="col-span-2 bg-secondary text-secondary-foreground font-black uppercase py-2 border-4 border-white hover:bg-white flex justify-center items-center gap-2 transition-colors"
                    >
                      <Play className="w-4 h-4" /> Start Working
                    </button>
                  )}

                  {isInProgress && (
                    <>
                      <button 
                        onClick={() => updateTaskStatus(task, 'COMPLETED')}
                        className="bg-accent text-accent-foreground font-black uppercase py-2 border-4 border-white hover:bg-white flex justify-center items-center gap-2 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" /> Complete
                      </button>
                      <button 
                        onClick={() => updateTaskStatus(task, 'BLOCKED')}
                        className="bg-destructive text-destructive-foreground font-black uppercase py-2 border-4 border-white hover:bg-white hover:text-black flex justify-center items-center gap-2 transition-colors"
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
