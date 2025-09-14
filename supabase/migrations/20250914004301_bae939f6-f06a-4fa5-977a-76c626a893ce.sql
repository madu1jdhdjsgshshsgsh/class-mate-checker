-- Fix attendance_sessions table to allow null classroom_id since we removed classroom selection
ALTER TABLE public.attendance_sessions ALTER COLUMN classroom_id DROP NOT NULL;

-- Make subject code unique per teacher (not globally) to allow different teachers to use same codes
DROP INDEX IF EXISTS subjects_code_key;
CREATE UNIQUE INDEX subjects_code_teacher_unique ON public.subjects (code, teacher_id);

-- Update RLS policies for better access control
DROP POLICY IF EXISTS "Students can view active sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Teachers can manage their sessions" ON public.attendance_sessions;

-- Better RLS policies for attendance_sessions
CREATE POLICY "Students can view all active sessions" 
ON public.attendance_sessions 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Teachers can create their own sessions" 
ON public.attendance_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can view their own sessions" 
ON public.attendance_sessions 
FOR SELECT 
USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their own sessions" 
ON public.attendance_sessions 
FOR UPDATE 
USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete their own sessions" 
ON public.attendance_sessions 
FOR DELETE 
USING (auth.uid() = teacher_id);

-- Fix subject policies to allow teachers to create subjects
DROP POLICY IF EXISTS "Students can view all subjects" ON public.subjects;
DROP POLICY IF EXISTS "Teachers can manage their subjects" ON public.subjects;

CREATE POLICY "Everyone can view subjects" 
ON public.subjects 
FOR SELECT 
USING (true);

CREATE POLICY "Teachers can create subjects" 
ON public.subjects 
FOR INSERT 
WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their subjects" 
ON public.subjects 
FOR UPDATE 
USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete their subjects" 
ON public.subjects 
FOR DELETE 
USING (auth.uid() = teacher_id);

-- Ensure classrooms policies are correct
DROP POLICY IF EXISTS "Everyone can view classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers can manage classrooms" ON public.classrooms;

CREATE POLICY "Everyone can view classrooms" 
ON public.classrooms 
FOR SELECT 
USING (true);

CREATE POLICY "Teachers can manage classrooms" 
ON public.classrooms 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'teacher'
));