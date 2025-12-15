-- Create a table to store login logs
create table if not exists public.login_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    email text not null,
    login_at timestamptz default now() not null,
    ip text,
    user_agent text
);

-- Enable Row Level Security
alter table public.login_logs enable row level security;

-- Policy: Users can only see their own logs
create policy "Users can view their own login logs"
    on public.login_logs
    for select
    using (auth.uid() = user_id);

-- Policy: Service role can insert logs (or authenticated users if we do it client side, but server side is better)
-- Since we are inserting from the server side (route handler), we will likely use a service role client or ensure the user is authenticated.
-- If inserting as the user:
create policy "Users can insert their own login logs"
    on public.login_logs
    for insert
    with check (auth.uid() = user_id);
