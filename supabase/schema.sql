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
    location text,
    specialization text,
    description text,
    target_clients text,
    differentiators text,
    intel_summary text,
    notes text,
    avatar_url text,
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
    intel_brief text,
    why_winning text,
    content_gaps text,
    visibility_score integer,
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
    prompt_id uuid references prompts(id) on delete set null,
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

-- ============================================================
-- PHASE 3 MIGRATIONS
-- ============================================================

-- Workspace mode (consultant vs direct)
alter table workspaces add column if not exists mode text
  check (mode in ('consultant', 'direct')) default 'direct';
alter table workspaces add column if not exists consultant_name text;
alter table workspaces add column if not exists consultant_email text;

-- Per-client notification preferences
alter table clients add column if not exists notify_client_email text;
alter table clients add column if not exists client_notification_level text
  check (client_notification_level in ('none', 'summary', 'full')) default 'none';

-- Smarter scan result fields
alter table scan_results add column if not exists mention_quality text
  check (mention_quality in ('leading','supporting','mentioned','not_mentioned'));
alter table scan_results add column if not exists authority_score integer;
alter table scan_results add column if not exists recommendation_strength text;
alter table scan_results add column if not exists why_competitor_wins text;
alter table scan_results add column if not exists citation_sources text[];
alter table scan_results add column if not exists citation_source_types text[];

-- Cross-client benchmarks
create table if not exists category_benchmarks (
    id uuid primary key default gen_random_uuid(),
    industry text not null,
    metric text not null,
    value jsonb not null,
    sample_size integer,
    calculated_at timestamptz default now()
);

-- Consultant playbook
create table if not exists consultant_playbook (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade,
    action_type text,
    industry text,
    baseline_visibility integer,
    post_action_visibility integer,
    weeks_to_impact integer,
    client_id uuid references clients(id),
    notes text,
    recorded_at timestamptz default now()
);
alter table consultant_playbook enable row level security;
create policy "Workspace owners manage playbook"
    on consultant_playbook for all using (
        workspace_id in (select id from workspaces where owner_id = auth.uid())
    );

-- Schema markup
create table if not exists schema_markup (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    page_url text,
    schema_type text check (schema_type in ('faq','organization','localbusiness','article','review','breadcrumb')),
    schema_json jsonb not null,
    is_deployed boolean default false,
    created_at timestamptz default now()
);
alter table schema_markup enable row level security;
create policy "Access schema_markup via client"
    on schema_markup for all using (
        client_id in (
            select c.id from clients c
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- Google My Business
create table if not exists gmb_data (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    location_id text,
    business_name text,
    rating numeric(3,2),
    review_count integer,
    photo_count integer,
    post_count integer,
    is_verified boolean default false,
    categories text[],
    last_synced timestamptz default now()
);
alter table gmb_data enable row level security;
create policy "Access gmb_data via client"
    on gmb_data for all using (
        client_id in (
            select c.id from clients c
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- Review intelligence
create table if not exists reviews (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    platform text check (platform in ('google','yelp','g2','capterra','trustpilot','facebook','industry')),
    rating integer check (rating between 1 and 5),
    review_text text,
    author text,
    reviewed_at date,
    sentiment text check (sentiment in ('positive','neutral','negative')),
    fetched_at timestamptz default now()
);
alter table reviews enable row level security;
create policy "Access reviews via client"
    on reviews for all using (
        client_id in (
            select c.id from clients c
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- NAP consistency
create table if not exists nap_listings (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    directory text not null,
    listed_name text,
    listed_address text,
    listed_phone text,
    listed_website text,
    is_consistent boolean,
    issues text[],
    checked_at timestamptz default now()
);
alter table nap_listings enable row level security;
create policy "Access nap_listings via client"
    on nap_listings for all using (
        client_id in (
            select c.id from clients c
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- Content gap analysis
create table if not exists content_gaps (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    competitor_id uuid references competitors(id) on delete cascade,
    topic text not null,
    competitor_url text,
    gap_score integer,
    estimated_impact text,
    status text check (status in ('open','in_progress','closed')) default 'open',
    identified_at timestamptz default now()
);
alter table content_gaps enable row level security;
create policy "Access content_gaps via client"
    on content_gaps for all using (
        client_id in (
            select c.id from clients c
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- Content scheduler
alter table geo_content add column if not exists scheduled_publish_at timestamptz;
alter table geo_content add column if not exists cms_platform text
  check (cms_platform in ('wordpress','webflow','hubspot','ghost','contentful','shopify','manual'));
alter table geo_content add column if not exists cms_post_id text;
alter table geo_content add column if not exists cms_post_url text;

-- CMS integrations
create table if not exists cms_connections (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade,
    client_id uuid references clients(id) on delete cascade,
    platform text check (platform in ('wordpress','webflow','hubspot','ghost','contentful','shopify','gmb')),
    access_token text,
    refresh_token text,
    site_url text,
    site_id text,
    token_expires_at timestamptz,
    is_active boolean default true,
    connected_at timestamptz default now()
);
alter table cms_connections enable row level security;
create policy "Workspace owners manage CMS connections"
    on cms_connections for all using (
        workspace_id in (select id from workspaces where owner_id = auth.uid())
    );

-- Backlink opportunities
create table if not exists backlink_opportunities (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    source_domain text not null,
    source_url text,
    domain_authority integer,
    relevance_score integer,
    opportunity_type text check (opportunity_type in ('guest_post','resource_page','broken_link','mention','directory')),
    status text check (status in ('identified','outreach_sent','acquired','rejected')) default 'identified',
    notes text,
    identified_at timestamptz default now()
);
alter table backlink_opportunities enable row level security;
create policy "Access backlink_opportunities via client"
    on backlink_opportunities for all using (
        client_id in (
            select c.id from clients c
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- PR opportunities
create table if not exists pr_opportunities (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references clients(id) on delete cascade,
    publication text not null,
    publication_url text,
    topic text,
    ai_citation_count integer default 0,
    contact_email text,
    status text check (status in ('identified','draft_ready','pitched','published')) default 'identified',
    created_at timestamptz default now()
);
alter table pr_opportunities enable row level security;
create policy "Access pr_opportunities via client"
    on pr_opportunities for all using (
        client_id in (
            select c.id from clients c
            join workspaces w on c.workspace_id = w.id
            where w.owner_id = auth.uid()
        )
    );

-- Multilingual prompt tracking
alter table prompts add column if not exists language text default 'en';
alter table prompts add column if not exists market text default 'US';

-- Stripe billing
create table if not exists subscriptions (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade,
    stripe_customer_id text unique,
    stripe_subscription_id text unique,
    plan text check (plan in ('starter','professional','agency')) default 'starter',
    status text check (status in ('active','cancelled','past_due','trialing')) default 'trialing',
    trial_ends_at timestamptz,
    current_period_end timestamptz,
    created_at timestamptz default now()
);
alter table subscriptions enable row level security;
create policy "Workspace owners manage subscriptions"
    on subscriptions for all using (
        workspace_id in (select id from workspaces where owner_id = auth.uid())
    );
