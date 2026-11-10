import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { TELEGRAM_URL, TOKEN_MINT, X_URL } from "./content.js";
import { ConnectWallet } from "./wallet.jsx";

const links = [
  ["How it works", "/how"],
  ["Examples", "/examples"],
  ["Docs", "/docs/who"],
  ["Capital flow", "/flow"],
  ["History", "/history"],
];

function hash(ix, iy) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function DotField() {
  const ref = useRef(null);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduce) return undefined;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let dots = [];
    let frame = 0;
    let running = true;
    const gap = 16;
    const alphas = [0.18, 0.32, 0.46, 0.6, 0.74, 0.9];

    function layout() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const next = [];
      const cols = Math.ceil(w / gap) + 1;
      const rows = Math.ceil(h / gap) + 1;
      for (let iy = 0; iy < rows; iy += 1) {
        for (let ix = 0; ix < cols; ix += 1) {
          const n = hash(ix, iy);
          if (n > 0.28) continue;
          next.push({
            x: ix * gap + gap / 2,
            y: iy * gap + gap / 2,
            phase: n * Math.PI * 2,
            speed: 0.0011 + hash(ix + 19, iy + 7) * 0.0018,
          });
        }
      }
      dots = next;
    }

    function draw(t) {
      if (!running) return;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const groups = [[], [], [], [], [], []];
      for (let i = 0; i < dots.length; i += 1) {
        const d = dots[i];
        const tw = 0.5 + 0.5 * Math.sin(t * d.speed + d.phase);
        const wave = 0.5 + 0.5 * Math.sin(t * 0.0004 + d.x * 0.018 + d.y * 0.014);
        const a = tw * (0.4 + 0.6 * wave);
        if (a < 0.14) continue;
        groups[Math.min(5, (a * 6) | 0)].push(d);
      }
      for (let i = 0; i < groups.length; i += 1) {
        const g = groups[i];
        if (!g.length) continue;
        ctx.beginPath();
        for (let j = 0; j < g.length; j += 1) {
          ctx.moveTo(g[j].x + 1.5, g[j].y);
          ctx.arc(g[j].x, g[j].y, 1.5, 0, Math.PI * 2);
        }
        ctx.fillStyle = `rgba(134, 239, 172, ${alphas[i]})`;
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    }

    function onResize() {
      layout();
    }

    function onVis() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
        return;
      }
      if (!running) {
        running = true;
        frame = requestAnimationFrame(draw);
      }
    }

    layout();
    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduce]);

  if (reduce) return null;
  return createPortal(<canvas ref={ref} className="dot-field" aria-hidden="true" />, document.body);
}

function ContractAddress() {
  const mint = TOKEN_MINT.trim();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!mint) return;
    try {
      await navigator.clipboard.writeText(mint);
    } catch {
      const area = document.createElement("textarea");
      area.value = mint;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <footer className="site-foot">
      <button type="button" className="contract" onClick={copy}>
        <span>{copied ? "Copied" : "Contract Address"}</span>
        {mint ? <code>{mint}</code> : null}
      </button>
      <FootLink label="X" href={X_URL}>
        <XMark />
      </FootLink>
      <FootLink label="Telegram" href={TELEGRAM_URL}>
        <TelegramMark />
      </FootLink>
    </footer>
  );
}

function XMark() {
  return (
    <svg className="x-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

function TelegramMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
      />
    </svg>
  );
}

function FootLink({ label, href, children }) {
  const mark = children || <span>{label}</span>;
  if (!href) {
    return (
      <div className="contract foot-link" aria-label={label}>
        {mark}
      </div>
    );
  }
  return (
    <a className="contract foot-link" href={href} target="_blank" rel="noreferrer" aria-label={label}>
      {mark}
    </a>
  );
}

