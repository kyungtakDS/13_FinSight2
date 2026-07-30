/* Free report + locked Pro sections + Polar-style paywall. */
(function () {
  const DS = window.FinSight2DesignSystem_56fb7f;
  const { Button } = DS;
  const D = window.FS_DATA;
  const won = D.won;
  const BigWon = ({ v, color }) => React.createElement('div', { className: 'fs-metric-big num', style: { color: color, display: 'flex', alignItems: 'baseline', gap: '0.06em' } },
    React.createElement('span', { style: { fontSize: '0.6em', fontWeight: 480, opacity: 0.8, letterSpacing: 0 } }, '₩'),
    Math.round(v).toLocaleString('ko-KR'));

  const Chip = ({ v }) => {
    const map = { biz: ['chip-biz', '사업 경비'], personal: ['chip-personal', '개인 지출'], unsure: ['chip-unsure', '애매'] };
    const [cls, label] = map[v];
    return React.createElement('span', { className: 'fs-chip ' + cls }, React.createElement('span', { className: 'cd' }), label);
  };

  function Donut() {
    let acc = 0;
    const stops = D.categories.map(c => { const start = acc; acc += c.pct * 100; return `${c.color} ${start}% ${acc}%`; }).join(', ');
    return React.createElement('div', { style: { display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' } },
      React.createElement('div', { style: { position: 'relative', width: 168, height: 168 } },
        React.createElement('div', { className: 'fs-donut', style: { background: `conic-gradient(${stops})` } }),
        React.createElement('div', { className: 'hole' },
          React.createElement('span', { style: { fontSize: 12, color: 'var(--fs-muted)' } }, '경비 후보'),
          React.createElement('span', { className: 'num', style: { fontSize: 18, fontWeight: 700, letterSpacing: '-0.4px' } }, won(D.bizTotal)))),
      React.createElement('div', { style: { flex: 1, minWidth: 240 } },
        D.categories.map(c => React.createElement('div', { key: c.name, className: 'fs-legend-row' },
          React.createElement('span', { className: 'sw', style: { background: c.color } }),
          React.createElement('span', { style: { flex: 1 } }, c.name),
          React.createElement('span', { className: 'num fs-muted', style: { fontSize: 13 } }, Math.round(c.pct * 100) + '%'),
          React.createElement('span', { className: 'num', style: { fontWeight: 540, minWidth: 92, textAlign: 'right' } }, won(c.amount))))));
  }

  function TxRow(t, i) {
    const neg = 0 > t.a;
    return React.createElement('tr', { key: i },
      React.createElement('td', { className: 'num fs-muted' }, t.d),
      React.createElement('td', { style: { fontWeight: 500 } }, t.m),
      React.createElement('td', { className: 'fs-muted' }, t.cat),
      React.createElement('td', null, React.createElement(Chip, { v: t.v })),
      React.createElement('td', { className: 'reason' }, t.r),
      React.createElement('td', { className: 'num amt' + (neg ? ' neg' : '') }, (neg ? '-' : '') + won(Math.abs(t.a))));
  }
  function TxTable({ rows }) {
    const head = ['날짜', '가맹점', '계정과목', '판정', '판정 근거', '금액'].map(h =>
      React.createElement('th', { key: h, style: h === '금액' ? { textAlign: 'right' } : null }, h));
    return React.createElement('div', { className: 'fs-tablewrap' },
      React.createElement('table', { className: 'fs-table' },
        React.createElement('thead', null, React.createElement('tr', null, head)),
        React.createElement('tbody', null, rows.map(TxRow))));
  }

  function Stat({ label, value, sub }) {
    return React.createElement('div', { className: 'fs-card', style: { padding: 20 } },
      React.createElement('div', { style: { fontSize: 13, color: 'var(--fs-muted)', marginBottom: 8 } }, label),
      React.createElement('div', { className: 'fs-metric num' }, value),
      sub && React.createElement('div', { style: { fontSize: 12.5, color: 'var(--fs-muted)', marginTop: 4 } }, sub));
  }

  function ReportScreen({ pro, onUpgrade }) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 32 } },
      // header
      React.createElement('div', null,
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 } },
          React.createElement('span', { className: 'fs-eyebrow' }, 'UC-06 · 무료 리포트'),
          React.createElement('span', { style: { fontSize: 12, color: 'var(--fs-muted)' } }, '· ' + D.file.period + ' · ' + D.file.rows + '건')),
        React.createElement('h2', { style: { fontSize: 30, fontWeight: 540, letterSpacing: '-0.6px', margin: 0 } }, '이 리포트는 파일 1개 기준입니다')),
      // savings hero
      React.createElement('div', { className: 'fs-card', style: { background: 'var(--fs-accent-soft)', border: '1px solid var(--fs-accent-line)' } },
        React.createElement('div', { style: { fontSize: 14, color: 'var(--fs-accent)', fontWeight: 540, marginBottom: 10 } }, '예상 절감액 (참고용)'),
        React.createElement(BigWon, { v: D.savings, color: 'var(--fs-accent)' }),
        React.createElement('p', { style: { fontSize: 13.5, color: 'var(--fs-muted)', margin: '12px 0 0', maxWidth: 560, lineHeight: 1.55 } },
          '경비 후보 합계 ' + won(D.bizTotal) + ' 에 가정 세율 ' + Math.round(D.RATE * 100) + '%를 적용한 보수적 추정입니다. “애매”로 분류된 건은 절감액에서 제외했습니다.')),
      // stat grid
      React.createElement('div', { className: 'fs-grid-3' },
        React.createElement(Stat, { label: '경비 후보 합계', value: won(D.bizTotal), sub: D.counts.biz + '건 (취소분 상계 포함)' }),
        React.createElement(Stat, { label: '개인 지출', value: won(D.personalTotal), sub: D.counts.personal + '건 · 절감액 제외' }),
        React.createElement(Stat, { label: '애매', value: D.counts.unsure + '건', sub: won(D.unsureTotal) + ' · 절감액 제외' })),
      // 애매 banner (숨기지 않음)
      React.createElement('div', { style: { display: 'flex', gap: 14, alignItems: 'flex-start', background: 'var(--fs-unsure-soft)', border: '1px solid var(--fs-unsure)', borderRadius: 'var(--radius-md)', padding: '16px 18px' } },
        React.createElement('span', { style: { color: 'var(--fs-unsure)', flexShrink: 0, marginTop: 1 } }, React.createElement(window.FSIcon, { name: 'spark', size: 20 })),
        React.createElement('div', null,
          React.createElement('div', { style: { fontWeight: 540, color: 'var(--fs-unsure)', marginBottom: 2 } }, '애매 ' + D.counts.unsure + '건 — 숨기지 않고 보여드립니다'),
          React.createElement('div', { style: { fontSize: 14, color: 'var(--fs-muted)', lineHeight: 1.5 } }, '업종을 특정할 수 없어 판정을 보류한 거래입니다. 이 건들은 세무사에게 따로 확인하세요.'))),
      // insights
      React.createElement('div', null,
        React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 } },
          React.createElement('h3', { style: { fontSize: 18, fontWeight: 540, margin: 0, letterSpacing: '-0.3px' } }, pro ? '전체 인사이트' : '상위 3개 인사이트'),
          !pro && React.createElement('span', { style: { fontSize: 13, color: 'var(--fs-muted)' } }, '무료 · 상위 3개')),
        React.createElement('div', { className: 'fs-grid-3' },
          D.insights.map((ins, i) => React.createElement('div', { key: i, className: 'fs-card', style: { padding: 20 } },
            React.createElement('span', { className: 'fs-chip chip-biz', style: { marginBottom: 12 } }, ins.tag),
            React.createElement('div', { style: { fontWeight: 540, fontSize: 15.5, letterSpacing: '-0.2px' } }, ins.title),
            React.createElement('div', { className: 'num', style: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', margin: '6px 0 8px' } }, won(ins.amount)),
            React.createElement('div', { style: { fontSize: 13, color: 'var(--fs-muted)', lineHeight: 1.5 } }, ins.note))))),
      // 계정과목 도넛
      React.createElement('div', { className: 'fs-card' },
        React.createElement('h3', { style: { fontSize: 18, fontWeight: 540, margin: '0 0 20px', letterSpacing: '-0.3px' } }, '계정과목별 집계'),
        React.createElement(Donut)),
      // transactions — locked or unlocked
      React.createElement('div', null,
        React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 } },
          React.createElement('h3', { style: { fontSize: 18, fontWeight: 540, margin: 0, letterSpacing: '-0.3px' } }, '거래별 분류 내역'),
          React.createElement('span', { style: { fontSize: 13, color: 'var(--fs-muted)' } }, D.counts.total + '건')),
        pro
          ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
              React.createElement(TxTable, { rows: D.TX }),
              React.createElement('div', { style: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' } },
                React.createElement(Button, { variant: 'primary', onClick: () => alert('세무사 전달용 CSV를 내려받습니다 (데모).') },
                  React.createElement(window.FSIcon, { name: 'download', size: 18 }), '세무사 전달용 파일 다운로드'),
                React.createElement('span', { style: { fontSize: 13, color: 'var(--fs-muted)' } }, 'CSV · 판정과 근거 포함')))
          : React.createElement('div', { className: 'fs-lockwrap' },
              React.createElement('div', { className: 'fs-lockblur' }, React.createElement(TxTable, { rows: D.TX.slice(0, 6) })),
              React.createElement('div', { className: 'fs-lockscrim' },
                React.createElement('span', { className: 'lk' }, React.createElement(window.FSIcon, { name: 'lock', size: 22 })),
                React.createElement('div', { style: { fontSize: 18, fontWeight: 540, letterSpacing: '-0.3px' } }, D.counts.total + '건의 거래별 판정과 근거가 잠겨 있습니다'),
                React.createElement('div', { style: { fontSize: 14, color: 'var(--fs-muted)', maxWidth: 420, lineHeight: 1.5 } }, '거래마다 사업 경비 / 개인 지출 / 애매 판정과 그 근거 한 줄, 그리고 세무사 전달용 파일 다운로드가 Pro에서 열립니다.'),
                React.createElement(Button, { variant: 'primary', size: 'lg', onClick: onUpgrade }, 'Pro로 전체 열람 · ₩9,900/월')))),
      // disclaimer
      React.createElement('p', { className: 'fs-disclaimer' },
        '본 서비스는 세무 자문이 아니라 경비 후보를 정리해 주는 도구입니다. 리포트의 “경비 처리 가능성이 높은 항목”과 “예상 절감액(참고용)”은 최종 판단이 아니며, 반드시 세무대리인과 상의하십시오. 이 리포트는 업로드한 파일 1개만을 기준으로 하며, 여러 리포트를 손으로 합산하면 중복이 생길 수 있습니다.'));
  }

  function PaywallModal({ onClose, onSubscribe }) {
    return React.createElement('div', { className: 'fs-scrim', onClick: onClose },
      React.createElement('div', { className: 'fs-modal', onClick: e => e.stopPropagation() },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
          React.createElement('span', { className: 'fs-eyebrow' }, 'Polar Checkout'),
          React.createElement('button', { className: 'fs-iconbtn', onClick: onClose, 'aria-label': '닫기', style: { width: 32, height: 32 } }, '✕')),
        React.createElement('h2', { style: { fontSize: 26, fontWeight: 540, letterSpacing: '-0.5px', margin: '14px 0 4px' } }, 'FinSight Pro'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 } },
          React.createElement('span', { className: 'num', style: { fontSize: 40, fontWeight: 340, letterSpacing: '-1px' } }, '₩9,900'),
          React.createElement('span', { style: { color: 'var(--fs-muted)', fontSize: 14 } }, '/ 월 · 언제든 해지')),
        React.createElement('ul', { style: { listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 12 } },
          ['거래별 전체 분류 + 판정 근거', '전체 인사이트', '세무사 전달용 파일 다운로드', '과거 분석 전부에 적용'].map(f =>
            React.createElement('li', { key: f, style: { display: 'flex', gap: 10, alignItems: 'center', fontSize: 14.5 } },
              React.createElement('span', { style: { color: 'var(--fs-biz)' } }, React.createElement(window.FSIcon, { name: 'check', size: 18 })), f))),
        React.createElement(Button, { variant: 'primary', fullWidth: true, size: 'lg', onClick: onSubscribe }, '구독 시작하기'),
        React.createElement('p', { style: { fontSize: 12, color: 'var(--fs-muted)', lineHeight: 1.55, marginTop: 16, marginBottom: 0, textAlign: 'center' } },
          '결제·영수증·해지는 Polar 고객 포털에서 관리됩니다. 해지 후에도 데이터는 지우지 않으며, 무료 화면은 계속 열립니다.')));
  }

  window.ReportScreen = ReportScreen;
  window.PaywallModal = PaywallModal;
})();
