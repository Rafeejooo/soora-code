export default function Loading({ text = 'Loading...', theme = '' }) {
  const cls = ['loading-screen', theme ? `loading-${theme}` : ''].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <div className="loading-pulse">
        <div className="pulse-ring" />
        <div className="pulse-ring" />
        <div className="pulse-dot" />
      </div>
      <p>{text}</p>
    </div>
  );
}
