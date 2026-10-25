# oracle-bone · 史读

An interface for reading the Chinese standard histories, starting with 史记.

The first set is the 秦汉之际 cluster:

- 卷七 项羽本纪
- 卷八 高祖本纪
- 卷四十八 陈涉世家
- 卷五十五 留侯世家
- 卷九十二 淮阴侯列传

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

**Settings.** The top bar switches the following:

- Edition: 殿本, 金陵本, or 对照 (both).
- Form: 卷轴 or 线装.
- Script: 简 or 繁.
- Punctuation: none (白文), 句读 circles, or full modern punctuation set in vertical forms.
- Commentary: each of 集解, 索隐 and 正义 can be shown or hidden, each in its own colour. The 殿本 考证 is moved from the end of the chapter to the words it discusses. The 索隐述赞 can also be toggled. The notes can sit in the text as 双行小注 (夹注) or as coloured dots that open in the side panel (点记). The ? button explains each commentary.
- Typeface: 楷 (霞鹜文楷) or 宋.

Settings persist in the browser. Positions can be linked as `#shiji-7/7.16.6` (chapter, then sentence).

**Context layers.** The left panel and the bottom strip hold the context layers:

- 舆图: a map of the period. It marks the states of the current year at their capitals, coloured by side, and the places named around the passage. The geography is that of about 200 BC: the 河 on its Western Han course, the 淮 running straight to the sea, the 泗, 睢 and 鸿沟, the marshes of the time (大野泽, 云梦泽, 彭蠡泽 and others), and the old coast of 苏北, the 长江 mouth and 渤海, with today's coast dashed. The map can be enlarged to fill the reading area.
- 人物: who is on stage now, and a card for each person. The card gives 名, 字, side, and the title they held in the current year. It also gives their age (虚岁) at the current date and every mention in the chapter.
- 对读: the same event as told in 史记, 汉书 and 资治通鉴, set side by side, with a line showing which books and chapters tell it. Each event is anchored by hand to a sentence in each book. The build then widens every account over the neighbouring paragraphs that share enough wording with the 史记 account, and adds paragraphs elsewhere that retell it (marked 同文). Wording that differs from the chapter being read is marked, with the share of shared wording.
- 校勘: every place where 殿本 and 金陵本 differ. Each is classed as 异文, 形近, 避讳 or 异体.
- 注: the full commentary at a point, next to the other edition's note at the same place.
- 时间轴: runs right to left like the text. It shows events from 博浪沙 (前218) to 前195, the current date, and the life spans of the people in the passage.

Dates use the 秦/汉初 calendar, in which the year begins in the tenth month. 汉元年十月 therefore falls in the winter of 前207.

## Editions and sources

| | Text | Source | Licence |
|---|---|---|---|
| 殿本 | 清乾隆四年武英殿本《史记》, as copied into the 文渊阁四库全书, with the 考证 | [gujilab/chinese-classical-corpus](https://huggingface.co/datasets/gujilab/chinese-classical-corpus) | CC0 1.0 |
| 金陵本 | 清同治金陵书局本《史记集解索隐正义》, the 底本 of the 中华书局点校本, with the 点校本's punctuation | [维基文库《史記三家註》](https://zh.wikisource.org/wiki/史記三家註) | CC BY-SA 4.0 |
| 汉书 | 卷一、三十一、三十四、四十 | 维基文库 | CC BY-SA 4.0 |
| 资治通鉴 | 卷七至十二 | 维基文库 | CC BY-SA 4.0 |
| Base map | land, coastline, rivers, lakes | [Natural Earth](https://www.naturalearthdata.com/) | public domain |
| Portraits | 清上官周《晚笑堂竹庄画传》, 明《新镌绘像东西汉全传》, 《三才图会》 and others, via Wikimedia Commons (`data/portraits.json` lists each) | Wikimedia Commons | public domain |

The 四库 transcription is simplified and unpunctuated. Its traditional forms are taken from the aligned 金陵本 character wherever the two editions agree, and from OpenCC elsewhere. Where the transcription has a placeholder or a private-use character, the 金陵本 character is restored and marked.

The 金陵本 text keeps the 金陵本's own readings. Characters the 点校本 deletes stay in the text, circled. Characters the 点校本 adds become notes.

The people, places, events and yearly state lists in `data/` were compiled for this project from the 史记 and 汉书. Most birth years are worked out from statements in the text, and the person card gives the reasoning. Place coordinates are approximate locations of the ancient city or the later seat.

## Data pipeline

The site reads only the JSON in `static/data/`, which is committed. To rebuild it:

```sh
npm run fetch      # download the sources into sources/ (skips what is already there)
npm run data       # build static/data/ from sources/ and data/
```

| File | What it does |
|---|---|
| `pipeline/fetch.mjs` | Downloads the 四库 corpus and Natural Earth into `sources/cache/` (not committed). It extracts the five chapters to `sources/siku/` and fetches Wikisource pages to `sources/wikisource/`. |
| `pipeline/siku.mjs` | Splits the 四库 text into main text, 三家注 and 考证. |
| `pipeline/wikitext.mjs` | Parses the Wikisource markup, including the 点校本's deletions and additions. |
| `pipeline/text.mjs` | Aligns the two editions character by character, then restores placeholders, classifies variants and anchors notes and 考证. It also cuts the text into sentences. |
| `pipeline/build.mjs` | Tags people and places, finds dates in the text and anchors every event to its passage in each book. It writes the chapter, catalogue and context files. |
| `pipeline/geo.mjs` | Clips and simplifies the base map, gives the rivers their classical names, and redraws the rivers, marshes and coast of about 200 BC. |
| `pipeline/portraits.mjs` | Finds a public-domain portrait for each person on Wikimedia Commons and records where it came from. |
| `data/*.json` | Hand-compiled people, places, events, states by year, and edition descriptions. |

`npm run data` fails if any event's passage can no longer be found in a text, so edits to `data/events.json` are checked against the books.

## Layout of the code

| Path | What it holds |
|---|---|
| `src/lib/layout.ts` | Lays a chapter out on a grid of vertical columns: main text, 双行小注, 句读 and punctuation cells. |
| `src/lib/components/Scroll.svelte`, `Book.svelte` | The two reading forms. |
| `src/lib/components/*Panel.svelte`, `Timeline.svelte` | The context layers. |
| `src/lib/reading.svelte.ts` | Works out what the current position means: its event, its date, and the people and places nearby. |
| `src/lib/state.svelte.ts` | Settings and the reading position, plus the calendar helpers. |
