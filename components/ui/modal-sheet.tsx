"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalSheetProps {
  /** 접근성 이름 */
  label: string;
  /**
   * 입력이 있는 모달(값 폼 시트)인가 — 키보드가 뜨면 시트가 그 위에 앉고 긴 본문만 스크롤한다
   * (리뷰 폼과 같은 `--vvh`/`--kb` 기준, globals.css `dialog[data-form]`).
   * 사유 시트처럼 입력이 없는 모달은 짧아서 이 처리가 필요 없다.
   */
  form?: boolean | undefined;
  /** 닫힌 뒤(딤 탭·Escape·부모의 ✕·뒤로가기 전부) 한 번 불린다 — 부모는 여기서 언마운트한다. */
  onClose: () => void;
  children: ReactNode;
}

/**
 * 바텀 모달 — 딤 배경 위 흰 시트(라운드 20 상단, 아래 safe-area). 바텀시트·드롭다운·토스트 위에 얹히는
 * 별도 표면이라 body 포털 + 네이티브 `<dialog>.showModal()`이다(사진 뷰어와 같은 이유 — 시트의 transform 아래서는
 * fixed가 시트 기준이 되고, top layer가 z 경쟁·포커스 트랩·Escape·포커스 복원을 공짜로 준다).
 * 닫는 경로는 하나: `dialog.close()` → `close` 이벤트 → `onClose`. 딤 탭·Escape·부모의 ✕가 전부 이 길로 간다.
 * 호출자: 로그인 시트 · 달라요 사유 시트 · 탈퇴 확인.
 * **데스크탑(lg)은 같은 컴포넌트가 딤 위 중앙 480 카드**(라운드 16 — design 화면 9 프레임 2). 딤 버튼이 뒤에 깔리고
 * 내용은 모바일 `mt-auto`(바닥) / 데스크탑 `m-auto`(중앙)로 자리만 바뀐다.
 */
export function ModalSheet({ label, form, onClose, children }: ModalSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const requestClose = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label={label}
      data-form={form ? "true" : undefined}
      onClose={onClose}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none bg-transparent p-0 text-fg backdrop:bg-common-100/40"
    >
      <div className="relative flex h-full flex-col">
        {/* 딤 자리 — 눌러서 닫는 표적. 시각은 backdrop이 맡고 이 버튼은 투명하다 */}
        <button
          type="button"
          aria-label="닫기"
          onClick={requestClose}
          className="absolute inset-0 cursor-default"
        />
        <div className="relative mt-auto w-full rounded-t-20 bg-bg pb-safe-bottom-or-3 shadow-upper lg:m-auto lg:w-120 lg:rounded-16 lg:border lg:border-line-hairline lg:pb-5 lg:shadow-card">
          {children}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

/** 모달 안에서 닫기를 부를 때 — 부모가 dialog ref를 모르므로 ✕는 가장 가까운 dialog를 닫는다. */
export function closeEnclosingDialog(el: HTMLElement | null): void {
  el?.closest("dialog")?.close();
}
