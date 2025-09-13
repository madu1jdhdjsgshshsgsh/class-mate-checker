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

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Classroom {
  id: string;
  name: string;
  location: string;
}

interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionCreated: () => void;
}

const CreateSessionDialog = ({ open, onOpenChange, onSessionCreated }: CreateSessionDialogProps) => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    subject_id: '',
    classroom_id: '',
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

  useEffect(() => {
    if (open && user) {
      fetchData();
    }
  }, [open, user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch subjects
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .eq('teacher_id', user.id);

      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

      // Fetch classrooms
      const { data: classroomsData, error: classroomsError } = await supabase
        .from('classrooms')
        .select('*');

      if (classroomsError) throw classroomsError;
      setClassrooms(classroomsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load subjects and classrooms",
        variant: "destructive",
      });
    }
  };

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

    if (!formData.subject_id || !formData.classroom_id || !formData.start_time || 
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
      const { error } = await supabase
        .from('attendance_sessions')
        .insert({
          teacher_id: user.id,
          subject_id: formData.subject_id,
          classroom_id: formData.classroom_id,
          session_date: formData.session_date || new Date().toISOString().split('T')[0],
          start_time: formData.start_time,
          end_time: formData.end_time,
          days_of_week: formData.days_of_week,
          esp32_device_id: formData.esp32_device_id || null,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Session created successfully",
      });

      // Reset form
      setFormData({
        subject_id: '',
        classroom_id: '',
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
          <div>
            <Label htmlFor="subject_id">Subject *</Label>
            <Select value={formData.subject_id} onValueChange={(value) => 
              setFormData(prev => ({ ...prev, subject_id: value }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map(subject => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="classroom_id">Classroom *</Label>
            <Select value={formData.classroom_id} onValueChange={(value) => 
              setFormData(prev => ({ ...prev, classroom_id: value }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="Select classroom" />
              </SelectTrigger>
              <SelectContent>
                {classrooms.map(classroom => (
                  <SelectItem key={classroom.id} value={classroom.id}>
                    {classroom.name} - {classroom.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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