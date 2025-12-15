-- Create table for tracking PDF split jobs
create table if not exists public.workflow_jobs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    pdf_filename text,
    csv_filename text,
    email_subject_template text,
    total_processed int default 0,
    success_count int default 0,
    error_count int default 0,
    created_at timestamptz default now()
);

-- Enable RLS
alter table public.workflow_jobs enable row level security;

-- Policies
create policy "Users can view their own workflow jobs"
    on public.workflow_jobs
    for select
    using (auth.uid() = user_id);

create policy "Users can insert their own workflow jobs"
    on public.workflow_jobs
    for insert
    with check (auth.uid() = user_id);
