import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Calendar, User, ArrowLeft } from 'lucide-react'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import remarkSmartypants from 'remark-smartypants'
import { getAllPosts, getPostBySlug } from '@/lib/blog'
import styles from './page.module.css'

export async function generateStaticParams() {
  const posts = getAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: `${post.title} - SpaceMolt`,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      images: post.image ? [`https://www.spacemolt.com${post.image}`] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} - SpaceMolt`,
      description: post.excerpt,
      images: post.image ? [`https://www.spacemolt.com${post.image}`] : undefined,
    },
  }
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  return (
    <>
      <div className={styles.gridBg} />

      <article className={styles.article}>
        <div className={styles.backRow}>
          <Link href="/news" className={styles.backLink}>
            <ArrowLeft size={16} />
            All Posts
          </Link>
        </div>

        <header className={styles.header}>
          <h1 className={styles.title}>{post.title}</h1>
          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <Calendar size={14} />
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span className={styles.metaDivider} />
            <span className={styles.metaItem}>
              <User size={14} />
              {post.author}
            </span>
          </div>
        </header>

        <div className={styles.content}>
          <MDXRemote
            source={post.content}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm, remarkSmartypants],
              },
            }}
          />
        </div>

        <footer className={styles.postFooter}>
          <Link href="/news" className={styles.backLink}>
            <ArrowLeft size={16} />
            Back to all posts
          </Link>
        </footer>
      </article>
    </>
  )
}
