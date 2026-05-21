<h1 align="center">
📖 Novel Processor
</h1>
<p align="center">
    English | <a href="./README.md">中文</a>
</p>
<p align="center">
    <em>One-click cleanup for web novels: smart line break, chapter reorder, Trad/Simp conversion, ad removal</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://tools.newzone.top/en/novel-processor"><img src="https://img.shields.io/badge/Live%20Demo-novel--processor-blue" alt="Live Demo"></a>
</p>

**Novel Processor** is a one-stop cleanup tool built for web novels, e-books, and other long-form text. It auto-repairs formatting issues, strips ads, normalizes chapter titles, reorders by chapter index, and optionally does Trad/Simp conversion — turning chaotic novel text into something clean and readable. The entire pipeline runs in your browser; files never leave your machine.

👉 **Try it online**: <https://tools.newzone.top/en/novel-processor>

![Novel Processor interface](./public/novel-processor.png "Novel Processor interface")

## What problems does it solve?

Typical pain points with downloaded novels:

- **Messy layout**: paragraphs not separated, chapters running together, scattered blank lines
- **Ad watermarks**: downloader stamps, group-promotion lines, "split-volume reading" markers
- **Inconsistent format**: mixed Trad/Simp, full-width vs half-width chaos
- **Broken line wrapping**: sentences split mid-line, paragraphs broken at the wrong spots
- **Chapter ordering**: scrambled tables of contents, chapter titles without line breaks

## Key features

- 📝 **Smart Line Break**: detect paragraph boundaries via Chinese punctuation, pure-numeric lines, and special starters; re-merge / re-split.
- 🏷️ **Chapter Formatting**: recognize "第 X 章" / "Chapter N" patterns and normalize; supports chapter reorder.
- 🎨 **Typesetting**: paragraph indent, long-paragraph splitting, whitespace trim, adjacent-duplicate removal.
- 🧹 **Content cleaning**: custom keyword filtering, line-end digit stripping, body-paragraph protection threshold.
- 🔄 **Trad/Simp Conversion**: built-in OpenCC engine for high-precision conversion.
- 🛡️ **Protected Dictionary**: shared with the Chinese Converter — define terms that should NOT be converted.
- 📦 **Batch Processing**: multi-file mode, large-file mode, auto-export option.
- 🌐 **Multi-locale UI**: powered by next-intl, with full UI translation across 18 languages.

## Three primary action buttons

| Button              | Behavior                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Start Process**   | Run the full pipeline: applies every checked option from the right-side config in order                                             |
| **Chapter Split**   | Just one thing — split inline-concatenated chapter titles onto their own lines, nothing else                                        |
| **Chapter Reorder** | Extract chapter index from each title (第十二章, Chapter 5, 第三卷 第四章, …) and re-sort the whole book. Untitled chapters go last |

When done, the result is auto-copied to clipboard and shown in the result card.

## Configuration (right-column three-section Collapse)

### 1. Typesetting (expanded by default)

- **Smart Line Break** (on): re-merge wrap-broken lines based on Chinese punctuation
  - Sub-toggle **Paragraph Indent** (visible only when Smart Line Break is on, default on): add `\t` to each paragraph head
- **Paragraph Split** (off): break long paragraphs into shorter ones via sentence detection (compromise NLP + Chinese punctuation)

### 2. Content Cleaning (collapsed by default)

- **Chapter Title Formatting** (on): recognize "Chapter X" / "第 X 章" patterns and normalize
- **Strip Line-End Digits** (off): remove trailing digits only on lines ≥ 10 chars (avoids stripping years from short titles)
- **Trim Spaces** (on): strip leading/trailing whitespace per line
- **Remove Adjacent Duplicates** (off): drop only **consecutive** duplicate lines (preserves common short dialogue like "嗯" / "好")
- **Special Start Text**: enter the novel title or a recurring header word — matching lines are forced into their own paragraph
- **Filter Words** + **Filter Threshold**:
  - Filter Words: comma-separated keywords (`channel,downloader`) — every matching line gets dropped
  - Filter Threshold: lines longer than N chars are exempt (kept even if they match) — protects body paragraphs. 0 disables the exemption.

### 3. Advanced Settings (collapsed by default)

- **Trad/Simp Conversion** Segmented:
  - **None** → skip this step
  - **Trad → Simp** → uses `tw → cn`
  - **Simp → Trad** → uses `cn → tw`
- **Single-File Mode**: process one file at a time
- **Auto-Export** (visible only in single-file mode): skip preview and download directly

## Protected Dictionary

Bottom-right of the page:

- **Master toggle**: enable / disable all rules
- Shows current s2t / t2s rule counts
- **Manage Rules** button: opens the drawer to add/edit/delete rules, plus batch import/export

The dictionary is shared with the [Chinese Converter](https://github.com/rockbenben/chinese-conversion) (same localStorage key) — edit in one place, applies in both. **Only participates in processing when Trad/Simp conversion is actually enabled in Advanced Settings**. When set to "None", the panel shows a "rules currently inactive" hint.

## Supported file formats

Drag-and-drop or paste support for `.txt`, `.md`, `.markdown` files.

## Tech stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **UI**: [Ant Design](https://ant.design/) + [Tailwind CSS 4](https://tailwindcss.com/)
- **i18n**: [next-intl](https://next-intl-docs.vercel.app/)
- **Text processing**:
  - [js-opencc](https://github.com/rockbenben/js-opencc): Trad/Simp conversion
  - [compromise](https://github.com/spencermountain/compromise): English NLP sentence boundaries
  - [jschardet](https://github.com/aadsm/jschardet): encoding detection

## Getting started

### Requirements

- Node.js >= 20.9.0
- Package manager: Yarn (recommended), npm, or pnpm

### Install & run

```bash
git clone https://github.com/rockbenben/novel-processor.git
cd novel-processor

# install dependencies
yarn install

# start dev server
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000) to use the tool.

### Production build

```bash
yarn build
```

## Contributing

PRs and issues welcome.

1. Fork the repo
2. Create a branch: `git checkout -b feature/AmazingFeature`
3. Commit: `git commit -m 'feat: add some AmazingFeature'`
4. Push: `git push origin feature/AmazingFeature`
5. Open a Pull Request

## Links

- 📖 [Documentation](https://docs.newzone.top/en/guide/tools/novel-processor)
- 🐛 [Report Issues](https://github.com/rockbenben/novel-processor/issues)
- 🔗 [Chinese Converter](https://github.com/rockbenben/chinese-conversion) (shares protected dictionary)

## License

[MIT](./LICENSE)
