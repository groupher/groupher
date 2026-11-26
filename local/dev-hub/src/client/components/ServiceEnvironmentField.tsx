import type { TServiceEnvironmentEntry } from '@shared/contracts'

type TProps = {
  entry: TServiceEnvironmentEntry
  pending: Record<string, string | null>
  disabled: boolean
  onChange: (value: string | null) => void
}

export function ServiceEnvironmentField({ entry, pending, disabled, onChange }: TProps) {
  const changed = Object.hasOwn(pending, entry.key)
  const value = changed ? (pending[entry.key] ?? '') : (entry.value ?? '')
  const source = changed
    ? pending[entry.key] === null
      ? 'Reset to default on save'
      : 'Unsaved change'
    : entry.source === 'local'
      ? 'Local config'
      : entry.source === 'hub'
        ? 'Hub managed'
        : 'Default'
  return (
    <div className='service-environment-field'>
      <label htmlFor={`local-env-${entry.key}`}>
        <code>{entry.key}</code>
        <small>{source}</small>
      </label>
      {entry.editable ? (
        <div>
          <input
            id={`local-env-${entry.key}`}
            aria-label={entry.key}
            type={entry.secret ? 'password' : 'text'}
            value={value}
            disabled={disabled}
            autoComplete='off'
            spellCheck={false}
            maxLength={8192}
            placeholder={
              entry.secret && entry.configured ? 'Configured — enter to replace' : 'Not configured'
            }
            onChange={(event) => onChange(event.target.value)}
          />
          <button
            type='button'
            disabled={disabled || (!changed && entry.source !== 'local')}
            onClick={() => onChange(null)}
          >
            Reset
          </button>
        </div>
      ) : (
        <output id={`local-env-${entry.key}`}>
          {entry.secret
            ? entry.configured
              ? '••••••'
              : 'Not initialized'
            : entry.value || 'Not configured'}
        </output>
      )}
    </div>
  )
}
