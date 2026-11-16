interface ValidatedInputProps {
  id: string;
  label: string;
  value: number | '';
  onChange: (value: number | '') => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  suffix?: string;
  hint?: string;
  error?: string;
  warning?: string;
  disabled?: boolean;
  inputMode?: 'numeric' | 'decimal';
}

export function ValidatedInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  suffix,
  hint,
  error,
  warning,
  disabled,
  inputMode = 'numeric',
}: ValidatedInputProps) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : '', warning ? `${id}-warning` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input
          id={id}
          type="number"
          value={value === '' ? '' : String(value)}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          inputMode={inputMode}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => {
            const raw = event.target.value;
            onChange(raw === '' ? '' : Number(raw));
          }}
        />
        {suffix ? <span className="input-suffix" aria-hidden="true">{suffix}</span> : null}
      </div>
      {hint ? <p className="field-hint" id={`${id}-hint`}>{hint}</p> : null}
      {error ? <p className="field-error" id={`${id}-error`} role="alert">{error}</p> : null}
      {!error && warning ? <p className="field-warning" id={`${id}-warning`}>{warning}</p> : null}
    </div>
  );
}
