// 업로드한 EPUB에서 제목/저자/표지를 미리 뽑아 보여주기 위한 헬퍼.
// epub.js는 브라우저 API(Blob 등)에 의존하므로 반드시 클라이언트에서만 호출할 것.
export async function extractEpubMeta(file: File): Promise<{
  title: string;
  author: string;
  coverUrl: string | null;
}> {
  const ePub = (await import("epubjs")).default;
  const buffer = await file.arrayBuffer();
  const book = ePub(buffer);
  await book.ready;
  const metadata = await book.loaded.metadata;
  let coverUrl: string | null = null;
  try {
    coverUrl = await book.coverUrl();
  } catch {
    coverUrl = null;
  }
  return {
    title: metadata.title || file.name.replace(/\.epub$/i, ""),
    author: metadata.creator || "",
    coverUrl,
  };
}
