-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  student_id TEXT, -- For students only
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create subjects table
CREATE TABLE public.subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Create classrooms table
CREATE TABLE public.classrooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

-- Create attendance sessions table
CREATE TABLE public.attendance_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  days_of_week TEXT[] NOT NULL, -- ['monday', 'wednesday', 'friday']
  is_active BOOLEAN NOT NULL DEFAULT true,
  esp32_device_id TEXT, -- For ESP32 integration
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Create attendance records table
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'pending')),
  check_in_time TIMESTAMP WITH TIME ZONE,
  student_latitude DECIMAL(10, 8),
  student_longitude DECIMAL(11, 8),
  esp32_latitude DECIMAL(10, 8),
  esp32_longitude DECIMAL(11, 8),
  distance_meters DECIMAL(10, 2),
  verification_method TEXT CHECK (verification_method IN ('manual', 'rfid', 'location')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Create verification links table for ESP32 integration
CREATE TABLE public.verification_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  esp32_latitude DECIMAL(10, 8) NOT NULL,
  esp32_longitude DECIMAL(11, 8) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_links ENABLE ROW LEVEL SECURITY;

-- Create attendance notifications table
CREATE TABLE public.attendance_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('verification_pending', 'attendance_confirmed', 'attendance_failed')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for subjects
CREATE POLICY "Teachers can manage their subjects" ON public.subjects
  FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Students can view all subjects" ON public.subjects
  FOR SELECT USING (true);

-- Create RLS policies for classrooms
CREATE POLICY "Everyone can view classrooms" ON public.classrooms
  FOR SELECT USING (true);

CREATE POLICY "Teachers can manage classrooms" ON public.classrooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'teacher'
    )
  );

-- Create RLS policies for attendance sessions
CREATE POLICY "Teachers can manage their sessions" ON public.attendance_sessions
  FOR ALL USING (auth.uid() = teacher_id);

CREATE POLICY "Students can view active sessions" ON public.attendance_sessions
  FOR SELECT USING (is_active = true);

-- Create RLS policies for attendance records
CREATE POLICY "Students can view their own records" ON public.attendance_records
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view records for their sessions" ON public.attendance_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions 
      WHERE id = session_id AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can insert their own records" ON public.attendance_records
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "System can update attendance records" ON public.attendance_records
  FOR UPDATE USING (true);

-- Create RLS policies for verification links
CREATE POLICY "Students can view their own verification links" ON public.verification_links
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "System can manage verification links" ON public.verification_links
  FOR ALL USING (true);

-- Create RLS policies for notifications
CREATE POLICY "Students can view their own notifications" ON public.attendance_notifications
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can update their own notifications" ON public.attendance_notifications
  FOR UPDATE USING (auth.uid() = student_id);

CREATE POLICY "System can insert notifications" ON public.attendance_notifications
  FOR INSERT WITH CHECK (true);

-- Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_sessions_updated_at
  BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();