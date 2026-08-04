import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextInput } from "./TextInput";

describe("TextInput", () => {
  afterEach(cleanup);

  it("connects its label and control", () => {
    render(<TextInput label="이름" id="name" value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText("이름")).toHaveAttribute("id", "name");
  });

  it("renders a textarea with rows", () => {
    render(<TextInput label="메모" id="memo" value="" onChange={vi.fn()} as="textarea" rows={5} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("rows", "5");
  });

  it("uses the input radius token", () => {
    render(<TextInput label="이름" id="name" value="" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveStyle({ borderRadius: "var(--radius-md)" });
  });
});
