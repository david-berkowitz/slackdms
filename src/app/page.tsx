import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>Community Ops Console</div>
        <nav className={styles.nav}>
          <a href="/admin">Admin Console</a>
          <a className={styles.outlineButton} href="/api/slack/install">
            Install Slack App
          </a>
        </nav>
      </header>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Slack community ops</p>
            <h1>Find the most active members and reach them at human speed.</h1>
            <p className={styles.lede}>
              Track activity across public channels, tag people by name, and
              send well-paced outreach from your own account.
            </p>
            <div className={styles.actions}>
              <a className={styles.primaryButton} href="/api/slack/install">
                Connect your workspace
              </a>
              <a className={styles.secondaryButton} href="/admin">
                Open admin console
              </a>
            </div>
            <div className={styles.metaRow}>
              <span>Active = messages + reactions in the last 90 days</span>
              <span>Auto-joins public channels</span>
            </div>
          </div>
          <div className={styles.heroCard}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardTitle}>90-day activity pulse</p>
                <p className={styles.cardSubtitle}>
                  Updated in near real-time via Slack events
                </p>
              </div>
              <span className={styles.badge}>Live</span>
            </div>
            <div className={styles.cardStats}>
              <div>
                <p className={styles.statLabel}>Active members</p>
                <p className={styles.statValue}>148</p>
              </div>
              <div>
                <p className={styles.statLabel}>Channels tracked</p>
                <p className={styles.statValue}>62</p>
              </div>
            </div>
            <div className={styles.cardList}>
              <div className={styles.cardRow}>
                <span className={styles.avatar}>SB</span>
                <div>
                  <p className={styles.cardName}>Susan B.</p>
                  <p className={styles.cardDetail}>#events • reacted today</p>
                </div>
                <span className={styles.tag}>VIP</span>
              </div>
              <div className={styles.cardRow}>
                <span className={styles.avatar}>MK</span>
                <div>
                  <p className={styles.cardName}>Mika K.</p>
                  <p className={styles.cardDetail}>#introductions • posted</p>
                </div>
                <span className={styles.tag}>Host</span>
              </div>
              <div className={styles.cardRow}>
                <span className={styles.avatar}>JR</span>
                <div>
                  <p className={styles.cardName}>Jordan R.</p>
                  <p className={styles.cardDetail}>
                    #announcements • reacted
                  </p>
                </div>
                <span className={styles.tag}>Partner</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.grid}>
          <div className={styles.gridCard}>
            <h3>Multi-workspace installs</h3>
            <p>
              Connect any Slack workspace via OAuth. Tokens are stored per
              workspace, so your outreach stays compliant and scoped.
            </p>
          </div>
          <div className={styles.gridCard}>
            <h3>Channel-level filters</h3>
            <p>
              Filter active members by channel or tag. Ideal for spotlighting
              #events, #jobs, or your onboarding lanes.
            </p>
          </div>
          <div className={styles.gridCard}>
            <h3>Rate-limited messaging</h3>
            <p>
              Send up to 100 messages per batch with pacing and retries to honor
              Slack limits.
            </p>
          </div>
        </section>

        <section className={styles.steps}>
          <h2>How it works</h2>
          <ol>
            <li>Install the Slack app and authorize your account.</li>
            <li>We auto-join public channels and track messages + reactions.</li>
            <li>
              Use the admin console to tag members and send thoughtful DMs.
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}
