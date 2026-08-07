// Curated, human-checked verse bank (NIV wording). Steward quotes only from
// this list — chat/interview system prompts are told never to cite or
// paraphrase a verse that isn't shown here, so the model can't fabricate a
// reference from its own (unreliable) training memory.
export const VERSES = [
  "Ephesians 5:25 — Husbands, love your wives, just as Christ loved the church and gave himself up for her.",
  "Proverbs 29:25 — Fear of man will prove to be a snare, but whoever trusts in the Lord is kept safe.",
  "Philippians 4:8 — Finally, brothers and sisters, whatever is true, whatever is noble, whatever is right, whatever is pure, whatever is lovely, whatever is admirable—if anything is excellent or praiseworthy—think about such things.",
  "Colossians 3:17 — And whatever you do, whether in word or deed, do it all in the name of the Lord Jesus, giving thanks to God the Father through him.",
  "Proverbs 27:12 — The prudent see danger and take refuge, but the simple keep going and pay the penalty.",
  "Proverbs 6:6-8 — Go to the ant, you sluggard; consider its ways and be wise! It has no commander, no overseer or ruler, yet it stores its provisions in summer and gathers its food at harvest.",
  "Proverbs 16:3 — Commit your work to the Lord, and your plans will be established.",
  "Proverbs 21:5 — The plans of the diligent lead to profit as surely as haste leads to poverty.",
  "Proverbs 22:29 — Do you see someone skilled in their work? They will serve before kings; they will not serve before officials of low rank.",
  "Ecclesiastes 9:10 — Whatever your hand finds to do, do it with all your might.",
  "Colossians 3:23 — Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.",
  "Proverbs 24:27 — Put your outdoor work in order and get your fields ready; after that, build your house.",
  "Luke 14:28 — Suppose one of you wants to build a tower. Won't you first sit down and estimate the cost to see if you have enough money to complete it?",
  "Proverbs 15:22 — Plans fail for lack of counsel, but with many advisers they succeed.",
  "James 1:22 — Do not merely listen to the word, and so deceive yourselves. Do what it says.",
  "Galatians 6:9 — Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.",
  "Proverbs 13:4 — A sluggard's appetite is never filled, but the desires of the diligent are fully satisfied.",
  "Proverbs 12:24 — Diligent hands will rule, but laziness ends in forced labor.",
  "1 Corinthians 10:31 — So whether you eat or drink or whatever you do, do it all for the glory of God.",
  "Proverbs 3:5-6 — Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.",
  "Joshua 1:9 — Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.",
  "Philippians 4:6-7 — Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.",
  "James 1:19 — Everyone should be quick to listen, slow to speak and slow to become angry.",
  "Proverbs 15:1 — A gentle answer turns away wrath, but a harsh word stirs up anger.",
  "Ephesians 4:29 — Do not let any unwholesome talk come out of your mouths, but only what is helpful for building others up according to their needs.",
  "Proverbs 27:17 — As iron sharpens iron, so one person sharpens another.",
  "1 Corinthians 13:4-7 — Love is patient, love is kind. It does not envy, it does not boast, it is not proud.",
  "Proverbs 31:11-12 — Her husband has full confidence in her and lacks nothing of value. She brings him good, not harm, all the days of her life.",
  "Malachi 2:14 — She is your partner, the wife of your marriage covenant.",
  "Genesis 2:24 — That is why a man leaves his father and mother and is united to his wife, and they become one flesh.",
  "Proverbs 18:22 — He who finds a wife finds what is good and receives favor from the Lord.",
  "Proverbs 22:6 — Start children off on the way they should go, and even when they are old they will not turn from it.",
  "Deuteronomy 6:6-7 — These commandments that I give you today are to be on your hearts. Impress them on your children.",
  "Psalm 127:1 — Unless the Lord builds the house, the builders labor in vain.",
  "Proverbs 11:14 — For lack of guidance a nation falls, but victory is won through many advisers.",
  "Proverbs 16:9 — In their hearts humans plan their course, but the Lord establishes their steps.",
  "Habakkuk 2:2 — Write down the revelation and make it plain on tablets so that a herald may run with it.",
  "Proverbs 24:3-4 — By wisdom a house is built, and through understanding it is established; through knowledge its rooms are filled with rare and beautiful treasures.",
  "Matthew 6:33 — But seek first his kingdom and his righteousness, and all these things will be given to you as well.",
  "Romans 12:2 — Do not conform to the pattern of this world, but be transformed by the renewing of your mind.",
  "1 Timothy 4:12 — Don't let anyone look down on you because you are young, but set an example for the believers in speech, in conduct, in love, in faith and in purity.",
  "Proverbs 10:4 — Lazy hands make for poverty, but diligent hands bring wealth.",
  "Nehemiah 4:6 — So we rebuilt the wall till all of it reached half its height, for the people worked with all their heart.",
  "Proverbs 27:23 — Be sure you know the condition of your flocks, give careful attention to your herds.",
  "2 Timothy 1:7 — For the Spirit God gave us does not make us timid, but gives us power, love and self-discipline.",
  "Psalm 90:12 — Teach us to number our days, that we may gain a heart of wisdom.",
  "James 4:13-15 — Instead, you ought to say, 'If it is the Lord's will, we will live and do this or that.'",
  "Proverbs 20:18 — Plans are established by seeking advice; so if you wage war, obtain guidance.",
  "1 Corinthians 9:26-27 — I do not run like someone running aimlessly; I do not fight like a boxer beating the air. No, I strike a blow to my body and make it my slave.",
];

