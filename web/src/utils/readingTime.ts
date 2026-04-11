const WORDS_PER_MINUTE = 200

export function getReadingTime(text: string): string {
    const words = text.trim().split(/\s+/).length
    const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
    return `${minutes} min read`
}
