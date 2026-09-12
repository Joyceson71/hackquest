'use client';

import { useEffect, useState, use } from 'react';
import ActionBoard from '@/components/actions/ActionBoard';
import { ConfirmedAction } from '@/components/actions/ActionRow';
import { Loader2, AlertTriangle } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function ActionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [actions, setActions] = useState<ConfirmedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [actionToDelete, setActionToDelete] = useState<string | null>(null);

  const participants = ['Alice (Engineering Manager)', 'Bob (Backend Developer)', 'Charlie (Designer)'];

  const fetchActions = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await authenticatedFetch(`${apiUrl}/meetings/${id}/confirmed-actions`);
      if (res.ok) {
        const data = await res.json();
        setActions(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, [id]);

  const handleStatusChange = async (actionId: string, newStatus: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await authenticatedFetch(`${apiUrl}/meetings/${id}/confirmed-actions/${actionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      // Optimistic update
      setActions((prev) =>
        prev.map((a) => (a.actionId === actionId ? { ...a, status: newStatus } : a))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAction = (actionId: string) => {
    setActionToDelete(actionId);
    setDeleteModalOpen(true);
  };

  const executeDeleteAction = async () => {
    if (!actionToDelete) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await authenticatedFetch(`${apiUrl}/meetings/${id}/confirmed-actions/${actionToDelete}`, {
        method: 'DELETE',
      });
      // Optimistic update
      setActions((prev) => prev.filter((a) => a.actionId !== actionToDelete));
    } catch (err) {
      console.error(err);
      alert('Failed to delete action');
    } finally {
      setDeleteModalOpen(false);
      setActionToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading action board…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Action Board</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The canonical record of all confirmed commitments from the meeting.
        </p>
      </div>

      <ActionBoard
        actions={actions}
        meetingId={id}
        participants={participants}
        onStatusChange={handleStatusChange}
        onDeleteAction={handleDeleteAction}
      />

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="border-4 border-border shadow-brutal bg-card">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black uppercase text-foreground flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive stroke-[3]" />
              Nuke this action?
            </DialogTitle>
            <DialogDescription className="text-lg font-bold text-muted-foreground uppercase pt-2">
              This action cannot be undone. This will permanently delete the task from the Action Board.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-4 sm:justify-start">
            <Button 
              variant="destructive" 
              onClick={executeDeleteAction}
              className="text-lg font-black uppercase shadow-brutal border-2 border-border hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              NUKE IT
            </Button>
            <Button 
              variant="outline" 
              onClick={() => { setDeleteModalOpen(false); setActionToDelete(null); }}
              className="text-lg font-black uppercase shadow-brutal border-2 border-border bg-card text-foreground hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none hover:bg-muted"
            >
              CANCEL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
