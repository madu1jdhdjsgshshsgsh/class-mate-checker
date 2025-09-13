import { useState } from 'react';
import { MapPin, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface LocationVerificationProps {
  onVerificationComplete?: (success: boolean) => void;
}

interface VerificationState {
  stage: 'idle' | 'waiting' | 'link-received' | 'verifying' | 'completed';
  verificationLink?: string;
  result?: {
    success: boolean;
    message: string;
    distance?: number;
  };
}

const LocationVerification = ({ onVerificationComplete }: LocationVerificationProps) => {
  const [verificationState, setVerificationState] = useState<VerificationState>({ stage: 'idle' });

  const startVerification = () => {
    setVerificationState({ stage: 'waiting' });
    
    // Simulate waiting for ESP32 to send verification link
    toast({
      title: "Waiting for Verification",
      description: "Please tap your RFID card on the ESP32 device to receive verification link",
    });

    // For demo purposes, simulate ESP32 sending link after 3 seconds
    setTimeout(() => {
      const mockToken = 'demo-token-' + Math.random().toString(36).substring(7);
      const verificationLink = `/verify/${mockToken}`;
      
      setVerificationState({ 
        stage: 'link-received', 
        verificationLink 
      });

      toast({
        title: "Verification Link Received",
        description: "Click 'Verify Location' to check your location against the classroom",
      });
    }, 3000);
  };

  const verifyLocation = async () => {
    if (!verificationState.verificationLink) return;

    setVerificationState(prev => ({ ...prev, stage: 'verifying' }));

    try {
      // Get current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        });
      });

      // For demo purposes, simulate verification result
      const mockDistance = Math.floor(Math.random() * 200); // 0-200 meters
      const success = mockDistance <= 100;

      const result = {
        success,
        message: success 
          ? `Location verified! You are ${mockDistance}m from the classroom.`
          : `Location verification failed. You are ${mockDistance}m away (max 100m allowed).`,
        distance: mockDistance
      };

      setVerificationState({
        stage: 'completed',
        verificationLink: verificationState.verificationLink,
        result
      });

      toast({
        title: result.success ? "Verification Successful" : "Verification Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });

      onVerificationComplete?.(result.success);

    } catch (error) {
      console.error('Location verification error:', error);
      
      const result = {
        success: false,
        message: 'Failed to get your location. Please enable location services and try again.'
      };

      setVerificationState({
        stage: 'completed',
        verificationLink: verificationState.verificationLink,
        result
      });

      toast({
        title: "Location Error",
        description: result.message,
        variant: "destructive",
      });

      onVerificationComplete?.(false);
    }
  };

  const resetVerification = () => {
    setVerificationState({ stage: 'idle' });
  };

  const renderContent = () => {
    switch (verificationState.stage) {
      case 'idle':
        return (
          <div className="text-center space-y-4">
            <MapPin className="w-12 h-12 mx-auto text-primary" />
            <div>
              <h3 className="font-semibold">Location Verification</h3>
              <p className="text-sm text-muted-foreground">
                Verify your attendance using location checking
              </p>
            </div>
            <Button onClick={startVerification} className="w-full">
              <MapPin className="w-4 h-4 mr-2" />
              Start Location Verification
            </Button>
          </div>
        );

      case 'waiting':
        return (
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
            <div>
              <h3 className="font-semibold">Waiting for Verification Link</h3>
              <p className="text-sm text-muted-foreground">
                Please tap your RFID card on the ESP32 device
              </p>
            </div>
            <Badge variant="secondary" className="animate-pulse">
              Waiting for ESP32...
            </Badge>
          </div>
        );

      case 'link-received':
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
            <div>
              <h3 className="font-semibold">Verification Link Received</h3>
              <p className="text-sm text-muted-foreground">
                Click below to verify your location
              </p>
            </div>
            <Button onClick={verifyLocation} className="w-full">
              <MapPin className="w-4 h-4 mr-2" />
              Verify Location
            </Button>
          </div>
        );

      case 'verifying':
        return (
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
            <div>
              <h3 className="font-semibold">Verifying Location</h3>
              <p className="text-sm text-muted-foreground">
                Checking your distance from the classroom...
              </p>
            </div>
            <Badge variant="secondary" className="animate-pulse">
              Verifying...
            </Badge>
          </div>
        );

      case 'completed':
        return (
          <div className="text-center space-y-4">
            {verificationState.result?.success ? (
              <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
            ) : (
              <XCircle className="w-12 h-12 mx-auto text-red-600" />
            )}
            <div>
              <h3 className={`font-semibold ${
                verificationState.result?.success ? 'text-green-600' : 'text-red-600'
              }`}>
                {verificationState.result?.success ? 'Verification Successful' : 'Verification Failed'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {verificationState.result?.message}
              </p>
              {verificationState.result?.distance && (
                <Badge variant={verificationState.result.success ? "default" : "destructive"} className="mt-2">
                  Distance: {verificationState.result.distance}m
                </Badge>
              )}
            </div>
            <Button onClick={resetVerification} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-center">Location Verification</CardTitle>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
};

export default LocationVerification;