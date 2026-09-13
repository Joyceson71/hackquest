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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-4 border-border pb-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-4xl md:text-5xl font-black text-foreground uppercase tracking-tighter drop-shadow-[-4px_4px_0px_var(--primary)]">
            YOUR MEETINGS
          </h1>
          <p className="text-sm font-bold mt-2 px-2 py-1 bg-foreground text-background inline-block">
            REVIEW EXTRACTED ACTIONS &amp; BURN THE EVIDENCE
          </p>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Button 
            size="lg" 
            onClick={() => router.push('/meetings/new')} 
            className="bg-primary hover:bg-primary text-background text-base py-6 px-6 font-black uppercase shadow-brutal border-4 border-border transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
          >
            <Plus className="mr-2 h-5 w-5 stroke-[3]" />
            UPLOAD NEW TRANSCRIPT
          </Button>
        </motion.div>
      </div>

      {meetings.length === 0 ? (
        <motion.div variants={itemVariants} className="bg-card border-8 border-border p-8 text-center shadow-brutal-lg max-w-2xl mx-auto mt-4">
          <div className="bg-primary p-4 inline-flex border-4 border-border shadow-brutal mb-6">
            <FileText className="h-10 w-10 text-background" />
          </div>
          <h2 className="text-3xl font-black uppercase mb-3">NOTHING HERE YET!</h2>
          <p className="text-base font-bold mb-6">
            FEED THE MACHINE. UPLOAD A TRANSCRIPT TO EXTRACT ACTION ITEMS.
          </p>
          <Button 
            onClick={() => router.push('/meetings/new')} 
            className="bg-secondary text-secondary-foreground hover:bg-foreground hover:text-background text-lg py-6 px-10 font-black uppercase shadow-brutal border-4 border-border"
          >
            GET STARTED
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
                whileHover={{ scale: 1.03 }}
                className="card-hover bg-card border-4 border-border p-6 shadow-brutal cursor-pointer flex flex-col justify-between h-[250px]"
                onClick={() => router.push(`/meetings/${m.PK}/transcript`)}
              >
                <div>
                  <div className="flex items-center justify-between mb-4 border-b-4 border-border pb-4">
                    <span className="text-sm font-black uppercase bg-accent text-background px-3 py-1 border-2 border-border">
                      {date}
                    </span>
                    <Button 
                      variant="ghost" 
                      className="h-10 w-10 p-0 text-muted-foreground border-2 border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                      onClick={(e) => confirmDelete(e, m.PK)}
                    >
                      <Trash2 className="h-5 w-5 stroke-[3]" />
                    </Button>
                  </div>
                  <h3 className="text-2xl font-black uppercase line-clamp-2 leading-tight">
                    {m.title || 'UNTITLED MEETING'}
                  </h3>
                </div>
                
                <div className="mt-4 pt-4 flex items-center justify-between">
                  <div className="text-sm font-black px-3 py-1 bg-secondary text-foreground border-2 border-border uppercase">
                    {m.status || 'PROCESSED'}
                  </div>
                  <div className="text-primary font-black uppercase flex items-center group">
                    OPEN <ArrowRight className="ml-2 h-5 w-5 stroke-[3] group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="border-4 border-border shadow-brutal bg-card">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black uppercase text-foreground flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive stroke-[3]" />
              Nuke this meeting?
            </DialogTitle>
            <DialogDescription className="text-lg font-bold text-muted-foreground uppercase pt-2">
              This action cannot be undone. This will permanently delete the meeting transcript and all extracted actions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-4 sm:justify-start">
            <Button 
              variant="destructive" 
              onClick={executeDelete}
              className="text-lg font-black uppercase shadow-brutal border-2 border-border hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              NUKE IT
            </Button>
            <Button 
              variant="outline" 
              onClick={() => { setDeleteModalOpen(false); setMeetingToDelete(null); }}
              className="text-lg font-black uppercase shadow-brutal border-2 border-border bg-card text-foreground hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none hover:bg-muted"
            >
              CANCEL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
