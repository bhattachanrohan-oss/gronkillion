"""End-to-end gameplay checks in headless Chromium (real UI, real timers)."""
import json, os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
# Optional: point GRONK_FONTS_DIR at a local @fontsource folder to screenshot with the real fonts offline.
FONTS = Path(os.environ.get("GRONK_FONTS_DIR", "/nonexistent"))
SHOTS = ROOT / "test" / "shots"
SHOTS.mkdir(exist_ok=True)

FONT_FILES = {
    "vt323": FONTS / "vt323/files/vt323-latin-400-normal.woff2",
}
FONT_CSS = "".join(
    f"@font-face{{font-family:'{fam}';font-weight:{w};font-style:normal;font-display:swap;src:url(https://fonts.gstatic.com/local/{key}.woff2) format('woff2');}}"
    for key, fam, w in [("vt323", "VT323", 400)]
)

problems = []
def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        problems.append(msg)

def wire(context):
    if not FONTS.exists():
        return  # use Google Fonts directly (or system fallbacks when offline)
    def css(route):
        route.fulfill(status=200, content_type="text/css", body=FONT_CSS, headers={"Access-Control-Allow-Origin": "*"})
    def font(route):
        key = route.request.url.rsplit("/", 1)[-1].replace(".woff2", "")
        route.fulfill(status=200, content_type="font/woff2", body=FONT_FILES[key].read_bytes(), headers={"Access-Control-Allow-Origin": "*"})
    context.route("https://fonts.googleapis.com/**", css)
    context.route("https://fonts.gstatic.com/local/**", font)

