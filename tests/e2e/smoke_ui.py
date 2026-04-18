from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[2]
SCREENSHOT = ROOT / "tests" / "e2e" / "artifacts" / "smoke-ui.png"


def main() -> None:
    SCREENSHOT.parent.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []
    page_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1100})

        page.on(
            "console",
            lambda msg: console_errors.append(msg.text)
            if msg.type == "error"
            else None,
        )
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        page.goto("http://127.0.0.1:4173", wait_until="networkidle")

        expect(page.get_by_role("heading", name="Tree Knowledge").first).to_be_visible()
        expect(page.get_by_text("知识宇宙总览").first).to_be_visible()

        page.get_by_role("button", name="Providers").click()
        expect(page.get_by_text("OpenAI-compatible Providers")).to_be_visible()

        page.get_by_label("名称").fill("Smoke Provider")
        page.get_by_label("Base URL").fill("https://api.openai.com/v1")
        page.get_by_label("API Key").fill("sk-smoke-test")
        page.get_by_label("Default Model").fill("gpt-4.1-mini")
        page.get_by_role("button", name="保存 Provider").click()

        expect(page.get_by_role("heading", name="Smoke Provider")).to_be_visible()
        page.get_by_role("button", name="返回启动台").click()

        page.get_by_role("button", name="新建知识库").click()
        page.get_by_label("名称").fill("Smoke Workspace")
        page.get_by_label("简介").fill("用于自动化烟测的知识库。")
        page.get_by_label("起始问题").fill("Tree Knowledge 为什么不是聊天记录？")
        page.get_by_role("button", name="创建并进入工作台").click()

        expect(page.get_by_text("当前节点为中心的有限半径图谱")).to_be_visible()
        expect(page.get_by_text("Smoke Workspace")).to_be_visible()

        dock_input = page.get_by_placeholder("围绕当前节点继续提问，或请求 AI 生成候选方向")
        dock_input.fill("这个主题还能从哪些方向展开")
        page.get_by_role("button", name="生成候选").click()

        expect(page.get_by_text("候选节点确认层")).to_be_visible()
        expect(page.get_by_role("button", name="采纳候选").first).to_be_visible()
        first_candidate_title = page.locator(".candidate-card h4").first.text_content() or ""
        page.get_by_role("button", name="采纳候选").first.click()

        expect(page.get_by_role("heading", name=first_candidate_title)).to_be_visible()

        page.get_by_role("button", name="搜索节点").click()
        page.get_by_label("搜索当前知识库节点").fill("Tree Knowledge")
        expect(page.locator(".search-result-card").first).to_be_visible()
        page.locator(".search-result-card").first.get_by_role("button", name="建立关系边").click()
        expect(page.locator(".relation-pill").first).to_be_visible()

        page.locator(".nav-list button").first.click()
        expect(page.get_by_text("当前节点为中心的有限半径图谱")).to_be_visible()

        page.screenshot(path=str(SCREENSHOT), full_page=True)
        browser.close()

    if console_errors or page_errors:
        raise SystemExit(
            "Smoke UI test saw runtime errors:\n"
            + "\n".join([*console_errors, *page_errors])
        )

    print(f"Smoke UI test passed. Screenshot: {SCREENSHOT}")


if __name__ == "__main__":
    main()