export function Shell() {
  const { pathname } = useLocation();

  return (
    <div className="app">
      <DotField />
      <header className="top">
        <Link to="/" className="brand" aria-label="site0">
          <img src="/site0-pfp.png" alt="" />
        </Link>
        <nav className="pill">
          {links.map(([label, to]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? "nav on" : "nav")}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="corner">
          <ConnectWallet />
        </div>
      </header>
      <div key={pathname} className="stage">
        <Outlet />
      </div>
      <ContractAddress />
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Editable({ value, onChange, as: Tag = "span", className = "" }) {
  return (
    <Tag
      className={`edit ${className}`.trim()}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onBlur={(event) => {
        const next = event.currentTarget.textContent.replace(/\s+/g, " ").trim();
        if (next && next !== value) onChange(next);
        else event.currentTarget.textContent = value;
      }}
    >
      {value}
    </Tag>
  );
}

function Line({ editable, value, onChange, as, className }) {
  if (!editable) {
    const Tag = as || "span";
    return <Tag className={className}>{value}</Tag>;
  }
  return (
    <Editable as={as || "span"} className={className} value={value} onChange={onChange} />
  );
}

function Pairs({ rows, editable, onChange }) {
  if (!rows?.length) return null;
  return (
    <ul className="rows">
      {rows.map((row, index) => (
        <li key={`${row[0]}-${index}`}>
          <Line
            editable={editable}
            value={row[0]}
            onChange={(value) => onChange(index, 0, value)}
          />
          <Line
            editable={editable}
            value={row[1]}
            onChange={(value) => onChange(index, 1, value)}
          />
        </li>
      ))}
    </ul>
  );
}

export function Sheet({ page, editable = false, onChange }) {
  const set = (key) => (value) => onChange?.({ ...page, [key]: value });
  const setRow = (index, which, value) => {
    const rows = page.rows.map((row, i) =>
      i === index ? (which === 0 ? [value, row[1]] : [row[0], value]) : row,
    );
    onChange?.({ ...page, rows });
  };
  const setSection = (index, key, value) => {
    const sections = page.sections.map((section, i) =>
      i === index ? { ...section, [key]: value } : section,
    );
    onChange?.({ ...page, sections });
  };
  const setItem = (sectionIndex, itemIndex, which, value) => {
    const sections = page.sections.map((section, i) => {
      if (i !== sectionIndex) return section;
      const items = section.items.map((item, j) =>
        j === itemIndex ? (which === 0 ? [value, item[1]] : [item[0], value]) : item,
      );
      return { ...section, items };
    });
    onChange?.({ ...page, sections });
  };

  return (
    <article className={`sheet sheet-${page.layout || "shop"}`}>
      {page.kicker ? (
        <Line
          editable={editable}
          as="p"
          className="kicker"
          value={page.kicker}
          onChange={set("kicker")}
        />
      ) : null}
      <Line
        editable={editable}
        as="h2"
        className="sheet-title"
        value={page.title}
        onChange={set("title")}
      />
      {page.lede ? (
        <Line
          editable={editable}
          as="p"
          className="lede"
          value={page.lede}
          onChange={set("lede")}
        />
      ) : null}
      {page.note ? (
        <Line editable={editable} as="p" value={page.note} onChange={set("note")} />
      ) : null}
      {page.sections?.map((section, index) => (
        <section className="block" key={`${section.heading}-${index}`}>
          {section.heading ? (
            <Line
              editable={editable}
              as="h3"
              value={section.heading}
              onChange={(value) => setSection(index, "heading", value)}
            />
          ) : null}
          {section.body ? (
            <Line
              editable={editable}
              as="p"
              value={section.body}
              onChange={(value) => setSection(index, "body", value)}
            />
          ) : null}
          <Pairs
            rows={section.items}
            editable={editable}
            onChange={(itemIndex, which, value) => setItem(index, itemIndex, which, value)}
          />
        </section>
      ))}
      <Pairs rows={page.rows} editable={editable} onChange={setRow} />
      {page.hours || page.address ? (
        <dl className="facts">
          {page.hours ? (
            <div>
              <dt>Hours</dt>
              <dd>
                <Line editable={editable} value={page.hours} onChange={set("hours")} />
              </dd>
            </div>
          ) : null}
          {page.address ? (
            <div>
              <dt>Find us</dt>
              <dd>
                <Line editable={editable} value={page.address} onChange={set("address")} />
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {page.whatsapp ? (
        <p className="message">
          <span>Message on WhatsApp</span>
          <strong>{page.whatsapp}</strong>
        </p>
      ) : null}
    </article>
  );
}

export function Frame({ url, children }) {
  const frame = useRef(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    function onChange() {
      setFull(document.fullscreenElement === frame.current);
    }
    function onKey(event) {
      if (event.key === "Escape") setFull(false);
    }
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function toggle() {
    const node = frame.current;
    if (!node) return;
    if (full) {
      setFull(false);
      if (document.fullscreenElement) document.exitFullscreen();
      return;
    }
    setFull(true);
    node.requestFullscreen?.().catch(() => {});
  }

  return (
    <div className={full ? "frame full" : "frame"} ref={frame}>
      <div className="chrome">
        <span />
        <span />
        <span />
        <p>{url}</p>
        <button
          className="full-btn"
          type="button"
          aria-pressed={full}
          onClick={toggle}
        >
          {full ? "Close" : "Full screen"}
        </button>
      </div>
      {children}
    </div>
  );
}

export function Dock({ children }) {
  return <div className="action">{children}</div>;
}
