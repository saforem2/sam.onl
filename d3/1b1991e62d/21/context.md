# Session Context

## User Prompts

### Prompt 1

In the repo at /Users/samforeman/projects/saforem2/sam.onl, find ALL embedded slide URLs in the web/src/pages/ directory.

Search for:
1. All iframe elements with src attributes
2. All embed elements 
3. Any references to slides.html, reveal.js presentations, or similar

For each one found, report:
- The file path
- The line number  
- The full iframe/embed tag or at minimum the src URL
- Whether the src URL is a local path or external URL
- For local paths, check if the referenced file actua...

