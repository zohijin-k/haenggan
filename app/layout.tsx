import type { Metadata } from "next";
// Google Fonts를 빌드 타임에 원격으로 받아오는 next/font/google 대신,
// 폰트 파일 자체를 패키지로 내장하는 @fontsource를 사용 — 네트워크가 막힌 환경에서도
// 빌드가 항상 안정적으로 성공하고, 배포 후에도 구글 폰트 서버 상태에 의존하지 않는다.
import "@fontsource/gaegu/300.css";
import "@fontsource/gaegu/400.css";
import "@fontsource/gaegu/700.css";
// 메모(손글씨) 폰트 후보 — 사용자가 사이드바에서 고른다 (lib/notePrefs.ts).
import "@fontsource/nanum-pen-script/400.css";
import "@fontsource/gowun-dodum/400.css";
// 본문/UI 폰트: Pretendard 가변 폰트 — 한글 전체 글립을 하나의 woff2 파일에
// 담고 있어(45~920 weight) Noto Serif KR의 명조/붓글씨 인상 대신
// 깔끔한 UI 서체를 제공한다.
import "pretendard/dist/web/variable/pretendardvariable.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "행간",
  description:
    "행간 · space between lines — 친구들과 책 한 권을 함께 읽으며, 행간마다 서로의 흔적을 남기는 곳",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-paper text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
