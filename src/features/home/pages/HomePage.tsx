export function HomePage() {
  return (
    <section className="welcome-panel" aria-labelledby="welcome-title">
      <p className="welcome-panel__eyebrow">A quiet space for your future self</p>
      <h1 id="welcome-title">未来のあなたへ</h1>
      <p className="welcome-panel__copy">今の気持ちを手紙にして、時間をまたいで自分へ届けよう。</p>
      <div className="welcome-panel__note" role="note">
        <span className="welcome-panel__note-mark" aria-hidden="true">
          ✦
        </span>
        <span>ここから、あなたの時間が動き出します。</span>
      </div>
    </section>
  )
}
