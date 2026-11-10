import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ConnectWallet } from "./wallet.jsx";

const links = [
  ["How it works", "/how"],
  ["Examples", "/examples"],
  ["Docs", "/docs/start"],
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
