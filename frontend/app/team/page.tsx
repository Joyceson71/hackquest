'use client';

import { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api';
import { useRole } from '@/lib/role-context';
import { Loader2, Users, CheckCircle, Clock, AlertTriangle, Plus, BarChart } from 'lucide-react';
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin" /></div>;

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
    <div className="container mx-auto px-6 py-12 max-w-7xl">
      <header className="mb-12 border-b-4 border-white pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-2">
            {selectedTeam.name}
          </h1>
          <p className="text-xl font-bold uppercase text-primary">
            {isLeader ? 'Team Leader Dashboard' : 'Team Member View'}
          </p>
        </div>
        
        {isLeader && (
          <Link href={`/team/new-task?teamId=${selectedTeam.teamId}`} className="bg-primary text-primary-foreground font-black uppercase px-6 py-3 border-4 border-white hover:bg-white hover:text-black transition-colors flex items-center gap-2">
            <Plus className="w-5 h-5" /> Assign Task
          </Link>
        )}
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Workload Dashboard - ONLY FOR LEADERS */}
        {isLeader && (
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-2">
              <BarChart className="w-8 h-8 text-primary" /> Workload
            </h2>
            
            <div className="space-y-4">
              {selectedTeam.members.map(member => {
                const w = workloads[member.email];
                if (!w) return null;
                return (
                  <div key={member.email} className="bg-card border-4 border-white p-4 shadow-brutal flex flex-col justify-between">
                    <h3 className="font-black uppercase truncate text-foreground" title={member.email}>{member.email}</h3>
                    <div className="flex gap-2 mt-2 text-xs font-bold uppercase">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1">Act: {w.active}</span>
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1">Pnd: {w.pending}</span>
                      <span className="bg-destructive/20 text-destructive px-2 py-1 border-2 border-destructive">Ovd: {w.overdue}</span>
                    </div>
                    <div className="mt-4 pt-4 border-t-2 border-white/20 flex justify-between">
                      <span className="font-bold uppercase text-xs text-foreground">Workload Score</span>
                      <span className="font-black text-primary text-lg leading-none">{w.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tasks List */}
        <div className={isLeader ? "lg:col-span-2 space-y-6" : "lg:col-span-3 space-y-6"}>
          <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-2">
            <Users className="w-8 h-8 text-primary" /> Active Tasks
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {tasks.map(task => {
              const isOverdue = task.deadline && new Date(task.deadline) < now;
              return (
                <div key={task.actionId} className={`bg-card border-4 ${isOverdue ? 'border-destructive shadow-[6px_6px_0px_0px_theme(colors.destructive.DEFAULT)]' : 'border-white shadow-brutal'} p-5 flex flex-col justify-between`}>
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="bg-primary text-primary-foreground px-2 py-1 text-xs font-black uppercase border-2 border-primary">{task.status}</span>
                      {isOverdue && <span className="bg-destructive text-destructive-foreground px-2 py-1 text-xs font-black uppercase flex items-center gap-1 border-2 border-destructive"><AlertTriangle className="w-3 h-3"/> Overdue</span>}
                    </div>
                    <h3 className="font-black text-xl uppercase mb-1 text-foreground">{task.task}</h3>
                    <p className="text-sm font-bold text-muted-foreground mb-4 truncate">{task.description}</p>
                  </div>
                  
                  <div className="pt-4 border-t-2 border-white/20">
                    <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground mb-1">
                      <span>Assignee</span>
                      <span>{task.currentOwner || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground">
                      <span>Deadline</span>
                      <span>{task.deadline ? new Date(task.deadline).toLocaleDateString() : 'None'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {tasks.length === 0 && (
              <div className="col-span-full text-center py-12 border-4 border-white/20 border-dashed font-black uppercase text-2xl text-muted-foreground">
                No active tasks in this team.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
