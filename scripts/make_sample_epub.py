"""
행간 데모/스캐폴딩용 샘플 EPUB 생성 스크립트.
저작권 문제가 없도록, 짧은 원본(placeholder) 텍스트로 구성한다.
실제 서비스 테스트 시에는 본인이 정식으로 구매/소장한 DRM 없는 EPUB으로 교체할 것.
"""
from ebooklib import epub

book = epub.EpubBook()
book.set_identifier("exchange-reading-sample-001")
book.set_title("여백에서 만나요 (샘플)")
book.set_language("ko")
book.add_author("행간 데모")

chapters_text = [
    (
        "1. 첫 페이지",
        [
            "누군가 읽던 책을 물려받으면, 나는 늘 그 사람이 밑줄 그은 자리부터 먼저 읽는다.",
            "왜 하필 이 문장이었을까. 그 사람의 하루가 거기 어딘가에 걸려 있었던 걸까.",
            "이 책은 그런 마음으로 만든, 아주 짧은 이야기 모음이다. 페이지를 넘기다 마음에 걸리는 문장이 있으면 그어보고, 옆에 한마디 남겨보자.",
        ],
    ),
    (
        "2. 손끝의 온도",
        [
            "종이에 남긴 흔적은 지워지지 않는다. 그래서 어떤 사람은 낙서를 두려워한다.",
            "하지만 지워지지 않기 때문에 소중해지는 흔적도 있다. 다만 모두가 그 무게를 감당하고 싶어하는 건 아니다.",
            "그래서 우리는 종이 대신 화면 위에, 그러나 여전히 손끝의 온도가 느껴지도록 밑줄을 긋기로 했다.",
        ],
    ),
    (
        "3. 돌려 읽기",
        [
            "한 권의 책을 여럿이 나눠 읽는다는 건, 같은 길을 다른 속도로 걷는 일과 비슷하다.",
            "누군가는 이미 결말을 알고, 누군가는 아직 첫 장에 머물러 있다.",
            "그래서 우리는 약속했다. 딱 네가 읽은 만큼만, 딱 그만큼의 흔적만 보여주기로.",
        ],
    ),
    (
        "4. 발견",
        [
            "어느 페이지를 넘기다 문득, 친구가 남긴 짧은 문장을 발견할 때가 있다.",
            "그 순간의 반가움은 미리 알고 찾아간 것과는 전혀 다르다. 우연히, 정확히 그 자리에서 마주쳤기 때문이다.",
            "이 책이 끝날 즈음엔, 우리 각자의 색으로 물든 문장들이 이 책 안에 남아 있을 것이다.",
        ],
    ),
]

epub_chapters = []
for idx, (title, paragraphs) in enumerate(chapters_text, start=1):
    c = epub.EpubHtml(title=title, file_name=f"chap_{idx:02d}.xhtml", lang="ko")
    body = "".join(f"<p>{p}</p>" for p in paragraphs)
    c.content = f"<h1>{title}</h1>{body}"
    book.add_item(c)
    epub_chapters.append(c)

book.toc = tuple(epub_chapters)
book.add_item(epub.EpubNcx())
book.add_item(epub.EpubNav())
book.spine = ["nav"] + epub_chapters

style = """
body { font-family: serif; line-height: 1.8; padding: 0 1em; }
h1 { font-size: 1.3em; margin-bottom: 1em; }
p { margin: 0 0 1em 0; }
"""
nav_css = epub.EpubItem(uid="style_nav", file_name="style/nav.css", media_type="text/css", content=style)
book.add_item(nav_css)
for c in epub_chapters:
    c.add_item(nav_css)

epub.write_epub("/home/claude/exchange-reading/public/sample-books/sample.epub", book)
print("done")
