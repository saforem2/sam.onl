# Session Context

## User Prompts

### Prompt 1

Audit ALL .mdx, .md, and .astro files under /Users/samforeman/projects/saforem2/sam.onl/web/src/pages/ for unpaired div tags. 

Write a Python script that:
1. Finds all .mdx, .md, and .astro files under web/src/pages/
2. For each file, uses a multi-line-aware regex to find all `<div...>` openers and `</div>` closers
3. Tracks nesting with a stack
4. Reports any files that have:
   - Extra `</div>` tags (stack underflow)
   - Unclosed `<div>` tags (stack not empty at end of file)

For each pro...

