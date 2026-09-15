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
      <div className="container mx-auto px-6 py-12 max-w-6xl">
        <header className="mb-12 border-b border-white/10 pb-6 flex flex-wrap gap-4 justify-between items-end">
          <div>
            <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-2">
              Teams Management
            </h1>
            <p className="text-lg font-medium text-muted-foreground">
              Create and assign leaders
            </p>
          </div>
        </header>

        <div className="glass-card border-white/10 p-6 mb-12 flex flex-wrap gap-4 rounded-2xl">
          <input 
            type="text" 
            placeholder="New Team Name" 
            className="flex-1 min-w-0 bg-foreground/20 border border-white/10 p-3 font-medium rounded-xl focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
          />
          <button 
            onClick={handleCreateTeam}
            disabled={!newTeamName.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 py-3 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-2" /> Create Team
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center min-h-[30vh]">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teams.map(team => (
              <a 
                key={team.teamId} 
                href={`/admin/teams/${team.teamId}`}
                className="block glass-card border-white/10 p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer group rounded-2xl"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-2xl font-heading font-semibold truncate text-foreground tracking-tight">{team.name}</h2>
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-medium text-sm text-muted-foreground tracking-wider uppercase">Leader</span>
                    <span className="font-medium bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-md truncate max-w-[150px] text-sm">
                      {team.leaderEmail || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-2">
                    <span className="font-medium text-sm text-muted-foreground tracking-wider uppercase">Created</span>
                    <span className="text-sm font-medium text-foreground">{new Date(team.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </a>
            ))}
            
            {teams.length === 0 && (
              <div className="col-span-full text-center py-20 border border-white/10 bg-card/30 rounded-3xl border-dashed font-heading font-medium text-xl text-muted-foreground">
                No Teams Created Yet
              </div>
            )}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
