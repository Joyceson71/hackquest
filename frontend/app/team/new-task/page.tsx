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
      <h2 className="text-2xl font-bold text-destructive">Missing Team ID</h2>
      <p className="text-muted-foreground text-sm">Navigate here from the Team Dashboard.</p>
      <Link href="/team" className="btn-secondary flex items-center gap-2 mt-2">
        <ArrowLeft className="w-4 h-4" /> Go to Team Dashboard
      </Link>
    </div>
  );

  return (
    <div className="flex-1 w-full p-6 md:p-8 max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <Link
        href="/team"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Create New Task
        </h1>
        <p className="text-muted-foreground mt-1">Assign a new task to a team member manually.</p>
      </header>

      <form onSubmit={handleSubmit} className="premium-card p-6 sm:p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">Task Title</label>
          <input 
            type="text" 
            required
            placeholder="e.g. Update API Documentation"
            className="w-full bg-muted/50 text-foreground border border-border p-3 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition-all"
            value={task}
            onChange={(e) => setTask(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">Description</label>
          <textarea 
            rows={4}
            placeholder="Provide details about the task..."
            className="w-full bg-muted/50 text-foreground border border-border p-3 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition-all resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Priority</label>
            <select 
              className="w-full bg-muted/50 text-foreground border border-border p-3 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
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
            <label className="block text-sm font-medium mb-2 text-foreground">Assignee</label>
            <select 
              required
              className="w-full bg-muted/50 text-foreground border border-border p-3 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
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
          <label className="block text-sm font-medium mb-2 text-foreground">Deadline</label>
          <input 
            type="datetime-local" 
            required
            className="w-full bg-muted/50 text-foreground border border-border p-3 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>

        <div className="pt-4 border-t border-border mt-6">
          <button 
            type="submit"
            disabled={loading || !task || !assignee}
            className="w-full btn-primary py-3 flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create and Assign'}
          </button>
        </div>
      </form>
    </div>
  );
}
