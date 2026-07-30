/* FinSight — mock data layer. Realistic Korean freelancer card statement,
   server-side classification results, and derived aggregations. Exposed on window. */
(function () {
  const won = (n) => '₩' + Math.round(n).toLocaleString('ko-KR');

  // verdict: 'biz' 사업 경비 | 'personal' 개인 지출 | 'unsure' 애매
  // amount in KRW; negative = 취소/부분취소 (부호 보존, 집계에서 상계)
  const TX = [
    { d: '01.03', m: '우아한형제들',        a: 32000,  cat: '식비',        v: 'personal', r: '개인 식사로 추정 — 업무 관련성 근거 없음' },
    { d: '01.05', m: 'GS25 역삼점',         a: 8500,   cat: '미분류',      v: 'unsure',   r: '편의점 지출 — 업무·개인 구분 불가' },
    { d: '01.07', m: '카카오 T 택시',        a: 14300,  cat: '여비교통비',   v: 'biz',      r: '심야 이동 — 여비교통비 후보' },
    { d: '01.09', m: '스타벅스 강남R점',     a: 12800,  cat: '미분류',      v: 'unsure',   r: '카페 지출 — 미팅 여부 확인 필요' },
    { d: '01.12', m: 'Adobe',              a: 29000,  cat: '지급수수료',   v: 'biz',      r: '디자인 소프트웨어 정기구독' },
    { d: '01.14', m: 'GS칼텍스 셀프주유',    a: 68000,  cat: '여비교통비',   v: 'biz',      r: '차량 유류비 — 여비교통비 후보' },
    { d: '01.15', m: '쿠팡',                a: 43200,  cat: '소모품비',     v: 'biz',      r: '사무용품 구매 — 소모품비' },
    { d: '01.18', m: '배달의민족',           a: 28500,  cat: '식비',        v: 'personal', r: '개인 식사로 추정' },
    { d: '01.20', m: 'KT 통신요금',          a: 55000,  cat: '통신비',      v: 'biz',      r: '업무용 회선 — 통신비' },
    { d: '01.22', m: '교보문고',             a: 26400,  cat: '도서인쇄비',   v: 'biz',      r: '업무 관련 도서 — 도서인쇄비' },
    { d: '01.24', m: '올리브영',             a: 34900,  cat: '기타',        v: 'personal', r: '개인 생활용품으로 추정' },
    { d: '01.25', m: '네이버클라우드',        a: 22000,  cat: '지급수수료',   v: 'biz',      r: '서버 호스팅 — 지급수수료' },
    { d: '01.28', m: '한국철도 KTX',         a: 47800,  cat: '여비교통비',   v: 'biz',      r: '출장 교통 — 여비교통비' },
    { d: '02.01', m: '무신사',               a: 89000,  cat: '기타',        v: 'personal', r: '의류 구매로 추정' },
    { d: '02.03', m: '스타벅스 결제취소',     a: -8900,  cat: '미분류',      v: 'unsure',   r: '부분취소 — 집계에서 상계' },
    { d: '02.05', m: 'Notion Labs',        a: 12000,  cat: '지급수수료',   v: 'biz',      r: '협업 도구 정기구독' },
    { d: '02.07', m: 'CU 논현점',            a: 3200,   cat: '미분류',      v: 'unsure',   r: '편의점 지출 — 구분 불가' },
    { d: '02.09', m: '대한항공',             a: 156000, cat: '미분류',      v: 'unsure',   r: '항공권 — 출장·개인여행 구분 불가' },
    { d: '02.11', m: '다이소 강남',          a: 12700,  cat: '소모품비',     v: 'biz',      r: '사무 소모품 — 소모품비' },
    { d: '02.13', m: '우체국 택배',          a: 9800,   cat: '지급수수료',   v: 'biz',      r: '우편·택배 — 지급수수료' },
    { d: '02.15', m: '배달의민족',           a: 22000,  cat: '식비',        v: 'personal', r: '개인 식사로 추정' },
    { d: '02.17', m: 'Amazon Web Services', a: 41500,  cat: '지급수수료',   v: 'biz',      r: '클라우드 인프라 — 지급수수료' },
    { d: '02.19', m: '스타벅스 삼성점',       a: 25600,  cat: '접대비',      v: 'biz',      r: '거래처 미팅 — 접대비 후보' },
    { d: '02.21', m: '이마트 성수',          a: 68900,  cat: '기타',        v: 'personal', r: '개인 장보기로 추정' },
    { d: '02.23', m: '한국철도 KTX',         a: 47800,  cat: '여비교통비',   v: 'biz',      r: '출장 교통 — 여비교통비' },
    { d: '02.25', m: 'LinkedIn',           a: 39000,  cat: '광고선전비',   v: 'biz',      r: '채용·홍보 — 광고선전비' },
    { d: '02.27', m: 'CGV 강남',            a: 28000,  cat: '기타',        v: 'personal', r: '개인 여가로 추정' },
  ];

  const sum = (arr) => arr.reduce((s, t) => s + t.a, 0);
  const biz = TX.filter(t => t.v === 'biz');
  const personal = TX.filter(t => t.v === 'personal');
  const unsure = TX.filter(t => t.v === 'unsure');

  const bizTotal = sum(biz);            // 경비 후보 합계 (취소분 상계 포함)
  const personalTotal = sum(personal);
  const unsureTotal = sum(unsure);
  const RATE = 0.165;                    // 가정 한계세율 15% + 지방소득세 1.5% (참고용)
  const savings = bizTotal * RATE;

  // 계정과목별 집계 (사업 경비만)
  const catMap = {};
  biz.forEach(t => { catMap[t.cat] = (catMap[t.cat] || 0) + t.a; });
  const CAT_COLORS = ['#22285f', '#4a5199', '#7a80c4', '#a7abd8', '#cdd0ec', '#e6e7f5'];
  const categories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount], i) => ({ name, amount, color: CAT_COLORS[i % CAT_COLORS.length], pct: amount / bizTotal }));

  // 상위 3 인사이트 (무료 노출)
  const subTx = biz.filter(t => t.cat === '지급수수료');
  const transitTx = biz.filter(t => t.cat === '여비교통비');
  const suppliesTx = biz.filter(t => t.cat === '소모품비' || t.cat === '도서인쇄비');
  const insights = [
    { tag: '정기구독', title: '정기 구독성 지출 ' + subTx.length + '건', amount: sum(subTx),
      note: 'Adobe · Notion · AWS · 네이버클라우드 — 대부분 지급수수료로 경비 처리 가능성이 높습니다.' },
    { tag: '여비교통비', title: '교통·출장 지출 ' + transitTx.length + '건', amount: sum(transitTx),
      note: 'KTX · 주유 · 택시. 출장 목적을 남겨두면 여비교통비 근거가 됩니다.' },
    { tag: '소모품·도서', title: '사무 소모품·도서 ' + suppliesTx.length + '건', amount: sum(suppliesTx),
      note: '쿠팡 · 다이소 · 교보문고 — 소모품비/도서인쇄비 후보입니다.' },
  ];

  window.FS_DATA = {
    won, TX, biz, personal, unsure,
    bizTotal, personalTotal, unsureTotal, savings, RATE,
    counts: { total: TX.length, biz: biz.length, personal: personal.length, unsure: unsure.length },
    categories, insights,
    file: { name: '신한카드_202501-02_이용내역.csv', issuer: '신한카드', encoding: 'CP949 (자동 변환)', rows: TX.length, sizeKB: 42, period: '2025.01.03 – 02.27' },
  };
})();
