'use client';

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, ArrowRight, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, Variants } from 'framer-motion';

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
  const router = useRouter();

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

  const handleDelete = async (e: React.MouseEvent, meetingId: string) => {
    e.stopPropagation();
    if (!confirm('NUKE THIS MEETING?')) return;
    
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
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
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b-8 border-border pb-8">
        <motion.div variants={itemVariants}>
          <h1 className="text-5xl md:text-7xl font-black text-foreground uppercase tracking-tighter drop-shadow-[-4px_4px_0px_#FF2E93]">
            YOUR MEETINGS
          </h1>
          <p className="text-xl font-bold mt-2 px-2 py-1 bg-foreground text-background inline-block">
            REVIEW EXTRACTED ACTIONS & BURN THE EVIDENCE
          </p>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Button 
            size="lg" 
            onClick={() => router.push('/meetings/new')} 
            className="bg-primary hover:bg-primary text-background text-xl py-8 px-6 font-black uppercase shadow-brutal border-4 border-border transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
          >
            <Plus className="mr-2 h-6 w-6 stroke-[3]" />
            UPLOAD NEW TRANSCRIPT
          </Button>
        </motion.div>
      </div>

      {meetings.length === 0 ? (
        <motion.div variants={itemVariants} className="bg-card border-8 border-border p-12 text-center shadow-brutal-lg max-w-2xl mx-auto transform -rotate-1">
          <div className="bg-primary p-6 rounded-full inline-block border-4 border-border shadow-brutal mb-8">
            <Loader2 className="h-16 w-16 text-background" />
          </div>
          <h2 className="text-4xl font-black uppercase mb-4">NOTHING HERE YET!</h2>
          <p className="text-xl font-bold mb-8">
            FEED THE MACHINE. UPLOAD A TRANSCRIPT TO EXTRACT ACTION ITEMS.
          </p>
          <Button 
            onClick={() => router.push('/meetings/new')} 
            className="bg-secondary text-foreground hover:bg-secondary text-2xl py-8 px-12 font-black uppercase shadow-brutal border-4 border-border"
          >
            GET STARTED
          </Button>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {meetings.map((m, idx) => {
            const dateStr = m.createdAt || new Date().toISOString();
            const date = new Date(dateStr).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            });
            // Rotate cards slightly for a chaotic maximalist feel
            const rotation = idx % 2 === 0 ? 1 : -1;

            return (
              <motion.div 
                key={m.PK}
                variants={itemVariants}
                whileHover={{ scale: 1.05, rotate: 0 }}
                className="card-hover bg-card border-4 border-border p-6 shadow-brutal cursor-pointer flex flex-col justify-between h-[250px]"
                style={{ rotate: `${rotation}deg` }}
                onClick={() => router.push(`/meetings/${m.PK}/transcript`)}
              >
                <div>
                  <div className="flex items-center justify-between mb-4 border-b-4 border-border pb-4">
                    <span className="text-sm font-black uppercase bg-accent text-background px-3 py-1 border-2 border-border">
                      {date}
                    </span>
                    <Button 
                      variant="ghost" 
                      className="h-10 w-10 p-0 text-foreground border-2 border-border hover:bg-destructive hover:text-background"
                      onClick={(e) => handleDelete(e, m.PK)}
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
    </motion.div>
  );
}
