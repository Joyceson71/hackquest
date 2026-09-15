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
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-12 min-h-screen"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-min">
        
        {/* Bento Hero Tile: Title & CTA */}
        <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-3 glass-card p-8 md:p-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-gradient-to-br from-white to-gray-50 border-none shadow-sm relative overflow-hidden">
          {/* Subtle gradient blob behind text */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl opacity-50" />
          
          <div className="relative z-10">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-2">
              Your Meetings
            </h1>
            <p className="text-gray-500 font-medium">
              Review extracted action items and tasks.
            </p>
          </div>
          
          <Button 
            size="lg" 
            onClick={() => router.push('/meetings/new')} 
            className="relative z-10 bg-primary hover:bg-primary/90 text-white rounded-full px-8 py-6 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5"
          >
            <Plus className="mr-2 h-5 w-5" />
            Upload Transcript
          </Button>
        </motion.div>

        {/* Bento Summary Tile */}
        <motion.div variants={itemVariants} className="glass-card p-8 flex flex-col justify-center items-center text-center bg-gray-900 text-white border-none shadow-sm">
          <div className="bg-white/10 p-4 rounded-2xl mb-4">
            <FileText className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-4xl font-extrabold mb-1">{meetings.length}</h2>
          <p className="text-gray-400 font-medium text-sm">Total Uploads</p>
        </motion.div>

        {/* Empty State or Meetings Grid */}
        {meetings.length === 0 ? (
          <motion.div variants={itemVariants} className="col-span-full glass-card p-12 text-center flex flex-col items-center justify-center min-h-[300px] border-none shadow-sm">
            <div className="bg-primary/10 p-6 rounded-full mb-6">
              <FileText className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No meetings yet</h2>
            <p className="text-gray-500 font-medium max-w-md">
              Upload your first meeting transcript to automatically extract action items and assign tasks to your team.
            </p>
          </motion.div>
        ) : (
          meetings.map((m, index) => {
            const dateStr = m.createdAt || new Date().toISOString();
            const date = new Date(dateStr).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            });

            // Alternate sizes for the bento grid effect
            const isWide = index % 5 === 0 && index !== 0;

            return (
              <motion.div 
                key={m.PK}
                variants={itemVariants}
                className={`glass-card p-6 md:p-8 cursor-pointer flex flex-col justify-between hover:border-primary/30 border-transparent transition-all group ${isWide ? 'md:col-span-2' : 'col-span-1'}`}
                onClick={() => router.push(`/meetings/${m.PK}/transcript`)}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                      {date}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 w-8 p-0 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      onClick={(e) => confirmDelete(e, m.PK)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 leading-tight mb-2 group-hover:text-primary transition-colors">
                    {m.title || 'Untitled Meeting'}
                  </h3>
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full capitalize">
                    {m.status?.toLowerCase() || 'Processed'}
                  </div>
                  <div className="text-primary font-semibold text-sm flex items-center group-hover:translate-x-1 transition-transform">
                    View <ArrowRight className="ml-1.5 h-4 w-4" />
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="border-none shadow-2xl rounded-3xl p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2.5 bg-red-100 text-red-600 rounded-xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
              Delete Meeting
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600 pt-3">
              Are you sure? This action cannot be undone and will permanently delete the transcript and associated tasks.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 gap-3 sm:justify-end">
            <Button 
              variant="outline" 
              onClick={() => { setDeleteModalOpen(false); setMeetingToDelete(null); }}
              className="rounded-full px-6 font-semibold border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={executeDelete}
              className="rounded-full px-6 font-semibold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
