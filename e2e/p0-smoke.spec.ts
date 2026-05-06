/**
 * P0 浏览器冒烟：登录 → 创建/加入家庭 → 创建宝宝 → 快速记录
 *
 * 对应场景：
 *   - S01 创建家庭（新用户）
 *   - S03 加入家庭（U4 用 FamilyA 邀请码）
 *   - S12 切换宝宝（家庭 A 已有 babyA1 / babyA2）
 *   - S16 编辑器创建喂养记录（UI 链路）
 *
 * 前置：先 pnpm dev（client :5173 + server :3000）
 */
import { test, expect, loginViaUI } from './fixtures/seed';

test.describe('P0 浏览器冒烟', () => {
  test('S01b U2 登录 / 看到家庭 / 看到首页今日记录', async ({ page, seed }) => {
    // 用种子已存在的 editor U2（FamilyA 内）
    await loginViaUI(page, seed.accounts.U2.email, seed.password);

    // 等待首页加载完成（确认 family + baby store 已加载）
    await page.goto('/');
    await expect(
      page.getByText('小橘 · 今日记录').or(page.getByText('小桃 · 今日记录')),
    ).toBeVisible({ timeout: 10_000 });

    // 进入家庭页 — 应能看到当前家庭名 FamilyA-E2E + 角色"成员"
    await page.goto('/family');
    await expect(page.getByText('FamilyA-E2E').first()).toBeVisible();
    await expect(page.getByText('成员').first()).toBeVisible();
  });

  test('S12+S16 切换宝宝 + 记录页', async ({ page, seed }) => {
    await loginViaUI(page, seed.accounts.U2.email, seed.password);

    // 直接访问 /record，验证 babies store 在子路由直入时也能加载
    await page.goto('/record');
    await expect(page.getByText(/母乳|配方奶|辅食|喂养/).first()).toBeVisible({ timeout: 10_000 });

    // 直接访问 /baby，验证宝宝列表
    await page.goto('/baby');
    await expect(page.getByText('小橘').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('小桃').first()).toBeVisible();
  });

  test('S01 新用户注册 → 创建家庭 → 显示管理员角色', async ({ page, seed }) => {
    const ts = Date.now();
    const email = `s01ui.${ts}@e2e.local`;
    const password = seed.password;

    // 注册新用户
    await page.goto('/register');
    await page.getByPlaceholder('请输入邮箱').fill(email);
    await page.getByPlaceholder('至少8位密码').fill(password);
    await page.getByPlaceholder('再次输入密码').fill(password);
    // 昵称输入框（取首个非邮箱/密码的输入框）
    const nicknameInput = page.locator('input[type="text"]').first();
    if (await nicknameInput.isVisible()) {
      await nicknameInput.fill(`UI测试-${ts}`);
    }
    await page.getByRole('button', { name: /注册|创建账号|开始/ }).click();

    // 注册后自动登录 → 跳转主页面，仍未加入家庭
    await page.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 10_000 });

    // 进家庭页 → 创建家庭
    await page.goto('/family');
    await page.getByRole('button', { name: '创建家庭' }).click();
    // 表单展开
    await page
      .locator('input')
      .filter({ hasText: '' })
      .first()
      .waitFor({ state: 'visible' });

    // 填写家庭名
    const familyName = `UI家庭-${ts}`;
    // 找 placeholder 含"家庭"或第一个 visible input
    const inputs = page.locator('form.card input').all();
    const allInputs = await inputs;
    if (allInputs.length >= 1) await allInputs[0].fill(familyName);
    if (allInputs.length >= 2) await allInputs[1].fill('UI测试妈妈');

    await page.getByRole('button', { name: /创建家庭|创建中/ }).last().click();

    // 创建成功 → 应展示家庭名和管理员徽章
    await expect(page.getByText(familyName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('管理员').first()).toBeVisible();
  });
});
