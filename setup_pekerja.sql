-- Create workers table
CREATE TABLE IF NOT EXISTS public.workers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_no VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    negara_asal VARCHAR(255) DEFAULT 'Malaysia',
    kumpulan VARCHAR(255) DEFAULT 'Kerja Am dan Lain-lain',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create attendance_records table
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'Hadir', 'Tidak Hadir', 'Cuti', 'Sakit'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_worker_date UNIQUE (worker_id, date)
);

-- Create work_assignments table
CREATE TABLE IF NOT EXISTS public.work_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_id UUID REFERENCES public.workers(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    work_type VARCHAR(255) NOT NULL,
    blok VARCHAR(255) NOT NULL,
    peringkat VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_assignments ENABLE ROW LEVEL SECURITY;

-- Create simple public/authenticated select, insert, update, delete policies
CREATE POLICY "Allow public select on workers" ON public.workers FOR SELECT USING (true);
CREATE POLICY "Allow public insert on workers" ON public.workers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on workers" ON public.workers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on workers" ON public.workers FOR DELETE USING (true);

CREATE POLICY "Allow public select on attendance" ON public.attendance_records FOR SELECT USING (true);
CREATE POLICY "Allow public insert on attendance" ON public.attendance_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on attendance" ON public.attendance_records FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on attendance" ON public.attendance_records FOR DELETE USING (true);

CREATE POLICY "Allow public select on work_assignments" ON public.work_assignments FOR SELECT USING (true);
CREATE POLICY "Allow public insert on work_assignments" ON public.work_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on work_assignments" ON public.work_assignments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on work_assignments" ON public.work_assignments FOR DELETE USING (true);

-- Enable Realtime for all three tables
alter publication supabase_realtime add table public.workers;
alter publication supabase_realtime add table public.attendance_records;
alter publication supabase_realtime add table public.work_assignments;


