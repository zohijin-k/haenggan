"use client";

// pdf.js 로더를 한 곳에 모아둠. 워커 파일은 웹팩 번들링을 거치면(ESM
// import/export 문법 때문에) 프로덕션 빌드가 깨져서, node_modules에서
// public/pdf.worker.min.mjs로 그대로 복사해두고 정적 파일 경로로 지정한다.
// (pdfjs-dist 버전을 올리면 이 워커 파일도 다시 복사해줘야 함)
export async function loadPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjsLib;
}


// PDF를 변환하지 않고 그대로 업로드할 때, 세션 만들기 폼에서 미리 보여줄
// 제목/저자/표지 썸네일만 살짝 뽑아본다 (실패해도 치명적이지 않음 — 사용자가
// 제목/저자는 직접 입력할 수 있고, 표지도 직접 올릴 수 있음).
export async function extractPdfPreview(
  file: File
): Promise<{ title: string; author: string; coverFile: File | null }> {
  const pdfjsLib = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  try {
    let title = file.name.replace(/\.pdf$/i, "");
    let author = "";
    try {
      const meta = await pdf.getMetadata();
      const info = (meta?.info ?? {}) as Record<string, unknown>;
      if (typeof info.Title === "string" && info.Title.trim()) title = info.Title.trim();
      if (typeof info.Author === "string") author = info.Author.trim();
    } catch {
      // 메타데이터가 없어도 파일명으로 대체하면 되니 무시
    }

    let coverFile: File | null = null;
    try {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.6 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.85)
        );
        if (blob) coverFile = new File([blob], "cover.jpg", { type: "image/jpeg" });
      }
    } catch {
      coverFile = null;
    }

    return { title, author, coverFile };
  } finally {
    await pdf.destroy();
  }
}
