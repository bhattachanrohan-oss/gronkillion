"""Validation + data-integrity checks run inside headless Chromium."""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = (Path(__file__).resolve().parent.parent / "index.html").as_uri()

CASES = [
    # (question id, input, expected kind, expected canonical or None)
    ("superbowl_mvp", "tom brady", "accepted", "Tom Brady"),
    ("superbowl_mvp", "  TOM   BRADY  ", "accepted", "Tom Brady"),
    ("superbowl_mvp", "BRADY", "accepted", "Tom Brady"),
    ("superbowl_mvp", "Tom Brady.", "accepted", "Tom Brady"),
    ("superbowl_mvp", "TB12", "accepted", "Tom Brady"),
    ("superbowl_mvp", "Mahomes", "accepted", "Patrick Mahomes"),
    ("superbowl_mvp", "patrick mahomes ii", "accepted", "Patrick Mahomes"),
    ("superbowl_mvp", "Manning", "ambiguous", None),
    ("superbowl_mvp", "Eli", "accepted", "Eli Manning"),
    ("superbowl_mvp", "dexter jackson", "accepted", "Dexter Jackson"),
    ("superbowl_mvp", "Jackson", "ambiguous", None),
    ("superbowl_mvp", "Joe Flaco", "accepted", "Joe Flacco"),
    ("superbowl_mvp", "Josh Allen", "nonqualifying", None),
    ("superbowl_mvp", "Allen", "ambiguous", None),
    ("superbowl_mvp", "Kenneth Walker", "accepted", "Kenneth Walker III"),
    ("superbowl_mvp", "Kenneth Walker III", "accepted", "Kenneth Walker III"),
    ("superbowl_mvp", "ken walker", "accepted", "Kenneth Walker III"),
    ("superbowl_mvp", "Brady Tom", "accepted", "Tom Brady"),
    ("superbowl_mvp", "qwerty", "unrecognized", None),
    ("superbowl_mvp", "", "empty", None),
    ("superbowl_mvp", "Tom", "unrecognized", None),
    ("superbowl_mvp", "Smith", "ambiguous", None),
    ("superbowl_mvp", "Emmit Smith", "accepted", "Emmitt Smith"),
    ("superbowl_mvp", "Ottis Anderson", "accepted", "Ottis Anderson"),
    ("award_mvp", "LT", "ambiguous", None),
    ("award_mvp", "Lawrence Taylor", "accepted", "Lawrence Taylor"),
    ("award_mvp", "Y.A. Tittle", "accepted", "Y.A. Tittle"),
    ("award_mvp", "ya tittle", "accepted", "Y.A. Tittle"),
    ("award_mvp", "Y. A. Tittle", "accepted", "Y.A. Tittle"),
    ("award_mvp", "OJ", "accepted", "O.J. Simpson"),
    ("award_mvp", "o.j. simpson", "accepted", "O.J. Simpson"),
    ("award_mvp", "Van Brocklin", "accepted", "Norm Van Brocklin"),
    ("award_mvp", "Jerry Rice", "nonqualifying", None),
    ("def_dpoy", "Watt", "ambiguous", None),
    ("def_dpoy", "JJ Watt", "accepted", "J.J. Watt"),
    ("def_dpoy", "J.J. Watt", "accepted", "J.J. Watt"),
    ("def_dpoy", "t.j. watt", "accepted", "T.J. Watt"),
    ("def_dpoy", "Woodson", "ambiguous", None),
    ("def_dpoy", "Deion", "accepted", "Deion Sanders"),
    ("def_dpoy", "Prime Time", "accepted", "Deion Sanders"),
    ("def_dpoy", "Mean Joe Greene", "accepted", "Joe Greene"),
    ("def_dpoy", "Pat Surtain", "accepted", "Patrick Surtain II"),
    ("def_dpoy", "Polamalu", "accepted", "Troy Polamalu"),
    ("def_dpoy", "Von Miller", "nonqualifying", None),
    ("wr_100_rec_td", "Jim Brown", "nonqualifying", None),
    ("wr_100_rec_td", "Tim Brown", "accepted", "Tim Brown"),
    ("wr_100_rec_td", "Tim Browne", "accepted", "Tim Brown"),
    ("wr_100_rec_td", "Marvin Harrison Jr.", "nonqualifying", None),
    ("wr_100_rec_td", "Marvin Harrison", "accepted", "Marvin Harrison"),
    ("wr_100_rec_td", "Gronk", "unrecognized", None),
    ("wr_100_rec_td", "Rob Gronkowski", "nonqualifying", None),
    ("wr_yards_champs", "Ja'Marr Chase", "accepted", "Ja'Marr Chase"),
    ("wr_yards_champs", "Ja’Marr Chase", "accepted", "Ja'Marr Chase"),
    ("wr_yards_champs", "jamarr chase", "accepted", "Ja'Marr Chase"),
    ("wr_yards_champs", "Smith-Njigba", "accepted", "Jaxon Smith-Njigba"),
    ("wr_yards_champs", "JSN", "accepted", "Jaxon Smith-Njigba"),
    ("wr_yards_champs", "Steve Smith", "accepted", "Steve Smith Sr."),
    ("wr_yards_champs", "Johnson", "ambiguous", None),
    ("wr_yards_champs", "Ochocinco", "accepted", "Chad Johnson"),
    ("wr_yards_champs", "TY Hilton", "accepted", "T.Y. Hilton"),
    ("te_hall_of_fame", "Kellen Winslow", "accepted", "Kellen Winslow"),
    ("te_hall_of_fame", "Kellen Winslow II", "nonqualifying", None),
    ("te_hall_of_fame", "Kellen Winslow Jr.", "nonqualifying", None),
    ("te_hall_of_fame", "Ghost", "ambiguous", None),
    ("te_six_pro_bowls", "Kelce", "accepted", "Travis Kelce"),
    ("te_six_pro_bowls", "Steve Jordan", "accepted", "Steve Jordan"),
    ("franchise_never_won", "BUF", "accepted", "Buffalo Bills"),
    ("franchise_never_won", "bills", "accepted", "Buffalo Bills"),
    ("franchise_never_won", "Buffalo Bills", "accepted", "Buffalo Bills"),
    ("franchise_never_won", "Jets", "nonqualifying", None),
    ("franchise_never_won", "New York", "nonqualifying", None),
    ("franchise_never_won", "Los Angeles", "ambiguous", None),
    ("franchise_never_won", "LA", "ambiguous", None),
    ("franchise_never_won", "LA Chargers", "accepted", "Los Angeles Chargers"),
    ("franchise_never_won", "San Diego Chargers", "accepted", "Los Angeles Chargers"),
    ("franchise_never_won", "Oilers", "accepted", "Tennessee Titans"),
    ("franchise_never_won", "Bengels", "accepted", "Cincinnati Bengals"),
    ("franchise_never_won", "KC", "nonqualifying", None),
    ("franchise_multi_sb", "Niners", "accepted", "San Francisco 49ers"),
    ("franchise_multi_sb", "SF", "accepted", "San Francisco 49ers"),
    ("franchise_multi_sb", "Redskins", "accepted", "Washington Commanders"),
    ("franchise_multi_sb", "Baltimore Colts", "accepted", "Indianapolis Colts"),
    ("franchise_multi_sb", "Baltimore", "accepted", "Baltimore Ravens"),
    ("franchise_multi_sb", "New York", "ambiguous", None),
    ("franchise_multi_sb", "Jets", "nonqualifying", None),
    ("franchise_afl", "New York Titans", "accepted", "New York Jets"),
    ("franchise_afl", "Titans", "accepted", "Tennessee Titans"),
    ("franchise_afl", "Dallas Texans", "accepted", "Kansas City Chiefs"),
    ("franchise_afl", "Texans", "nonqualifying", None),
    ("stadium_sb_host", "Superdome", "accepted", None),
    ("stadium_sb_host", "the superdome", "accepted", None),
    ("stadium_sb_host", "Joe Robbie Stadium", "accepted", None),
    ("stadium_sb_host", "AT&T Stadium", "accepted", None),
    ("stadium_sb_host", "ATT Stadium", "accepted", None),
    ("stadium_sb_host", "Levis Stadium", "accepted", None),
    ("stadium_sb_host", "Mercedes-Benz", "ambiguous", None),
    ("stadium_sb_host", "Lambeau Field", "nonqualifying", None),
    ("stadium_sb_host", "US Bank Stadium", "accepted", None),
    ("stadium_sb_host", "U.S. Bank Stadium", "accepted", None),
    ("stadium_three_sb", "Levi's Stadium", "nonqualifying", None),
    ("draft_host_cities", "Dallas", "accepted", "Arlington"),
    ("draft_host_cities", "Philly", "accepted", "Philadelphia"),
    ("draft_host_cities", "New York", "nonqualifying", None),
    ("draft_qb_first_overall", "Young", "ambiguous", None),
    ("draft_qb_first_overall", "Bryce Young", "accepted", "Bryce Young"),
    ("draft_qb_first_overall", "Steve Young", "nonqualifying", None),
    ("draft_qb_first_overall", "Mendoza", "accepted", "Fernando Mendoza"),
    ("draft_non_qb_first_overall", "Too Tall Jones", "accepted", 'Ed "Too Tall" Jones'),
    ("draft_non_qb_first_overall", "Ed Too Tall Jones", "accepted", 'Ed "Too Tall" Jones'),
    ("draft_non_qb_first_overall", "Bo", "accepted", "Bo Jackson"),
    ("rb_2000_season", "CJ2K", "accepted", "Chris Johnson"),
    ("rb_2000_season", "Earl Campbell", "nonqualifying", None),
    ("rb_rushing_champs", "MJD", "accepted", "Maurice Jones-Drew"),
    ("rb_rushing_champs", "Jones-Drew", "accepted", "Maurice Jones-Drew"),
    ("rb_rushing_champs", "Zeke", "accepted", "Ezekiel Elliott"),
    ("rb_rushing_champs", "Cook", "ambiguous", None),
    ("qb_400_td", "Roethlisburger", "accepted", "Ben Roethlisberger"),
    ("qb_400_td", "Big Ben", "accepted", "Ben Roethlisberger"),
    ("qb_400_td", "Manning", "ambiguous", None),
    ("qb_400_td", "Peyton", "accepted", "Peyton Manning"),
    ("qb_400_td", "Phillip Rivers", "accepted", "Philip Rivers"),
    ("superbowl_winning_coach", "Harbaugh", "ambiguous", None),
    ("superbowl_winning_coach", "Big Tuna", "accepted", "Bill Parcells"),
    ("superbowl_winning_coach", "Mike McDonald", "accepted", "Mike Macdonald"),
    ("superbowl_winning_coach", "Kyle Shanahan", "nonqualifying", None),
    ("playoff_sb_losing_coach", "Shanahan", "ambiguous", None),
    ("playoff_sb_losing_coach", "Marv Levy", "accepted", "Marv Levy"),
    ("award_droy", "Bosa", "ambiguous", None),
    ("award_droy", "Sauce Gardner", "accepted", "Sauce Gardner"),
    ("award_droy", "Will Anderson", "accepted", "Will Anderson Jr."),
    ("award_oroy", "OBJ", "accepted", "Odell Beckham Jr."),
    ("award_oroy", "Odell Beckham", "accepted", "Odell Beckham Jr."),
    ("award_oroy", "RG3", "accepted", "Robert Griffin III"),
    ("award_oroy", "CJ Stroud", "accepted", "C.J. Stroud"),
    ("award_oroy", "Tetairoa McMillan", "accepted", "Tetairoa McMillan"),
]

