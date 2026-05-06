/**
 * 跨家庭浏览器隔离 E2E 测试
 *
 * 关键场景：
 *   1. U6 (FamilyB) 登录后，无法在自己页面看到 FamilyA 的家庭名/宝宝名/记录文案
 *   2. U1 (FamilyA admin) 登录后，无法在自己页面看到 FamilyB 的家庭名/宝宝名/记录文案
 *   3. 同一浏览器双 context 模拟两个家庭并行使用，互不干扰
 *   4. 未加入家庭用户（U5）登录后看不到任何家庭数据
 *
 * 文案哨兵（来自 seed-e2e）：
 *   - FamilyA：'FamilyA-E2E', '小橘', '小桃'
 *   - FamilyB：'FamilyB-E2E', '小雪', 'B 家庭独享'
 *
 * 关键：用 loginViaAPI 直接走后端 API 拿 token，避免 UI 频繁登录触发 authRateLimit (10/min/IP)
 */
import { test, expect, loginViaAPI } from './fixtures/seed';

test.describe('跨家庭浏览器隔离', () => {
  test('U6(FamilyB) 视角看不到 FamilyA 任何数据', async ({ page, context, seed }) => {
    await loginViaAPI(context, seed.accounts.U6.email, seed.password);

    await page.goto('/');
    await expect(page.getByText('小雪 · 今日记录')).toBeVisible({ timeout: 10_000 });
    const homeText = await page.locator('body').innerText();
    expect(homeText).not.toContain('小橘');
    expect(homeText).not.toContain('小桃');
    expect(homeText).not.toContain('FamilyA-E2E');

    await page.goto('/family');
    await expect(page.getByText('FamilyB-E2E').first()).toBeVisible();
    const familyText = await page.locator('body').innerText();
    expect(familyText).not.toContain('FamilyA-E2E');
    expect(familyText).not.toContain('momA');
    expect(familyText).not.toContain('dadA');
    // 注意：'grandma' 是 grandmaM 的子串，因此不直接断言；改为更精确的 momA/dadA 检查
  });

  test('U1(FamilyA admin) 视角看不到 FamilyB 任何数据', async ({ page, context, seed }) => {
    await loginViaAPI(context, seed.accounts.U1.email, seed.password);

    await page.goto('/');
    await expect(
      page.getByText('小橘 · 今日记录').or(page.getByText('小桃 · 今日记录')),
    ).toBeVisible({ timeout: 10_000 });

    const homeText = await page.locator('body').innerText();
    expect(homeText).not.toContain('小雪');
    expect(homeText).not.toContain('FamilyB-E2E');
    expect(homeText).not.toContain('B 家庭独享');

    await page.goto('/family');
    await expect(page.getByText('FamilyA-E2E').first()).toBeVisible();
    const familyText = await page.locator('body').innerText();
    expect(familyText).not.toContain('FamilyB-E2E');
    expect(familyText).not.toContain('momB');
  });

  test('双 context 并行：U1 与 U6 在同一浏览器互不干扰', async ({ browser, seed }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      // 并行 API 登录（不打 UI）
      await Promise.all([
        loginViaAPI(ctxA, seed.accounts.U1.email, seed.password),
        loginViaAPI(ctxB, seed.accounts.U6.email, seed.password),
      ]);

      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();

      await Promise.all([pageA.goto('/'), pageB.goto('/')]);

      await expect(
        pageA.getByText('小橘 · 今日记录').or(pageA.getByText('小桃 · 今日记录')),
      ).toBeVisible({ timeout: 15_000 });
      await expect(pageB.getByText('小雪 · 今日记录')).toBeVisible({ timeout: 15_000 });

      const aText = await pageA.locator('body').innerText();
      const bText = await pageB.locator('body').innerText();
      expect(aText).not.toContain('小雪');
      expect(aText).not.toContain('FamilyB-E2E');
      expect(bText).not.toContain('小橘');
      expect(bText).not.toContain('小桃');
      expect(bText).not.toContain('FamilyA-E2E');
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test('未加入家庭用户（U5）登录后无法看到任何家庭数据', async ({ page, context, seed }) => {
    await loginViaAPI(context, seed.accounts.U5.email, seed.password);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const homeText = await page.locator('body').innerText();
    expect(homeText).not.toContain('小橘');
    expect(homeText).not.toContain('小桃');
    expect(homeText).not.toContain('小雪');
    expect(homeText).not.toContain('FamilyA-E2E');
    expect(homeText).not.toContain('FamilyB-E2E');
    expect(homeText).toMatch(/未加入家庭|创建.*家庭|加入.*家庭/);

    await page.goto('/family');
    await page.waitForLoadState('networkidle');
    const familyText = await page.locator('body').innerText();
    expect(familyText).toMatch(/未加入家庭|创建家庭|加入家庭/);
    expect(familyText).not.toContain('FamilyA-E2E');
    expect(familyText).not.toContain('FamilyB-E2E');
  });

  test('U2(FamilyA editor) 不能在 UI 中看到 FamilyB 任何痕迹', async ({ page, context, seed }) => {
    await loginViaAPI(context, seed.accounts.U2.email, seed.password);

    // 探查多个页面，确保任何角落都不漏
    for (const route of ['/', '/family', '/record', '/discover']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const text = await page.locator('body').innerText();
      expect(text, `route ${route} 不应含 B 家庭文案`).not.toContain('FamilyB-E2E');
      expect(text, `route ${route} 不应含 小雪`).not.toContain('小雪');
      expect(text, `route ${route} 不应含 B 家庭独享`).not.toContain('B 家庭独享');
    }
  });
});
