-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

-- Create user_roles table for secure role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Add building column to classrooms
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS building TEXT;

-- Update classrooms RLS for admin
DROP POLICY IF EXISTS "Teachers can manage classrooms" ON public.classrooms;

CREATE POLICY "Admins can manage classrooms"
  ON public.classrooms
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create session_enrollments table to track join requests
CREATE TABLE public.session_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, enrolled, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (session_id, student_id)
);

-- Enable RLS on session_enrollments
ALTER TABLE public.session_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own enrollments"
  ON public.session_enrollments
  FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can request enrollment"
  ON public.session_enrollments
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers can manage enrollments for their sessions"
  ON public.session_enrollments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM attendance_sessions 
      WHERE attendance_sessions.id = session_id 
      AND attendance_sessions.teacher_id = auth.uid()
    )
  );

-- Add recurring fields to attendance_sessions
ALTER TABLE public.attendance_sessions 
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;

-- Add attendance tracking fields to attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS selected_classroom_id UUID REFERENCES public.classrooms(id),
  ADD COLUMN IF NOT EXISTS attendance_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS can_verify BOOLEAN DEFAULT false;

-- Create trigger for updated_at on session_enrollments
CREATE TRIGGER update_session_enrollments_updated_at
  BEFORE UPDATE ON public.session_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for session_enrollments
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_enrollments;