'use client';

import { useEffect, useState } from 'react';
import RoleGuard from '@/components/RoleGuard';
import { authenticatedFetch } from '@/lib/api';
import { Loader2, Plus, Users, Trash } from 'lucide-react';

interface Team {
  teamId: string;
  name: string;
  description: string;
  leaderEmail: string | null;
  createdAt: string;
}

export default function AdminTeamsPage() {

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');

  const fetchTeams = async () => {
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/teams`);
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/teams`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newTeamName })
      });
      if (res.ok) {
        setNewTeamName('');
        fetchTeams();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <RoleGuard allowedRole="admin">
      <div className="flex-1 w-full p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Teams Management</h1>
            <p className="text-muted-foreground mt-1">Create teams and assign organizational leaders.</p>
          </div>
        </div>

        {/* Create Team Form */}
        <div className="premium-card p-4 sm:p-6 mb-8 flex flex-col sm:flex-row gap-4 items-center">
          <input 
            type="text" 
            placeholder="New Team Name" 
            className="w-full sm:flex-1 bg-muted/50 border border-border p-3 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground placeholder:text-muted-foreground transition-all"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
          />
          <button 
            onClick={handleCreateTeam}
            disabled={!newTeamName.trim()}
            className="w-full sm:w-auto btn-primary whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" /> Create Team
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-[30vh]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map(team => (
              <a 
                key={team.teamId} 
                href={`/admin/teams/${team.teamId}`}
                className="block premium-card p-6 hover:border-primary/50 transition-all duration-300 cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold truncate text-foreground tracking-tight group-hover:text-primary transition-colors">{team.name}</h2>
                  <div className="p-2 rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <span className="font-medium text-xs text-muted-foreground">Leader</span>
                    <span className="font-medium text-foreground bg-muted px-2.5 py-0.5 rounded-md truncate max-w-[150px] text-xs">
                      {team.leaderEmail || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs text-muted-foreground">Created</span>
                    <span className="text-xs font-medium text-foreground">{new Date(team.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </a>
            ))}
            
            {teams.length === 0 && (
              <div className="col-span-full premium-card border-dashed p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-foreground">No teams created</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                    Get started by creating your first organizational team above.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
