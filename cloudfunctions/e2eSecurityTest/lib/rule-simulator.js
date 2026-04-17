/**
 * E2E 安全测试 - 安全规则模拟器 (Rule Simulator)
 * 
 * 模拟 CloudBase 安全规则引擎的判定行为。
 * admin SDK 绕过安全规则，但安全规则的判定逻辑是确定性的纯函数：
 * f(rule, auth, doc) → allow/deny
 * 
 * 我们在测试云函数中读取真实文档数据，注入模拟的 auth 对象，
 * 按安全规则表达式逐条求值，判定结果与真实引擎等价。
 */

class RuleSimulator {
  constructor(db) {
    this.db = db;

    // 6 个集合的安全规则定义（与实际配置一致）
    this.rules = {
      users: {
        read: 'doc._openid == auth.openid',
        create: 'doc._openid == auth.openid',
        update: 'doc._openid == auth.openid',
        delete: 'doc._openid == auth.openid'
      },
      families: {
        read: 'auth != null',  // v4.2 调整：原 auth.openid in doc.memberOpenids 在 doc().get() 不生效
        create: 'auth != null',
        update: false,
        delete: false
      },
      babies: {
        read: "get('database.families.' + doc.familyId).memberOpenids contains auth.openid",
        create: 'auth != null',
        update: 'doc._openid == auth.openid',
        delete: false
      },
      records: {
        read: "get('database.families.' + doc.familyId).memberOpenids contains auth.openid",
        create: 'auth != null',
        update: 'doc._openid == auth.openid',
        delete: 'doc._openid == auth.openid'
      },
      vaccine_records: {
        read: "get('database.families.' + doc.familyId).memberOpenids contains auth.openid",
        create: 'auth != null',
        update: 'doc._openid == auth.openid',
        delete: 'doc._openid == auth.openid'
      },
      milestone_records: {
        read: "get('database.families.' + doc.familyId).memberOpenids contains auth.openid",
        create: 'auth != null',
        update: 'doc._openid == auth.openid',
        delete: 'doc._openid == auth.openid'
      }
    };
  }

  /**
   * 模拟安全规则判定
   * @param {string} collection  - 集合名
   * @param {string} operation   - 操作: read/create/update/delete
   * @param {object|null} auth   - 模拟的 auth 对象 { openid: string } 或 null
   * @param {object} doc         - 文档数据
   * @returns {object} { allowed: boolean, reason: string }
   */
  async evaluate(collection, operation, auth, doc) {
    const collRules = this.rules[collection];
    if (!collRules) {
      return { allowed: false, reason: `未知集合: ${collection}` };
    }

    const ruleExpr = collRules[operation];

    // 规则为 boolean
    if (ruleExpr === true) return { allowed: true, reason: 'rule=true' };
    if (ruleExpr === false) return { allowed: false, reason: 'rule=false（禁止客户端操作）' };

    // 规则为表达式
    try {
      const result = await this._evalExpression(ruleExpr, auth, doc);
      return {
        allowed: result,
        reason: result ? `规则通过: ${ruleExpr}` : `规则拒绝: ${ruleExpr}`
      };
    } catch (e) {
      return { allowed: false, reason: `规则求值异常: ${e.message}` };
    }
  }

  /**
   * 求值安全规则表达式
   */
  async _evalExpression(expr, auth, doc) {
    // 1. auth != null
    if (expr === 'auth != null') {
      return auth !== null && auth !== undefined;
    }

    // 2. doc._openid == auth.openid
    if (expr === 'doc._openid == auth.openid') {
      return auth && doc && doc._openid === auth.openid;
    }

    // 3. auth.openid in doc.memberOpenids
    if (expr === 'auth.openid in doc.memberOpenids') {
      return auth && doc && Array.isArray(doc.memberOpenids) && doc.memberOpenids.includes(auth.openid);
    }

    // 4. get('database.families.' + doc.familyId).memberOpenids contains auth.openid
    if (expr.includes("get('database.families.'")) {
      if (!doc || !doc.familyId) return false;
      try {
        const familyDoc = await this.db.collection('families').doc(doc.familyId).get();
        const family = familyDoc.data;
        if (!family || !family.memberOpenids) return false;
        return auth && family.memberOpenids.includes(auth.openid);
      } catch (e) {
        // 家庭文档不存在 → get() 返回 null → 规则拒绝
        return false;
      }
    }

    // 5. 未知表达式
    throw new Error(`不支持的规则表达式: ${expr}`);
  }
}

module.exports = { RuleSimulator };
