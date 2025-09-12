import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RFIDCheckInRequest {
  esp32_device_id: string;
  student_rfid: string;
  latitude: number;
  longitude: number;
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

    const { esp32_device_id, student_rfid, latitude, longitude }: RFIDCheckInRequest = await req.json();

    console.log(`ESP32 RFID Check-in request:`, {
      esp32_device_id,
      student_rfid,
      latitude,
      longitude
    });

    // Find active session for this ESP32 device
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select(`
        *,
        subjects (name, code),
        classrooms (name, latitude, longitude)
      `)
      .eq('esp32_device_id', esp32_device_id)
      .eq('is_active', true)
      .single();

    if (sessionError || !session) {
      console.error('No active session found for ESP32 device:', esp32_device_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No active session found for this device' 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Find student by RFID (assuming student_id field contains RFID)
    const { data: student, error: studentError } = await supabase
      .from('profiles')
      .select('*')
      .eq('student_id', student_rfid)
      .eq('role', 'student')
      .single();

    if (studentError || !student) {
      console.error('Student not found with RFID:', student_rfid);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Student not found with provided RFID' 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate verification token
    const verificationToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create verification link
    const { error: linkError } = await supabase
      .from('verification_links')
      .insert({
        session_id: session.id,
        student_id: student.user_id,
        token: verificationToken,
        esp32_latitude: latitude,
        esp32_longitude: longitude,
        expires_at: expiresAt.toISOString()
      });

    if (linkError) {
      console.error('Error creating verification link:', linkError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create verification link' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create notification for student
    const { error: notificationError } = await supabase
      .from('attendance_notifications')
      .insert({
        student_id: student.user_id,
        session_id: session.id,
        message: `RFID detected! Tap the verification link to confirm your attendance for ${session.subjects.name}`,
        type: 'verification_pending'
      });

    if (notificationError) {
      console.error('Error creating notification:', notificationError);
    }

    // Create pending attendance record
    const { error: recordError } = await supabase
      .from('attendance_records')
      .insert({
        session_id: session.id,
        student_id: student.user_id,
        status: 'pending',
        esp32_latitude: latitude,
        esp32_longitude: longitude,
        verification_method: 'rfid'
      });

    if (recordError) {
      console.error('Error creating attendance record:', recordError);
    }

    const verificationUrl = `${supabaseUrl.replace('.supabase.co', '')}.lovable.app/verify/${verificationToken}`;

    console.log(`Verification link created for student ${student.full_name}:`, verificationUrl);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'RFID detected successfully',
        student_name: student.full_name,
        session: session.subjects.name,
        verification_url: verificationUrl,
        expires_in_minutes: 5
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in esp32-rfid-checkin function:', error);
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