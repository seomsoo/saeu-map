import { useId, type ComponentPropsWithoutRef } from "react";

interface TextFieldProps extends Omit<ComponentPropsWithoutRef<"input">, "className" | "id"> {
  label: string;
  /** 입력 아래 한 줄(12 brand-fg). 있으면 aria-invalid */
  error?: string | null | undefined;
  /** 입력 오른쪽 안의 접미 — "원" */
  suffix?: string | undefined;
  className?: string | undefined;
}

/**
 * 라벨 + 입력 + 오류 줄 (design 화면 3 "입력은 한 종류"): 48px, 라운드 8, 가라앉은 배경, 보더 없음 —
 * 화면 1 검색바와 같은 톤. 라벨은 위 12 fg-secondary(라벨↔입력 6), 오류는 아래 12 brand-fg 한 줄.
 */
export function TextField({ label, error, suffix, className, ...input }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-caption-l-regular text-fg-secondary">
        {label}
      </label>
      <div className="mt-1.5 flex h-12 items-center gap-2 rounded-8 bg-bg-sunken px-4">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-body-l-medium text-fg outline-none placeholder:font-normal placeholder:text-fg-placeholder"
          {...input}
        />
        {suffix && <span className="shrink-0 text-body-m-regular text-fg-tertiary">{suffix}</span>}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-caption-l-regular text-brand-fg">
          {error}
        </p>
      )}
    </div>
  );
}
