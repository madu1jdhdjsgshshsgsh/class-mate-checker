import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, CheckCircle, XCircle, AlertCircle, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface VerificationLink {
  id: string;
  token: string;
  esp32_latitude: number;
  esp32_longitude: number;
  expires_at: string;
  is_used: boolean;
  created_at: string;
  session_id: string;
  attendance_sessions: {
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

const LocationVerificationPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [verificationLinks, setVerificationLinks] = useState<VerificationLink[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const fetchVerificationLinks = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('verification_links')
        .select(`
          *,
          attendance_sessions!inner(
            session_date,
            start_time,
            end_time,
            subjects(name, code),
            classrooms(name)
          )
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVerificationLinks(data || []);
    } catch (error) {
      console.error('Error fetching verification links:', error);
      toast.error('Failed to load verification links');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    setLocationLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationLoading(false);
          toast.success('Location updated successfully');
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Failed to get current location');
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      toast.error('Geolocation is not supported by this browser');
      setLocationLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  const verifyAttendance = async (link: VerificationLink) => {
    if (!currentLocation) {
      toast.error('Please get your current location first');
      return;
    }

    try {
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        link.esp32_latitude,
        link.esp32_longitude
      );

      const response = await fetch('/api/verify-attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          token: link.token,
          student_latitude: currentLocation.lat,
          student_longitude: currentLocation.lng,
          distance_meters: distance
        })
      });

      if (response.ok) {
        toast.success('Attendance verified successfully!');
        fetchVerificationLinks();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to verify attendance');
      }
    } catch (error) {
      console.error('Error verifying attendance:', error);
      toast.error('Failed to verify attendance');
    }
  };

  const getStatusColor = (link: VerificationLink) => {
    if (link.is_used) return 'bg-green-500';
    if (new Date(link.expires_at) < new Date()) return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getStatusText = (link: VerificationLink) => {
    if (link.is_used) return 'Verified';
    if (new Date(link.expires_at) < new Date()) return 'Expired';
    return 'Pending';
  };

  const getStatusIcon = (link: VerificationLink) => {
    if (link.is_used) return <CheckCircle className="w-4 h-4" />;
    if (new Date(link.expires_at) < new Date()) return <XCircle className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  useEffect(() => {
    fetchVerificationLinks();
  }, [user]);

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
            <h1 className="text-3xl font-bold">Location Verification</h1>
            <p className="text-muted-foreground">
              Verify your attendance using location-based verification
            </p>
          </div>
          <Button onClick={getCurrentLocation} disabled={locationLoading}>
            <Navigation className="w-4 h-4 mr-2" />
            {locationLoading ? 'Getting Location...' : 'Get Current Location'}
          </Button>
        </div>

        {currentLocation && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                Current Location: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
              </div>
            </CardContent>
          </Card>
        )}

        {verificationLinks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No verification links</h3>
              <p className="text-muted-foreground">
                Verification links will appear here when teachers create attendance sessions
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {verificationLinks.map((link) => (
              <Card key={link.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {link.attendance_sessions?.subjects?.name || 'Unknown Subject'}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <Badge variant="secondary">
                          {link.attendance_sessions?.subjects?.code || 'N/A'}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {link.attendance_sessions?.classrooms?.name || 'No Classroom'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(link.attendance_sessions?.session_date || '').toLocaleDateString()}
                        </div>
                      </CardDescription>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`${getStatusColor(link)} text-white flex items-center gap-1`}
                    >
                      {getStatusIcon(link)}
                      {getStatusText(link)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Session Time:</strong>
                      <div className="text-muted-foreground">
                        {link.attendance_sessions?.start_time} - {link.attendance_sessions?.end_time}
                      </div>
                    </div>
                    <div>
                      <strong>Expires At:</strong>
                      <div className="text-muted-foreground">
                        {new Date(link.expires_at).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <strong>Expected Location:</strong>
                      <div className="text-muted-foreground">
                        {link.esp32_latitude.toFixed(6)}, {link.esp32_longitude.toFixed(6)}
                      </div>
                    </div>
                    {currentLocation && (
                      <div>
                        <strong>Distance:</strong>
                        <div className="text-muted-foreground">
                          {calculateDistance(
                            currentLocation.lat,
                            currentLocation.lng,
                            link.esp32_latitude,
                            link.esp32_longitude
                          ).toFixed(0)} meters
                        </div>
                      </div>
                    )}
                  </div>

                  {!link.is_used && new Date(link.expires_at) > new Date() && (
                    <Button 
                      onClick={() => verifyAttendance(link)}
                      disabled={!currentLocation}
                      className="w-full"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Verify Attendance
                    </Button>
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

export default LocationVerificationPage;