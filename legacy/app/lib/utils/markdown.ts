/**
 * Simple markdown parser for chat messages
 * Supports: **bold**, *italic*, `code`, [links](url), @mentions, #hashtags
 */

export interface ParsedMarkdown {
  html: string
  plainText: string
  mentions: string[]
  hashtags: string[]
}

export function parseMarkdown(text: string): ParsedMarkdown {
  const mentions: string[] = []
  const hashtags: string[] = []
  let html = text

  // Extract mentions (@username) and hashtags (#tag)
  html = html.replace(/@(\w+)/g, (match, username) => {
    if (!mentions.includes(username)) {
      mentions.push(username)
    }
    return `<span class="mention" data-mention="${username}">@${username}</span>`
  })

  html = html.replace(/#(\w+)/g, (match, tag) => {
    if (!hashtags.includes(tag)) {
      hashtags.push(tag)
    }
    return `<span class="hashtag" data-hashtag="${tag}">#${tag}</span>`
  })

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')

  // Italic: *text* or _text_
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Code block: ```code```
  html = html.replace(/```([\s\S]+?)```/g, '<pre><code>$1</code></pre>')

  // Images: ![alt](url) - process first to avoid matching as links
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full max-h-96 rounded" loading="lazy" />')

  // Links: [text](url) - match links that aren't images
  html = html.replace(/(?<!\!)\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">$1</a>')

  // Line breaks
  html = html.replace(/\n/g, '<br>')

  return {
    html,
    plainText: text,
    mentions,
    hashtags,
  }
}
