/* Shared inline-SVG icons + Google mark. Exposed on window.FSIcon / window.FSGoogle. */
(function () {
  const P = (d, extra) => React.createElement('path', Object.assign({ d, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }, extra || {}));
  const PATHS = {
    upload: ['M12 15V4', 'M8 8l4-4 4 4', 'M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'],
    report: ['M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M14 3v6h6', 'M9 13h6', 'M9 17h4'],
    history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v4h4', 'M12 8v4l3 2'],
    settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L16 2H8l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2L8 22h8l.5-2.5a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5A7 7 0 0 0 19 12z'],
    sun: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4'],
    moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
    lock: ['M6 10h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z', 'M8 10V7a4 4 0 0 1 8 0v3'],
    download: ['M12 3v12', 'M8 11l4 4 4-4', 'M4 21h16'],
    check: ['M4 12l5 5L20 6'],
    arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
    file: ['M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M14 3v6h6'],
    spark: ['M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z'],
    logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  };
  function FSIcon({ name, size = 20, style }) {
    const paths = PATHS[name] || [];
    return React.createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true, style },
      paths.map((d, i) => P(d, { key: i })));
  }
  function FSGoogle({ size = 20 }) {
    return React.createElement('svg', { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true },
      React.createElement('path', { fill: '#4285F4', d: 'M21.6 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.24C20.5 17.7 21.6 15.2 21.6 12.2z' }),
      React.createElement('path', { fill: '#34A853', d: 'M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22z' }),
      React.createElement('path', { fill: '#FBBC05', d: 'M6.4 13.9a6 6 0 0 1 0-3.82V7.5H3.06a10 10 0 0 0 0 9l3.34-2.6z' }),
      React.createElement('path', { fill: '#EA4335', d: 'M12 5.98c1.47 0 2.78.5 3.82 1.5l2.85-2.85A10 10 0 0 0 3.06 7.5l3.34 2.58C7.2 7.73 9.4 5.98 12 5.98z' }));
  }
  window.FSIcon = FSIcon;
  window.FSGoogle = FSGoogle;
})();
