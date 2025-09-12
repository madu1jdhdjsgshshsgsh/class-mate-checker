import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyAttendanceRequest {
  token: string;
  student_latitude: number;
  student_longitude: number;
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, student_latitude, student_longitude }: VerifyAttendanceRequest = await req.json();

    console.log(`Attendance verification request for token: ${token}`);

    // Find verification link
    const { data: verificationLink, error: linkError } = await supabase
      .from('verification_links')
      .select(`
        *,
        attendance_sessions (
          *,
          subjects (name, code),
          classrooms (name, latitude, longitude)
        )
      `)
      .eq('token', token)
      .eq('is_used', false)
      .single();

    if (linkError || !verificationLink) {
      console.error('Invalid or expired verification token:', token);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired verification link' 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(verificationLink.expires_at);
    if (now > expiresAt) {
      console.error('Verification token expired:', token);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Verification link has expired' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Calculate distance between student and ESP32
    const distance = calculateDistance(
      student_latitude,
      student_longitude,
      verificationLink.esp32_latitude,
      verificationLink.esp32_longitude
    );

    console.log(`Distance calculated: ${distance} meters`);

    const isWithinRange = distance <= 100; // 100 meters range
    const attendanceStatus = isWithinRange ? 'present' : 'absent';

    // Update attendance record
    const { error: updateError } = await supabase
      .from('attendance_records')
      .update({
        status: attendanceStatus,
        check_in_time: new Date().toISOString(),
        student_latitude,
        student_longitude,
        distance_meters: distance
      })
      .eq('session_id', verificationLink.session_id)
      .eq('student_id', verificationLink.student_id)
      .eq('status', 'pending');

    if (updateError) {
      console.error('Error updating attendance record:', updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to update attendance record' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Mark verification link as used
    const { error: markUsedError } = await supabase
      .from('verification_links')
      .update({ is_used: true })
      .eq('id', verificationLink.id);

    if (markUsedError) {
      console.error('Error marking verification link as used:', markUsedError);
    }

    // Create confirmation notification
    const notificationMessage = isWithinRange 
      ? `✅ Attendance confirmed for ${verificationLink.attendance_sessions.subjects.name}! You were within range.`
      : `❌ Attendance marked as absent for ${verificationLink.attendance_sessions.subjects.name}. You were ${Math.round(distance)}m away (max 100m allowed).`;

    const { error: notificationError } = await supabase
      .from('attendance_notifications')
      .insert({
        student_id: verificationLink.student_id,
        session_id: verificationLink.session_id,
        message: notificationMessage,
        type: isWithinRange ? 'attendance_confirmed' : 'attendance_failed'
      });

    if (notificationError) {
      console.error('Error creating confirmation notification:', notificationError);
    }

    console.log(`Attendance verification completed: ${attendanceStatus} (${distance}m)`);

    return new Response(
      JSON.stringify({
        success: true,
        status: attendanceStatus,
        distance_meters: Math.round(distance),
        within_range: isWithinRange,
        session: verificationLink.attendance_sessions.subjects.name,
        message: isWithinRange 
          ? 'Attendance confirmed successfully!' 
          : `You were too far from the classroom (${Math.round(distance)}m away, max 100m allowed)`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in verify-attendance function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});