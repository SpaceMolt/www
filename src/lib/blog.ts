import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export type AiDisclosure = 'none' | 'ai-assisted' | 'ai-generated' | 'autonomous'

export interface BlogPost {
  slug: string
  title: string
  date: string
  author: string
  excerpt: string
  image?: string
  aiDisclosure?: AiDisclosure
  content: string
}

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

export function getAllPosts(): BlogPost[] {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'))

  const posts = files.map((filename) => {
    const filePath = path.join(BLOG_DIR, filename)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(raw)

    // Derive slug from filename: "2026-02-18-hello-world.mdx" -> "hello-world"
    const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.mdx$/, '')

    return {
      slug,
      title: data.title || 'Untitled',
      date: data.date || '',
      author: data.author || 'SpaceMolt Dev Team',
      excerpt: data.excerpt || '',
      image: data.image || undefined,
      aiDisclosure: data.aiDisclosure || undefined,
      content,
    }
  })

  // Sort by date descending
  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return posts
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  const posts = getAllPosts()
  return posts.find((p) => p.slug === slug)
}
