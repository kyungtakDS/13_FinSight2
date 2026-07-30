/* Auth modal, Upload (+ auto-detect), and Analysis (progress) screens. */
(function () {
  const DS = window.FinSight2DesignSystem_56fb7f;
  const { Button } = DS;
  const D = window.FS_DATA;

  // ---------- Auth ----------
  function AuthModal({ onClose, onSignIn }) {
    return React.createElement('div', { className: 'fs-scrim', onClick: onClose },
      React.createElement('div', { className: 'fs-modal', onClick: e => e.stopPropagation() },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 8 } },
          React.createElement('span', { style: { width: 10, height: 10, borderRadius: '50%', background: 'var(--fs-accent)' } }), 'FinSight'),
        React.createElement('h2', { style: { fontSize: 24, fontWeight: 540, letterSpacing: '-0.5px', margin: '0 0 8px' } }, '로그인하고 시작하기'),
        React.createElement('p', { style: { fontSize: 14.5, color: 'var(--fs-muted)', lineHeight: 1.5, margin: '0 0 24px' } }, '카드 명세서를 다루는 서비스라 익명 업로드는 지원하지 않습니다. Google 계정으로 안전하게 시작하세요.'),
        React.createElement('button', { className: 'fs-google', onClick: onSignIn },
          React.createElement(window.FSGoogle, { size: 20 }), 'Google 계정으로 계속하기'),
        React.createElement('p', { style: { fontSize: 12, color: 'var(--fs-muted)', lineHeight: 1.6, marginTop: 20, marginBottom: 0 } },
          '계속하면 ', React.createElement('a', { href: '#' }, '이용약관'), '과 ', React.createElement('a', { href: '#' }, '개인정보처리방침'), '에 동의하는 것으로 봅니다. 본 서비스는 세무 자문이 아닙니다.')));
  }

  // ---------- Upload ----------
  function DetectRow({ k, v, ok }) {
    return React.createElement('div', { className: 'fs-detect-row' },
      React.createElement('span', { className: 'k' }, k),
      React.createElement('span', { className: 'v' }, ok && React.createElement(window.FSIcon, { name: 'check', size: 16, style: { color: 'var(--fs-biz)' } }), v));
  }

  function UploadScreen({ onAnalyze }) {
    const [file, setFile] = React.useState(null);
    const [drag, setDrag] = React.useState(false);
    const pick = () => setFile(D.file);
    if (!file) {
      return React.createElement('div', { style: { maxWidth: 640, margin: '0 auto' } },
        React.createElement('span', { className: 'fs-eyebrow' }, 'UC-04 · 업로드'),
        React.createElement('h2', { style: { fontSize: 30, fontWeight: 540, letterSpacing: '-0.6px', margin: '10px 0 6px' } }, '카드 명세서 CSV를 올리세요'),
        React.createElement('p', { style: { color: 'var(--fs-muted)', margin: '0 0 28px', fontSize: 15.5 } }, '카드사마다 양식이 달라도 괜찮습니다. 인코딩과 컬럼 구조를 자동으로 판별합니다.'),
        React.createElement('div', { className: 'fs-drop' + (drag ? ' drag' : ''), onClick: pick,
          onDragOver: e => { e.preventDefault(); setDrag(true); }, onDragLeave: () => setDrag(false),
          onDrop: e => { e.preventDefault(); setDrag(false); pick(); } },
          React.createElement('span', { className: 'up' }, React.createElement(window.FSIcon, { name: 'upload', size: 24 })),
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: 17, fontWeight: 540 } }, '파일을 끌어다 놓거나 클릭해 선택'),
            React.createElement('div', { style: { color: 'var(--fs-muted)', fontSize: 14, marginTop: 4 } }, 'CSV 전용 · 최대 2MB / 3,000행')),
          React.createElement(Button, { variant: 'secondary', onClick: e => { e.stopPropagation(); pick(); } }, '파일 선택')),
        React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' } },
          ['XLSX·PDF는 지원하지 않습니다 (CSV로 변환 안내)', '카드번호·승인번호는 저장하지 않습니다'].map(t =>
            React.createElement('span', { key: t, style: { fontSize: 12.5, color: 'var(--fs-muted)', background: 'var(--color-surface-soft)', padding: '6px 12px', borderRadius: 50 } }, t))),
        React.createElement('p', { style: { marginTop: 24, fontSize: 13.5 } }, React.createElement('a', { href: '#' }, '카드사별 CSV 내려받는 법 →')));
    }
    return React.createElement('div', { style: { maxWidth: 640, margin: '0 auto' } },
      React.createElement('span', { className: 'fs-eyebrow' }, '자동 판별 완료'),
      React.createElement('h2', { style: { fontSize: 30, fontWeight: 540, letterSpacing: '-0.6px', margin: '10px 0 6px' } }, '이 파일을 이렇게 읽었습니다'),
      React.createElement('p', { style: { color: 'var(--fs-muted)', margin: '0 0 24px', fontSize: 15.5 } }, '맞으면 분석을 시작하세요. 사용자가 컬럼을 맞춰줄 필요는 없습니다.'),
      React.createElement('div', { className: 'fs-card' },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 } },
          React.createElement('span', { style: { width: 40, height: 40, borderRadius: 10, background: 'var(--fs-accent-soft)', color: 'var(--fs-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(window.FSIcon, { name: 'file', size: 20 })),
          React.createElement('div', { style: { minWidth: 0 } },
            React.createElement('div', { style: { fontWeight: 540, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, file.name),
            React.createElement('div', { style: { fontSize: 13, color: 'var(--fs-muted)' } }, file.sizeKB + 'KB · ' + file.period))),
        React.createElement(DetectRow, { k: '카드사', v: file.issuer, ok: true }),
        React.createElement(DetectRow, { k: '인코딩', v: file.encoding, ok: true }),
        React.createElement(DetectRow, { k: '거래 행 수', v: file.rows + '행', ok: true }),
        React.createElement(DetectRow, { k: '컬럼 매핑', v: '이용일자→날짜 · 가맹점명→상호 · 이용금액→금액', ok: true }),
        React.createElement(DetectRow, { k: '민감정보 제거', v: '카드번호·승인번호 제거됨', ok: true })),
      React.createElement('div', { style: { display: 'flex', gap: 12, marginTop: 24 } },
        React.createElement(Button, { variant: 'primary', size: 'lg', onClick: onAnalyze }, '분석 시작하기'),
        React.createElement(Button, { variant: 'tertiary', onClick: () => setFile(null) }, '다른 파일 선택')));
  }

  // ---------- Analysis ----------
  const STEPS = ['파일 파싱 및 정규화', '컬럼 구조 판별', '가맹점 사전 대조', '업종 분류 (AI)', '집계 · 절감액 계산'];
  function AnalysisScreen({ onDone }) {
    const [step, setStep] = React.useState(0);
    React.useEffect(() => {
      if (step >= STEPS.length) { const t = setTimeout(onDone, 700); return () => clearTimeout(t); }
      const t = setTimeout(() => setStep(s => s + 1), step === 3 ? 1600 : 900);
      return () => clearTimeout(t);
    }, [step]);
    const pct = Math.min(100, Math.round((step / STEPS.length) * 100));
    return React.createElement('div', { style: { maxWidth: 560, margin: '0 auto' } },
      React.createElement('span', { className: 'fs-eyebrow' }, 'UC-05 · 분석 중'),
      React.createElement('h2', { style: { fontSize: 30, fontWeight: 540, letterSpacing: '-0.6px', margin: '10px 0 6px' } }, '경비 후보를 분류하는 중입니다'),
      React.createElement('p', { style: { color: 'var(--fs-muted)', margin: '0 0 28px', fontSize: 15.5 } }, '탭을 닫아도 분석은 서버에서 계속됩니다. 끝나면 리포트가 준비됩니다.'),
      React.createElement('div', { className: 'fs-card' },
        React.createElement('div', { className: 'fs-pbar', style: { marginBottom: 8 } }, React.createElement('span', { style: { width: pct + '%' } })),
        React.createElement('div', { style: { fontSize: 13, color: 'var(--fs-muted)', textAlign: 'right', marginBottom: 8 } }, pct + '%'),
        STEPS.map((s, i) => {
          const state = step > i ? 'done' : i === step ? 'active' : 'pending';
          return React.createElement('div', { key: i, className: 'fs-step ' + state },
            React.createElement('span', { className: 'mark' },
              state === 'done' ? React.createElement(window.FSIcon, { name: 'check', size: 15 }) : state === 'active' ? React.createElement('span', { className: 'spin' }) : null),
            React.createElement('span', null, s));
        })));
  }

  window.AuthModal = AuthModal;
  window.UploadScreen = UploadScreen;
  window.AnalysisScreen = AnalysisScreen;
})();
