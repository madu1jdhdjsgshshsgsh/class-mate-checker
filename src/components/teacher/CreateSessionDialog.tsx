import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionCreated: () => void;
}

const CreateSessionDialog = ({ open, onOpenChange, onSessionCreated }: CreateSessionDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Session</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <p>Session creation form coming soon...</p>
          <Button onClick={() => {
            onSessionCreated();
            onOpenChange(false);
          }}>
            Create Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateSessionDialog;