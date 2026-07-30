/* FinSight root — router, theme, auth/pro state, app shell. */
(function () {
  const D = window.FS_DATA;

  function AppShell({ screen, onNav, theme, onToggleTheme, pro, onManage, onSignOut, children }) {
    const titles = { upload: '업로드', analysis: '분석', report: '리포트' };
    const nav = [['upload', 'upload', '업로드'], ['report', 'report', '리포트'], ['history', 'history', '기록'], ['settings', 'settings', '설정']];
    return React.createElement('div', { className: 'fs-app' },
      React.createElement('aside', { className: 'fs-side' },
        React.createElement('div', { className: 'fs-brand' }, React.createElement('span', { className: 'dot' }), 'FinSight'),
        nav.map(([id, ic, label]) => React.createElement('button', {
          key: id, className: 'fs-navitem' + (id === screen || (id === 'report' && screen === 'analysis') ? ' active' : ''),
          onClick: () => (id === 'upload' || id === 'report') && onNav(id) },
          React.createElement('span', { className: 'ic' }, React.createElement(window.FSIcon, { name: ic, size: 18 })), label)),
        React.createElement('div', { style: { flex: 1 } }),
        React.createElement('div', { style: { fontSize: 12.5, color: 'var(--fs-muted)', lineHeight: 1.5, padding: '12px', borderRadius: 12, background: 'var(--color-surface-soft)' } },
          pro ? React.createElement('span', { style: { fontWeight: 540, color: 'var(--fs-accent)' } }, 'Pro 구독 중')
              : '무료 플랜 · 전체 열람은 Pro',
          React.createElement('div', { style: { marginTop: 4 } }, React.createElement('a', { href: '#', onClick: e => { e.preventDefault(); pro ? onManage() : onNav('report'); } }, pro ? '구독 관리' : '업그레이드 →')))),
      React.createElement('div', { className: 'fs-main' },
        React.createElement('div', { className: 'fs-topbar' },
          React.createElement('h1', null, titles[screen] || '리포트'),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
            React.createElement('button', { className: 'fs-iconbtn', onClick: onToggleTheme, 'aria-label': '테마 전환' }, React.createElement(window.FSIcon, { name: theme === 'dark' ? 'sun' : 'moon', size: 18 })),
            React.createElement('button', { className: 'fs-iconbtn', onClick: onSignOut, 'aria-label': '로그아웃' }, React.createElement(window.FSIcon, { name: 'logout', size: 18 })),
            React.createElement('span', { className: 'fs-avatar' }, '민'))),
        React.createElement('div', { className: 'fs-content' }, children)));
  }

  function App() {
    const [theme, setTheme] = React.useState(() => localStorage.getItem('fs-theme') || 'light');
    const [screen, setScreen] = React.useState('landing'); // landing | upload | analysis | report
    const [showAuth, setShowAuth] = React.useState(false);
    const [showPay, setShowPay] = React.useState(false);
    const [pro, setPro] = React.useState(false);

    React.useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('fs-theme', theme); }, [theme]);
    const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

    const startAuth = () => setShowAuth(true);
    const signIn = () => { setShowAuth(false); setScreen('upload'); };
    const signOut = () => { setScreen('landing'); setPro(false); };

    let body;
    if (screen === 'landing') {
      body = React.createElement(window.LandingScreen, { onStart: startAuth, theme, onToggleTheme: toggleTheme });
    } else {
      let inner;
      if (screen === 'upload') inner = React.createElement(window.UploadScreen, { onAnalyze: () => setScreen('analysis') });
      else if (screen === 'analysis') inner = React.createElement(window.AnalysisScreen, { onDone: () => setScreen('report') });
      else inner = React.createElement(window.ReportScreen, { pro, onUpgrade: () => setShowPay(true) });
      body = React.createElement(AppShell, {
        screen, theme, pro, onToggleTheme: toggleTheme, onSignOut: signOut,
        onNav: s => setScreen(s), onManage: () => alert('Polar 고객 포털로 이동합니다 (데모).') }, inner);
    }

    return React.createElement(React.Fragment, null, body,
      showAuth && React.createElement(window.AuthModal, { onClose: () => setShowAuth(false), onSignIn: signIn }),
      showPay && React.createElement(window.PaywallModal, { onClose: () => setShowPay(false), onSubscribe: () => { setPro(true); setShowPay(false); } }));
  }

  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
})();
