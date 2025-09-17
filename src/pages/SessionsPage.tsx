import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, BookOpen, Users, Clock, Calendar, MapPin, UserMinus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface AttendanceRecord {
  id: string;
  status: string;
  check_in_time: string | null;
  attendance_sessions: {
    id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    subjects: {
      name: string;
      code: string;
    } | null;
    classrooms: {
      name: string;
    } | null;
  } | null;
}

interface SessionStats {
  sessionId: string;
  subjectName: string;
  subjectCode: string;
  classroomName: string;
  total: number;
  present: number;
  absent: number;
  pending: number;
  attendanceRate: number;
  enrolledCount?: number;
  enrolledStudents?: Array<{
    id: string;
    full_name: string;
    email: string;
  }>;
}

const SessionsPage = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState<SessionStats[]>([]);

  const fetchSessionData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      if (profile?.role === 'teacher') {
        // Fetch teacher's sessions with enrolled students and attendance stats
        const { data: sessions, error: sessionsError } = await supabase
          .from('attendance_sessions')
          .select(`
            id,
            session_date,
            start_time,
            end_time,
            subjects!inner(name, code),
            classrooms(name),
            attendance_records(id, status, student_id, profiles!inner(full_name, email))
          `)
          .eq('teacher_id', user.id)
          .eq('is_active', true);

        if (sessionsError) throw sessionsError;

        const stats: SessionStats[] = sessions?.map(session => {
          const records = session.attendance_records || [];
          const enrolledStudents = records.map(r => r.profiles).filter((p, index, self) => 
            p && self.findIndex(student => student.email === p.email) === index
          );
          
          const total = records.length;
          const present = records.filter(r => r.status === 'present').length;
          const absent = records.filter(r => r.status === 'absent').length;
          const pending = records.filter(r => r.status === 'pending').length;

          return {
            sessionId: session.id,
            subjectName: session.subjects?.name || 'Unknown Subject',
            subjectCode: session.subjects?.code || 'N/A',
            classroomName: session.classrooms?.name || 'No Classroom',
            total,
            present,
            absent,
            pending,
            attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
            enrolledCount: enrolledStudents.length,
            enrolledStudents: enrolledStudents as any
          };
        }) || [];

        setSessionStats(stats);
      } else {
        // Fetch student's attendance records grouped by session
        const { data: records, error } = await supabase
          .from('attendance_records')
          .select(`
            id,
            status,
            check_in_time,
            attendance_sessions!inner(
              id,
              session_date,
              start_time,
              end_time,
              subjects(name, code),
              classrooms(name)
            )
          `)
          .eq('student_id', user.id);

        if (error) throw error;

        // Group by session
        const sessionMap = new Map();
        records?.forEach(record => {
          const sessionId = record.attendance_sessions?.id;
          if (!sessionId) return;

          if (!sessionMap.has(sessionId)) {
            sessionMap.set(sessionId, {
              sessionId,
              subjectName: record.attendance_sessions?.subjects?.name || 'Unknown Subject',
              subjectCode: record.attendance_sessions?.subjects?.code || 'N/A',
              classroomName: record.attendance_sessions?.classrooms?.name || 'No Classroom',
              total: 0,
              present: 0,
              absent: 0,
              pending: 0
            });
          }

          const stats = sessionMap.get(sessionId);
          stats.total++;
          if (record.status === 'present') stats.present++;
          else if (record.status === 'absent') stats.absent++;
          else if (record.status === 'pending') stats.pending++;
        });

        const stats = Array.from(sessionMap.values()).map(stat => ({
          ...stat,
          attendanceRate: stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0
        }));

        setSessionStats(stats);
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
      toast.error('Failed to load session data');
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async (sessionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('attendance_records')
        .delete()
        .eq('student_id', user.id)
        .eq('session_id', sessionId);

      if (error) throw error;

      toast.success('Successfully unenrolled from session');
      fetchSessionData();
    } catch (error) {
      console.error('Error unenrolling:', error);
      toast.error('Failed to unenroll from session');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('attendance_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('teacher_id', user.id);

      if (error) throw error;

      toast.success('Session deleted successfully');
      fetchSessionData();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    }
  };

  const handleEditSession = (sessionId: string) => {
    // Navigate to edit page or open edit dialog
    // For now, let's just log it - you can implement the edit functionality
    console.log('Edit session:', sessionId);
    toast.success('Edit functionality coming soon');
  };

  useEffect(() => {
    fetchSessionData();

    // Set up real-time subscription for attendance record changes
    if (user) {
      const channel = supabase
        .channel('session-attendance-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'attendance_records'
          },
          () => {
            fetchSessionData(); // Refresh data when attendance records change
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, profile]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {profile?.role === 'teacher' ? 'Session Management' : 'My Sessions'}
            </h1>
            <p className="text-muted-foreground">
              {profile?.role === 'teacher' 
                ? 'Manage your sessions and view enrolled students' 
                : 'View your attendance across different sessions'
              }
            </p>
          </div>
        </div>

        {sessionStats.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No sessions found</h3>
              <p className="text-muted-foreground">
                {profile?.role === 'teacher' 
                  ? 'Create your first session to get started' 
                  : 'Join sessions to see your attendance here'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sessionStats.map((session) => (
              <Card key={session.sessionId} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{session.subjectName}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">{session.subjectCode}</Badge>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {session.classroomName}
                        </div>
                      </CardDescription>
                    </div>
                    {profile?.role === 'student' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnenroll(session.sessionId)}
                        className="text-destructive hover:text-destructive"
                      >
                        <UserMinus className="w-4 h-4 mr-1" />
                        Unenroll
                      </Button>
                    )}
                    {profile?.role === 'teacher' && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditSession(session.sessionId)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSession(session.sessionId)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{session.attendanceRate}%</span>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>{session.present}/{session.total} sessions</div>
                      {profile?.role === 'teacher' && (
                        <div className="flex items-center gap-1 mt-1">
                          <Users className="w-3 h-3" />
                          {session.enrolledCount} enrolled
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Progress value={session.attendanceRate} className="h-2" />
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Present: {session.present}
                    </span>
                    <span className="text-red-600 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      Absent: {session.absent}
                    </span>
                    <span className="text-yellow-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Pending: {session.pending}
                    </span>
                  </div>

                  {profile?.role === 'teacher' && session.enrolledStudents && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Enrolled Students
                      </h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {session.enrolledStudents.map((student: any, index: number) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span>{student.full_name}</span>
                            <span className="text-muted-foreground">{student.email}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SessionsPage;