'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, CardAction, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Calendar, ArrowRight, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Meeting {
  PK: string;
  title: string;
  createdAt: string;
  status: string;
}

export default function Dashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await authenticatedFetch(`${apiUrl}/meetings`);
        if (res.ok) {
          const data = await res.json();
          // Sort by newest first
          const sorted = data.sort((a: Meeting, b: Meeting) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
          setMeetings(sorted);
        }
      } catch (e) {
        console.error('Failed to fetch meetings', e);
      } finally {
        setLoading(false);
      }
    };
    fetchMeetings();
  }, []);

  const handleDelete = async (e: React.MouseEvent, meetingId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this meeting?')) return;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await authenticatedFetch(`${apiUrl}/meetings/${meetingId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMeetings((prev) => prev.filter(m => m.PK !== meetingId));
      } else {
        alert('Failed to delete meeting');
      }
    } catch (err) {
      console.error('Error deleting meeting', err);
      alert('Error deleting meeting');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-foreground">Your Meetings</h1>
          <p className="text-foreground/70 mt-1">Review AI-extracted actions from past meetings.</p>
        </div>
        <Button size="lg" onClick={() => router.push('/meetings/new')} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="mr-2 h-5 w-5" />
          Upload Transcript
        </Button>
      </div>

      {meetings.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-primary/20 p-4 rounded-full mb-4">
            <Calendar className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl mb-2">No meetings yet!</CardTitle>
          <CardDescription className="text-base max-w-sm mb-6">
            Upload your first meeting transcript and let the AI extract your action items automatically.
          </CardDescription>
          <Button onClick={() => router.push('/meetings/new')} variant="default">
            Get Started
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings.map((m) => {
            const dateStr = m.createdAt || new Date().toISOString();
            const date = new Date(dateStr).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            });
            return (
              <Card key={m.PK} className="hover:-translate-y-1 transition-transform cursor-pointer" onClick={() => router.push(`/meetings/${m.PK}/transcript`)}>
                <CardHeader className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold text-muted-foreground">{date}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
                      onClick={(e) => handleDelete(e, m.PK)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardTitle className="text-xl line-clamp-2 pr-8">{m.title || 'Untitled Meeting'}</CardTitle>
                </CardHeader>
                <CardContent className="mt-4 pt-4 border-t-2 border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold px-2 py-1 rounded-full bg-secondary/20 text-secondary">
                      {m.status || 'PROCESSED'}
                    </div>
                    <div className="text-primary font-bold flex items-center text-sm group-hover:underline">
                      Open <ArrowRight className="ml-1 h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