def main():
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        logs = []
        page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
        page.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
        page.goto(URL)
        page.wait_for_function("window.GRONKILLION")
        info = page.evaluate("""() => {
          const G = window.GRONKILLION;
          return {
            count: G.questions.length,
            cats: G.categories,
            perQ: G.questions.map(q => [q.id, q.category, q.difficulty, q.answers.length]),
            shape: Object.keys(G.questions[0]).concat(Object.keys(G.questions[0].answers[0])),
            dailyA: G.dailyQuestionIds('2026-11-05'),
            dailyA2: G.dailyQuestionIds('2026-11-05'),
            dailyB: G.dailyQuestionIds('2026-11-06'),
            dailyCats: G.dailyQuestionIds('2026-11-05').map(id => G.questions.find(q => q.id === id).category)
          };
        }""")
        print(f"questions: {info['count']}  categories: {len(info['cats'])}")
        for row in info["perQ"]:
            print("  ", row)
        print("runtime shape keys:", info["shape"])
        print("daily 2026-11-05:", info["dailyA"])
        assert info["dailyA"] == info["dailyA2"], "daily selection not deterministic"
        assert info["dailyA"] != info["dailyB"], "daily selection identical on two dates"
        assert len(set(info["dailyCats"])) == 7, "daily repeats a category"
        assert info["count"] >= 35
        no_gronk = page.evaluate("window.GRONKILLION.questions.filter(q => !q.answers.some(a => a.rarity === 'gronkillion')).map(q => q.id)")
        print("questions without a 100-point answer:", no_gronk or "none")
        assert not no_gronk, "a perfect 700 must be possible for every question set"
        for qid, text, kind, canon in CASES:
            r = page.evaluate("([q,t]) => { const r = window.GRONKILLION.validate(q,t); return {kind:r.kind, canonical: r.answer ? r.answer.canonical : null, name: r.name || null, note: r.note || null}; }", [qid, text])
            ok = r["kind"] == kind and (canon is None or r["canonical"] == canon)
            if not ok:
                failures.append((qid, text, kind, canon, r))
        warn = [l for l in logs if l.startswith(("warning", "error", "pageerror"))]
        print("console warnings/errors:", warn or "none")
        browser.close()
    print(f"\n{len(CASES) - len(failures)}/{len(CASES)} validation cases passed")
    for f in failures:
        print("FAIL", f)
    sys.exit(1 if failures else 0)

main()
