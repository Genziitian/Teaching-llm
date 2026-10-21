import { ERROR_KINDS, type ErrorKind } from './errors'
import styles from './ErrorScreen.module.css'

// Plain anchors on purpose: a full page load clears whatever broke the app.
export default function ErrorScreen({ kind }: { kind: ErrorKind }) {
  const error = ERROR_KINDS[kind]
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{error.eyebrow}</p>
          <h1>
            {error.title.map((line, index) => (
              <span key={line}>
                {line}
                {index < error.title.length - 1 && <br />}
              </span>
            ))}
          </h1>
          <p className={styles.message}>{error.message}</p>
          <div className={styles.actions}>
            <a className={styles.primary} href="/">
              <span aria-hidden="true">↖</span> Back to home
            </a>
            <a className={styles.secondary} href="/support">
              Need help
            </a>
          </div>
        </div>
        <div className={styles.art} aria-hidden="true">
          <img className={styles.light} src={`/desk-diorama/errors/${kind}.svg`} alt="" draggable={false} />
          <img className={styles.dark} src={`/desk-diorama/errors/${kind}-dark.svg`} alt="" draggable={false} />
        </div>
      </div>
    </main>
  )
}
