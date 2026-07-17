import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Calendar, User } from 'lucide-react'
import { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import remarkSmartypants from 'remark-smartypants'
import { getAllPosts, getPostBySlug } from '@/lib/blog'
import { BackToAllPosts, BackToAllPostsFooter, AiDisclosureBanner, LightboxImage } from './NewsDetailClient'
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
    alternates: {
      canonical: `https://www.spacemolt.com/news/${slug}`,
    },
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
    ...(post.aiDisclosure && {
      other: {
        'ai-disclosure': post.aiDisclosure,
      },
    }),
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
    <div className="console-page">
      <article className={styles.article}>
        <div className={styles.backRow}>
          <BackToAllPosts />
        </div>

        <header className={`console-page-header ${styles.header}`}>
          <span className="console-page-kicker">Comms</span>
          <h1 className="console-page-title">{post.title}</h1>
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

        {post.image && (
          <div className={styles.heroImage}>
            <Image
              src={post.image}
              alt={post.title}
              width={1200}
              height={630}
              priority
            />
          </div>
        )}

        <div className={styles.content}>
          <MDXRemote
            source={post.content}
            components={{ img: LightboxImage }}
            options={{
              mdxOptions: {
                remarkPlugins: [remarkGfm, remarkSmartypants],
              },
            }}
          />
        </div>

        {post.aiDisclosure && post.aiDisclosure !== 'none' && (
          <AiDisclosureBanner disclosure={post.aiDisclosure} />
        )}

        <footer className={styles.postFooter}>
          <BackToAllPostsFooter />
        </footer>
      </article>
    </div>
  )
}