def new_page(browser, logs, **kw):
    ctx = browser.new_context(**kw)
    wire(ctx)
    page = ctx.new_page()
    page.on("console", lambda m: logs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
    return ctx, page

def gstate(page):
    return page.evaluate("window.GRONKILLION.getState()")

def wait_phase(page, phase, timeout=8000):
    page.wait_for_function(f"window.GRONKILLION && window.GRONKILLION.getState().phase === '{phase}'", timeout=timeout)

def answer_for(page, tier_pref):
    """Pick a real answer for the current question, preferring the given tier order."""
    return page.evaluate("""(pref) => {
      const G = window.GRONKILLION, s = G.getState();
      const q = G.questions.find(x => x.id === s.questionIds[s.round]);
      for (const t of pref) { const a = q.answers.find(x => x.rarity === t); if (a) return {text: a.canonical, points: a.points, rarity: a.rarity, qid: q.id, type: q.type}; }
      const a = q.answers[0]; return {text: a.canonical, points: a.points, rarity: a.rarity, qid: q.id, type: q.type};
    }""", tier_pref)

def typo_for(page):
    """A misspelling of a real answer that validate() accepts via its typo matcher."""
    return page.evaluate("""() => {
      const G = window.GRONKILLION, s = G.getState();
      const q = G.questions.find(x => x.id === s.questionIds[s.round]);
      for (const a of q.answers) {
        const c = a.canonical;
        for (let i = 2; i < c.length - 1; i++) {
          for (const t of [c.slice(0, i) + c[i] + c.slice(i), c.slice(0, i) + c.slice(i + 1)]) {
            const r = G.validate(q.id, t);
            if (r.kind === 'accepted' && r.via === 'typo' && r.answer.canonical === c) return {text: t, canonical: c, points: a.points};
          }
        }
      }
      return null;
    }""")

SHEET_JS = """() => {
  const S = GRONK_SPRITES;
  let h = '<div style="padding:16px;background:#0E1626;color:#E8F1FF;font:16px VT323,monospace">';
  h += '<div class="wm-chroma" style="width:720px;margin:8px 0 16px">' + S.wordmark(true) + '</div>';
  h += '<div class="wm-chroma" style="width:240px;margin:0 0 16px">' + S.wordmark(false) + '</div>';
  S.names().forEach(n => { const z = S.size(n);
    h += '<div style="display:inline-block;margin:6px;text-align:center;vertical-align:top"><div style="background:#1F6B34;padding:6px">' +
      S.svg(n).replace('class="spr ', 'style="width:' + z.w * 4 + 'px;height:' + z.h * 4 + 'px" class="spr ') + '</div>' + n + '</div>'; });
  ['dim', 'hot', 'dense'].forEach(v => h += '<div style="height:120px;margin:6px 0;background:url(' + S.crowd(v) + ') repeat-x 0 0/384px 120px;image-rendering:pixelated"></div>');
  document.querySelector('main').innerHTML = h + '</div>';
  document.querySelectorAll('.screen').forEach(e => e.hidden = true);
}"""

def no_hscroll(page):
    return page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

def main():
    logs = []
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------------- Desktop: full unlimited game ----------------
        print("\n[desktop unlimited game]")
        ctx, page = new_page(browser, logs, viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        ctx.grant_permissions(["clipboard-read", "clipboard-write"])
        page.goto(URL)
        page.wait_for_function("window.GRONKILLION")
        page.wait_for_timeout(500)
        page.screenshot(path=str(SHOTS / "01_home_desktop.png"))
        check(page.locator("#kickoffSub").inner_text() == "Today's Daily Challenge", "kickoff defaults to today's daily")
        page.click("#unlimitedBtn")
        page.wait_for_timeout(500)
        page.screenshot(path=str(SHOTS / "02_kickoff.png"))
        wait_phase(page, "PREVIEW")
        page.wait_for_timeout(400)
        page.screenshot(path=str(SHOTS / "03_preview.png"))
        # typing during preview is blocked; Enter shows a hold message
        page.locator("#answerInput").press_sequentially("abc", delay=10)
        check(page.input_value("#answerInput") == "", "typing blocked during snap count")
        page.keyboard.press("Enter")
        fb = page.inner_text("#feedback")
        check("after the snap" in fb, f"Enter during preview shows hold message (phase {gstate(page)['phase']}, feedback {fb!r})")
        wait_phase(page, "ANSWERING")
        s = gstate(page)
        # invalid answer keeps the clock running
        dl_before = s["deadline"]
        page.fill("#answerInput", "zzzz qqqq")
        page.keyboard.press("Enter")
        page.wait_for_timeout(150)
        check(page.inner_text("#feedback").startswith("Not recognized"), "unrecognized answer message")
        check(gstate(page)["phase"] == "ANSWERING" and gstate(page)["deadline"] == dl_before, "invalid answer does not reset or end the play")
        page.screenshot(path=str(SHOTS / "04_wrong.png"))
        # rapid double submit of a valid answer only scores once
        ans = answer_for(page, ["gronkillion", "hall_of_famer", "all_pro", "pro_bowler", "starter", "chalk"])
        page.wait_for_timeout(300)
        page.fill("#answerInput", ans["text"])
        page.keyboard.press("Enter")
        page.click("#submitBtn", force=True)
        page.keyboard.press("Enter")
        wait_phase(page, "REVEAL")
        page.wait_for_selector("#reveal:not([hidden])")
        page.wait_for_timeout(950)
        if ans["rarity"] in ("all_pro", "hall_of_famer", "gronkillion"):
            check(page.locator("#gameField [data-role='qb']").evaluate("e => getComputedStyle(e).opacity") == "1", "big play: quarterback sprite is on the field")
            page.screenshot(path=str(SHOTS / "17_bigplay_throw.png"))
        page.wait_for_timeout(1600)
        s = gstate(page)
        check(s["score"] == ans["points"], f"round 1 scored once: {s['score']} == {ans['points']} ({ans['rarity']}, {ans['text']})")
        page.screenshot(path=str(SHOTS / "05_reveal.png"), full_page=True)
        total = s["score"]

        # rounds 2..7 with mixed behaviour
        for rnd in range(2, 8):
            page.wait_for_timeout(500)
            page.click("#nextBtn")
            wait_phase(page, "ANSWERING", 10000)
            if rnd == 3:
                page.click("#skipBtn")
                check(gstate(page)["phase"] == "ANSWERING", "first skip tap only arms the skip")
                page.click("#skipBtn")
                wait_phase(page, "REVEAL")
                check(gstate(page)["score"] == total, "skip awards zero")
                continue
            if rnd == 4:
                # let the real clock run out while text is typed (not submitted)
                ans = answer_for(page, ["starter", "chalk"])
                page.fill("#answerInput", ans["text"])
                wait_phase(page, "REVEAL", 30000)
                page.wait_for_timeout(600)
                check(gstate(page)["score"] == total, "timeout awards zero even with typed text")
                check("would have scored" in page.inner_text("#rvNote"), "timeout reveal mentions the unsubmitted answer")
                page.screenshot(path=str(SHOTS / "06_timeout.png"))
                continue
            pref = ["gronkillion", "hall_of_famer", "all_pro", "pro_bowler", "starter", "chalk"] if rnd != 5 else ["chalk", "starter"]
            ans = answer_for(page, pref)
            if rnd == 6:
                page.fill("#answerInput", ans["text"])
                page.click("#submitBtn")   # submit with the button
            else:
                page.fill("#answerInput", ans["text"].lower())
                page.keyboard.press("Enter")
            wait_phase(page, "REVEAL")
            if rnd == 5:
                page.wait_for_selector("#reveal:not([hidden])")
                page.wait_for_timeout(560)
                check(page.locator("#gameField .tl").count() == 6, "six tier lines sweep ahead of the ball")
                page.screenshot(path=str(SHOTS / "18_tierlines_advance.png"))
            total += ans["points"]
            check(gstate(page)["score"] == total, f"round {rnd} score {gstate(page)['score']} == {total} ({ans['text']})")
            if rnd == 5:
                page.wait_for_timeout(1200)
                page.set_viewport_size({"width": 820, "height": 900})  # resize mid-game
                page.wait_for_timeout(300)
                page.set_viewport_size({"width": 1440, "height": 900})
        page.wait_for_timeout(600)
        check(page.locator("#nextBtn span").inner_text().lower().startswith("final whistle"), "last play button says Final Whistle")
        page.click("#nextBtn")
        wait_phase(page, "RESULTS")
        page.wait_for_timeout(1800)
        page.screenshot(path=str(SHOTS / "07_results_desktop.png"), full_page=True)
        res_score = int(page.inner_text("#resScore"))
        check(res_score == total, f"results score {res_score} == {total}")
        check(page.locator("#resPlays li").count() == 7, "results list all seven plays")
        check(page.locator("#resLog .log-col").count() == 7, "drive log charts all seven plays")
        check(page.locator("#resLegend tr.is-you").count() == 1, "rank ladder highlights exactly one row")
        page.locator(".res-log").screenshot(path=str(SHOTS / "20_results_drive_log.png"))
        page.click("#copyBtn")
        page.wait_for_timeout(400)
        clip = page.evaluate("navigator.clipboard.readText()")
        print("   share text:\n" + "\n".join("     " + l for l in clip.splitlines()))
        check(f"Score: {total}/700" in clip and "Think NFL. Go Deep. Score Big." in clip, "share text copied to clipboard")
        ids = gstate(page)["questionIds"]
        # no answers leak into the share text
        answered = [pl["canonical"] for pl in gstate(page)["plays"] if pl and pl.get("canonical")]
        check(not any(name.lower() in clip.lower() for name in answered), "share text reveals no answers")
        page.click("#shareBtn")
        page.wait_for_timeout(400)
        if page.locator("#shareDialog[open]").count():
            check("Score:" in page.input_value("#shareText"), "share dialog shows the summary when there is no share sheet")
            page.click("#shareClose")
            page.wait_for_timeout(150)
        # play again -> new unlimited, avoid immediate repeats
        page.click("#replayBtn")
        wait_phase(page, "PREVIEW", 6000)
        ids2 = gstate(page)["questionIds"]
        overlap = len(set(ids) & set(ids2))
        check(overlap <= 2, f"next unlimited game mostly new questions (overlap {overlap})")
        check(len(set(ids2)) == 7, "no repeated question within a game")
        # refresh mid-game -> resume banner
        wait_phase(page, "ANSWERING")
        page.reload()
        page.wait_for_function("window.GRONKILLION")
        check(page.locator("#resumeBox").is_visible(), "resume banner after refresh")
        page.screenshot(path=str(SHOTS / "08_resume.png"))
        page.click("#resumeBox button[data-action='resume']")
        page.wait_for_timeout(300)
        st = gstate(page)
        check(st["phase"] in ("ANSWERING", "REVEAL") and st["questionIds"] == ids2, f"resumed same game in {st['phase']}")
        ctx.close()

        # ---------------- Mobile: daily challenge ----------------
        print("\n[mobile daily challenge]")
        ctx, page = new_page(browser, logs, **p.devices["iPhone 13"])
        page.goto(URL)
        page.wait_for_function("window.GRONKILLION")
        page.wait_for_timeout(400)
        page.screenshot(path=str(SHOTS / "10_home_mobile.png"), full_page=True)
        check(no_hscroll(page), "home: no horizontal scroll on mobile")
        expected = page.evaluate("window.GRONKILLION.dailyQuestionIds()")
        page.click("#kickoffBtn")
        wait_phase(page, "PREVIEW", 6000)
        check(gstate(page)["questionIds"] == expected, "daily uses the seeded question set")
        score = 0
        for rnd in range(1, 8):
            wait_phase(page, "ANSWERING", 10000)
            if rnd == 1:
                page.wait_for_timeout(200)
                page.screenshot(path=str(SHOTS / "11_question_mobile.png"), full_page=True)
                check(no_hscroll(page), "question: no horizontal scroll on mobile")
            ans = answer_for(page, ["all_pro", "pro_bowler", "starter", "chalk", "hall_of_famer", "gronkillion"])
            page.fill("#answerInput", ans["text"])
            page.click("#submitBtn")
            wait_phase(page, "REVEAL")
            score += ans["points"]
            if rnd == 1:
                page.wait_for_timeout(1600)
                page.screenshot(path=str(SHOTS / "12_reveal_mobile.png"), full_page=True)
                check(no_hscroll(page), "reveal: no horizontal scroll on mobile")
            page.wait_for_timeout(500)
            page.click("#nextBtn")
        wait_phase(page, "RESULTS")
        page.wait_for_timeout(1600)
        page.screenshot(path=str(SHOTS / "13_results_mobile.png"), full_page=True)
        check(no_hscroll(page), "results: no horizontal scroll on mobile")
        check(int(page.inner_text("#resScore")) == score, "daily results score matches")
        page.click("#resHomeBtn")
        page.wait_for_timeout(300)
        check(page.locator("#kickoffSub").inner_text() == "Unlimited Mode", "after daily, kickoff switches to unlimited")
        check(str(score) in page.inner_text("#statDaily"), "home shows today's daily score")
        check("next Daily Challenge" in page.inner_text("#dailyNote"), "home shows next daily reset countdown")
        page.click("#dailyBtn")
        wait_phase(page, "RESULTS")
        check(int(page.inner_text("#resScore")) == score, "re-opening daily shows the saved result, no second attempt")
        page.reload()
        page.wait_for_function("window.GRONKILLION")
        page.click("#dailyBtn")
        wait_phase(page, "RESULTS")
        check(gstate(page)["phase"] == "RESULTS", "daily stays locked after reload")
        ctx.close()

        # ---------------- Perfect drive -> touchdown ----------------
        print("\n[perfect drive]")
        ctx, page = new_page(browser, logs, viewport={"width": 1440, "height": 900})
        page.goto(URL)
        page.wait_for_function("window.GRONKILLION")
        page.click("#unlimitedBtn")
        for rnd in range(1, 8):
            wait_phase(page, "ANSWERING", 10000)
            ans = answer_for(page, ["gronkillion"])
            page.fill("#answerInput", ans["text"])
            page.keyboard.press("Enter")
            wait_phase(page, "REVEAL")
            if rnd == 7:
                page.wait_for_timeout(2700)
                check(page.inner_text("#gameField [data-role='zone']") == "TOUCHDOWN", "zone label reads TOUCHDOWN at 700")
                check(page.locator("#confetti").is_visible(), "touchdown confetti fires")
                page.screenshot(path=str(SHOTS / "09_touchdown.png"))
            page.wait_for_timeout(500)
            page.click("#nextBtn")
        wait_phase(page, "RESULTS")
        page.wait_for_timeout(1700)
        check(int(page.inner_text("#resScore")) == 700, "perfect drive scores 700")
        check(page.inner_text("#resRank") == "GRONKILLION LEGEND", "700 earns GRONKILLION LEGEND")
        ctx.close()

        # ---------------- Autocorrect confirm ----------------
        print("\n[autocorrect confirm]")
        ctx, page = new_page(browser, logs, viewport={"width": 1024, "height": 860})
        page.goto(URL)
        page.wait_for_function("window.GRONKILLION")
        page.click("#unlimitedBtn")
        wait_phase(page, "ANSWERING", 10000)
        check(no_hscroll(page), "game: no horizontal scroll at 1024px (non-emulated)")
        tested = False
        for rnd in range(1, 8):
            wait_phase(page, "ANSWERING", 10000)
            typo = typo_for(page)
            if typo:
                before = gstate(page)["score"]
                page.fill("#answerInput", typo["text"])
                page.keyboard.press("Enter")
                page.wait_for_timeout(200)
                chip = page.locator("#typoChip")
                check(gstate(page)["phase"] == "ANSWERING", f"typo {typo['text']!r} is not locked in on the first submit")
                check(chip.is_visible() and typo["canonical"] in chip.inner_text(), f"confirm chip shows {typo['text']!r} -> {typo['canonical']!r}")
                page.screenshot(path=str(SHOTS / "19_autocorrect_confirm.png"))
                page.locator("#answerInput").press_sequentially("x")
                check(not chip.is_visible(), "editing the text clears the chip")
                page.fill("#answerInput", typo["text"])
                page.wait_for_timeout(320)
                page.keyboard.press("Enter")
                page.wait_for_timeout(150)
                check(chip.is_visible() and gstate(page)["phase"] == "ANSWERING", "after an edit, the typo needs confirming again")
                page.wait_for_timeout(320)
                page.keyboard.press("Enter")
                wait_phase(page, "REVEAL")
                check(gstate(page)["score"] == before + typo["points"], f"second submit confirms and scores +{typo['points']}")
                tested = True
                break
            ans = answer_for(page, ["chalk"])
            page.fill("#answerInput", ans["text"])
            page.keyboard.press("Enter")
            wait_phase(page, "REVEAL")
            page.wait_for_timeout(500)
            page.click("#nextBtn")
        check(tested, "found a typo the validator corrects in this drive")
        ctx.close()

        # ---------------- Sprite sheet (review only; nothing shipped) ----------------
        print("\n[sprite sheet]")
        ctx, page = new_page(browser, logs, viewport={"width": 1100, "height": 900})
        page.goto(URL)
        page.wait_for_function("window.GRONKILLION")
        page.evaluate(SHEET_JS)
        page.wait_for_timeout(200)
        page.screenshot(path=str(SHOTS / "21_sprite_sheet.png"), full_page=True)
        check(page.evaluate("GRONK_SPRITES.names().length") >= 25, "sprite sheet renders every sprite")
        ctx.close()

        # ---------------- localStorage unavailable ----------------
        print("\n[storage disabled]")
        ctx, page = new_page(browser, logs, viewport={"width": 1280, "height": 800})
        ctx.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } });")
        page.goto(URL)
        page.wait_for_function("window.GRONKILLION")
        check(page.locator("#storageNote").is_visible(), "storage-disabled note shown")
        page.click("#unlimitedBtn")
        wait_phase(page, "ANSWERING", 8000)
        ans = answer_for(page, ["chalk"])
        page.fill("#answerInput", ans["text"])
        page.keyboard.press("Enter")
        wait_phase(page, "REVEAL")
        check(gstate(page)["score"] == ans["points"], "playable without storage")
        ctx.close()

        # ---------------- Reduced motion + sound toggle ----------------
        print("\n[reduced motion + sound]")
        ctx, page = new_page(browser, logs, viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
        page.goto(URL)
        page.wait_for_function("window.GRONKILLION")
        check(page.get_attribute("#soundBtn", "aria-pressed") == "false", "sound muted by default")
        page.click("#soundBtn")
        check(page.get_attribute("#soundBtn", "aria-pressed") == "true", "sound toggles on")
        page.click("#unlimitedBtn")
        wait_phase(page, "ANSWERING", 8000)
        ans = answer_for(page, ["gronkillion", "hall_of_famer", "all_pro"])
        page.fill("#answerInput", ans["text"])
        page.keyboard.press("Enter")
        wait_phase(page, "REVEAL")
        page.wait_for_timeout(300)
        check(page.locator("#reveal").is_visible(), "reveal works with reduced motion")
        check(page.evaluate("document.getAnimations().length") == 0, "reduced motion: no running animations on the reveal")
        page.screenshot(path=str(SHOTS / "14_reveal_reduced.png"))
        # leave mid-game via brand button -> confirm dialog
        page.click("#nextBtn")
        wait_phase(page, "ANSWERING", 8000)
        page.click("#brandBtn")
        page.wait_for_selector("#confirmDialog[open]")
        page.screenshot(path=str(SHOTS / "15_confirm.png"))
        page.click("#confirmOk")
        wait_phase(page, "HOME")
        check(page.locator("#resumeBox").is_visible(), "leaving mid-game keeps a resumable drive")
        page.click("#howBtn")
        page.wait_for_selector("#howDialog[open]")
        page.screenshot(path=str(SHOTS / "16_how.png"))
        ctx.close()

        browser.close()

    real = [l for l in logs if "ERR_TUNNEL" not in l and "Failed to load resource" not in l]
    print("\nconsole warnings/errors:", real or "none")
    if real:
        problems.append("console errors")
    print(f"\n{len(problems)} problem(s)")
    for pr in problems:
        print(" -", pr)
    sys.exit(1 if problems else 0)

main()
