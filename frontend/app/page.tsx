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
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 flex flex-col h-[calc(100vh-80px)] justify-center"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-4 border-black pb-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-4xl md:text-5xl font-heading font-black tracking-tighter uppercase text-foreground">
            Your Meetings
          </h1>
          <p className="text-sm font-bold mt-2 px-3 py-1 bg-primary text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-flex items-center uppercase tracking-widest">
            Review actions & process tasks
          </p>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Button 
            size="lg" 
            onClick={() => router.push('/meetings/new')} 
            className="bg-accent hover:bg-accent text-black text-base py-6 px-6 font-black uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all rounded-none"
          >
            <Plus className="mr-2 h-5 w-5 stroke-[3px]" />
            Upload Transcript
          </Button>
        </motion.div>
      </div>

      {meetings.length === 0 ? (
        <motion.div variants={itemVariants} className="glass-card p-10 text-center max-w-2xl mx-auto mt-4 flex flex-col items-center">
          <div className="bg-primary p-4 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-6 flex items-center justify-center">
            <FileText className="h-10 w-10 text-black stroke-[3px]" />
          </div>
          <h2 className="text-3xl font-heading font-black mb-3 uppercase tracking-tight">No meetings found</h2>
          <p className="text-muted-foreground font-bold text-base mb-8 max-w-md">
            Upload your first meeting transcript to automatically extract action items and assign tasks.
          </p>
          <Button 
            onClick={() => router.push('/meetings/new')} 
            className="bg-secondary hover:bg-secondary text-black text-lg py-6 px-10 font-black uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all rounded-none"
          >
            Get Started
          </Button>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {meetings.map((m) => {
            const dateStr = m.createdAt || new Date().toISOString();
            const date = new Date(dateStr).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            });

            return (
              <motion.div 
                key={m.PK}
                variants={itemVariants}
                className="glass-card p-6 cursor-pointer flex flex-col justify-between h-[240px]"
                onClick={() => router.push(`/meetings/${m.PK}/transcript`)}
              >
                <div>
                  <div className="flex items-center justify-between mb-4 border-b-2 border-black pb-4">
                    <span className="text-xs font-bold text-black uppercase tracking-widest bg-accent px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      {date}
                    </span>
                    <Button 
                      variant="ghost" 
                      className="h-8 w-8 p-0 bg-destructive text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-destructive rounded-none"
                      onClick={(e) => confirmDelete(e, m.PK)}
                    >
                      <Trash2 className="h-4 w-4 stroke-[3px]" />
                    </Button>
                  </div>
                  <h3 className="text-xl font-heading font-black line-clamp-2 leading-tight uppercase tracking-tight">
                    {m.title || 'Untitled Meeting'}
                  </h3>
                </div>
                
                <div className="mt-4 pt-4 flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-widest px-3 py-1 bg-secondary text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {m.status || 'Processed'}
                  </div>
                  <div className="text-black font-black uppercase tracking-widest flex items-center group text-sm border-b-2 border-transparent hover:border-black transition-colors">
                    View <ArrowRight className="ml-1.5 h-4 w-4 stroke-[3px] group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="glass-card sm:max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading font-black uppercase text-foreground flex items-center gap-3">
              <div className="p-2 bg-destructive border-2 border-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <AlertTriangle className="h-6 w-6 stroke-[3px]" />
              </div>
              Delete Meeting?
            </DialogTitle>
            <DialogDescription className="text-base text-black font-bold pt-3">
              THIS ACTION CANNOT BE UNDONE. THIS WILL PERMANENTLY DELETE THE MEETING TRANSCRIPT AND ALL EXTRACTED ACTIONS.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 gap-3 sm:justify-end">
            <Button 
              variant="outline" 
              onClick={() => { setDeleteModalOpen(false); setMeetingToDelete(null); }}
              className="text-sm font-black uppercase tracking-widest border-2 border-black bg-white text-black hover:bg-muted shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-none"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={executeDelete}
              className="text-sm font-black uppercase tracking-widest bg-destructive hover:bg-destructive text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-none"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
