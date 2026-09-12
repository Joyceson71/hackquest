'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, ArrowRight, Trash2, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, Variants } from 'framer-motion';
import { useRole } from '@/lib/role-context';
import RoleGuard from '@/components/RoleGuard';

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight">
            YOUR MEETINGS
          </h1>
          <p className="text-sm font-medium mt-2 text-muted-foreground">
            Review extracted actions & verify the audit trail
          </p>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Button 
            size="lg" 
            onClick={() => router.push('/meetings/new')} 
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground text-base py-6 px-6 font-semibold shadow-glow transition-all rounded-xl border border-white/20"
          >
            <Plus className="mr-2 h-5 w-5" />
            Upload Transcript
          </Button>
        </motion.div>
      </div>

      {meetings.length === 0 ? (
        <motion.div variants={itemVariants} className="glass-card p-12 text-center max-w-2xl mx-auto mt-12">
          <div className="bg-primary/10 p-4 rounded-full inline-block border border-primary/20 shadow-glow-sm mb-6">
            <Loader2 className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-3 tracking-tight">Nothing here yet</h2>
          <p className="text-base text-muted-foreground mb-8">
            Upload a transcript to extract action items.
          </p>
          <Button 
            onClick={() => router.push('/meetings/new')} 
            className="bg-secondary hover:bg-secondary/90 text-secondary-foreground text-lg py-6 px-10 font-semibold rounded-xl shadow-glow-sm"
          >
            Get Started
          </Button>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {meetings.map((m, idx) => {
            const dateStr = m.createdAt || new Date().toISOString();
            const date = new Date(dateStr).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            });
            return (
              <motion.div 
                key={m.PK}
                variants={itemVariants}
                className="card-hover glass-card p-6 cursor-pointer flex flex-col justify-between h-[250px] relative overflow-hidden group"
                onClick={() => router.push(`/meetings/${m.PK}/transcript`)}
              >
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                      {date}
                    </span>
                    <Button 
                      variant="ghost" 
                      className="h-10 w-10 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                      onClick={(e) => confirmDelete(e, m.PK)}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                    {m.title || 'Untitled Meeting'}
                  </h3>
                </div>
                
                <div className="relative z-10 mt-4 pt-4 flex items-center justify-between">
                  <div className="text-xs font-medium px-3 py-1 bg-white/5 text-muted-foreground rounded-full border border-white/10 uppercase">
                    {m.status || 'Processed'}
                  </div>
                  <div className="text-accent font-semibold text-sm flex items-center group-hover:text-primary transition-colors">
                    View <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="glass-card bg-[#18181b]/95 p-6 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="bg-destructive/10 p-2 rounded-full">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              Delete meeting?
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground pt-4">
              This action cannot be undone. This will permanently delete the meeting transcript and all extracted actions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 gap-3 sm:justify-start">
            <Button 
              variant="destructive" 
              onClick={executeDelete}
              className="font-semibold rounded-xl"
            >
              Delete Permanently
            </Button>
            <Button 
              variant="outline" 
              onClick={() => { setDeleteModalOpen(false); setMeetingToDelete(null); }}
              className="font-semibold rounded-xl bg-transparent border-white/20 text-foreground hover:bg-white/10"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
