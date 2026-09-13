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
        <header className="mb-10 border-b-4 border-border pb-6 flex flex-wrap gap-4 justify-between items-end">
          <div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-2">
              Teams Management
            </h1>
            <p className="text-xl font-bold uppercase text-muted-foreground">
              Create and assign leaders
            </p>
          </div>
        </header>

        <div className="bg-card border-4 border-border shadow-brutal-lg p-6 mb-10 flex flex-wrap gap-4">
          <input 
            type="text" 
            placeholder="New Team Name" 
            className="flex-1 min-w-0 bg-background border-4 border-border p-3 font-bold uppercase focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
          />
          <button 
            onClick={handleCreateTeam}
            disabled={!newTeamName.trim()}
            className="bg-primary text-primary-foreground font-black uppercase px-6 py-3 border-4 border-border hover:bg-foreground hover:text-background transition-colors disabled:opacity-50 shadow-brutal-sm flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Create Team
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
                className="block bg-card border-4 border-white p-6 shadow-brutal hover:-translate-y-1 hover:shadow-brutal-lg transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-black uppercase truncate text-foreground">{team.name}</h2>
                  <Users className="w-6 h-6 text-primary group-hover:animate-bounce" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b-2 border-white/20 pb-2">
                    <span className="font-bold uppercase text-sm text-foreground">Leader</span>
                    <span className="font-bold bg-primary/20 text-primary px-2 py-1 truncate max-w-[150px]">
                      {team.leaderEmail || 'UNASSIGNED'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-2">
                    <span className="font-bold uppercase text-sm text-foreground">Created</span>
                    <span className="font-mono text-sm text-muted-foreground">{new Date(team.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </a>
            ))}
            
            {teams.length === 0 && (
              <div className="col-span-full text-center py-12 border-4 border-white/20 border-dashed font-black uppercase text-2xl text-muted-foreground">
                No Teams Created Yet
              </div>
            )}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
