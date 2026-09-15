'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import SpatialCard from '@/components/SpatialCard';
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
    <div className="flex-1 w-full p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1">Manage your team's meetings and extracted tasks.</p>
        </div>
        <Button 
          onClick={() => router.push('/meetings/new')} 
          className="btn-primary flex items-center gap-2 w-full md:w-auto"
        >
          <Plus className="h-4 w-4" />
          Upload Transcript
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[160px]">
        <SpatialCard tiltIntensity={5} glowIntensity={0.1} className="p-0">
          <div className="flex flex-col gap-2 h-full justify-center">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">Total Meetings</span>
            </div>
            <span className="text-4xl font-bold">{meetings.length}</span>
          </div>
        </SpatialCard>
        
        <SpatialCard tiltIntensity={5} glowIntensity={0.15} className="p-0">
          <div className="flex flex-col gap-2 h-full justify-center">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#00FF66]" />
              <span className="text-sm font-medium">Processed</span>
            </div>
            <span className="text-4xl font-bold">{meetings.filter(m => m.status?.toLowerCase() === 'processed').length || meetings.length}</span>
          </div>
        </SpatialCard>
        
        <SpatialCard tiltIntensity={5} glowIntensity={0.1} className="p-0 opacity-50">
          <div className="flex flex-col gap-2 h-full justify-center">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Pending Review</span>
            </div>
            <span className="text-4xl font-bold">0</span>
          </div>
        </SpatialCard>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Recent Activity</h2>
        </div>

        {meetings.length === 0 ? (
          <div className="premium-card border-dashed p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">No meetings uploaded</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Get started by uploading your first audio transcript to extract tasks and action items.
              </p>
            </div>
            <Button onClick={() => router.push('/meetings/new')} className="btn-secondary mt-2">
              Upload Transcript
            </Button>
          </div>
        ) : (
          <div className="premium-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">Meeting Title</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {meetings.map((m) => {
                    const dateStr = m.createdAt || new Date().toISOString();
                    const date = new Date(dateStr).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    });

                    return (
                      <tr key={m.PK} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => router.push(`/meetings/${m.PK}/transcript`)}
                            className="font-medium text-foreground hover:text-primary transition-colors text-left"
                          >
                            {m.title || 'Untitled Meeting'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {date}
                        </td>
                        <td className="px-6 py-4">
                          <span className="badge-completed">
                            {m.status?.toLowerCase() || 'Processed'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => router.push(`/meetings/${m.PK}/transcript`)}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => confirmDelete(e, m.PK)}
                            >
                              <Trash2 className="h-4 w-4" />
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
        <DialogContent className="premium-card border-border sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Meeting
            </DialogTitle>
            <DialogDescription className="text-muted-foreground pt-2">
              Are you sure? This action will permanently erase the meeting and all associated extracted tasks.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end mt-4">
            <Button 
              variant="outline" 
              onClick={() => { setDeleteModalOpen(false); setMeetingToDelete(null); }}
              className="btn-ghost border border-border"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={executeDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md px-4 py-2 font-medium"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
