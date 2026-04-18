import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "@/app/App";

describe("App", () => {
  it("renders the launchpad shell", async () => {
    render(<App />);

    expect(await screen.findByText("Tree Knowledge")).toBeInTheDocument();
    expect(await screen.findByText("知识宇宙总览")).toBeInTheDocument();
  });
});
