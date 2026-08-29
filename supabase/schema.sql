-- 행간 (haenggan) — Supabase 스키마
-- 개인/친구 소규모 사용을 전제로 한 가벼운 스키마입니다.
-- 정식 서비스로 확장할 때는 auth.users 연동 + 더 촘촘한 RLS로 교체하세요.

create extension if not exists "pgcrypto";

-- 하나의 "같이 읽기" 세션 = 책 한 권 + 초대 코드
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,              -- 초대 링크에 쓰는 짧은 코드 (예: 6자리)
  book_title text not null,
  book_author text,
  epub_path text not null,                -- Supabase Storage 상의 epub 파일 경로
  cover_url text,
  created_by text not null,               -- 만든 사람 닉네임
  created_at timestamptz not null default now()
);

-- 세션 참여자 (계정 없이 닉네임 기반)
create table if not exists session_members (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  nickname text not null,
  color text not null,                    -- 이 사람의 형광펜/손글씨 색
  device_key text not null,               -- 브라우저 localStorage에 저장되는 본인 식별용 키
  joined_at timestamptz not null default now(),
  unique (session_id, nickname)
);

-- 페이지(문장) 단위 하이라이트 + 메모
create table if not exists highlights (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  member_id uuid not null references session_members(id) on delete cascade,
  cfi_range text not null,                -- epub.js EPUB CFI (위치 식별자)
  chapter_href text,
  selected_text text not null,
  note text,
  color text not null,
  created_at timestamptz not null default now()
);

-- 각 참여자의 최대 진행 위치 (이 지점 이후의 남의 노트는 잠금 처리됨)
create table if not exists reading_progress (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  member_id uuid not null references session_members(id) on delete cascade,
  furthest_cfi text not null,
  percentage numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (session_id, member_id)
);

alter table sessions enable row level security;
alter table session_members enable row level security;
alter table highlights enable row level security;
alter table reading_progress enable row level security;

-- 소규모 개인 프로젝트용 단순 정책: 초대 코드/세션 id를 아는 사람만 접근한다는 전제로
-- anon 키에 대해 전체 read/write를 허용합니다. (정식 서비스 전환 시 auth.uid() 기반으로 교체)
create policy "anon full access - sessions" on sessions for all using (true) with check (true);
create policy "anon full access - members" on session_members for all using (true) with check (true);
create policy "anon full access - highlights" on highlights for all using (true) with check (true);
create policy "anon full access - progress" on reading_progress for all using (true) with check (true);

-- Storage: epub 파일을 담을 버킷 (Supabase 대시보드에서 'books' 버킷을 만들고
-- public 여부는 취향에 따라 설정하세요. private로 두면 signed URL로 접근)
