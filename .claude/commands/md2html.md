Convert a markdown file into a beautiful, well-designed HTML webpage.

The argument provided is the path to the markdown file: $ARGUMENTS

## Steps

1. Read the markdown file at the given path.
2. Analyze the structure — identify headings, sections, tables, lists, code blocks, and any special content.
3. Generate a single self-contained HTML file that:
   - Uses Tailwind CSS via CDN (`https://cdn.tailwindcss.com`)
   - Uses Inter font from Google Fonts
   - Matches the SuperReddit dark theme: `#0f172a` background, `#1e293b` cards, `#334155` borders, `#06b6d4` cyan accents, `#3b82f6` blue accents
   - Has a fixed sidebar navigation with links to each major section (h2 headings)
   - Is fully responsive with a mobile hamburger menu
   - Renders tables with proper styling (dark header, hover rows, rounded containers)
   - Renders code blocks with dark backgrounds and cyan syntax coloring
   - Uses cards with rounded corners and subtle borders for content sections
   - Includes an IntersectionObserver for active nav link highlighting on scroll
   - Has a gradient text effect for the page title
   - Uses numbered section indicators (cyan circles) for major sections
   - Has proper spacing, typography hierarchy, and visual polish
4. Save the HTML file next to the markdown file with the same name but `.html` extension.
5. Confirm the file was created and show the path.

## Design Guidelines

- Background: `#0f172a` (body), `#1e293b` (cards), `#334155` (borders/table headers)
- Text: `#e2e8f0` (headings), `#cbd5e1` (body), `#94a3b8` (muted)
- Accents: `#06b6d4` (cyan primary), `#3b82f6` (blue secondary)
- Positive: `#10b981` / Negative: `#ef4444` / Warning: `#eab308`
- Cards: `border-radius: 12px`, `border: 1px solid #334155`
- Sidebar: 256px fixed left, scrollable nav
- Font: Inter 400/500/600/700/800
- Tables: full-width, collapsed borders, uppercase headers, hover rows
- Lists: cyan bullet points, proper spacing
- Code: `#334155` background, `#06b6d4` text, 4px border-radius

## Rules

- Output a SINGLE self-contained HTML file (no external dependencies beyond CDN)
- Do NOT create separate CSS or JS files
- Include the sidebar navigation with links derived from h2 headings
- Include mobile responsive design with hamburger menu
- Include "Back to Research Hub" link in sidebar pointing to `../index.html`
- Make sure ALL content from the markdown is represented — do not skip or summarize sections
