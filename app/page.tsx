import CreateSessionForm from "@/components/CreateSessionForm";
import JoinSessionForm from "@/components/JoinSessionForm";
import { MEMBER_PALETTE } from "@/lib/palette";

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16">
      <div className="mb-12 text-center">
        <p className="mb-3 text-sm text-ink/45">문장과 문장 사이, 우리만 아는 이야기</p>
        <h1 className="text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          행간
        </h1>
        <p className="mt-1.5 text-[11px] uppercase tracking-[0.2em] text-ink/30">
          space between lines
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
          친구들과 전자책 한 권을 같이 읽어요.
          <br />
          내가 읽은 만큼만, 서로의 밑줄과 메모가 조금씩 드러납니다.
        </p>
      </div>

      <div className="grid w-full gap-5 sm:grid-cols-2">
        <section className="rounded-2xl border border-ink/10 border-l-[3px] border-l-moss bg-white/40 p-6 shadow-note backdrop-blur-sm">
          <h2 className="mb-1 flex items-center gap-1.5 text-base font-medium text-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-moss" />
            새로 시작하기
          </h2>
          <p className="mb-5 text-xs text-ink/50">
            EPUB을 올리고, 친구들에게 코드를 공유하세요
          </p>
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
    </main>
  );
}
