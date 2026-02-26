# Session Context

## User Prompts

### Prompt 1

In the repo at /Users/samforeman/projects/saforem2/sam.onl, find ALL image references in web/src/pages/ that are broken (i.e., the referenced image file does not exist).

Search ALL .mdx, .md, and .astro files under web/src/pages/ for:
1. Markdown image syntax: ![alt](path)
2. HTML img tags: <img src="path">
3. Astro Image components: <Image src={...}>
4. Any other image references

For each image reference found:
1. Determine the absolute path of the referenced image
2. Check if that file ex...

