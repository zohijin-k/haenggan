export type Session = {
  id: string;
  code: string;
  name: string | null;
  book_title: string;
  book_author: string | null;
  epub_path: string;
  cover_url: string | null;
  created_by: string;
  created_at: string;
};

export type Member = {
  id: string;
  session_id: string;
  nickname: string;
  color: string;
  device_key: string;
  joined_at: string;
};

export type Highlight = {
  id: string;
  session_id: string;
  member_id: string;
  cfi_range: string;
  chapter_href: string | null;
  selected_text: string;
  note: string | null;
  color: string;
  created_at: string;
  // join된 값 (client에서 채워 넣음)
  member?: Member;
};

export type ReadingProgress = {
  id: string;
  session_id: string;
  member_id: string;
  furthest_cfi: string;
  percentage: number;
  updated_at: string;
};
