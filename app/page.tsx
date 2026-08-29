import Link from "next/link";
import CreateSessionForm from "@/components/CreateSessionForm";
import JoinSessionForm from "@/components/JoinSessionForm";
import { MEMBER_PALETTE } from "@/lib/palette";

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16">
      <div className="mb-12 text-center">
        <p className="mb-3 text-sm text-ink/45">space between lines</p>
        <h1 className="text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          행간
        </h1>
        <p className="mt-1.5 text-[11px] uppercase tracking-[0.2em] text-ink/30">
          글에 직접적으로 나타나 있지 아니하나
          <br />
           그 글을 통하여 나타내려고 하는 숨은 뜻을 비유적으로 이르는 말
        </p>
        {/* 참여자마다 고정된 색을 갖는다는 이 서비스의 핵심 컨셉을,
            첫 화면에서부터 작은 점들로 살짝 예고한다 */}
        <div className="mt-4 flex justify-center gap-1.5">
          {MEMBER_PALETTE.map((c) => (
            <span
              key={c.name}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink/55">
          read between the lines
        </p>
      </div>

      <div className="grid w-full gap-5 sm:grid-cols-2">
        <section className="rounded-2xl border border-ink/10 border-l-[3px] border-l-moss bg-white/40 p-6 shadow-note backdrop-blur-sm">
          <h2 className="mb-1 flex items-center gap-1.5 text-base font-medium text-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-moss" />
            새로 시작하기
          </h2>
          <CreateSessionForm />
        </section>

        <section className="rounded-2xl border border-ink/10 border-l-[3px] border-l-clay bg-white/40 p-6 shadow-note backdrop-blur-sm">
          <h2 className="mb-1 flex items-center gap-1.5 text-base font-medium text-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-clay" />
            초대받았어요
          </h2>
          <p className="mb-5 text-xs text-ink/50">
            코드를 받았다면 여기로 들어오세요
          </p>
          <JoinSessionForm />
        </section>
      </div>

      <Link
        href="/library"
        className="mt-8 text-sm text-ink/45 underline-offset-4 transition hover:text-ink/70 hover:underline"
      >
        서재로 가기 →
      </Link>
    </main>
  );
}
