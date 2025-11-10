import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, XCircle, Clock, Users } from 'lucide-react';

interface EnrollmentRequest {
  id: string;
  status: string;
  created_at: string;
  student_id: string;
  session_id: string;
  profiles: {
    full_name: string;
    email: string;
    student_id: string | null;
  } | null;
  attendance_sessions: {
    subjects: {
      name: string;
      code: string;
    } | null;
    start_time: string;
    end_time: string;
  } | null;
}

const TeacherStudentManagement = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnrollments();

    // Real-time subscription
    const channel = supabase
      .channel('enrollment-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_enrollments'
        },
        () => {
          fetchEnrollments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchEnrollments = async () => {
    if (!user) return;

    try {
      // First get enrollments for teacher's sessions
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('session_enrollments')
        .select(`
          *,
          attendance_sessions!inner (
            subjects!left (name, code),
            start_time,
            end_time,
            teacher_id
          )
        `)
        .eq('attendance_sessions.teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (enrollmentsError) throw enrollmentsError;

      // Then fetch profiles for each student
      const enrichedEnrollments = await Promise.all(
        (enrollmentsData || []).map(async (enrollment) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, email, student_id')
            .eq('user_id', enrollment.student_id)
            .maybeSingle();

          return {
            ...enrollment,
            profiles: profileData
          };
        })
      );

      setEnrollments(enrichedEnrollments as EnrollmentRequest[]);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch enrollment requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (enrollmentId: string, studentId: string, sessionId: string) => {
    try {
      // Update enrollment status to enrolled
      const { error: enrollmentError } = await supabase
        .from('session_enrollments')
        .update({ status: 'enrolled' })
        .eq('id', enrollmentId);

      if (enrollmentError) throw enrollmentError;

      // Create attendance record for the student
      const { error: recordError } = await supabase
        .from('attendance_records')
        .insert({
          session_id: sessionId,
          student_id: studentId,
          status: 'pending',
          verification_method: 'manual'
        });

      if (recordError) throw recordError;

      toast({
        title: 'Success',
        description: 'Student enrolled successfully',
      });

      fetchEnrollments();
    } catch (error) {
      console.error('Error approving enrollment:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve enrollment',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (enrollmentId: string) => {
    try {
      const { error } = await supabase
        .from('session_enrollments')
        .update({ status: 'rejected' })
        .eq('id', enrollmentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Enrollment request rejected',
      });

      fetchEnrollments();
    } catch (error) {
      console.error('Error rejecting enrollment:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject enrollment',
        variant: 'destructive',
      });
    }
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'enrolled':
        return <Badge variant="outline" className="bg-green-50"><CheckCircle className="w-3 h-3 mr-1" /> Enrolled</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const pendingCount = enrollments.filter(e => e.status === 'pending').length;
  const enrolledCount = enrollments.filter(e => e.status === 'enrolled').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Student Management</h1>
        <p className="text-muted-foreground">Manage enrollment requests for your sessions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Enrolled Students</p>
                <p className="text-2xl font-bold">{enrolledCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{enrollments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enrollment Requests</CardTitle>
          <CardDescription>Review and approve student enrollment requests</CardDescription>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No enrollment requests yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Session Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{enrollment.profiles?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{enrollment.profiles?.email || ''}</p>
                      </div>
                    </TableCell>
                    <TableCell>{enrollment.profiles?.student_id || 'N/A'}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{enrollment.attendance_sessions?.subjects?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{enrollment.attendance_sessions?.subjects?.code || ''}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {enrollment.attendance_sessions ? 
                        `${formatTime(enrollment.attendance_sessions.start_time)} - ${formatTime(enrollment.attendance_sessions.end_time)}` 
                        : 'N/A'}
                    </TableCell>
                    <TableCell>{getStatusBadge(enrollment.status)}</TableCell>
                    <TableCell>
                      {enrollment.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(enrollment.id, enrollment.student_id, enrollment.session_id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(enrollment.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherStudentManagement;