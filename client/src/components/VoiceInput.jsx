export function ModeTabs({ label, options, value, onChange }) {
  return (
    <div className="mode-tabs" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={value === option.value ? 'mode-tab active' : 'mode-tab'}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function MicButton({ dictation, text }) {
  if (!dictation.supported) {
    return <p className="notice voice-note">Voice input needs Chrome or Edge. You can still type here.</p>;
  }

  return (
    <div className="mic-row">
      <button
        type="button"
        className={dictation.listening ? 'button mic-button listening' : 'button secondary mic-button'}
        onClick={() => (dictation.listening ? dictation.stop() : dictation.start(text))}
      >
        <span className="mic-dot" aria-hidden="true" />
        {dictation.listening ? 'Stop speaking' : 'Start speaking'}
      </button>
      <span className="muted" role="status">
        {dictation.listening ? 'Listening. Your words appear below.' : ''}
      </span>
      {dictation.error && (
        <p className="alert voice-note" role="alert">
          {dictation.error}
        </p>
      )}
    </div>
  );
}
