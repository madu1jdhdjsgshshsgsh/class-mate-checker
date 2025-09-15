import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, CheckCircle, XCircle, AlertCircle, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import LocationVerification from '@/components/student/LocationVerification';

interface AttendanceSession {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  days_of_week: string[];
  is_active: boolean;
  subjects: {
    id: string;
    name: string;
    code: string;
  } | null;
  classrooms: {
    name: string;
    location: string;
  } | null;
}

interface AttendanceRecord {
  id: string;
  status: 'present' | 'absent' | 'pending';
  check_in_time: string;
  session_id: string;
  attendance_sessions: {
    subjects: {
      name: string;
      code: string;
    } | null;
  } | null;
}

const StudentDashboard = () => {
  const { user } = useAuth();
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch active sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('attendance_sessions')
        .select(`
          *,
          subjects!left (id, name, code),
          classrooms!left (name, location)
        `)
        .eq('is_active', true)
        .order('start_time');

      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError);
        toast({
          title: "Error",
          description: "Failed to fetch active sessions",
          variant: "destructive",
        });
      } else {
        // Filter sessions for today's day of week
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const todaySessions = sessionsData?.filter(session => 
          session.days_of_week.includes(today)
        ) || [];
        
        setActiveSessions(todaySessions);
      }

      // Fetch attendance history
      const { data: historyData, error: historyError } = await supabase
        .from('attendance_records')
        .select(`
          *,
          attendance_sessions!left (
            subjects!left (name, code)
          )
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (historyError) {
        console.error('Error fetching attendance history:', historyError);
        toast({
          title: "Error",
          description: "Failed to fetch attendance history",
          variant: "destructive",
        });
      } else {
        setAttendanceHistory((historyData || []) as AttendanceRecord[]);
      }
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
        .channel('attendance-updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'attendance_records',
            filter: `student_id=eq.${user.id}`
          },
          () => {
            fetchData(); // Refresh data when new attendance record is created
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'attendance_records',
            filter: `student_id=eq.${user.id}`
          },
          () => {
            fetchData(); // Refresh data when attendance record is updated
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleJoinSession = async (sessionId: string) => {
    if (!user) return;

    try {
      // Check if student already has a record for this session
      const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('session_id', sessionId)
        .eq('student_id', user.id)
        .single();

      if (existingRecord) {
        toast({
          title: "Already Registered",
          description: "You have already joined this session",
          variant: "destructive",
        });
        return;
      }

      // Create attendance record with pending status
      const { error } = await supabase
        .from('attendance_records')
        .insert({
          session_id: sessionId,
          student_id: user.id,
          status: 'pending',
          verification_method: 'manual'
        });

      if (error) {
        console.error('Error joining session:', error);
        toast({
          title: "Error",
          description: "Failed to join session",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Session Joined",
        description: "Wait for RFID verification or teacher confirmation",
      });

      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error in handleJoinSession:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const getAttendanceStats = () => {
    const total = attendanceHistory.length;
    const present = attendanceHistory.filter(r => r.status === 'present').length;
    const absent = attendanceHistory.filter(r => r.status === 'absent').length;
    const pending = attendanceHistory.filter(r => r.status === 'pending').length;

    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, present, absent, pending, attendanceRate };
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDaysOfWeek = (days: string[]) => {
    if (!days || !Array.isArray(days) || days.length === 0) {
      return 'No days scheduled';
    }
    return days.map(day => day.charAt(0).toUpperCase() + day.slice(1, 3)).join(', ');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'absent':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const stats = getAttendanceStats();

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
      <div>
        <h1 className="text-3xl font-bold">Student Dashboard</h1>
        <p className="text-muted-foreground">Track your attendance and join active sessions</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="dashboard-stat">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Attendance Rate</p>
                <p className="text-2xl font-bold">{stats.attendanceRate}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <Progress value={stats.attendanceRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="dashboard-stat">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-stat">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Present</p>
                <p className="text-2xl font-bold text-green-600">{stats.present}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-stat">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Absent</p>
                <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Verification */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Location Verification</h2>
        <div className="flex justify-center">
          <LocationVerification onVerificationComplete={(success) => {
            if (success) {
              fetchData(); // Refresh data after successful verification
            }
          }} />
        </div>
      </div>

      {/* Today's Active Sessions */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Today's Sessions</h2>
        
        {activeSessions?.length === 0 ? (
          <Card className="attendance-card">
            <CardContent className="p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No sessions today</h3>
              <p className="text-muted-foreground">
                Check back tomorrow for new attendance sessions
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeSessions?.filter(session => session != null).map((session) => {
              const hasJoined = attendanceHistory?.some(
                record => record?.session_id === session?.id
              );

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
                      <Badge variant="default">
                        {session.subjects?.code || 'N/A'}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(session.start_time)} - {formatTime(session.end_time)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDaysOfWeek(session.days_of_week)}
                      </div>
                    </div>

                    <Button 
                      onClick={() => handleJoinSession(session.id)}
                      disabled={hasJoined}
                      className="w-full"
                      variant={hasJoined ? "secondary" : "default"}
                    >
                      {hasJoined ? "Already Joined" : "Join Session"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Attendance History */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Recent Attendance</h2>
        
        {attendanceHistory?.length === 0 ? (
          <Card className="attendance-card">
            <CardContent className="p-8 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No attendance history</h3>
              <p className="text-muted-foreground">
                Your attendance records will appear here once you join sessions
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="attendance-card">
            <CardContent className="p-6">
              <div className="space-y-4">
                {attendanceHistory?.filter(record => record != null).map((record) => (
                  <div 
                    key={record.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(record.status)}
                      <div>
                        <p className="font-medium">
                          {record.attendance_sessions?.subjects?.name || 'Unknown Subject'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {record.attendance_sessions?.subjects?.code || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={
                          record.status === 'present' ? 'default' :
                          record.status === 'absent' ? 'destructive' : 'secondary'
                        }
                        className="capitalize"
                      >
                        {record.status}
                      </Badge>
                      {record.check_in_time && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(record.check_in_time).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;