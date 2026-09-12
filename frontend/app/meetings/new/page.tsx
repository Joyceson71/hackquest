'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Upload, FileText } from 'lucide-react';

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
    const res = await fetch(`${apiUrl}/meetings`, {
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
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setError('');
    setDemoLoading(true);
    try {
      const meetingId = await createMeeting('Q3 Launch Plan (Demo)', DEMO_PARTICIPANTS, SYNTHETIC_TRANSCRIPT);
      router.push(`/meetings/${meetingId}/transcript`);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setDemoLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Try the Demo</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Load a pre-configured meeting transcript to see how the AI extracts decisions and tasks.
              </p>
            </div>
            <Button onClick={handleLoadDemo} disabled={demoLoading || loading} className="shrink-0">
              <FileText className="h-4 w-4 mr-2" />
              {demoLoading ? 'Loading…' : 'Load Demo'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground font-semibold">Or Upload Custom</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Upload Transcript</CardTitle>
          <CardDescription>
            Upload a meeting transcript to extract action items. Accepted formats: .txt, .vtt, .srt
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="meeting-title">Meeting Title</Label>
              <Input
                id="meeting-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Weekly Sprint Planning"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="participants">Participant Directory</Label>
              <Textarea
                id="participants"
                required
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="Alice (Engineering Manager)&#10;Bob (Backend Developer)&#10;Charlie (Designer)"
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">One participant per line. Name and role. Max 20 participants.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transcript-file">Transcript File</Label>
              <Input
                id="transcript-file"
                type="file"
                accept=".txt,.vtt,.srt"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              <p className="text-xs text-muted-foreground">Max 500 KB</p>
            </div>

            <Button type="submit" className="w-full" disabled={loading || demoLoading}>
              <Upload className="h-4 w-4 mr-2" />
              {loading ? 'Uploading…' : 'Upload & Extract Actions'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
