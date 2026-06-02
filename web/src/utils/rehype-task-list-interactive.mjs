/**
 * GFM emits `<input type="checkbox" disabled>` for task-list items per
 * the CommonMark spec. We want them to be clickable, so strip the
 * `disabled` attribute. A small client script (in Layout/Doc) handles
 * persistence — it reads `data-task-key` to scope state per task.
 */
import { visit } from 'unist-util-visit'

export default function rehypeTaskListInteractive() {
    return (tree) => {
        visit(tree, 'element', (node) => {
            if (node.tagName !== 'input') return
            const type = node.properties?.type
            if (type !== 'checkbox') return
            // Only touch GFM task-list checkboxes (their parent <li> gets
            // the `task-list-item` class). We can't see the parent here
            // cheaply, so just remove `disabled` from any markdown-emitted
            // checkbox — those are the only inputs in rendered markdown.
            if ('disabled' in (node.properties ?? {})) {
                delete node.properties.disabled
            }
        })
    }
}
