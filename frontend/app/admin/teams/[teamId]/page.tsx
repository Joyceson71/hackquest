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
      <div className="flex-1 w-full p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        <a
          href="/admin/teams"
          className="inline-flex items-center gap-2 font-medium text-sm text-muted-foreground hover:text-foreground transition-all mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Teams
        </a>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {team.name}
            </h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> 
              Leader: <span className="font-medium text-foreground">{team.leaderEmail || 'None Assigned'}</span>
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Members List */}
          <div className="lg:col-span-8 space-y-6">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Team Members
            </h2>
            
            <div className="space-y-4">
              {team.members.map(member => (
                <div key={member.email} className="premium-card p-5 flex items-center justify-between gap-3 group">
                  <div className="min-w-0 flex-1 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground font-medium shrink-0">
                      {member.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-medium text-base text-foreground truncate" title={member.email}>{member.email}</h3>
                      <span className={`inline-block px-2 py-0.5 mt-1 text-xs font-medium rounded-md ${member.role === 'LEADER' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground'}`}>
                        {member.role === 'LEADER' ? 'Leader' : 'Member'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveMember(member.email)}
                    className="shrink-0 p-2.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    title={`Remove ${member.email}`}
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              {team.members.length === 0 && (
                <div className="premium-card border-dashed p-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">No members yet</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                      Add team members using the form to get started.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Add Member Form */}
          <div className="lg:col-span-4">
            <div className="premium-card p-6 sticky top-24">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-foreground">
                <Plus className="w-4 h-4 text-primary" /> Add Member
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="employee@example.com" 
                    className="w-full bg-muted/50 text-foreground border border-border p-3 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition-colors"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">Role</label>
                  <select 
                    className="w-full bg-muted/50 text-foreground border border-border p-3 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
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
                  className="w-full btn-primary py-3 mt-4"
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
