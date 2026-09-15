'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, ArrowRight, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, Variants } from 'framer-motion';
import { useRole } from '@/lib/role-context';


interface Meeting {
  PK: string;
  title: string;
  createdAt: string;
  status: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0, rotate: -2 },
  visible: { 
    y: 0, 
    opacity: 1, 
    rotate: 0,
    transition: { type: 'spring', stiffness: 300, damping: 20 }
  }
};

export default function Dashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);
  const router = useRouter();
  const { role } = useRole();

  // Redirect employees away from admin dashboard
  useEffect(() => {
    if (role === 'employee') {
      router.replace('/employee');
    }
  }, [role, router]);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
        const res = await authenticatedFetch(`${apiUrl}/meetings`);
        if (res.ok) {
          const data = await res.json();
          const sorted = data.sort((a: Meeting, b: Meeting) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
          setMeetings(sorted);
        } else if (res.status === 401 || res.status === 403) {
          // API rejected our token. Log but do NOT aggressively redirect —
          // the AuthProvider is responsible for session management.
          // A stale/expired token on one fetch should not nuke the whole session.
          console.error('[Dashboard] API returned', res.status, '— token may be expired. Please refresh.');
          setMeetings([]);
        }
      } catch (e) {
        console.error('Failed to fetch meetings', e);
      } finally {
        setLoading(false);
      }
    };
    fetchMeetings();
  }, []);

  const confirmDelete = (e: React.MouseEvent, meetingId: string) => {
    e.stopPropagation();
    setMeetingToDelete(meetingId);
    setDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!meetingToDelete) return;
    
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
      const res = await authenticatedFetch(`${apiUrl}/meetings/${meetingToDelete}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMeetings((prev) => prev.filter(m => m.PK !== meetingToDelete));
      } else {
        alert('Failed to delete meeting');
      }
    } catch (err) {
      console.error('Error deleting meeting', err);
      alert('Error deleting meeting');
    } finally {
      setDeleteModalOpen(false);
      setMeetingToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full p-8 md:p-12 max-w-7xl mx-auto space-y-12">
      
      {/* Header section */}
      <div className="border-b border-border pb-8">
        <p className="meta-text text-muted-foreground mb-4">SYSTEM OVERVIEW</p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <h1 className="editorial-heading text-5xl md:text-6xl text-foreground">
            GOOD MORNING,<br />LEAD.
          </h1>
          <Button 
            onClick={() => router.push('/meetings/new')} 
            className="btn-primary flex items-center gap-2 h-12 px-6 meta-text w-full md:w-auto"
          >
            <Plus className="h-4 w-4" />
            UPLOAD TRANSCRIPT
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-y border-border">
        <div className="p-8 border-b md:border-b-0 md:border-r border-border flex flex-col justify-center">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <span className="meta-text">01 // TOTAL MEETINGS</span>
          </div>
          <span className="editorial-heading text-6xl">{meetings.length}</span>
        </div>
        
        <div className="p-8 border-b md:border-b-0 md:border-r border-border flex flex-col justify-center">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <span className="meta-text text-primary">02 // PROCESSED</span>
          </div>
          <span className="editorial-heading text-6xl text-primary">{meetings.filter(m => m.status?.toLowerCase() === 'processed').length || meetings.length}</span>
        </div>
        
        <div className="p-8 flex flex-col justify-center opacity-50">
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <span className="meta-text">03 // PENDING REVIEW</span>
          </div>
          <span className="editorial-heading text-6xl">0</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="meta-text text-foreground">RECENT ACTIVITY</h2>
        </div>

        {meetings.length === 0 ? (
          <div className="border border-border p-12 flex flex-col items-center justify-center text-center space-y-6">
            <div>
              <h3 className="editorial-heading text-2xl text-foreground">NO LOGS DETECTED</h3>
              <p className="meta-text text-muted-foreground mt-4 max-w-sm mx-auto">
                INITIALIZE THE SYSTEM BY UPLOADING AN AUDIO TRANSCRIPT.
              </p>
            </div>
            <Button onClick={() => router.push('/meetings/new')} className="btn-secondary meta-text h-12 px-8">
              UPLOAD TRANSCRIPT
            </Button>
          </div>
        ) : (
          <div className="border-t border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="meta-text text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-4 font-normal">IDENTIFIER</th>
                    <th className="px-4 py-4 font-normal">TIMESTAMP</th>
                    <th className="px-4 py-4 font-normal">STATUS</th>
                    <th className="px-4 py-4 text-right font-normal">OPERATIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {meetings.map((m) => {
                    const dateStr = m.createdAt || new Date().toISOString();
                    const date = new Date(dateStr).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    }).toUpperCase();

                    return (
                      <tr key={m.PK} className="hover:bg-muted/50 transition-colors group">
                        <td className="px-4 py-6">
                          <button 
                            onClick={() => router.push(`/meetings/${m.PK}/transcript`)}
                            className="editorial-heading text-lg text-foreground hover:text-primary transition-colors text-left"
                          >
                            {m.title || 'UNTITLED LOG'}
                          </button>
                        </td>
                        <td className="px-4 py-6 meta-text text-muted-foreground">
                          {date}
                        </td>
                        <td className="px-4 py-6">
                          <span className="meta-text text-foreground">
                            ✓ {m.status?.toUpperCase() || 'PROCESSED'}
                          </span>
                        </td>
                        <td className="px-4 py-6 text-right">
                          <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              className="meta-text h-8 px-2 text-foreground hover:text-primary rounded-none"
                              onClick={() => router.push(`/meetings/${m.PK}/transcript`)}
                            >
                              VIEW &gt;
                            </Button>
                            <Button 
                              variant="ghost" 
                              className="meta-text h-8 px-2 text-muted-foreground hover:text-destructive rounded-none"
                              onClick={(e) => confirmDelete(e, m.PK)}
                            >
                              [DELETE]
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="border border-border bg-background rounded-none p-8">
          <DialogHeader>
            <DialogTitle className="editorial-heading text-2xl text-foreground">
              CONFIRM DELETION
            </DialogTitle>
            <DialogDescription className="meta-text text-muted-foreground pt-4">
              THIS ACTION WILL PERMANENTLY ERASE THE LOG AND ALL ASSOCIATED TASKS. THIS CANNOT BE UNDONE.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-4 sm:justify-end mt-8 border-t border-border pt-6">
            <Button 
              variant="outline" 
              onClick={() => { setDeleteModalOpen(false); setMeetingToDelete(null); }}
              className="btn-ghost meta-text rounded-none"
            >
              CANCEL
            </Button>
            <Button 
              variant="destructive" 
              onClick={executeDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-none px-6 py-2 meta-text"
            >
              PURGE LOG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
