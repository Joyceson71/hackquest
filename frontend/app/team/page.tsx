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
    <div className="flex-1 w-full p-8 md:p-12 max-w-7xl mx-auto space-y-12">
      
      {/* Header */}
      <div className="manga-panel p-8 pb-10 border-b-2">
        <div className="absolute top-0 right-0 p-4 text-border opacity-20 manga-header text-6xl leading-none">
          // SQUAD
        </div>
        <p className="meta-label text-primary font-bold tracking-widest mb-4">SQUAD OVERVIEW // {isLeader ? 'LEAD CLEARANCE' : 'OPERATOR CLEARANCE'}</p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10">
          <h1 className="manga-header text-5xl md:text-6xl text-foreground">
            {selectedTeam.name.toUpperCase()}
          </h1>
          {isLeader && (
            <Link 
              href={`/team/new-task?teamId=${selectedTeam.teamId}`} 
              className="btn-primary flex items-center justify-center gap-2 h-12 px-6 meta-label w-full md:w-auto"
            >
              [+] ALLOCATE MISSION
            </Link>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-12">
        
        {/* Workload Dashboard - ONLY FOR LEADERS */}
        {isLeader && (
          <div className="lg:col-span-4 space-y-6">
            <h2 className="meta-label text-muted-foreground border-b-2 border-border pb-2 font-bold">
              WORKLOAD DISTRIBUTION
            </h2>
            
            <div className="space-y-4">
              {selectedTeam.members.map(member => {
                const w = workloads[member.email];
                if (!w) return null;
                return (
                  <div key={member.email} className="manga-panel p-6 flex flex-col justify-between group">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0 border border-border">
                        {member.email.charAt(0).toUpperCase()}
                      </div>
                      <h3 className="meta-label text-foreground font-bold truncate" title={member.email}>
                        {member.email.toUpperCase()}
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-0 mb-6 border border-border bg-muted/10">
                      <div className="flex flex-col p-4 border-r border-border">
                        <span className="text-[10px] text-muted-foreground font-bold tracking-widest mb-2">ACTIVE</span>
                        <span className="manga-header text-2xl text-foreground">{w.active}</span>
                      </div>
                      <div className="flex flex-col p-4 border-r border-border">
                        <span className="text-[10px] text-muted-foreground font-bold tracking-widest mb-2">PENDING</span>
                        <span className="manga-header text-2xl text-foreground">{w.pending}</span>
                      </div>
                      <div className="flex flex-col p-4 bg-destructive/10 border-b-2 border-destructive">
                        <span className="text-[10px] text-destructive font-bold tracking-widest mb-2">OVERDUE</span>
                        <span className="manga-header text-2xl text-destructive">{w.overdue}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t-2 border-border flex justify-between items-center">
                      <span className="meta-label text-muted-foreground font-bold">THREAT SCORE</span>
                      <span className="manga-header text-xl text-foreground">{w.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tasks List */}
        <div className={isLeader ? "lg:col-span-8 space-y-6" : "lg:col-span-12 space-y-6"}>
          <div className="flex items-center justify-between border-b-2 border-border pb-2">
            <h2 className="meta-label font-bold text-muted-foreground">
              ACTIVE OPERATIONS
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map((task, index) => {
              const isOverdue = task.deadline && new Date(task.deadline) < now;
              return (
                <div key={task.actionId} className={`manga-panel p-8 flex flex-col justify-between ${isOverdue ? 'border-l-destructive border-l-4' : 'border-l-primary border-l-4'}`}>
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <span className="meta-label font-bold text-foreground bg-muted/20 px-2 py-1 border border-border">
                        {task.status.toUpperCase()}
                      </span>
                      {isOverdue && (
                        <span className="meta-label text-destructive font-bold">
                          [OVERDUE]
                        </span>
                      )}
                    </div>
                    <h3 className="manga-header text-3xl text-foreground mb-4 leading-snug">{task.task}</h3>
                    <p className="meta-label text-muted-foreground mb-8 line-clamp-3 leading-relaxed opacity-70">{task.description}</p>
                  </div>
                  
                  <div className="pt-6 border-t-2 border-border mt-auto space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="meta-label text-muted-foreground font-bold">ASSIGNEE</span>
                      <span className="meta-label text-foreground font-bold">{task.currentOwner || 'UNASSIGNED'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="meta-label text-muted-foreground font-bold">DEADLINE</span>
                      <span className={`meta-label ${isOverdue ? 'text-destructive font-bold' : 'text-foreground font-bold'}`}>
                        {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() : 'NONE'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {tasks.length === 0 && (
              <div className="col-span-full manga-panel p-16 flex flex-col items-center justify-center text-center space-y-6">
                <h3 className="manga-header text-3xl text-foreground">NO ACTIVE OPERATIONS</h3>
                <p className="meta-label text-muted-foreground max-w-sm mx-auto">
                  SQUAD CAPABILITIES ARE CURRENTLY UNUTILIZED.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
