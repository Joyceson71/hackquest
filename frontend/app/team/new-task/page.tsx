'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api';
import { useRole } from '@/lib/role-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewTaskPage() {
  const { userEmail } = useRole();
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamId = searchParams.get('teamId');

  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{email: string, name: string}[]>([]);
  
  const [task, setTask] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignee, setAssignee] = useState('');
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    if (!teamId) return;
    
    // Fetch team members to populate the assignee dropdown
    authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/teams/${teamId}`)
      .then(res => res.json())
      .then(data => {
        if (data.members) setTeamMembers(data.members);
      })
      .catch(console.error);
  }, [teamId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) return;

    setLoading(true);
    try {
      const res = await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/teams/${teamId}/tasks`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          task,
          description,
          priority,
          assignee,
          deadline,
          assignedBy: userEmail
        })
      });

      if (res.ok) {
        router.push('/team');
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  if (!teamId) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
      <h2 className="text-3xl font-black uppercase text-destructive">Missing Team ID</h2>
      <p className="text-muted-foreground font-bold uppercase text-sm">Navigate here from the Team Dashboard.</p>
      <a href="/team" className="inline-flex items-center gap-2 font-black uppercase text-sm border-2 border-border px-4 py-2 bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors shadow-brutal-sm">
        <ArrowLeft className="w-4 h-4 stroke-[3]" /> Go to Team Dashboard
      </a>
    </div>
  );

  return (
    <div className="container mx-auto px-6 py-12 max-w-3xl">
      <Link
        href="/team"
        className="inline-flex items-center gap-2 font-black uppercase text-sm border-2 border-border px-4 py-2 bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors shadow-brutal-sm mb-8"
      >
        <ArrowLeft className="w-4 h-4 stroke-[3]" /> Back to Dashboard
      </Link>

      <header className="mb-12 border-b-4 border-white pb-6">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-2 text-foreground">
          Create New Task
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="bg-card border-4 border-white p-8 shadow-brutal-lg space-y-6">
        <div>
          <label className="block text-sm font-black uppercase mb-2 text-foreground">Task Title</label>
          <input 
            type="text" 
            required
            className="w-full bg-background text-foreground border-4 border-border p-3 font-bold focus:outline-none focus:border-primary placeholder:text-muted-foreground"
            value={task}
            onChange={(e) => setTask(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-black uppercase mb-2 text-foreground">Description</label>
          <textarea 
            rows={4}
            className="w-full bg-background text-foreground border-4 border-border p-3 font-bold focus:outline-none focus:border-primary"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-black uppercase mb-2 text-foreground">Priority</label>
            <select 
              className="w-full bg-background text-foreground border-4 border-border p-3 font-bold uppercase focus:outline-none focus:border-primary"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-black uppercase mb-2 text-foreground">Assignee</label>
            <select 
              required
              className="w-full bg-background text-foreground border-4 border-border p-3 font-bold uppercase focus:outline-none focus:border-primary"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">-- Select Member --</option>
              {teamMembers.map(m => (
                <option key={m.email} value={m.email}>{m.email}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-black uppercase mb-2 text-foreground">Deadline</label>
          <input 
            type="datetime-local" 
            required
            className="w-full bg-background text-foreground border-4 border-border p-3 font-bold uppercase focus:outline-none focus:border-primary"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <button 
          type="submit"
          disabled={loading || !task || !assignee}
          className="w-full bg-primary text-primary-foreground font-black uppercase p-4 mt-4 border-4 border-border hover:bg-foreground hover:text-background transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-brutal-sm"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Create and Assign'}
        </button>
      </form>
    </div>
  );
}
