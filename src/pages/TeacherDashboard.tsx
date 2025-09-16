import { useState, useEffect } from 'react';
import { Plus, Calendar, Clock, MapPin, Users, BarChart3, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import CreateSessionDialog from '@/components/teacher/CreateSessionDialog';

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface AttendanceSession {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  days_of_week: string[];
  is_active: boolean;
  subjects: Subject | null;
  classrooms: {
    name: string;
    location: string;
  } | null;
  attendance_records: Array<{
    status: string;
  }>;
}

const TeacherDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch subjects
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .eq('teacher_id', user.id);

      if (subjectsError) {
        console.error('Error fetching subjects:', subjectsError);
        toast({
          title: "Error",
          description: "Failed to fetch subjects",
          variant: "destructive",
        });
        return;
      }

      setSubjects(subjectsData || []);

      // Fetch sessions with related data
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('attendance_sessions')
        .select(`
          *,
          subjects!left (id, name, code),
          classrooms!left (name, location),
          attendance_records!left (status)
        `)
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError);
        toast({
          title: "Error",
          description: "Failed to fetch sessions",
          variant: "destructive",
        });
        return;
      }

      setSessions(sessionsData || []);
    } catch (error) {
      console.error('Error in fetchData:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up real-time subscription for attendance updates
    if (user) {
      const channel = supabase
        .channel('teacher-attendance-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'attendance_records'
          },
          () => {
            fetchData(); // Refresh data when attendance records change
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'attendance_sessions'
          },
          () => {
            fetchData(); // Refresh data when sessions change
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const getAttendanceStats = (session: AttendanceSession) => {
    const records = session.attendance_records || [];
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const pending = records.filter(r => r.status === 'pending').length;
    const total = records.length;

    return { present, absent, pending, total };
  };

  const formatDaysOfWeek = (days: string[]) => {
    if (!days || !Array.isArray(days) || days.length === 0) {
      return 'No days scheduled';
    }
    return days.map(day => day.charAt(0).toUpperCase() + day.slice(1, 3)).join(', ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
          <p className="text-muted-foreground">Manage your classes and track attendance</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/sessions')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            Manage Sessions
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Session
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="dashboard-stat">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Subjects</p>
                <p className="text-2xl font-bold">{subjects.length}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-stat">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold">
                  {sessions?.filter(s => s?.is_active).length || 0}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-stat">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold">{sessions?.length || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-stat">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Classes</p>
                <p className="text-2xl font-bold">
                  {sessions?.filter(s => {
                    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                    return s?.days_of_week?.includes(today) && s?.is_active;
                  }).length || 0}
                </p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Your Sessions</h2>
        
        {sessions?.length === 0 ? (
          <Card className="attendance-card">
            <CardContent className="p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No sessions yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first attendance session to get started
              </p>
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Create Your First Session
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sessions?.filter(session => session != null).map((session) => {
              const stats = getAttendanceStats(session);
              const attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

              return (
                <Card key={session.id} className="attendance-card">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{session.subjects?.name || 'Unknown Subject'}</CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {session.classrooms?.name || 'No Classroom'}
                        </CardDescription>
                      </div>
                      <Badge variant={session.is_active ? "default" : "secondary"}>
                        {session.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {session.start_time} - {session.end_time}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDaysOfWeek(session.days_of_week)}
                      </div>
                    </div>

                    {stats.total > 0 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Attendance Rate</span>
                          <span className="font-medium">{attendanceRate}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${attendanceRate}%` }}
                          />
                        </div>
                        <div className="flex gap-4 text-xs">
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            Present: {stats.present}
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            Absent: {stats.absent}
                          </span>
                          {stats.pending > 0 && (
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-yellow-500" />
                              Pending: {stats.pending}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CreateSessionDialog 
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSessionCreated={fetchData}
      />
    </div>
  );
};

export default TeacherDashboard;