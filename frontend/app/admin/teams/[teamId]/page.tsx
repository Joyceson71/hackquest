'use client';

import { useEffect, useState, use } from 'react';
import RoleGuard from '@/components/RoleGuard';
import { authenticatedFetch } from '@/lib/api';
import { Loader2, Plus, Users, Trash, Shield, ArrowLeft } from 'lucide-react';

interface TeamMember {
  email: string;
  name: string;
  role: string;
  joinedAt: string;
}

interface TeamData {
  teamId: string;
  name: string;
  description: string;
  leaderEmail: string | null;
  createdAt: string;
  members: TeamMember[];
}

export default function AdminTeamDetailsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const unwrappedParams = use(params);
  const teamId = unwrappedParams.teamId;

  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('MEMBER');

  const fetchTeam = async () => {
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/teams/${teamId}`);
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [teamId]);

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) return;
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: newMemberEmail, role: newMemberRole })
      });
      if (res.ok) {
        setNewMemberEmail('');
        fetchTeam();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveMember = async (email: string) => {
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/teams/${teamId}/members/${encodeURIComponent(email)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchTeam();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-[40vh]">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
    </div>
  );
  if (!team) return (
    <div className="flex justify-center items-center min-h-[40vh] font-black uppercase text-2xl text-muted-foreground">
      Team not found
    </div>
  );

  return (
    <RoleGuard allowedRole="admin">
      <div className="container mx-auto px-6 py-12 max-w-6xl">
        <a
          href="/admin/teams"
          className="inline-flex items-center gap-2 font-medium text-sm border border-white/10 px-4 py-2 bg-card/50 hover:bg-card/5 hover:text-foreground transition-all shadow-sm rounded-xl mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Teams
        </a>

        <header className="mb-12 border-b border-white/10 pb-6">
          <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight mb-2 text-foreground">
            {team.name}
          </h1>
          <p className="text-lg font-medium text-muted-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Leader: <span className="text-foreground">{team.leaderEmail || 'None Assigned'}</span>
          </p>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Members List */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-heading font-semibold tracking-tight flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Users className="w-6 h-6" />
              </div>
              Team Members
            </h2>
            
            <div className="space-y-4">
              {team.members.map(member => (
                <div key={member.email} className="glass-card border-white/10 p-5 rounded-2xl flex items-center justify-between gap-3 transition-all hover:shadow-lg">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading font-semibold text-lg text-foreground truncate tracking-tight" title={member.email}>{member.email}</h3>
                    <span className={`inline-block px-3 py-1 text-xs font-semibold mt-2 border rounded-full ${member.role === 'LEADER' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-card/5 text-muted-foreground border-white/10'}`}>
                      {member.role === 'LEADER' ? 'Leader' : 'Member'}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleRemoveMember(member.email)}
                    className="shrink-0 p-2.5 rounded-full border border-white/10 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                    title={`Remove ${member.email}`}
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              {team.members.length === 0 && (
                <div className="text-center py-12 border border-white/10 bg-card/30 rounded-3xl border-dashed font-medium text-lg text-muted-foreground">
                  No members yet. Add someone!
                </div>
              )}
            </div>
          </div>

          {/* Add Member Form */}
          <div>
            <div className="glass-card border-white/10 p-8 sticky top-24 rounded-2xl">
              <h2 className="text-xl font-heading font-semibold mb-6 flex items-center gap-2 text-foreground">
                <Plus className="w-5 h-5 text-primary" /> Add Member
              </h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-muted-foreground">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="employee@hackquest.com" 
                    className="w-full bg-foreground/20 text-foreground border border-white/10 p-3 rounded-xl font-medium focus:outline-none focus:border-primary placeholder:text-muted-foreground transition-colors"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-muted-foreground">Role</label>
                  <select 
                    className="w-full bg-foreground/20 text-foreground border border-white/10 p-3 rounded-xl font-medium focus:outline-none focus:border-primary transition-colors appearance-none"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                  >
                    <option value="MEMBER">Team Member</option>
                    <option value="LEADER">Team Leader</option>
                  </select>
                </div>

                <button 
                  onClick={handleAddMember}
                  disabled={!newMemberEmail.trim()}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold p-4 mt-6 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
                >
                  Add to Team
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
