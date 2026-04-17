/**
 * E2E 安全测试 - 测试执行引擎
 */

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', SKIP: 'SKIP', ERROR: 'ERROR' };

class TestRunner {
  constructor(db) {
    this.db = db;
    this.results = [];
    this.currentModule = '';
  }

  setModule(name) {
    this.currentModule = name;
  }

  /**
   * 执行单个测试用例
   * @param {string} id    - 测试编号 (如 'RM-01')
   * @param {string} title - 测试标题
   * @param {Function} fn  - async 测试函数，返回 { pass: boolean, actual?: any, detail?: string }
   */
  async test(id, title, fn) {
    const t0 = Date.now();
    try {
      const { pass, actual, detail } = await fn();
      this.results.push({
        id,
        module: this.currentModule,
        title,
        status: pass ? STATUS.PASS : STATUS.FAIL,
        duration: Date.now() - t0,
        actual: typeof actual === 'object' ? JSON.stringify(actual).slice(0, 500) : String(actual || ''),
        detail: detail || ''
      });
    } catch (err) {
      this.results.push({
        id,
        module: this.currentModule,
        title,
        status: STATUS.ERROR,
        duration: Date.now() - t0,
        actual: '',
        detail: `${err.message || err}`.slice(0, 500)
      });
    }
  }

  /**
   * 跳过测试用例
   */
  skip(id, title, reason) {
    this.results.push({
      id,
      module: this.currentModule,
      title,
      status: STATUS.SKIP,
      duration: 0,
      actual: '',
      detail: reason || 'Skipped'
    });
  }

  /**
   * 生成测试报告
   */
  getReport() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === STATUS.PASS).length;
    const failed = this.results.filter(r => r.status === STATUS.FAIL).length;
    const errors = this.results.filter(r => r.status === STATUS.ERROR).length;
    const skipped = this.results.filter(r => r.status === STATUS.SKIP).length;

    // 按模块分组统计
    const byModule = {};
    this.results.forEach(r => {
      if (!byModule[r.module]) byModule[r.module] = { total: 0, passed: 0, failed: 0, errors: 0, skipped: 0 };
      byModule[r.module].total++;
      if (r.status === STATUS.PASS) byModule[r.module].passed++;
      if (r.status === STATUS.FAIL) byModule[r.module].failed++;
      if (r.status === STATUS.ERROR) byModule[r.module].errors++;
      if (r.status === STATUS.SKIP) byModule[r.module].skipped++;
    });

    return {
      summary: {
        total,
        passed,
        failed,
        errors,
        skipped,
        passRate: total > 0 ? `${((passed / total) * 100).toFixed(1)}%` : '0%'
      },
      byModule,
      failures: this.results.filter(r => r.status === STATUS.FAIL || r.status === STATUS.ERROR),
      allResults: this.results,
      executedAt: new Date().toISOString()
    };
  }
}

module.exports = { TestRunner, STATUS };
