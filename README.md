# oracle-bone · 史读

An interface for reading the Chinese histories. Three books are on the shelf, each with a first set of chapters around one period:

| Book | Period | Chapters |
|---|---|---|
| 史记 | 秦汉之际 | 卷七 项羽本纪, 卷八 高祖本纪, 卷四十八 陈涉世家, 卷五十五 留侯世家, 卷九十二 淮阴侯列传 |
| 三国志 (with 裴松之注) | 赤壁三分 | 卷一 武帝纪, 卷三十二 先主传, 卷三十五 诸葛亮传, 卷四十七 吴主传, 卷五十四 周瑜鲁肃吕蒙传 |
| 春秋 (经 with 左传; 公羊 and 穀梁 beside it) | 晋文之霸 | 注疏本卷一 (隐公元年至二年), 卷十四至十六 (僖公二十二年至三十三年) |

The brand in the top bar opens the 书架 to change book; each book reopens at the chapter last read.

The text is set vertically, right to left. It can be shown as a handscroll (卷轴) or as the leaves of a 线装 book cut to each edition's own 行款, with the 版心 in the middle. Two editions can be read side by side. Around the text sit four context layers that follow the passage you are reading.

## Running it

```sh
npm install
npm run dev        # http://localhost:5173
```

`npm run build` writes a static site to `build/`, which any static file server can serve. The build is a single-page app with relative data paths and no server code, so it can be wrapped in Tauri as is. To do that, point Tauri's `frontendDist` at `build/` and its `devUrl` at the dev server.

## What is on screen

**Text.** The reader shows these marks on the text:

- 专名线: a straight line beside person names and a dashed one beside place names.
- An orange bar beside characters where the two editions differ, and a wedge where the other edition has extra characters.
- 缺笔 marks on characters the 殿本 cut without their last stroke, to avoid 清 emperors' names.
- Marks on characters restored where the 四库 transcription has a gap.
- The 点校本's deletions and additions on the 金陵本 text.
- 春秋: 经 and 传 each start with their name cut in 阴文, as the 注疏 editions print them. Clicking a 经 mark opens the 三传 panel.
- 三国志: where a 卷 holds several lives (周瑜、鲁肃、吕蒙), each begins under its own heading.

**Settings.** The top bar switches the following:

- Edition: each book's two editions, or 对照 (both). 史记: 殿本 and 金陵本. 三国志: 殿本 and 中华书局点校本. 春秋: 四库本 and 阮刻十三经注疏本.
- 春秋 only: 经传 together, 经 alone, or 传 alone.
- Form: 卷轴 or 线装.
- Script: 简 or 繁.
- Punctuation: none (白文), 句读 circles, or full modern punctuation set in vertical forms.
- Commentary: each commentary can be shown or hidden, each in its own colour: 集解, 索隐, 正义 and 述赞 for the 史记, 裴注 for the 三国志, and 杜注, 音义 and 疏 for the 春秋. The 殿本 考证 is moved from the end of the chapter to the words it discusses. The notes can sit in the text as 双行小注 (夹注) or as coloured dots that open in the side panel (点记). The ? button explains each commentary.
- Typeface: 楷 (霞鹜文楷) or 宋.

**Your own portraits.** Pictures put in `static/portraits-local/` and named after a person's id (`zhuge-liang.png`, or `sanguozhi/zhuge-liang.png` for one book only) replace that person's woodcut. Git ignores the folder, so pictures you don't have the rights to share stay on your machine. See the README in that folder.

Settings persist in the browser. Positions can be linked as `#shiji-7/7.16.6`, `#sanguozhi-54/54.16.1` or `#chunqiu-15/15.1.1` (chapter, then sentence).

**Context layers.** The left panel and the bottom strip hold the context layers:

