import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Switch } from "../switch";
import { TextField } from "../text-field";

describe("Switch", () => {
  it("role=switch, aria-checked, 누르면 반대 값", () => {
    const onChange = vi.fn();
    render(<Switch label="새우회도 팔아요" checked={false} onChange={onChange} />);
    const sw = screen.getByRole("switch", { name: "새우회도 팔아요" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("TextField", () => {
  it("라벨로 찾고, 접미와 오류 줄이 붙으면 aria-invalid·describedby", () => {
    render(<TextField label="가격" suffix="원" error="가격을 숫자로 알려주세요" value="" onChange={() => {}} />);
    const input = screen.getByRole("textbox", { name: "가격" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("가격을 숫자로 알려주세요");
    expect(screen.getByText("원")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("가격을 숫자로 알려주세요");
  });

  it("오류가 없으면 aria-invalid 없음", () => {
    render(<TextField label="메뉴명" value="" onChange={() => {}} />);
    expect(screen.getByRole("textbox", { name: "메뉴명" })).not.toHaveAttribute("aria-invalid");
  });
});
