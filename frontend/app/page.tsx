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
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12 min-h-screen"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Hardware Control Panel (Left Column on large screens) */}
        <motion.div variants={itemVariants} className="lg:col-span-4 space-y-6">
          <div className="obj-raised p-6 md:p-8 flex flex-col justify-center min-h-[250px] relative overflow-hidden">
            <div className="absolute top-4 right-4 flex gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
              <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
            </div>
            <h1 className="text-3xl md:text-4xl font-heading font-black tracking-widest text-primary mb-2 uppercase drop-shadow-[0_0_10px_rgba(0,240,255,0.3)]">
              Meetings
            </h1>
            <p className="text-muted-foreground font-semibold text-sm uppercase tracking-widest mb-8">
              Data Extraction Module
            </p>
            <Button 
              size="lg" 
              onClick={() => router.push('/meetings/new')} 
              className="btn-3d-primary w-full py-6 flex items-center justify-center gap-3 text-sm"
            >
              <Plus className="h-5 w-5" />
              UPLOAD_TRANSCRIPT
            </Button>
          </div>

          <div className="obj-raised p-6 flex flex-row items-center justify-between border-l-4 border-l-primary">
            <div className="flex items-center gap-4">
              <div className="p-3 obj-inset rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Uploads</span>
                <span className="text-3xl font-black text-foreground">{meetings.length}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Display Screen (Right Column) */}
        <motion.div variants={itemVariants} className="lg:col-span-8 obj-inset p-6 md:p-8 min-h-[500px] flex flex-col relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          
          <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
            <h2 className="text-lg font-black text-foreground uppercase tracking-widest flex items-center gap-3">
              <div className="w-2 h-2 bg-primary rounded-sm shadow-[0_0_8px_var(--primary)] animate-pulse" />
              Active Memory Blocks
            </h2>
          </div>

          {meetings.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="p-6 obj-raised rounded-full mb-6 text-primary/40">
                <FileText className="h-12 w-12" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2 uppercase tracking-widest">Memory Empty</h2>
              <p className="text-muted-foreground font-semibold text-sm max-w-md uppercase">
                Initialize extraction by uploading a new audio transcript via the control panel.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-max">
              {meetings.map((m) => {
                const dateStr = m.createdAt || new Date().toISOString();
                const date = new Date(dateStr).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric'
                });

                return (
                  <motion.div 
                    key={m.PK}
                    variants={itemVariants}
                    className="obj-raised p-5 cursor-pointer flex flex-col justify-between h-[200px] group hover:border-primary/50"
                    onClick={() => router.push(`/meetings/${m.PK}/transcript`)}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-3">
                        <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-1 rounded shadow-[inset_0_0_5px_rgba(0,240,255,0.2)]">
                          {date}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-7 w-7 p-0 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={(e) => confirmDelete(e, m.PK)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <h3 className="text-lg font-bold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                        {m.title || 'UNKNOWN_RECORD'}
                      </h3>
                    </div>
                    
                    <div className="mt-4 pt-3 flex items-center justify-between border-t border-white/5">
                      <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted px-2 py-1 rounded shadow-3d-inset">
                        {m.status?.toLowerCase() || 'Processed'}
                      </div>
                      <div className="text-primary font-black text-[10px] uppercase tracking-widest flex items-center group-hover:drop-shadow-[0_0_5px_var(--primary)] transition-all">
                        ACCESS <ArrowRight className="ml-1.5 h-3 w-3 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="obj-raised border-none p-0 sm:max-w-md overflow-hidden bg-background">
          <div className="bg-destructive/10 p-6 border-b border-destructive/20 flex items-center gap-4">
            <div className="p-3 obj-inset rounded-lg text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-black text-destructive uppercase tracking-widest drop-shadow-[0_0_8px_var(--destructive)]">
              Confirm Purge
            </DialogTitle>
          </div>
          <div className="p-6">
            <DialogDescription className="text-sm font-semibold text-muted-foreground uppercase tracking-widest leading-relaxed mb-8">
              Are you sure? This action will permanently erase the memory block and associated extraction data.
            </DialogDescription>
            <DialogFooter className="gap-4 sm:justify-end">
              <Button 
                variant="outline" 
                onClick={() => { setDeleteModalOpen(false); setMeetingToDelete(null); }}
                className="btn-3d w-full sm:w-auto text-foreground hover:text-foreground"
              >
                ABORT
              </Button>
              <Button 
                variant="destructive" 
                onClick={executeDelete}
                className="btn-3d w-full sm:w-auto bg-destructive text-destructive-foreground shadow-[0_0_15px_rgba(255,51,51,0.4),var(--shadow-3d-raised-sm)] hover:bg-destructive/90"
              >
                PURGE_RECORD
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
