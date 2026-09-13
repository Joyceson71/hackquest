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
          className="inline-flex items-center gap-2 font-black uppercase text-sm border-2 border-border px-4 py-2 bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors shadow-brutal-sm mb-8"
        >
          <ArrowLeft className="w-4 h-4 stroke-[3]" /> Back to Teams
        </a>

        <header className="mb-12 border-b-4 border-white pb-6">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-2">
            {team.name}
          </h1>
          <p className="text-xl font-bold uppercase text-muted-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Leader: {team.leaderEmail || 'None Assigned'}
          </p>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Members List */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-2">
              <Users className="w-8 h-8 text-primary" /> Team Members
            </h2>
            
            <div className="space-y-4">
              {team.members.map(member => (
                <div key={member.email} className="bg-card border-4 border-border p-4 shadow-brutal flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black uppercase text-lg text-foreground truncate" title={member.email}>{member.email}</h3>
                    <span className={`inline-block px-2 py-1 text-xs font-black uppercase mt-1 border-2 border-border ${member.role === 'LEADER' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {member.role}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleRemoveMember(member.email)}
                    className="shrink-0 p-2 border-2 border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                    title={`Remove ${member.email}`}
                  >
                    <Trash className="w-5 h-5" />
                  </button>
                </div>
              ))}
              
              {team.members.length === 0 && (
                <div className="text-center py-8 border-4 border-white/20 border-dashed font-bold uppercase text-muted-foreground">
                  No members yet. Add someone!
                </div>
              )}
            </div>
          </div>

          {/* Add Member Form */}
          <div>
            <div className="bg-card border-4 border-white p-6 sticky top-6 shadow-brutal-lg">
              <h2 className="text-2xl font-black uppercase mb-6 flex items-center gap-2 text-foreground">
                <Plus className="w-6 h-6 text-primary" /> Add Member
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-2 text-muted-foreground">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="employee@hackquest.com" 
                    className="w-full bg-background text-foreground border-4 border-border p-3 font-bold focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase mb-2 text-muted-foreground">Role</label>
                  <select 
                    className="w-full bg-background text-foreground border-4 border-border p-3 font-bold uppercase focus:outline-none focus:border-primary"
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
                  className="w-full bg-primary text-primary-foreground font-black uppercase p-4 mt-4 hover:bg-foreground hover:text-background transition-colors disabled:opacity-50 border-4 border-border shadow-brutal-sm"
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
