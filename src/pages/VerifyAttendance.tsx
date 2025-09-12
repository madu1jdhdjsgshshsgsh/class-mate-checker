import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const VerifyAttendance = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [result, setResult] = useState<any>(null);

  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  };

  const handleVerify = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const location = await getCurrentLocation();
      
      const { data, error } = await supabase.functions.invoke('verify-attendance', {
        body: {
          token,
          student_latitude: location.latitude,
          student_longitude: location.longitude
        }
      });

      if (error) throw error;

      setResult(data);
      setVerified(true);
      
      if (data.success) {
        toast({
          title: data.within_range ? "Attendance Confirmed!" : "Attendance Failed",
          description: data.message,
          variant: data.within_range ? "default" : "destructive"
        });
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: error.message || "Could not verify attendance",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <MapPin className="w-6 h-6" />
            Verify Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!verified ? (
            <>
              <p className="text-center text-muted-foreground">
                Click the button below to verify your attendance using your current location.
              </p>
              <Button 
                onClick={handleVerify} 
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Attendance'
                )}
              </Button>
            </>
          ) : (
            <div className="text-center space-y-4">
              {result?.within_range ? (
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
              ) : (
                <XCircle className="w-16 h-16 text-red-600 mx-auto" />
              )}
              <div>
                <h3 className={`text-lg font-semibold ${result?.within_range ? 'text-green-600' : 'text-red-600'}`}>
                  {result?.within_range ? 'Attendance Confirmed' : 'Attendance Failed'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Distance: {result?.distance_meters}m from classroom
                </p>
                <p className="text-sm text-muted-foreground">
                  Session: {result?.session}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyAttendance;