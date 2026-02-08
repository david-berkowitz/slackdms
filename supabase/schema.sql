create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  team_id text unique not null,
  team_name text,
  bot_access_token text,
  bot_user_id text,
  authed_user_id text,
  authed_user_token text,
  installed_at timestamptz,
  updated_at timestamptz
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references workspaces(team_id) on delete cascade,
  user_id text not null,
  display_name text,
  real_name text,
  is_bot boolean default false,
  deleted boolean default false,
  profile jsonb,
  user_created_at timestamptz,
  unique (team_id, user_id)
);

create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references workspaces(team_id) on delete cascade,
  channel_id text not null,
  name text,
  is_private boolean default false,
  is_archived boolean default false,
  unique (team_id, channel_id)
);

create table if not exists user_activity (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references workspaces(team_id) on delete cascade,
  user_id text not null,
  last_activity_at timestamptz,
  unique (team_id, user_id)
);

create table if not exists user_channel_activity (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references workspaces(team_id) on delete cascade,
  user_id text not null,
  channel_id text not null,
  last_activity_at timestamptz,
  unique (team_id, user_id, channel_id)
);

create table if not exists dm_jobs (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references workspaces(team_id) on delete cascade,
  created_by text,
  sender_user_id text,
  message_template text not null,
  status text not null,
  created_at timestamptz
);

create table if not exists dm_job_recipients (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references dm_jobs(id) on delete cascade,
  user_id text not null,
  status text not null,
  error text,
  sent_at timestamptz
);

create index if not exists idx_user_activity_team_last on user_activity (team_id, last_activity_at desc);
create index if not exists idx_user_channel_activity_team_channel_last on user_channel_activity (team_id, channel_id, last_activity_at desc);
create index if not exists idx_dm_recipients_job_status on dm_job_recipients (job_id, status);


create table if not exists workspace_senders (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references workspaces(team_id) on delete cascade,
  user_id text not null,
  access_token text not null,
  display_name text,
  real_name text,
  created_at timestamptz,
  unique (team_id, user_id)
);

create table if not exists dm_workflows (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references workspaces(team_id) on delete cascade,
  name text not null,
  trigger text not null,
  channel_id text,
  sender_user_id text,
  message_template text not null,
  is_active boolean default true,
  created_at timestamptz,
  updated_at timestamptz
);

create index if not exists idx_workflow_team_trigger on dm_workflows (team_id, trigger, is_active);


create table if not exists workflow_sends (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references dm_workflows(id) on delete cascade,
  team_id text not null references workspaces(team_id) on delete cascade,
  user_id text not null,
  sent_at timestamptz,
  unique (workflow_id, user_id)
);

create index if not exists idx_workflow_sends_team_user on workflow_sends (team_id, user_id);
