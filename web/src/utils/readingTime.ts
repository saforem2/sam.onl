const WORDS_PER_MINUTE = 200

export function getReadingTime(text: string): string {
    const trimmed = text.trim()
    if (!trimmed) return '1 min read'
    const words = trimmed.split(/\s+/).length
    const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
    return `${minutes} min read`
}