- 舆图: a map of the book's period. It shades the land each state held in the current year, coloured by side, with dashed lines where two holders meet; city dots take their holder's colour, and the states are marked at their capitals. Each city's holder year by year is in `data/<book>/territory.json`, written by hand from the histories; the shaded areas are drawn along the lie of the land: each held city spreads over a 0.05° terrain grid until it meets another's, slowed by slopes, high ground, river crossings and marshes, so borders fall on ridges and rivers (`pipeline/terrain.mjs`). Names are placed so that none overlaps another, the passage's places first. It also marks the places named around the passage. Each book has its own map. 史记: about 200 BC, with the 河 on its Western Han course, the 泗, 睢 and 鸿沟, and the 大野、云梦、彭蠡 marshes. 三国志: the 东汉 河 after 王景's works, the 汴渠 and 白沟, a smaller 云梦泽. 春秋: the 河 on its northern course to the sea near today's 天津, no 鸿沟, the larger 云梦泽. The old coast is drawn with today's coast dashed. The map can be enlarged to fill the reading area.
- 人物: who is on stage now, and a card for each person. The card gives 名, 字, side, and the title they held in the current year. It also gives their age (虚岁) at the current date and every mention in the chapter. Under 人物关系 it lists what other people were to them, from `data/<book>/relations.json`: kin, lord and vassal, friends and allies, enemies. Each relation is split into phases (英布 is 项羽's general, then his enemy), the phase of the year being read is marked, and a line from the text says where the relation turns. The card also lists who appears in the same passages most often in the chapter.
- 对读: the same event as told in other books, set side by side, with a line showing which books and chapters tell it. 史记 is read against 汉书 and 资治通鉴; 三国志 against 后汉书 and 资治通鉴; 左传 against the 史记 (秦本纪, 晋世家, 楚世家, 郑世家) and 国语·晋语四. Each event is anchored by hand to a sentence in each book. The build then grows every account sentence by sentence, for as long as the next sentences share enough wording with the other books' accounts of the event, and adds sentences elsewhere that retell it closely (marked 同文). A sentence belongs to one event only, and an account in a long 通鉴 or 后汉书 paragraph shows just its own sentences, with …… where the paragraph goes on. The 左传 is the exception: its accounts keep the whole 传 entry. Wording that differs from the chapter being read is marked, with the share of shared wording.
- 三传 (春秋 only): each 经 entry of the year, with whether and where the 左传 tells it, and the 公羊 and 穀梁 readings. Words where their 经 text differs from the 左氏 one are marked.
- 校勘: every place where the two editions differ. Each is classed as 异文, 形近, 避讳 or 异体.
- 注: the full commentary at a point, next to the other edition's note at the same place. For the 三国志, each 裴注 passage is labelled with the book it quotes, and the panel lists the books this chapter's 裴注 quotes, with every passage from each.
- 时间轴: runs right to left like the text. It shows the book's events, the current date, and the life spans of the people in the passage. The chapter's events are titled in up to three rows; each title hangs to the left of its own line down to its dot, and no title covers another or another's line.

Each book keeps its own calendar. 史记: the 秦/汉初 calendar, in which the year begins in the tenth month, so 汉元年十月 falls in the winter of 前207. 三国志: 年号, with the other courts' years alongside (黄武五年 · 魏黄初七年 · 蜀建兴四年). 春秋: the years of the 鲁 dukes in the 周正, whose first month falls around December of the year before, with the years of the states whose people are on stage.

## Editions and sources

| | Text | Source | Licence |
|---|---|---|---|
| 史记 殿本 | 清乾隆四年武英殿本《史记》, as copied into the 文渊阁四库全书, with the 考证 | [gujilab/chinese-classical-corpus](https://huggingface.co/datasets/gujilab/chinese-classical-corpus) | CC0 1.0 |
| 史记 金陵本 | 清同治金陵书局本《史记集解索隐正义》, the 底本 of the 中华书局点校本, with the 点校本's punctuation | [维基文库《史記三家註》](https://zh.wikisource.org/wiki/史記三家註) | CC BY-SA 4.0 |
| 三国志 殿本 | 清乾隆四年武英殿本《三国志》, as copied into the 四库全书, with the 考证 | gujilab/chinese-classical-corpus | CC0 1.0 |
| 三国志 点校本 | 中华书局点校本 (1982 second edition), with its punctuation and its deletions and additions | [维基文库《三國志》](https://zh.wikisource.org/wiki/三國志) | CC BY-SA 4.0 |
| 春秋 四库本 | 文渊阁四库全书本《春秋左传注疏》, with the 考证 | [维基文库《春秋左傳注疏 (四庫全書本)》](https://zh.wikisource.org/wiki/春秋左傳注疏_(四庫全書本)) | CC BY-SA 4.0 |
| 春秋 阮刻本 | 清嘉庆阮刻《十三经注疏》本《春秋左传正义》, with modern punctuation | [维基文库《春秋左傳正義》](https://zh.wikisource.org/wiki/春秋左傳正義) | CC BY-SA 4.0 |
| Parallel texts | 汉书 卷一、三十一、三十四、四十; 后汉书 卷九、七十四; 资治通鉴 卷七至十二、六十二至六十九; 史记 卷五、三十九、四十、四十二; 国语 卷十; 春秋左氏传, 公羊传, 穀梁传 (隐公, 僖公) | 维基文库 | CC BY-SA 4.0 |
| Base map | land, coastline, rivers, lakes | [Natural Earth](https://www.naturalearthdata.com/) | public domain |
| Elevation | ETOPO 2022, 1′ grid sampled every 3′, for drawing borders along the terrain | [NOAA ERDDAP](https://upwell.pfeg.noaa.gov/erddap/griddap/etopo180.html) | public domain |
| Portraits | 清上官周《晚笑堂竹庄画传》, 《三才图会》, 传阎立本《历代帝王图》, 清刊《三国演义》 and 《绣像东周列国全志》 绣像, 丁善长《历代画像传》 and others, via Wikimedia Commons (each book's `portraits.json` lists each picture) | Wikimedia Commons | public domain |

The 四库 transcription of the 史记 and 三国志 is simplified and unpunctuated. Its traditional forms are taken from the aligned character of the other edition wherever the two agree, and from OpenCC elsewhere. Where the transcription has a placeholder or a private-use character, the other edition's character is restored and marked, in the main text and in the commentary.

The 金陵本 text keeps the 金陵本's own readings. Characters the 点校本 deletes stay in the text, circled. Characters the 点校本 adds become notes.

The people, places, events and yearly state lists in `data/<book>/` were compiled for this project from the books themselves and their parallels. For the 史记, most birth years are worked out from statements in the text, and the person card gives the reasoning. Place coordinates are approximate locations of the ancient city or the later seat.

## Data pipeline

The site reads only the JSON in `static/data/`, which is committed. To rebuild it:

```sh
npm run fetch      # download the sources into sources/ (skips what is already there)
npm run data       # build static/data/ from sources/ and data/, then the font subsets
```

| File | What it does |
|---|---|
| `pipeline/fetch.mjs` | Downloads the 四库 corpus, Natural Earth and the ETOPO elevation grid into `sources/cache/` (not committed). It extracts the chapters to `sources/siku/` and fetches Wikisource pages to `sources/wikisource/`. |
| `pipeline/books/*.mjs` | One file per book: its chapters, commentaries, calendar, sides, timeline, map and parallels, and how its two editions are read. |
| `pipeline/siku.mjs` | Splits the 四库 text into main text, commentary and 考证. |
| `pipeline/chunqiu.mjs` | Reads the two 注疏 editions into 经, 传 and their notes, and matches each 经 entry with the 公羊 and 穀梁. |
| `pipeline/wikitext.mjs` | Parses the Wikisource markup, including the 点校本's deletions and additions. |
| `pipeline/text.mjs` | Aligns the two editions character by character, then restores placeholders, classifies variants and anchors notes and 考证. It also cuts the text into sentences. |
| `pipeline/build.mjs` | Tags people and places, finds dates in the text and anchors every event to its passage in each book. It writes the chapter, catalogue and context files. |
| `pipeline/geo.mjs` | Clips and simplifies the base map, gives the rivers their classical names, and redraws the rivers, marshes and coast of each period. |
| `pipeline/fonts.mjs` | Downloads 霞鹜文楷 (regular and medium) and cuts each down to the characters the site uses, as `static/fonts/wenkai-*.woff2`. One file per weight replaces about a hundred web-font pieces, so text does not appear piece by piece. Run it (`npm run fonts`) after adding text. |
| `pipeline/terrain.mjs` | Draws each year's holdings as shapes along the terrain: a cost grid from the ETOPO elevation, the land and the period's rivers and marshes; a cheapest-path spread from every held city; then the outline of each holder's cells, smoothed, and the lines where two holders meet. Writes `<book>/territory.json`. |
| `pipeline/portraits.mjs` | `node pipeline/portraits.mjs <book>` finds a public-domain portrait for each person on Wikimedia Commons. The source line for each picture is then checked and written by hand. |
| `data/<book>/*.json` | Hand-compiled people, relations between them, places, events, states by year, who held each place by year (`territory.json`), edition descriptions and portrait sources for each book. |

`npm run data` fails if any event's passage can no longer be found in a text, so edits to `data/<book>/events.json` are checked against the books. `BOOK=chunqiu npm run data` rebuilds one book's chapters and keeps the others as they are.

## Layout of the code

| Path | What it holds |
|---|---|
| `src/lib/layout.ts` | Lays a chapter out on a grid of vertical columns: main text, 双行小注, 句读 and punctuation cells. |
| `src/lib/components/Scroll.svelte`, `Book.svelte` | The two reading forms. |
| `src/lib/components/*Panel.svelte`, `Timeline.svelte` | The context layers. |
| `src/lib/reading.svelte.ts` | Loads the book being read, and works out what the current position means: its event, its date, and the people and places nearby. |
| `src/lib/state.svelte.ts` | Settings and the reading position. |
| `src/lib/dates.ts` | Each book's calendar: era years, months, reign names and ages. |
