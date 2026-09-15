'use client';

import { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api';
import { useRole } from '@/lib/role-context';
import { Loader2, Users, AlertTriangle, Plus, BarChart } from 'lucide-react';
import Link from 'next/link';

interface TeamMember {
  email: string;
  name: string;
  role: string;
}

interface TeamData {
  teamId: string;
  name: string;
  description: string;
  leaderEmail: string;
  members: TeamMember[];
}

interface Task {
  actionId: string;
  task: string;
  description: string;
  priority: string;
  status: string;
  currentOwner: string | null;
  deadline: string | null;
}

export default function TeamDashboardPage() {
  const { userEmail } = useRole();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeamDetails = async (teamId: string) => {
    try {
      const [teamRes, taskRes] = await Promise.all([
        authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/teams/${teamId}`),
        authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/teams/${teamId}/tasks`)
      ]);
      
      if (teamRes.ok && taskRes.ok) {
        const teamData = await teamRes.json();
        const taskData = await taskRes.json();
        setSelectedTeam(teamData);
        setTasks(taskData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Load teams this user belongs to
  useEffect(() => {
    if (!userEmail) return;
    
    const fetchMyTeams = async () => {
      try {
        const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/me/teams`);
        if (res.ok) {
          const myTeams = await res.json();
          setTeams(myTeams);
          if (myTeams.length > 0) {
            fetchTeamDetails(myTeams[0].teamId);
          } else {
            setLoading(false);
          }
        }
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };
    fetchMyTeams();
  }, [userEmail]);

  if (loading) return (
    <div className="flex justify-center items-center min-h-[40vh]">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
    </div>
  );

  if (teams.length === 0) {
    return (
      <div className="container mx-auto px-6 py-20 max-w-4xl text-center">
        <h1 className="text-4xl font-black uppercase mb-4">No Teams Found</h1>
        <p className="text-xl font-bold text-muted-foreground uppercase">You have not been assigned to any teams yet.</p>
      </div>
    );
  }

  if (!selectedTeam) return null;

  const currentUserMember = selectedTeam.members.find(m => m.email.toLowerCase() === userEmail?.toLowerCase());
  const isLeader = currentUserMember?.role === 'LEADER';

  // Calculate workloads
  const workloads: Record<string, { active: number, pending: number, overdue: number, score: number }> = {};
  selectedTeam.members.forEach(m => {
    workloads[m.email] = { active: 0, pending: 0, overdue: 0, score: 0 };
  });

  const now = new Date();
  tasks.forEach(t => {
    if (!t.currentOwner || !workloads[t.currentOwner]) return;
    
    const isOverdue = t.deadline && new Date(t.deadline) < now;
    if (isOverdue) {
      workloads[t.currentOwner].overdue++;
      workloads[t.currentOwner].score += 5;
    } else if (t.status === 'IN_PROGRESS') {
      workloads[t.currentOwner].active++;
      workloads[t.currentOwner].score += 3;
    } else if (t.status === 'PENDING') {
      workloads[t.currentOwner].pending++;
      workloads[t.currentOwner].score += 2;
    }
  });

  return (
    <div className="flex-1 w-full p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {selectedTeam.name}
            </h1>
            <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium border border-primary/20">
              {isLeader ? 'Leader View' : 'Member View'}
            </span>
          </div>
          <p className="text-muted-foreground mt-1">Manage team workload and track active tasks.</p>
        </div>
        
        {isLeader && (
          <Link 
            href={`/team/new-task?teamId=${selectedTeam.teamId}`} 
            className="btn-primary flex items-center justify-center gap-2 w-full md:w-auto"
          >
            <Plus className="w-4 h-4" /> 
            Assign Task
          </Link>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        
        {/* Workload Dashboard - ONLY FOR LEADERS */}
        {isLeader && (
          <div className="lg:col-span-4 space-y-6">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <BarChart className="w-5 h-5 text-primary" /> Workload
            </h2>
            
            <div className="space-y-4">
              {selectedTeam.members.map(member => {
                const w = workloads[member.email];
                if (!w) return null;
                return (
                  <div key={member.email} className="premium-card p-5 flex flex-col justify-between group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-foreground font-medium shrink-0">
                        {member.email.charAt(0).toUpperCase()}
                      </div>
                      <h3 className="font-medium text-sm text-foreground truncate" title={member.email}>
                        {member.email}
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="flex flex-col gap-1 p-2 bg-muted/30 rounded-md text-center">
                        <span className="text-xs text-muted-foreground font-medium">Active</span>
                        <span className="text-foreground font-bold">{w.active}</span>
                      </div>
                      <div className="flex flex-col gap-1 p-2 bg-amber-500/10 rounded-md text-center">
                        <span className="text-xs text-amber-500 font-medium">Pending</span>
                        <span className="text-amber-500 font-bold">{w.pending}</span>
                      </div>
                      <div className="flex flex-col gap-1 p-2 bg-destructive/10 rounded-md text-center">
                        <span className="text-xs text-destructive font-medium">Overdue</span>
                        <span className="text-destructive font-bold">{w.overdue}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border flex justify-between items-center">
                      <span className="font-medium text-xs text-muted-foreground">Workload Score</span>
                      <span className="font-bold text-foreground bg-muted px-2 py-0.5 rounded-md text-xs">{w.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tasks List */}
        <div className={isLeader ? "lg:col-span-8 space-y-6" : "lg:col-span-12 space-y-6"}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Active Tasks
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {tasks.map(task => {
              const isOverdue = task.deadline && new Date(task.deadline) < now;
              return (
                <div key={task.actionId} className={`premium-card p-5 flex flex-col justify-between ${isOverdue ? 'border-l-4 border-l-destructive' : ''}`}>
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="badge-inprogress">
                        {task.status}
                      </span>
                      {isOverdue && (
                        <span className="text-xs font-medium text-destructive flex items-center gap-1 bg-destructive/10 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3"/> Overdue
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-base text-foreground mb-1 leading-snug">{task.task}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{task.description}</p>
                  </div>
                  
                  <div className="pt-4 border-t border-border mt-auto">
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                      <span className="font-medium">Assignee</span>
                      <span className="text-foreground">{task.currentOwner || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span className="font-medium">Deadline</span>
                      <span className={`${isOverdue ? 'text-destructive font-medium' : 'text-foreground'}`}>
                        {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {tasks.length === 0 && (
              <div className="col-span-full premium-card border-dashed p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-foreground">No active tasks</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                    This team currently has no active tasks.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
