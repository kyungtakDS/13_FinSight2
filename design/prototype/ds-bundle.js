/* @ds-bundle: {"format":4,"namespace":"FinSight2DesignSystem_56fb7f","components":[{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"IconButton","sourcePath":"components/buttons/IconButton.jsx"},{"name":"TextInput","sourcePath":"components/forms/TextInput.jsx"},{"name":"Footer","sourcePath":"components/navigation/Footer.jsx"},{"name":"MarqueeStrip","sourcePath":"components/navigation/MarqueeStrip.jsx"},{"name":"TopNav","sourcePath":"components/navigation/TopNav.jsx"},{"name":"CheckGlyph","sourcePath":"components/pricing/CheckGlyph.jsx"},{"name":"PricingTabs","sourcePath":"components/pricing/PricingTabs.jsx"},{"name":"ColorBlock","sourcePath":"components/surfaces/ColorBlock.jsx"},{"name":"FeatureTile","sourcePath":"components/surfaces/FeatureTile.jsx"},{"name":"PricingCard","sourcePath":"components/surfaces/PricingCard.jsx"},{"name":"PromoBanner","sourcePath":"components/surfaces/PromoBanner.jsx"},{"name":"TemplateCard","sourcePath":"components/surfaces/TemplateCard.jsx"}],"sourceHashes":{"components/buttons/Button.jsx":"a26c148adc82","components/buttons/IconButton.jsx":"1b78af053131","components/forms/TextInput.jsx":"005ef8196c65","components/navigation/Footer.jsx":"4de744c5436c","components/navigation/MarqueeStrip.jsx":"e6c1edd53213","components/navigation/TopNav.jsx":"14b01c470941","components/pricing/CheckGlyph.jsx":"0eaf1f7c949f","components/pricing/PricingTabs.jsx":"49a860e18eca","components/surfaces/ColorBlock.jsx":"36e246c7ee4d","components/surfaces/FeatureTile.jsx":"1e1600e74f9e","components/surfaces/PricingCard.jsx":"8d1022909e05","components/surfaces/PromoBanner.jsx":"ed05ad4d0539","components/surfaces/TemplateCard.jsx":"21cfd10eaf3f","ui_kits/marketing/ContactScreen.jsx":"268636dd8795","ui_kits/marketing/HomeScreen.jsx":"b45edd22cd1b","ui_kits/marketing/PricingScreen.jsx":"bf16124f0d1a"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.FinSight2DesignSystem_56fb7f = window.FinSight2DesignSystem_56fb7f || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/buttons/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * FinSight2 pill button. Pill is the only button shape in the system.
 * Variants map 1:1 to the spec: primary (black), secondary (white),
 * tertiary (text hit-target), magenta (single-shot promo CTA).
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  href,
  onClick,
  type = 'button',
  style = {},
  ...rest
}) {
  const base = {
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--type-button-size)',
    lineHeight: 'var(--type-button-lh)',
    letterSpacing: 'var(--type-button-ls)',
    fontWeight: 'var(--type-button-weight)',
    borderRadius: 'var(--radius-pill)',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-xs)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    minHeight: '44px',
    boxSizing: 'border-box',
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.4 : 1,
    transition: 'transform 120ms ease, background-color 120ms ease'
  };
  const variants = {
    primary: {
      background: 'var(--color-primary)',
      color: 'var(--color-on-primary)',
      padding: size === 'lg' ? '14px 28px' : '10px 20px'
    },
    secondary: {
      background: 'var(--color-canvas)',
      color: 'var(--color-ink)',
      padding: '8px 18px 10px',
      boxShadow: 'inset 0 0 0 1px var(--color-hairline)'
    },
    tertiary: {
      background: 'transparent',
      color: 'var(--color-ink)',
      padding: 'var(--space-xs) var(--space-sm)',
      borderRadius: 'var(--radius-full)',
      minHeight: 'auto',
      fontSize: 'var(--type-link-size)',
      fontWeight: 'var(--type-link-weight)'
    },
    magenta: {
      background: 'var(--color-accent-magenta)',
      color: 'var(--color-on-primary)',
      padding: '10px 18px'
    }
  };
  const composed = {
    ...base,
    ...variants[variant],
    ...style
  };
  const Tag = href ? 'a' : 'button';
  const tagProps = href ? {
    href
  } : {
    type,
    disabled
  };
  return /*#__PURE__*/React.createElement(Tag, _extends({}, tagProps, {
    onClick: onClick,
    style: composed,
    onMouseDown: e => {
      if (!disabled) e.currentTarget.style.transform = 'scale(0.97)';
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = 'scale(1)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'scale(1)';
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/buttons/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * FinSight2 circular icon button. 40px on light surfaces, inverse variant
 * for dark color blocks (translucent white surface). Always a full circle.
 */
function IconButton({
  children,
  variant = 'default',
  size = 40,
  disabled = false,
  ariaLabel,
  onClick,
  style = {},
  ...rest
}) {
  const variants = {
    default: {
      background: 'var(--color-surface-soft)',
      color: 'var(--color-ink)'
    },
    inverse: {
      background: 'var(--icon-inverse-surface)',
      color: 'var(--color-block-ink-inverse)'
    }
  };
  const composed = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: 'var(--radius-full)',
    border: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    padding: 0,
    fontSize: Math.round(size * 0.45),
    transition: 'transform 120ms ease',
    ...variants[variant],
    ...style
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": ariaLabel,
    disabled: disabled,
    onClick: onClick,
    style: composed,
    onMouseDown: e => {
      if (!disabled) e.currentTarget.style.transform = 'scale(0.94)';
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = 'scale(1)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'scale(1)';
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * FinSight2 form field. Hairline border, radius-md, 12px/14px padding.
 * Focus is communicated via a ring, not a fill change (surface unchanged).
 */
function TextInput({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
  as = 'input',
  rows = 4,
  style = {},
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const field = {
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--type-body-size)',
    lineHeight: 'var(--type-body-lh)',
    letterSpacing: 'var(--type-body-ls)',
    fontWeight: 'var(--type-body-weight)',
    color: 'var(--color-ink)',
    background: 'var(--color-canvas)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-hairline)',
    padding: '12px 14px',
    minHeight: '48px',
    outline: 'none',
    boxShadow: focused ? '0 0 0 3px rgba(0,0,0,0.12)' : 'none',
    transition: 'box-shadow 120ms ease',
    resize: as === 'textarea' ? 'vertical' : undefined,
    ...style
  };
  const Field = as;
  const fieldProps = as === 'textarea' ? {
    rows
  } : {
    type
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-xs)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--type-body-lg-size)',
      fontWeight: 'var(--type-body-lg-weight)',
      letterSpacing: 'var(--type-body-lg-ls)',
      color: 'var(--color-ink)'
    }
  }, label), /*#__PURE__*/React.createElement(Field, _extends({
    id: id,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: field
  }, fieldProps, rest)));
}
Object.assign(__ds_scope, { TextInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextInput.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Footer.jsx
try { (() => {
const DEFAULT_COLUMNS = [{
  head: 'Product',
  links: ['Design', 'FigJam', 'Dev Mode', 'Prototyping', 'Pricing']
}, {
  head: 'Resources',
  links: ['Blog', 'Support', 'Community', 'Templates', 'Best practices']
}, {
  head: 'Company',
  links: ['About', 'Careers', 'Customers', 'Newsroom', 'Contact']
}, {
  head: 'Legal',
  links: ['Privacy', 'Terms', 'Security', 'Cookies']
}];

/**
 * Dense footer link grid on white canvas, wordmark set in display weight at
 * the top-left. Caption (mono, uppercase) column heads; body-sm links.
 */
function Footer({
  brand = 'FinSight2',
  columns = DEFAULT_COLUMNS,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: 'var(--color-canvas)',
      color: 'var(--color-ink)',
      borderTop: '1px solid var(--color-hairline)',
      padding: 'var(--space-section) var(--space-xl)',
      boxSizing: 'border-box',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: '1.4fr repeat(4, 1fr)',
      gap: 'var(--space-xl)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 40,
      fontWeight: 340,
      letterSpacing: '-0.96px'
    }
  }, brand), columns.map(col => /*#__PURE__*/React.createElement("div", {
    key: col.head,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--type-caption-size)',
      letterSpacing: 'var(--type-caption-ls)',
      textTransform: 'uppercase',
      opacity: 0.55
    }
  }, col.head), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)'
    }
  }, col.links.map(l => /*#__PURE__*/React.createElement("li", {
    key: l
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--type-body-sm-size)',
      fontWeight: 'var(--type-body-sm-weight)',
      color: 'var(--color-ink)',
      textDecoration: 'none'
    }
  }, l))))))));
}
Object.assign(__ds_scope, { Footer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Footer.jsx", error: String((e && e.message) || e) }); }

// components/navigation/MarqueeStrip.jsx
try { (() => {
/**
 * Thin black ribbon under the nav that scrolls customer names in white.
 * 36px tall, inverse-canvas ground. Marquee animates via keyframes injected once.
 */
function MarqueeStrip({
  items = [],
  style = {}
}) {
  React.useEffect(() => {
    if (document.getElementById('fs2-marquee-kf')) return;
    const s = document.createElement('style');
    s.id = 'fs2-marquee-kf';
    s.textContent = '@keyframes fs2-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}';
    document.head.appendChild(s);
  }, []);
  const track = [...items, ...items];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-inverse-canvas)',
      color: 'var(--color-inverse-ink)',
      height: 36,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-xl)',
      whiteSpace: 'nowrap',
      animation: 'fs2-marquee 28s linear infinite',
      paddingLeft: 'var(--space-xl)'
    }
  }, track.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--type-body-sm-size)',
      fontWeight: 'var(--type-body-sm-weight)',
      opacity: 0.9
    }
  }, t))));
}
Object.assign(__ds_scope, { MarqueeStrip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/MarqueeStrip.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopNav.jsx
try { (() => {
/**
 * Sticky top navigation. White bar, wordmark left, primary links center-left,
 * right-anchored secondary + primary pill pair. 56px tall on desktop.
 * No logo mark was provided, so the brand shows as a display-weight wordmark.
 */
function TopNav({
  brand = 'FinSight2',
  links = ['Products', 'Solutions', 'Community', 'Resources', 'Pricing'],
  onSignIn,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      background: 'var(--color-canvas)',
      color: 'var(--color-ink)',
      borderBottom: '1px solid var(--color-hairline)',
      boxSizing: 'border-box',
      ...style
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-lg)',
      padding: '0 var(--space-lg)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: '-0.5px'
    }
  }, brand), /*#__PURE__*/React.createElement("ul", {
    style: {
      display: 'flex',
      gap: 'var(--space-md)',
      listStyle: 'none',
      margin: 0,
      padding: 0,
      flex: 1
    }
  }, links.map(l => /*#__PURE__*/React.createElement("li", {
    key: l
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--type-body-sm-size)',
      fontWeight: 'var(--type-body-sm-weight)',
      color: 'var(--color-ink)',
      textDecoration: 'none',
      padding: 'var(--space-xs) var(--space-xs)'
    }
  }, l)))), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "tertiary",
    onClick: onSignIn
  }, "Sign in"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary"
  }, "Contact sales"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary"
  }, "Get started for free")));
}
Object.assign(__ds_scope, { TopNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopNav.jsx", error: String((e && e.message) || e) }); }

// components/pricing/CheckGlyph.jsx
try { (() => {
/**
 * Comparison-table checkmark. Green glyph on a canvas circle — used as a
 * glyph fill in the pricing matrix, not as a surface color.
 */
function CheckGlyph({
  size = 16,
  present = true,
  style = {}
}) {
  if (!present) {
    return /*#__PURE__*/React.createElement("span", {
      "aria-label": "not included",
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 8,
        height: size + 8,
        color: 'var(--color-hairline)',
        fontSize: size,
        ...style
      }
    }, "\u2014");
  }
  return /*#__PURE__*/React.createElement("span", {
    "aria-label": "included",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size + 8,
      height: size + 8,
      borderRadius: 'var(--radius-full)',
      background: 'var(--color-canvas)',
      color: 'var(--color-success)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 8.5L6.2 11.5L13 4.5",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })));
}
Object.assign(__ds_scope, { CheckGlyph });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pricing/CheckGlyph.jsx", error: String((e && e.message) || e) }); }

// components/pricing/PricingTabs.jsx
try { (() => {
/**
 * FinSight2 pricing pill-toggle. Selected tab uses the exact button-primary
 * surface (black), so the active tab reads as an active CTA, not a passive state.
 */
function PricingTabs({
  tabs = [],
  value,
  onChange,
  style = {}
}) {
  const active = value ?? tabs[0];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      gap: 'var(--space-xs)',
      padding: 'var(--space-xxs)',
      background: 'var(--color-surface-soft)',
      borderRadius: 'var(--radius-pill)',
      overflowX: 'auto',
      maxWidth: '100%',
      ...style
    }
  }, tabs.map(tab => {
    const selected = tab === active;
    return /*#__PURE__*/React.createElement("button", {
      key: tab,
      type: "button",
      onClick: () => onChange && onChange(tab),
      style: {
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-button-size)',
        fontWeight: 'var(--type-button-weight)',
        letterSpacing: 'var(--type-button-ls)',
        border: 'none',
        cursor: 'pointer',
        borderRadius: 'var(--radius-pill)',
        padding: '10px 20px',
        whiteSpace: 'nowrap',
        background: selected ? 'var(--color-primary)' : 'transparent',
        color: selected ? 'var(--color-on-primary)' : 'var(--color-ink)',
        transition: 'background-color 120ms ease, color 120ms ease'
      }
    }, tab);
  }));
}
Object.assign(__ds_scope, { PricingTabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/pricing/PricingTabs.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/ColorBlock.jsx
try { (() => {
const BLOCKS = {
  lime: {
    bg: 'var(--color-block-lime)',
    ink: 'var(--color-block-ink)'
  },
  lilac: {
    bg: 'var(--color-block-lilac)',
    ink: 'var(--color-block-ink)'
  },
  cream: {
    bg: 'var(--color-block-cream)',
    ink: 'var(--color-block-ink)'
  },
  mint: {
    bg: 'var(--color-block-mint)',
    ink: 'var(--color-block-ink)'
  },
  pink: {
    bg: 'var(--color-block-pink)',
    ink: 'var(--color-block-ink)'
  },
  coral: {
    bg: 'var(--color-block-coral)',
    ink: 'var(--color-block-ink)'
  },
  navy: {
    bg: 'var(--color-block-navy)',
    ink: 'var(--color-block-ink-inverse)'
  }
};

/**
 * The signature FinSight2 color-block section. Full-content-width pastel (or
 * navy) panel with radius-lg corners and xxl interior padding. The type sits
 * in a single editorial column with generous side margins so it reads as a
 * poster, not a wall of copy. Color is the depth device — no shadows.
 */
function ColorBlock({
  variant = 'lime',
  eyebrow,
  title,
  children,
  align = 'left',
  bleed = false,
  style = {}
}) {
  const b = BLOCKS[variant] || BLOCKS.lime;
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: b.bg,
      color: b.ink,
      borderRadius: bleed ? 0 : 'var(--radius-lg)',
      padding: 'var(--space-xxl)',
      boxSizing: 'border-box',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '760px',
      margin: align === 'center' ? '0 auto' : '0',
      textAlign: align,
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-lg)',
      alignItems: align === 'center' ? 'center' : 'flex-start'
    }
  }, eyebrow && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--type-eyebrow-size)',
      letterSpacing: 'var(--type-eyebrow-ls)',
      fontWeight: 'var(--type-eyebrow-weight)',
      textTransform: 'uppercase',
      opacity: variant === 'navy' ? 0.7 : 0.55
    }
  }, eyebrow), title && /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--type-display-lg-size)',
      lineHeight: 'var(--type-display-lg-lh)',
      letterSpacing: 'var(--type-display-lg-ls)',
      fontWeight: 'var(--type-display-lg-weight)',
      textWrap: 'balance'
    }
  }, title), children && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--type-subhead-size)',
      lineHeight: 'var(--type-subhead-lh)',
      letterSpacing: 'var(--type-subhead-ls)',
      fontWeight: 'var(--type-subhead-weight)',
      textWrap: 'pretty'
    }
  }, children)));
}
Object.assign(__ds_scope, { ColorBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/ColorBlock.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/FeatureTile.jsx
try { (() => {
/**
 * Larger composition tile holding a product UI mock or pastel illustration.
 * Surface-soft ground, radius-md, lg padding, mono eyebrow label.
 */
function FeatureTile({
  eyebrow,
  children,
  minHeight = 220,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface-soft)',
      color: 'var(--color-ink)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-lg)',
      minHeight,
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)',
      boxSizing: 'border-box',
      ...style
    }
  }, eyebrow && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--type-eyebrow-size)',
      letterSpacing: 'var(--type-eyebrow-ls)',
      fontWeight: 'var(--type-eyebrow-weight)',
      textTransform: 'uppercase',
      opacity: 0.6
    }
  }, eyebrow), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, children));
}
Object.assign(__ds_scope, { FeatureTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/FeatureTile.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/PricingCard.jsx
try { (() => {
/**
 * Pricing tier card. Canvas surface stroked with hairline (never shadowed),
 * radius-lg, lg padding. Weight — not shadow — carries the featured tier.
 */
function PricingCard({
  name,
  price,
  period = '/ editor / month',
  blurb,
  features = [],
  ctaLabel = 'Get started',
  ctaVariant = 'secondary',
  featured = false,
  onCta,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-canvas)',
      color: 'var(--color-ink)',
      border: '1px solid var(--color-hairline)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-lg)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)',
      boxSizing: 'border-box',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--type-card-title-size)',
      fontWeight: 'var(--type-card-title-weight)'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 44,
      fontWeight: 340,
      letterSpacing: '-0.96px'
    }
  }, price), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--type-caption-size)',
      letterSpacing: 'var(--type-caption-ls)',
      textTransform: 'uppercase',
      opacity: 0.6
    }
  }, period)), blurb && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--type-body-sm-size)',
      fontWeight: 'var(--type-body-sm-weight)',
      lineHeight: 'var(--type-body-sm-lh)'
    }
  }, blurb), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: featured ? 'primary' : ctaVariant,
    fullWidth: true,
    onClick: onCta
  }, ctaLabel), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)'
    }
  }, features.map((f, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      display: 'flex',
      gap: 'var(--space-xs)',
      alignItems: 'flex-start',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--type-body-sm-size)',
      fontWeight: 'var(--type-body-sm-weight)',
      lineHeight: 'var(--type-body-sm-lh)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.CheckGlyph, {
    size: 14
  })), /*#__PURE__*/React.createElement("span", null, f)))));
}
Object.assign(__ds_scope, { PricingCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/PricingCard.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/PromoBanner.jsx
try { (() => {
/**
 * Inline lilac promo banner ("Save your spot" Release Notes). Carries a single
 * magenta promo CTA on the right edge. Radius-md, md/lg padding.
 */
function PromoBanner({
  eyebrow = 'Release notes',
  message,
  ctaLabel = 'Save your spot',
  onCta,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-block-lilac)',
      color: 'var(--color-ink)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-md) var(--space-lg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-lg)',
      flexWrap: 'wrap',
      boxSizing: 'border-box',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 220,
      flex: 1
    }
  }, eyebrow && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--type-caption-size)',
      letterSpacing: 'var(--type-caption-ls)',
      textTransform: 'uppercase',
      opacity: 0.6
    }
  }, eyebrow), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--type-body-sm-size)',
      fontWeight: 'var(--type-body-sm-weight)',
      lineHeight: 'var(--type-body-sm-lh)'
    }
  }, message)), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "magenta",
    onClick: onCta
  }, ctaLabel));
}
Object.assign(__ds_scope, { PromoBanner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/PromoBanner.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/TemplateCard.jsx
try { (() => {
/**
 * Template thumbnail tile — surface-soft ground, radius-md, md padding around
 * an embedded preview. Used in the home "Explore what people are making" grid.
 * Optional slight off-axis rotation for the FigJam sticky-note feel.
 */
function TemplateCard({
  title,
  category,
  preview,
  swatch = 'var(--color-block-mint)',
  rotate = 0,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("figure", {
    style: {
      background: 'var(--color-surface-soft)',
      color: 'var(--color-ink)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-md)',
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)',
      transform: rotate ? `rotate(${rotate}deg)` : undefined,
      boxSizing: 'border-box',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      aspectRatio: '4 / 3',
      borderRadius: 'var(--radius-sm)',
      background: swatch,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, preview), /*#__PURE__*/React.createElement("figcaption", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, category && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--type-caption-size)',
      letterSpacing: 'var(--type-caption-ls)',
      textTransform: 'uppercase',
      opacity: 0.55
    }
  }, category), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--type-body-sm-size)',
      fontWeight: 'var(--type-body-sm-weight)'
    }
  }, title)));
}
Object.assign(__ds_scope, { TemplateCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/TemplateCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/ContactScreen.jsx
try { (() => {
const {
  TopNav,
  Footer,
  Button,
  TextInput,
  PromoBanner,
  ColorBlock
} = window.FinSight2DesignSystem_56fb7f;
const CWrap = window.KitWrap;
function ContactScreen({
  onNav
}) {
  const [sent, setSent] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-canvas)',
      minHeight: '100vh'
    }
  }, /*#__PURE__*/React.createElement(TopNav, {
    onSignIn: () => onNav && onNav('home')
  }), /*#__PURE__*/React.createElement(CWrap, {
    style: {
      paddingTop: 'var(--space-xxl)',
      paddingBottom: 'var(--space-section)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 'var(--space-xl)'
    }
  }, /*#__PURE__*/React.createElement(PromoBanner, {
    eyebrow: "Release notes",
    message: "Config 2026 sessions are now live \u2014 reserve your spot.",
    ctaLabel: "Save your spot"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-section)',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-lg)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-eyebrow",
    style: {
      opacity: 0.55
    }
  }, "Contact sales"), /*#__PURE__*/React.createElement("h1", {
    className: "t-display-lg",
    style: {
      margin: 0
    }
  }, "Let's build something together"), /*#__PURE__*/React.createElement("p", {
    className: "t-subhead",
    style: {
      margin: 0
    }
  }, "Tell us about your team and we'll help you find the right plan \u2014 usually within one business day.")), /*#__PURE__*/React.createElement(ColorBlock, {
    variant: "lime"
  }, sent ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-sm)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-headline"
  }, "Thanks \u2014 we'll be in touch."), /*#__PURE__*/React.createElement("span", {
    className: "t-body"
  }, "A specialist will reach out within one business day."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-md)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => setSent(false)
  }, "Send another"))) : /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      setSent(true);
    },
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--space-md)'
    }
  }, /*#__PURE__*/React.createElement(TextInput, {
    label: "First name",
    id: "fn",
    placeholder: "Jamie"
  }), /*#__PURE__*/React.createElement(TextInput, {
    label: "Last name",
    id: "ln",
    placeholder: "Rivera"
  })), /*#__PURE__*/React.createElement(TextInput, {
    label: "Work email",
    id: "em",
    type: "email",
    placeholder: "you@company.com"
  }), /*#__PURE__*/React.createElement(TextInput, {
    label: "Company",
    id: "co",
    placeholder: "FinSight2"
  }), /*#__PURE__*/React.createElement(TextInput, {
    label: "How can we help?",
    id: "msg",
    as: "textarea",
    rows: 4,
    placeholder: "Tell us about your team\u2026"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    type: "submit",
    fullWidth: true
  }, "Send message"))))), /*#__PURE__*/React.createElement(Footer, null));
}
window.ContactScreen = ContactScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/ContactScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/HomeScreen.jsx
try { (() => {
const {
  TopNav,
  MarqueeStrip,
  Footer,
  Button,
  ColorBlock,
  TemplateCard,
  FeatureTile
} = window.FinSight2DesignSystem_56fb7f;

// White-canvas container with section rhythm between blocks.
function Wrap({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      padding: '0 var(--space-lg)',
      ...style
    }
  }, children);
}
function HomeScreen({
  onNav
}) {
  const templates = [{
    c: 'Brainstorm',
    t: 'Product kickoff',
    s: 'var(--color-block-pink)',
    r: -2
  }, {
    c: 'Roadmap',
    t: 'Quarterly plan',
    s: 'var(--color-block-mint)',
    r: 1.5
  }, {
    c: 'Design',
    t: 'Mobile UI kit',
    s: 'var(--color-block-lilac)',
    r: -1
  }, {
    c: 'Research',
    t: 'User interview',
    s: 'var(--color-block-cream)',
    r: 2
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-canvas)',
      minHeight: '100vh'
    }
  }, /*#__PURE__*/React.createElement(TopNav, {
    onSignIn: () => onNav && onNav('home')
  }), /*#__PURE__*/React.createElement(MarqueeStrip, {
    items: ['Acme', 'Northwind', 'Globex', 'Initech', 'Umbrella', 'Soylent', 'Hooli', 'Stark']
  }), /*#__PURE__*/React.createElement(Wrap, {
    style: {
      paddingTop: 'var(--space-section)',
      paddingBottom: 'var(--space-section)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 900,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-lg)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-eyebrow",
    style: {
      opacity: 0.55
    }
  }, "Design \xB7 Ideate \xB7 Ship"), /*#__PURE__*/React.createElement("h1", {
    className: "t-display-xl",
    style: {
      margin: 0
    }
  }, "Where teams design together"), /*#__PURE__*/React.createElement("p", {
    className: "t-body-lg",
    style: {
      margin: 0,
      maxWidth: 620
    }
  }, "One connected canvas for brainstorming, design, and handoff \u2014 so your best ideas never get lost between tools."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-sm)',
      flexWrap: 'wrap',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg"
  }, "Get started for free"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    onClick: () => onNav && onNav('contact')
  }, "Contact sales")))), /*#__PURE__*/React.createElement(Wrap, {
    style: {
      paddingBottom: 'var(--space-section)'
    }
  }, /*#__PURE__*/React.createElement(ColorBlock, {
    variant: "lime",
    eyebrow: "Design systems",
    title: "Keep every team on the same page."
  }, "Shared libraries, tokens, and components \u2014 one source of truth that updates everywhere the moment you publish.")), /*#__PURE__*/React.createElement(Wrap, {
    style: {
      paddingBottom: 'var(--space-section)'
    }
  }, /*#__PURE__*/React.createElement(ColorBlock, {
    variant: "navy",
    eyebrow: "Ship products",
    title: "From first idea to production."
  }, "Prototype, review, and hand off without ever leaving the canvas \u2014 developers get specs and code in the same place.")), /*#__PURE__*/React.createElement(Wrap, {
    style: {
      paddingBottom: 'var(--space-section)'
    }
  }, /*#__PURE__*/React.createElement(ColorBlock, {
    variant: "coral",
    eyebrow: "For developers",
    title: "Design that speaks your language."
  }, "Inspect, measure, and export production-ready values straight from the file. No more guessing from a screenshot.")), /*#__PURE__*/React.createElement(Wrap, {
    style: {
      paddingBottom: 'var(--space-section)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-lg)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "t-display-lg",
    style: {
      margin: 0,
      maxWidth: 640
    }
  }, "Explore what people are making"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 'var(--space-lg)'
    }
  }, templates.map((tp, i) => /*#__PURE__*/React.createElement(TemplateCard, {
    key: i,
    category: tp.c,
    title: tp.t,
    swatch: tp.s,
    rotate: tp.r
  }))))), /*#__PURE__*/React.createElement(Wrap, {
    style: {
      paddingBottom: 'var(--space-section)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "t-display-lg",
    style: {
      margin: 0
    }
  }, "Start building today"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-sm)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg"
  }, "Get started for free"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    onClick: () => onNav && onNav('pricing')
  }, "See pricing")))), /*#__PURE__*/React.createElement(Footer, null));
}
window.HomeScreen = HomeScreen;
window.KitWrap = Wrap;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/PricingScreen.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  TopNav,
  MarqueeStrip,
  Footer,
  Button,
  ColorBlock,
  PricingCard,
  PricingTabs,
  CheckGlyph
} = window.FinSight2DesignSystem_56fb7f;
const PWrap = window.KitWrap;
const TIERS = [{
  name: 'Starter',
  price: '$0',
  period: 'free forever',
  blurb: 'For individuals getting started.',
  features: ['3 team files', 'Unlimited personal drafts', 'Basic templates'],
  variant: 'secondary'
}, {
  name: 'Professional',
  price: '$16',
  period: '/ editor / mo',
  blurb: 'For growing product teams.',
  features: ['Unlimited files', 'Shared team libraries', 'Version history', 'Admin controls'],
  featured: true
}, {
  name: 'Organization',
  price: '$45',
  period: '/ editor / mo',
  blurb: 'For companies scaling design.',
  features: ['Org-wide libraries', 'Design system analytics', 'SSO & SCIM', 'Branch & merge'],
  variant: 'secondary'
}, {
  name: 'Enterprise',
  price: 'Custom',
  period: 'contact sales',
  blurb: 'For advanced security needs.',
  features: ['Dedicated success', 'Advanced security', 'Guest controls', 'Custom billing'],
  variant: 'secondary'
}];
const MATRIX = [['Unlimited files', false, true, true, true], ['Shared libraries', false, true, true, true], ['Single sign-on (SSO)', false, false, true, true], ['Design system analytics', false, false, true, true], ['Advanced security', false, false, false, true]];
function PricingScreen({
  onNav
}) {
  const [tier, setTier] = React.useState('Professional');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-canvas)',
      minHeight: '100vh'
    }
  }, /*#__PURE__*/React.createElement(TopNav, {
    onSignIn: () => onNav && onNav('home')
  }), /*#__PURE__*/React.createElement(MarqueeStrip, {
    items: ['Acme', 'Northwind', 'Globex', 'Initech', 'Umbrella', 'Soylent']
  }), /*#__PURE__*/React.createElement(PWrap, {
    style: {
      paddingTop: 'var(--space-section)',
      paddingBottom: 'var(--space-xl)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-lg)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-eyebrow",
    style: {
      opacity: 0.55
    }
  }, "Pricing"), /*#__PURE__*/React.createElement("h1", {
    className: "t-display-lg",
    style: {
      margin: 0
    }
  }, "Plans for teams of every size"), /*#__PURE__*/React.createElement(PricingTabs, {
    tabs: TIERS.map(t => t.name),
    value: tier,
    onChange: setTier
  }))), /*#__PURE__*/React.createElement(PWrap, {
    style: {
      paddingBottom: 'var(--space-section)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 'var(--space-lg)',
      alignItems: 'start'
    }
  }, TIERS.map(t => /*#__PURE__*/React.createElement(PricingCard, _extends({
    key: t.name
  }, t, {
    ctaLabel: t.name === 'Enterprise' ? 'Contact sales' : `Choose ${t.name}`,
    onCta: () => t.name === 'Enterprise' && onNav && onNav('contact')
  }))))), /*#__PURE__*/React.createElement(PWrap, {
    style: {
      paddingBottom: 'var(--space-section)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "t-display-lg",
    style: {
      margin: '0 0 var(--space-lg)'
    }
  }, "Compare plans"), /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--color-hairline)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr repeat(4, 1fr)',
      alignItems: 'center',
      padding: 'var(--space-md) var(--space-lg)',
      background: 'var(--color-surface-soft)'
    }
  }, /*#__PURE__*/React.createElement("span", null), TIERS.map(t => /*#__PURE__*/React.createElement("span", {
    key: t.name,
    className: "t-caption",
    style: {
      textAlign: 'center'
    }
  }, t.name))), MATRIX.map((row, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr repeat(4, 1fr)',
      alignItems: 'center',
      padding: 'var(--space-md) var(--space-lg)',
      borderTop: '1px solid var(--color-hairline-soft)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "t-body-sm"
  }, row[0]), row.slice(1).map((v, j) => /*#__PURE__*/React.createElement("span", {
    key: j,
    style: {
      display: 'flex',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(CheckGlyph, {
    present: v
  }))))))), /*#__PURE__*/React.createElement(PWrap, {
    style: {
      paddingBottom: 'var(--space-section)'
    }
  }, /*#__PURE__*/React.createElement(ColorBlock, {
    variant: "lime",
    eyebrow: "FAQ",
    title: "Questions? We've got answers."
  }, "Switch plans anytime, only pay for editors, and cancel whenever you like. Need something custom? Talk to our team.", /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-lg)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => onNav && onNav('contact')
  }, "Contact sales")))), /*#__PURE__*/React.createElement(Footer, null));
}
window.PricingScreen = PricingScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/PricingScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.TextInput = __ds_scope.TextInput;

__ds_ns.Footer = __ds_scope.Footer;

__ds_ns.MarqueeStrip = __ds_scope.MarqueeStrip;

__ds_ns.TopNav = __ds_scope.TopNav;

__ds_ns.CheckGlyph = __ds_scope.CheckGlyph;

__ds_ns.PricingTabs = __ds_scope.PricingTabs;

__ds_ns.ColorBlock = __ds_scope.ColorBlock;

__ds_ns.FeatureTile = __ds_scope.FeatureTile;

__ds_ns.PricingCard = __ds_scope.PricingCard;

__ds_ns.PromoBanner = __ds_scope.PromoBanner;

__ds_ns.TemplateCard = __ds_scope.TemplateCard;

})();