// References that assume a specific relationship the reader may not have.
// The daily rotation below has no judgment call the way chat does (it never
// "decides" a verse fits) — so verses tagged here are excluded unless the
// user's profile actually matches, same rule Home.tsx's seasonCategory()
// already applies to journal prompts.
const MARRIAGE_ONLY_REFS = new Set([
  "Ephesians 5:25",
  "Proverbs 31:11-12",
  "Malachi 2:14",
  "Genesis 2:24",
  "Proverbs 18:22",
]);
const PARENTING_ONLY_REFS = new Set(["Proverbs 22:6", "Deuteronomy 6:6-7"]);

function verseRef(verse: string): string {
  return verse.split(" — ")[0]!;
}

interface RelationshipLike {
  type?: string | null;
}

interface VerseProfileContext {
  season_of_life?: string | null;
  relationships?: RelationshipLike[];
}

function isMarried(profile: VerseProfileContext | null): boolean {
  const season = (profile?.season_of_life || "").toLowerCase();
  return season.includes("married") || Boolean(profile?.relationships?.some((r) => /spouse|wife|husband/i.test(r.type || "")));
}

function hasKids(profile: VerseProfileContext | null): boolean {
  const season = (profile?.season_of_life || "").toLowerCase();
  return (
    /father|mother|parent|\bkids?\b|\bchild/.test(season) ||
    Boolean(profile?.relationships?.some((r) => /child|son|daughter/i.test(r.type || "")))
  );
}

export function getVerseOfTheDay(profile: VerseProfileContext | null = null): string {
  const married = isMarried(profile);
  const kids = hasKids(profile);
  const pool = VERSES.filter((v) => {
    const ref = verseRef(v);
    if (MARRIAGE_ONLY_REFS.has(ref) && !married) return false;
    if (PARENTING_ONLY_REFS.has(ref) && !kids) return false;
    return true;
  });

  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return pool[dayOfYear % pool.length]!;
}

export const SCRIPTURE_GROUNDING = `## Approved verses
When Scripture fits naturally, quote VERBATIM from this list only — never cite, paraphrase, or invent a reference that isn't here. If nothing here fits the moment, skip Scripture rather than reaching.
${VERSES.map((v) => `- ${v}`).join("\n")}`;
