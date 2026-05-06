export function Footer() {
  return (
    <footer className="w-full py-4 mt-8">
      <div className="flex flex-col items-center gap-1.5 text-xs text-[var(--text-secondary)]">
        <p className="font-medium">三点水的瀚</p>

        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noreferrer"
          className="hover:text-[var(--primary-dark)] transition-colors"
        >
          京ICP备2026006110号-1
        </a>

        <a
          href="https://beian.mps.gov.cn/#/query/webSearch?code=11010502059458"
          rel="noreferrer"
          target="_blank"
          className="flex items-center gap-1.5 hover:text-[var(--primary-dark)] transition-colors"
        >
          <img
            src="/beian-icon.png"
            alt="备案图标"
            className="w-3.5 h-3.5"
          />
          京公网安备11010502059458号
        </a>
      </div>
    </footer>
  );
}
