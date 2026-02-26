# Session Context

## User Prompts

### Prompt 1

Fix the `j` `k` scroll behavior in the main content

### Prompt 2

it seems to skip paragraphs, lists, headings, ...

e.g. when pressing `j` for the first time, the Cooling Down list element is selected as shown:

[Image 1] 

pressing `j` again selects the W&B Report list element as shown:

[Image 2] 

why is not focusing the links? i.e. when pressing `j` on a list element that contains a link, the link should be the next focused element

### Prompt 3

no no, we DO want to fos <ul> elements

### Prompt 4

still not right; pressing j/k just moves focus between these two but never goes anywhere else:

[Image 1] [Image 2]

### Prompt 5

still not working; when pressing j in the first screenshot from the previous message, why is the Sam Foreman 2025-10-06 line not focused first??

### Prompt 6

wait no, <p> and list elements should all be focusable

### Prompt 7

wait no, <p> and list elements should all be focusable

### Prompt 8

still not right; e.g. in @web/src/pages/landing.mdx when pressing 'j' for the first time, the `## About` heading should be focused; pressing `j` again should send the focus to the anchor link for the `## About` heading; pressing `j` again should focus the paragraph below; pressing `j` again should focus the first [Computational Scientist] link in that paragraph, etc.

instead; pressing `j` for the first time sends the focus to the `I'm a computational scientist...` paragraph as shown below:

...

### Prompt 9

its closer now but seems like its skipping elements ? pressing j from the first screenshot sends the focus to the next link (in the second screenshot), skipping the <div> block

[Image 1] [Image 2]

### Prompt 10

Continue if you have next steps, or stop and ask for clarification if you are unsure how to proceed.

### Prompt 11

can we scroll (/focus with `j/k`) through individual lines in code blocks as well?

### Prompt 12

Continue if you have next steps, or stop and ask for clarification if you are unsure how to proceed.

### Prompt 13

Why aren't we using the CodePreview for code blocks?

