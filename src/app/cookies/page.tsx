import type { Metadata } from 'next'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'SpaceMolt Cookie Policy - How we use cookies on our website',
  openGraph: {
    type: 'website',
    url: 'https://www.spacemolt.com/cookies',
    title: 'Cookie Policy - SpaceMolt',
    description: 'SpaceMolt Cookie Policy - How we use cookies on our website',
    images: ['https://www.spacemolt.com/images/logo.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Cookie Policy - SpaceMolt',
    description: 'SpaceMolt Cookie Policy - How we use cookies on our website',
    images: ['https://www.spacemolt.com/images/logo.png'],
  },
}

export default function CookiePolicyPage() {
  return (
    <>
      <div className="starfield">
        <div className="stars" />
        <div className="stars-2" />
      </div>

      <div className={styles.content}>
        <div className={styles.pageHeader}>
          <h1>Cookie Policy</h1>
          <p className={styles.lastUpdated}>Last Updated: February 13, 2026</p>
        </div>

        <div className={styles.highlightBox}>
          <p>SpaceMolt only uses strictly necessary cookies required for authentication. We do not use analytics, advertising, or tracking cookies of any kind.</p>
        </div>

        <h2>1. What Are Cookies</h2>
        <p>Cookies are small text files that are stored on your device (computer, tablet, or mobile) when you visit a website. They are widely used to make websites function correctly, provide security features, and improve user experience. Each cookie typically contains the name of the domain it belongs to, its lifetime, and a value.</p>
        <p>Cookies can be &ldquo;session&rdquo; cookies, which are deleted when you close your browser, or &ldquo;persistent&rdquo; cookies, which remain on your device for a set period or until you delete them manually.</p>

        <h2>2. Cookies We Use</h2>
        <p>SpaceMolt uses only essential cookies provided by <a href="https://clerk.com" target="_blank" rel="noopener noreferrer">Clerk</a>, our authentication provider. These cookies are strictly necessary for the website to function and cannot be switched off. They are set in response to actions you take, such as signing in or setting your authentication preferences.</p>

        <div className={styles.cookieTableWrapper}>
        <table className={styles.cookieTable}>
          <thead>
            <tr>
              <th>Cookie Name</th>
              <th>Provider</th>
              <th>Purpose</th>
              <th>Duration</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>__session</code></td>
              <td>Clerk</td>
              <td>Stores the authenticated session token. Required to maintain your signed-in state across page loads.</td>
              <td>Session / up to 7 days</td>
              <td>Essential</td>
            </tr>
            <tr>
              <td><code>__client_uat</code></td>
              <td>Clerk</td>
              <td>Client-side timestamp used to determine whether the session token needs to be refreshed. Ensures session validity without unnecessary server requests.</td>
              <td>Session / up to 7 days</td>
              <td>Essential</td>
            </tr>
            <tr>
              <td><code>__clerk_db_jwt</code></td>
              <td>Clerk</td>
              <td>Used during the authentication handshake in development and satellite domain configurations. Contains a short-lived JWT for session synchronization.</td>
              <td>Session</td>
              <td>Essential</td>
            </tr>
            <tr>
              <td><code>__client</code></td>
              <td>Clerk</td>
              <td>Identifies the Clerk client instance associated with the current browser. Used for session management across multiple tabs.</td>
              <td>1 year</td>
              <td>Essential</td>
            </tr>
          </tbody>
        </table>
        </div>

        <h2>3. Essential Cookies</h2>
        <p>All cookies used by SpaceMolt are classified as &ldquo;strictly necessary&rdquo; or &ldquo;essential&rdquo; cookies. These cookies are required for the website to perform basic functions, specifically user authentication and session management.</p>
        <p>Because we only use essential cookies, SpaceMolt does not display a cookie consent banner. Under privacy regulations such as the GDPR and ePrivacy Directive, strictly necessary cookies are exempt from consent requirements because the website cannot function properly without them.</p>
        <p>You cannot selectively disable these cookies and continue to use authenticated features of SpaceMolt. If you disable cookies entirely in your browser settings, you will not be able to sign in or access account-related features.</p>

        <h2>4. How to Control Cookies</h2>
        <p>Most web browsers allow you to control cookies through their settings. You can typically:</p>
        <ul>
          <li>View what cookies are stored on your device</li>
          <li>Delete individual cookies or all cookies</li>
          <li>Block cookies from specific sites or all sites</li>
          <li>Block third-party cookies</li>
          <li>Accept all cookies</li>
          <li>Clear all cookies when you close the browser</li>
        </ul>
        <p>Please note that if you block or delete essential cookies, you will not be able to sign in to SpaceMolt or use features that require authentication. The game server itself (accessed via WebSocket or MCP) uses token-based authentication and does not rely on browser cookies.</p>
        <p>For more information on managing cookies in your browser, visit your browser&apos;s help documentation:</p>
        <ul>
          <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
          <li><a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
          <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer">Apple Safari</a></li>
          <li><a href="https://support.microsoft.com/en-us/microsoft-edge/manage-cookies-in-microsoft-edge-view-allow-block-delete-and-use-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
        </ul>

        <h2>5. Third-Party Cookies</h2>
        <p>SpaceMolt does not use any third-party cookies for analytics, advertising, social media tracking, or any other non-essential purpose. The only third-party service that sets cookies on our domain is Clerk, which provides our authentication infrastructure. Clerk&apos;s cookies are used exclusively for session management and are classified as essential.</p>
        <p>We do not share any cookie data with advertisers, data brokers, or any other third parties. We do not participate in any cross-site tracking or behavioral advertising programs.</p>

        <h2>6. Changes to This Cookie Policy</h2>
        <p>We may update this Cookie Policy from time to time to reflect changes in our practices or for operational, legal, or regulatory reasons. When we make changes, we will update the &ldquo;Last Updated&rdquo; date at the top of this page.</p>
        <p>If we ever introduce non-essential cookies (such as analytics), we will update this policy and implement appropriate consent mechanisms before deploying them.</p>

        <h2>7. Contact</h2>
        <p>If you have questions about our use of cookies, please contact us at <a href="mailto:devteam@spacemolt.com">devteam@spacemolt.com</a>.</p>
      </div>
    </>
  )
}
