-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- === WORKSPACES ===
create table workspaces (
    id uuid primary key default gen_random_uuid(),
    name text not null default 'My Workspace',
    owner_id uuid references auth.users(id) on delete cascade,
    created_at timestamptz default now()
);

alter table workspaces enable row level security;
create policy "Users can manage their own workspace"
    on workspaces for all using (auth.uid() = owner_id);

-- === CLIENTS ===
create table clients (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade,
    name text not null,
    domain text,
    industry text,
    notes text,
    created_at timestamptz default now()
);

alter table clients enable row level security;
create policy "Workspace members can manage clients"
    on clients for all using (
        workspace_id in (select id from workspaces where owner_id = auth.uid())
    );

-- === COMPETITORS ===
create table competitors (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    name text not null,
    domain text,
    created_at timestamptz default now()
);

alter table competitors enable row level security;
create policy "Access competitors via client"
    on competitors for all using (
        client_id in (
            select c.id from clients c
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- === PROMPTS ===
create table prompts (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    text text not null,
    category text check (category in ('awareness', 'evaluation', 'purchase')) default 'awareness',
    is_active boolean default true,
    created_at timestamptz default now()
);

alter table prompts enable row level security;
create policy "Access prompts via client"
    on prompts for all using (
        client_id in (
            select c.id from clients c
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- === SCAN RESULTS ===
-- One row per prompt per model per scan run
create table scan_results (
    id uuid primary key default gen_random_uuid(),
    prompt_id uuid references prompts(id) on delete cascade,
    client_id uuid references clients(id) on delete cascade,
    model text not null check (model in ('chatgpt', 'claude', 'gemini')),
    mentioned boolean default false,
    mention_position integer,
    sentiment text check (sentiment in ('positive', 'neutral', 'negative')) default 'neutral',
    response_excerpt text,                       -- first 500 chars of AI response
    competitor_mentions text[],               -- array of competitor names found in response
    scanned_at timestamptz default now()
);

alter table scan_results enable row level security;
create policy "Access scan results via client"
    on scan_results for all using (
        client_id in (
            select c.id from clients c
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- Index for fast queries by client + date
create index scan_results_client_date on scan_results (client_id, scanned_at desc);

-- === GEO CONTENT ===
create table geo_content (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    title text not null,
    content text,
    target_prompt text,
    content_type text check (content_type in ('article', 'comparison', 'faq', 'landing')),
    tone text default 'authoritative',
    word_count_target integer default 1200,
    status text check (status in ('draft', 'published')) default 'draft',
    published_url text,
    -- Citation tracking (updated after each scan)
    cited_by_gpt boolean default false,
    cited_by_claude boolean default false,
    cited_by_gemini boolean default false,
    citation_rate integer generated always as (
        (case when cited_by_gpt then 33 else 0 end) +
        (case when cited_by_claude then 33 else 0 end) +
        (case when cited_by_gemini then 34 else 0 end)
    ) stored,
    created_at timestamptz default now(),
    published_at timestamptz
);

alter table geo_content enable row level security;
create policy "Access geo_content via client"
    on geo_content for all using (
        client_id in (
            select c.id from clients c
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- === KEYWORDS ===
create table keywords (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    keyword text not null,
    category text check (category in ('branded', 'category', 'competitor')) default 'category',
    monthly_volume integer,
    difficulty text check (difficulty in ('easy', 'medium', 'hard')),
    your_rank integer,
    top_competitor_name text,
    top_competitor_rank integer,
    ai_visible text check (ai_visible in ('yes', 'partial', 'no')) default 'no',
    trend text check (trend in ('up', 'down', 'flat')) default 'flat',
    opportunity text check (opportunity in ('high', 'medium', 'low')) default 'medium',
    last_updated timestamptz default now(),
    created_at timestamptz default now()
);

alter table keywords enable row level security;
create policy "Access keywords via client"
    on keywords for all using (
        client_id in (
            select c.id from clients c
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- === REPORTS ===
create table reports (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    workspace_id uuid references workspaces(id) on delete cascade,
    name text not null,
    report_type text check (report_type in ('full', 'visibility', 'competitor', 'executive')),
    date_range_start date,
    date_range_end date,
    sections text[],                                   -- ['visibility', 'competitors', 'geo', 'keywords']
    accent_color text default '#7C3AED',
    pdf_url text,                                         -- Supabase Storage URL after generation
    page_count integer,
    created_at timestamptz default now()
);

alter table reports enable row level security;
create policy "Access reports via workspace"
    on reports for all using (
        workspace_id in (select id from workspaces where owner_id = auth.uid())
    );

-- === USER SETTINGS ===
create table user_settings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade unique,
    workspace_id uuid references workspaces(id),
    active_client_id uuid references clients(id),     -- last selected client
    scan_frequency text default 'daily',
    alert_on_drop boolean default true,
    weekly_digest boolean default true,
    timezone text default 'America/Chicago',
    updated_at timestamptz default now()
);

alter table user_settings enable row level security;
create policy "Users manage their own settings"
    on user_settings for all using (auth.uid() = user_id);

-- === COMPETITOR CONTENT (Phase 2) ===
create table if not exists competitor_content (
    id uuid primary key default gen_random_uuid(),
    competitor_id uuid references competitors(id) on delete cascade,
    url text not null,
    title text,
    excerpt text,
    likely_cited boolean default false,
    citation_prompt_ids text[],
    crawled_at timestamptz default now()
);

alter table competitor_content enable row level security;
create policy "Access competitor_content via client"
    on competitor_content for all using (
        competitor_id in (
            select comp.id from competitors comp
            join clients c on comp.client_id = c.id
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- === COMPETITOR ADS (Phase 2) ===
create table if not exists competitor_ads (
    id uuid primary key default gen_random_uuid(),
    competitor_id uuid references competitors(id) on delete cascade,
    platform text check (platform in ('google', 'meta')),
    ad_text text,
    ad_url text,
    first_seen date,
    last_seen date,
    is_active boolean default true,
    fetched_at timestamptz default now()
);

alter table competitor_ads enable row level security;
create policy "Access competitor_ads via client"
    on competitor_ads for all using (
        competitor_id in (
            select comp.id from competitors comp
            join clients c on comp.client_id = c.id
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- === CLIENT PORTAL ACCESS (Phase 2) ===
create table if not exists client_portal_access (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    workspace_id uuid references workspaces(id) on delete cascade,
    portal_slug text unique not null,
    client_email text,
    portal_password_hash text,
    brand_name text,
    brand_logo_url text,
    accent_color text default '#7C3AED',
    is_active boolean default true,
    created_at timestamptz default now()
);

alter table client_portal_access enable row level security;
create policy "Workspace owners manage portal access"
    on client_portal_access for all using (
        workspace_id in (select id from workspaces where owner_id = auth.uid())
    );
