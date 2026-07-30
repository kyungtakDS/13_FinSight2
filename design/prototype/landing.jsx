/* Landing (marketing) — DS pastel color-block system. Korean copy.
   Composes with FinSight2 DS: Button, ColorBlock, MarqueeStrip, PricingCard, Footer. */
(function () {
  const DS = window.FinSight2DesignSystem_56fb7f;
  const { Button, ColorBlock, MarqueeStrip, PricingCard, Footer } = DS;

  function Nav({ onStart, theme, onToggleTheme }) {
    return React.createElement('header', { style: { background: 'var(--color-canvas)', borderBottom: '1px solid var(--color-hairline)', position: 'sticky', top: 0, zIndex: 20 } },
      React.createElement('nav', { style: { maxWidth: 'var(--container-max)', margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', padding: '0 var(--space-lg)' } },
        React.createElement('span', { style: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', { style: { width: 10, height: 10, borderRadius: '50%', background: 'var(--fs-accent)' } }), 'FinSight'),
        React.createElement('ul', { style: { display: 'flex', gap: 'var(--space-md)', listStyle: 'none', margin: 0, padding: 0, flex: 1, fontSize: 15 } },
          ['작동 방식', '가격', '데이터 처리'].map(l => React.createElement('li', { key: l }, React.createElement('a', { href: '#', style: { color: 'var(--color-ink)', fontWeight: 450 } }, l)))),
        React.createElement('button', { className: 'fs-iconbtn', onClick: onToggleTheme, 'aria-label': '테마 전환' }, React.createElement(window.FSIcon, { name: theme === 'dark' ? 'sun' : 'moon', size: 18 })),
        React.createElement(Button, { variant: 'tertiary', onClick: onStart }, '로그인'),
        React.createElement(Button, { variant: 'primary', onClick: onStart }, '무료로 시작하기')));
  }

  function LandingScreen({ onStart, theme, onToggleTheme }) {
    const wrap = (children, extra) => React.createElement('div', { style: Object.assign({ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '0 var(--space-lg)' }, extra) }, children);
    return React.createElement('div', { style: { background: 'var(--color-canvas)', minHeight: '100vh' } },
      React.createElement(Nav, { onStart, theme, onToggleTheme }),
      React.createElement(MarqueeStrip, { items: ['신한카드', '삼성카드', '현대카드', 'KB국민카드', '롯데카드', '우리카드', 'BC카드', '하나카드'] }),
      // hero
      wrap(React.createElement('div', { style: { maxWidth: 860, margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', alignItems: 'center' } },
        React.createElement('span', { className: 't-eyebrow', style: { opacity: 0.55 } }, '프리랜서·1인 사업자를 위한'),
        React.createElement('h1', { className: 't-display-xl', style: { margin: 0 } }, '카드 명세서를 올리면, 경비가 정리됩니다'),
        React.createElement('p', { className: 't-body-lg', style: { margin: 0, maxWidth: 620 } }, '수백 건의 카드 내역을 사업 경비 후보로 자동 분류해, 세무사에게 그대로 넘길 정리본을 만들어 드립니다. 가계부가 아니라, 경비 정리 도구입니다.'),
        React.createElement('div', { style: { display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', justifyContent: 'center' } },
          React.createElement(Button, { variant: 'primary', size: 'lg', onClick: onStart }, 'CSV 올리고 절감액 보기'),
          React.createElement(Button, { variant: 'secondary', size: 'lg', href: '#how' }, '작동 방식 보기')),
        React.createElement('span', { className: 't-caption', style: { opacity: 0.5 } }, '카드번호·승인번호는 저장하지 않습니다 · 원본 90일 후 자동 삭제')),
        { paddingTop: 'var(--space-section)', paddingBottom: 'var(--space-section)' }),
      // color blocks
      React.createElement('div', { id: 'how' },
        wrap(React.createElement(ColorBlock, { variant: 'lime', eyebrow: '무료로 자기 숫자부터', title: '결제 전에, 당신의 예상 절감액을 먼저 봅니다.' },
          '업로드하면 무료로 절세 추정액과 상위 3개 인사이트를 바로 봅니다. 랜딩 페이지의 약속이 아니라, 당신의 실제 카드 내역으로 계산한 숫자입니다.'),
          { paddingBottom: 'var(--space-section)' }),
        wrap(React.createElement(ColorBlock, { variant: 'navy', eyebrow: '데이터 처리', title: '누가·언제·얼마 썼는지는 서버 밖으로 나가지 않습니다.' },
          'AI에는 가맹점 상호명과 CSV 헤더 구조만 전달합니다. 금액·날짜·카드번호·사용자 정보는 전송 대상이 아닙니다. 합계와 절감액은 우리 서버가 직접 계산합니다.'),
          { paddingBottom: 'var(--space-section)' }),
        wrap(React.createElement(ColorBlock, { variant: 'coral', eyebrow: '보수적으로', title: '애매한 건 절감액에서 뺍니다. 과대 추정은 당신의 리스크니까요.' },
          '업종을 특정할 수 없는 지출은 “애매”로 따로 표시하고 추정액에서 제외합니다. 추정액은 언제나 보수적인 하한입니다.'),
          { paddingBottom: 'var(--space-section)' })),
      // steps
      wrap(React.createElement('div', null,
        React.createElement('h2', { className: 't-display-lg', style: { margin: '0 0 var(--space-xl)', maxWidth: 620 } }, '네 단계면 끝납니다'),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-lg)' } },
          [['01', 'CSV 업로드', '카드사 사이트에서 내려받은 파일 그대로. 인코딩·컬럼은 자동 판별합니다.'],
           ['02', '자동 분류', '거래별로 사업 경비 / 개인 지출 / 애매를 판정하고 근거를 답니다.'],
           ['03', '무료 리포트', '예상 절감액과 상위 3개 인사이트를 무료로 확인합니다.'],
           ['04', '전달용 파일', 'Pro로 전체 내역과 세무사 전달용 파일을 받습니다.']].map(s =>
            React.createElement('div', { key: s[0], style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              React.createElement('span', { className: 't-eyebrow', style: { color: 'var(--fs-accent)' } }, s[0]),
              React.createElement('span', { className: 't-card-title', style: { fontSize: 20 } }, s[1]),
              React.createElement('span', { className: 't-body-sm', style: { color: 'var(--fs-muted)' } }, s[2]))))),
        { paddingBottom: 'var(--space-section)' }),
      // pricing
      wrap(React.createElement('div', { id: 'pricing' },
        React.createElement('div', { style: { textAlign: 'center', marginBottom: 'var(--space-xl)' } },
          React.createElement('span', { className: 't-eyebrow', style: { opacity: 0.55 } }, '가격'),
          React.createElement('h2', { className: 't-display-lg', style: { margin: '8px 0 0' } }, '업로드는 무제한. Pro는 전체 열람과 다운로드.')),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', maxWidth: 780, margin: '0 auto', alignItems: 'start' } },
          React.createElement(PricingCard, { name: '무료', price: '₩0', period: '영구 무료', blurb: '업로드·분석 무제한. 자기 숫자를 먼저 확인하세요.',
            features: ['업로드·분석 무제한', '예상 절감액', '상위 3개 인사이트'], ctaLabel: '무료로 시작하기', ctaVariant: 'secondary', onCta: onStart }),
          React.createElement(PricingCard, { name: 'Pro', price: '₩9,900', period: '월 구독', blurb: '거래별 전체 분류와 세무사 전달용 다운로드까지.', featured: true,
            features: ['무료의 모든 기능', '거래별 전체 분류 + 판정 근거', '전체 인사이트', '세무사 전달용 파일 다운로드', '언제든 해지 가능'], ctaLabel: 'Pro 시작하기', onCta: onStart }))),
        { paddingBottom: 'var(--space-section)' }),
      // disclaimer strip
      wrap(React.createElement('p', { style: { fontSize: 13, color: 'var(--fs-muted)', lineHeight: 1.6, textAlign: 'center', maxWidth: 720, margin: '0 auto' } },
        '본 서비스는 세무 자문이 아니라 경비 후보를 정리해 주는 도구입니다. 최종 판단은 세무대리인과 상의하십시오. “예상 절감액”은 참고용 추정치입니다.'),
        { paddingBottom: 'var(--space-section)' }),
      React.createElement(Footer, { brand: 'FinSight',
        columns: [
          { head: '제품', links: ['작동 방식', '가격', '데이터 처리', '보안'] },
          { head: '지원', links: ['카드사별 CSV 받기', '자주 묻는 질문', '문의하기'] },
          { head: '회사', links: ['소개', '블로그', '채용'] },
          { head: '약관', links: ['이용약관', '개인정보처리방침', '세무 고지'] }] }));
  }
  window.LandingScreen = LandingScreen;
})();
