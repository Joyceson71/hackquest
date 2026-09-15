'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Upload, FileText } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';

const SYNTHETIC_TRANSCRIPT = `[00:00] Sarah (Organizer): Okay, let's get started. We need to finalize the Q3 launch plan.
[00:14] Marcus: I'll have the updated landing page copy ready by Friday. I just need final approval on the headline options.
[00:31] Sarah: Agreed — we're going with Headline B. That's decided.
[00:38] Priya: Great. I can handle the email campaign setup. I'll need the copy from Marcus first, so realistically I'm targeting end of next week.
[00:52] Sarah: Works for me. Marcus, can you loop in the design team today so Priya isn't waiting?
[01:04] Marcus: Yes, I'll send the brief to design this afternoon.
[01:11] Sarah: Good. What about the analytics dashboard? That was supposed to be ready for launch.
[01:19] Dev: It's 80% done. I need two more days — so Wednesday should be fine.
[01:28] Sarah: Wednesday is the hard deadline then. Dev, you own that.
[01:34] Priya: Should we schedule a dry run before launch?
[01:40] Sarah: Yes — let's do a dry run on Thursday at 2 PM. I'll send the calendar invite.
[01:51] Marcus: Works for me.
[01:53] Dev: Same.
[01:55] Sarah: Alright, to recap: Headline B is approved, Marcus owns landing page copy by Friday, Dev owns the dashboard by Wednesday, Priya owns email setup by end of next week, and I'll send the Thursday dry-run invite. Meeting closed.`;

const DEMO_PARTICIPANTS = `Sarah (Organizer)\nMarcus (Attendee)\nPriya (Attendee)\nDev (Attendee)`;

export default function NewMeetingPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');

  const createMeeting = async (meetingTitle: string, meetingParticipants: string, transcriptFile: File | string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    // 1. Initialize meeting
    const res = await authenticatedFetch(`${apiUrl}/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: meetingTitle, participants: meetingParticipants }),
    });

    if (!res.ok) throw new Error('Failed to initialize meeting');
    const { meetingId, uploadUrl } = await res.json();

    // 2. Upload transcript
    let body: BodyInit;
    if (typeof transcriptFile === 'string') {
      body = transcriptFile;
    } else {
      body = transcriptFile;
    }

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      body,
      headers: { 'Content-Type': 'text/plain' },
    });

    if (!uploadRes.ok) throw new Error('Failed to upload transcript to storage');

    return meetingId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please select a transcript file (.txt, .vtt, .srt)');
      return;
    }
    if (file.size > 500 * 1024) {
      setError('File size exceeds the 500 KB limit.');
      return;
    }
    const validTypes = ['.txt', '.vtt', '.srt'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(ext)) {
      setError('Invalid file type. Accepted formats: .txt, .vtt, .srt');
      return;
    }

    setLoading(true);
    try {
      const meetingId = await createMeeting(title, participants, file);
      router.push(`/meetings/${meetingId}/transcript`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      setLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setError('');
    setDemoLoading(true);
    try {
      const meetingId = await createMeeting('Q3 Launch Plan (Demo)', DEMO_PARTICIPANTS, SYNTHETIC_TRANSCRIPT);
      router.push(`/meetings/${meetingId}/transcript`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      setDemoLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full p-6 md:p-8 max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          New Meeting
        </h1>
        <p className="text-muted-foreground mt-1">Upload a transcript to automatically extract tasks and decisions.</p>
      </header>

      <div className="premium-card p-6 bg-primary/5 border border-primary/20">
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div>
            <h3 className="font-semibold text-primary">Try the Demo</h3>
            <p className="text-sm text-primary/70 mt-1 max-w-md">
              Load a pre-configured meeting transcript to see how the AI extracts decisions and tasks.
            </p>
          </div>
          <button onClick={handleLoadDemo} disabled={demoLoading || loading} className="shrink-0 btn-primary flex items-center px-4 py-2">
            <FileText className="h-4 w-4 mr-2" />
            {demoLoading ? 'Loading…' : 'Load Demo'}
          </button>
        </div>
      </div>

      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-4 text-muted-foreground font-medium tracking-wider">Or Upload Custom</span>
        </div>
      </div>

      <div className="premium-card p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Upload Transcript</h2>
          <p className="text-sm text-muted-foreground mt-1">Accepted formats: .txt, .vtt, .srt</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-md text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="meeting-title" className="block text-sm font-medium text-foreground">Meeting Title</label>
            <input
              id="meeting-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekly Sprint Planning"
              className="w-full bg-muted/50 text-foreground border border-border p-3 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="participants" className="block text-sm font-medium text-foreground">Participant Directory</label>
            <textarea
              id="participants"
              required
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="Alice (Engineering Manager)&#10;Bob (Backend Developer)&#10;Charlie (Designer)"
              className="w-full bg-muted/50 text-foreground border border-border p-3 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground transition-all min-h-[120px] resize-y"
            />
            <p className="text-xs text-muted-foreground mt-1">One participant per line (Name and Role). Max 20 participants.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="transcript-file" className="block text-sm font-medium text-foreground">Transcript File</label>
            <input
              id="transcript-file"
              type="file"
              accept=".txt,.vtt,.srt"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full file:mr-4 file:px-4 file:py-2 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer border border-border bg-muted/20 rounded-md"
            />
            <p className="text-xs text-muted-foreground mt-1">Max 500 KB</p>
          </div>

          <div className="pt-4 border-t border-border mt-6">
            <button type="submit" className="w-full btn-primary py-3 flex justify-center items-center" disabled={loading || demoLoading}>
              <Upload className="h-4 w-4 mr-2" />
              {loading ? 'Uploading…' : 'Upload & Extract Actions'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
