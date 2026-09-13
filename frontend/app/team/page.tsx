'use client';

import { useEffect, useState, useCallback } from 'react';
import { authenticatedFetch } from '@/lib/api';
import RoleGuard from '@/components/RoleGuard';
import { motion, Variants } from 'framer-motion';
import { Loader2, Users, Mail, UserCheck, UserX, Clock, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Employee {
  id: string;
  email: string;
  name: string;
  status: string;
  isVerified: boolean;
  created: string;
  lastModified: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

function TeamPageInner() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
      const res = await authenticatedFetch(`${apiUrl}/employees`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEmployees();
  }, [fetchEmployees]);

  const filteredEmployees = employees.filter((e) => 
    e.name.toLowerCase().includes(search.toLowerCase()) || 
    e.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto space-y-8"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-4 border-border pb-6">
        <motion.div variants={itemVariants}>
          <h1 className="text-4xl md:text-5xl font-black text-foreground uppercase tracking-tighter drop-shadow-[-4px_4px_0px_var(--primary)]">
            TEAM DIRECTORY
          </h1>
          <p className="text-sm font-bold mt-2 px-2 py-1 bg-foreground text-background inline-block uppercase">
            REGISTERED EMPLOYEES & USERS IN THE SYSTEM
          </p>
        </motion.div>
        
        <motion.div variants={itemVariants} className="w-full sm:w-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground stroke-[3]" />
          <Input 
            placeholder="SEARCH TEAM..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 font-black uppercase border-4 border-border bg-card shadow-brutal-sm w-full sm:w-80" 
          />
        </motion.div>
      </div>

      {loading ? (
        <div className="bg-card border-8 border-border p-12 text-center shadow-brutal-lg max-w-2xl mx-auto transform -rotate-1 mt-12">
          <div className="bg-primary p-4 rounded-full inline-block border-4 border-border shadow-brutal mb-6">
            <Loader2 className="h-10 w-10 text-background animate-spin" />
          </div>
          <h2 className="text-3xl font-black uppercase mb-3">LOADING DIRECTORY</h2>
          <p className="text-base font-bold">FETCHING USER DATA FROM THE MAINFRAME...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
         <div className="bg-card border-8 border-border p-12 text-center shadow-brutal-lg max-w-2xl mx-auto transform -rotate-1 mt-12">
          <div className="bg-destructive p-4 rounded-full inline-block border-4 border-border shadow-brutal mb-6">
            <UserX className="h-10 w-10 text-background stroke-[3]" />
          </div>
          <h2 className="text-3xl font-black uppercase mb-3">NO EMPLOYEES FOUND</h2>
          <p className="text-base font-bold">THEY EITHER QUIT OR HAVEN&apos;T SIGNED UP YET.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEmployees.map((emp, idx) => {
            const date = emp.created ? new Date(emp.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'UNKNOWN';
            const isConfirmed = emp.status === 'CONFIRMED';
            const rotation = idx % 2 === 0 ? 1 : -1;
            
            return (
              <motion.div 
                key={emp.id}
                variants={itemVariants}
                whileHover={{ scale: 1.02, rotate: 0 }}
                className="bg-card border-4 border-border p-6 shadow-brutal flex flex-col justify-between h-[220px]"
                style={{ rotate: `${rotation}deg` }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4 border-b-4 border-border pb-4">
                    <div className={`px-2 py-1 border-2 border-border text-xs font-black uppercase ${isConfirmed ? 'bg-accent text-background' : 'bg-warning text-background'}`}>
                      {emp.status}
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 border-2 border-border bg-background text-foreground text-xs font-black uppercase">
                      {emp.isVerified ? <UserCheck className="h-3 w-3 text-accent stroke-[3]" /> : <Clock className="h-3 w-3 text-warning stroke-[3]" />}
                      {emp.isVerified ? 'VERIFIED' : 'PENDING'}
                    </div>
                  </div>
                  <h3 className="text-2xl font-black uppercase line-clamp-1 truncate" title={emp.name}>
                    {emp.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-2 text-muted-foreground font-bold text-sm truncate">
                    <Mail className="h-4 w-4 shrink-0 stroke-[3]" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t-4 border-border/20 flex items-center justify-between text-xs font-bold uppercase text-muted-foreground">
                  <span>JOINED</span>
                  <span className="text-foreground">{date}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

export default function TeamPage() {
  return (
    <RoleGuard allowedRole="admin">
      <TeamPageInner />
    </RoleGuard>
  );
}
