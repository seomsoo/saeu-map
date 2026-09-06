import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ModalSheet, closeEnclosingDialog } from "../modal-sheet";

describe("ModalSheet — body 포털 dialog, 닫는 경로는 close 이벤트 하나", () => {
  it("열리면 showModal, 딤 버튼을 누르면 close → onClose 한 번", () => {
    const onClose = vi.fn();
    render(
      <ModalSheet label="로그인" onClose={onClose}>
        <p>내용</p>
      </ModalSheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "로그인" });
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveProperty("open", true);
    expect(screen.getByText("내용")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog).toHaveProperty("open", false);
  });

  it("closeEnclosingDialog: 모달 안 ✕가 가장 가까운 dialog를 닫는다", () => {
    const onClose = vi.fn();
    render(
      <ModalSheet label="확인" onClose={onClose}>
        <button
          type="button"
          onClick={(e) => {
            closeEnclosingDialog(e.currentTarget);
          }}
        >
          취소
        </button>
      </ModalSheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
