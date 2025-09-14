import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionCreated: () => void;
}

const CreateSessionDialog = ({ open, onOpenChange, onSessionCreated }: CreateSessionDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    subject_name: '',
    subject_code: '',
    session_date: '',
    start_time: '',
    end_time: '',
    days_of_week: [] as string[],
    esp32_device_id: ''
  });

  const daysOfWeek = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ];


  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.subject_name || !formData.subject_code || !formData.start_time || 
        !formData.end_time || formData.days_of_week.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // First create the subject
      const { data: subjectData, error: subjectError } = await supabase
        .from('subjects')
        .insert({
          name: formData.subject_name,
          code: formData.subject_code,
          teacher_id: user.id
        })
        .select()
        .single();

      if (subjectError) throw subjectError;

      // Then create the session
      const { error: sessionError } = await supabase
        .from('attendance_sessions')
        .insert({
          teacher_id: user.id,
          subject_id: subjectData.id,
          classroom_id: null,
          session_date: formData.session_date || new Date().toISOString().split('T')[0],
          start_time: formData.start_time,
          end_time: formData.end_time,
          days_of_week: formData.days_of_week,
          esp32_device_id: formData.esp32_device_id || null,
          is_active: true
        });

      if (sessionError) throw sessionError;

      toast({
        title: "Success",
        description: "Session created successfully",
      });

      // Reset form
      setFormData({
        subject_name: '',
        subject_code: '',
        session_date: '',
        start_time: '',
        end_time: '',
        days_of_week: [],
        esp32_device_id: ''
      });

      onSessionCreated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating session:', error);
      toast({
        title: "Error",
        description: "Failed to create session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="subject_name">Subject Name *</Label>
              <Input
                value={formData.subject_name}
                onChange={(e) => setFormData(prev => ({ ...prev, subject_name: e.target.value }))}
                placeholder="Enter subject name"
                required
              />
            </div>
            <div>
              <Label htmlFor="subject_code">Subject Code *</Label>
              <Input
                value={formData.subject_code}
                onChange={(e) => setFormData(prev => ({ ...prev, subject_code: e.target.value }))}
                placeholder="Enter subject code"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time">Start Time *</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="end_time">End Time *</Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <Label>Days of Week *</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {daysOfWeek.map(day => (
                <div key={day.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={day.value}
                    checked={formData.days_of_week.includes(day.value)}
                    onCheckedChange={() => handleDayToggle(day.value)}
                  />
                  <Label htmlFor={day.value} className="text-sm">{day.label}</Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="esp32_device_id">ESP32 Device ID (Optional)</Label>
            <Input
              value={formData.esp32_device_id}
              onChange={(e) => setFormData(prev => ({ ...prev, esp32_device_id: e.target.value }))}
              placeholder="Enter ESP32 device ID"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Creating..." : "Create Session"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateSessionDialog;