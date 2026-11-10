import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { cardPath, docs, examples, readSite, slugify } from "./content.js";
import { useDraft } from "./draft.jsx";
import { Dock, Frame } from "./ui.jsx";
import { forgetPayment, paidSignature, payForGenerate, tokenCharges } from "./pay.js";
import { useWallet } from "./wallet.jsx";

function useTitle(title) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function writtenPrompt(draft) {
  const prompt = draft.prompt.trim();
  const logic = (draft.data || "").trim();
  if (!logic) return prompt;
  return `${prompt}\n\nDatabase:\n${logic}`.trim();
}

function asUrl(value) {
  const text = value.trim();
  if (!text || /\s/.test(text)) return "";
  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  return validUrl(withProtocol) ? withProtocol : "";
}

export function Home() {
  useTitle("site0");
  const navigate = useNavigate();
  const { draft, setDraft, notice, setNotice } = useDraft();
  const writing = draft.mode === "write";

  function update(key, value) {
    setNotice("");
    setDraft({ ...draft, [key]: value });
  }

  function submit(event) {
    event.preventDefault();
    if (draft.mode === "link") {
      const text = draft.url.trim();
      if (!text) {
        setNotice("Paste a link, or write the page yourself.");
        return;
      }
      const url = asUrl(text);
      if (!url || text.includes("gone.example")) {
        if (!url && !text.includes("gone.example")) {
          setDraft({ ...draft, mode: "write", url: "", prompt: text, live: null });
          setNotice("");
          navigate("/generating");
          return;
        }
        setNotice("");
        navigate("/reference-failed");
        return;
      }
      setDraft({
        ...draft,
        mode: "write",
        url,
        prompt: `Build my own website, using ${url} as the example.`,
        reading: null,
        live: null,
      });
      setNotice("");
      navigate("/generating");
      return;
    } else if (!writtenPrompt(draft)) {
        setNotice("Write the site, or the records it should keep.");
      return;
    } else {
      setDraft((current) => ({ ...current, live: null }));
    }
    setNotice("");
    navigate("/generating");
  }

  return (
    <main className="hero">
      <p className="hero-name"><span>site</span>0</p>
      <h1>{writing ? "Write a sentence. Get a site." : "Paste a site you like."}</h1>
      <p className="sub">
        {writing
          ? "You do not need to know how a website is built. Write the name, the price, the hours, or the place. site0 makes the page."
          : "Paste any public page as the example. site0 looks at it and builds a new site for you."}
      </p>

      <form className="composer" onSubmit={submit}>
        <div className="tabs">
          <button
            className={writing ? "tab" : "tab on"}
            type="button"
            onClick={() => update("mode", "link")}
          >
            Paste a link
          </button>
          <button
            className={writing ? "tab on" : "tab"}
            type="button"
            onClick={() => update("mode", "write")}
          >
            Write it yourself
          </button>
        </div>
        <div className="swap">
          {writing ? (
            <div className="write-stack">
            <label className="bar write">
              <textarea
                value={draft.prompt}
                placeholder={"Lane Coffee. Open until 2. Milk is 4. Second door on the left."}
                aria-label="Page prompt"
                rows={3}
                onChange={(event) => update("prompt", event.target.value)}
              />
              <button className="go" type="submit" aria-label="Write the page">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </label>
            <label className="data-logic">
              <span>Database</span>
              <textarea
                value={draft.data || ""}
                placeholder="Visitors save a name and a message. The page lists the latest ones."
                aria-label="Database logic"
                rows={2}
                onChange={(event) => update("data", event.target.value)}
              />
            </label>
            </div>
          ) : (
          <label className="bar">
            <span className="link-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  d="M10 13a5 5 0 0 0 7.07.07l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M14 11a5 5 0 0 0-7.07-.07L5.5 12.34a5 5 0 0 0 7.07 7.07L14 18.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <input
              value={draft.url}
              placeholder="Paste a link"
              autoComplete="off"
              aria-label="Reference link"
              onChange={(event) => update("url", event.target.value)}
            />
            <button className="go" type="submit" aria-label="Make a preview">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </label>
          )}
        </div>

        {notice ? <p className="warn">{notice}</p> : null}
      </form>

      <section className="feed">
        <p className="label">Examples</p>
        {examples.map((example) => (
          <Link key={example.id} to={`/examples/${example.id}`} className="feed-row">
            <span>{example.kind}</span>
            <em>{example.prompt}</em>
            <strong>Open</strong>
          </Link>
        ))}
      </section>
    </main>
  );
}

function clock(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function Generating() {
  const { draft } = useDraft();
  if (draft.mode === "write") return <Writing />;
  return <Analyzing />;
}

const WRITE_STEPS = [
  "Reading the sentence",
  "Laying out the site",
  "Writing the line",
];
const LOAD_CELLS = 14;

function Writing() {
  useTitle("Writing · site0");
  const navigate = useNavigate();
  const { draft, setDraft, setPage } = useDraft();
  const { account, wallet } = useWallet();
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [tick, setTick] = useState(0);
  const [run, setRun] = useState(0);
  const payer = useRef({ account, wallet });
  const payAddress = tokenCharges() ? account?.address || "" : "";

  useEffect(() => {
    payer.current = { account, wallet };
  }, [account, wallet]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function write() {
      let last = "The page did not get written.";
      let signature = "";
      const current = payer.current;
      try {
        if (tokenCharges()) {
          setPaying(true);
          signature = await payForGenerate({
            wallet: current.wallet,
            account: current.account,
            key: writtenPrompt(draft),
          });
          if (cancelled) return;
          setPaying(false);
        }
      } catch (cause) {
        if (!cancelled) setError(cause.message || "The wallet did not send the tokens.");
        setPaying(false);
        return;
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (cancelled) return;
        try {
          const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: writtenPrompt(draft),
              wallet: current.account?.address || "",
              signature,
            }),
            signal: controller.signal,
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data.page?.html) {
            throw new Error(data.error || last);
          }
          if (cancelled) return;
          setPage(data.page);
          setDraft((current) => ({
            ...current,
            name: data.page.title,
            offer: data.page.lede || "",
            whatsapp: data.page.whatsapp || "",
          }));
          navigate("/preview", { replace: true });
          return;
        } catch (cause) {
          if (cancelled || cause.name === "AbortError") return;
          last = cause.message || last;
        }
      }
      if (!cancelled) setError(last);
    }

    write();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [draft.data, draft.prompt, navigate, payAddress, run, setDraft, setPage]);

  useEffect(() => {
    if (error) return undefined;
    const timer = setInterval(() => setTick((value) => value + 1), 180);
    return () => clearInterval(timer);
  }, [error]);

  const head = tick % LOAD_CELLS;
  const step = Math.floor(tick / 12) % WRITE_STEPS.length;

  return (
    <main className="narrow status-screen">
      <p className="eyebrow">Writing</p>
      <h1>
        {error ? "The site did not get written." : paying ? "Approve the burn." : "Writing the site."}
      </h1>
      {error ? (
        <p className="sub">{error}</p>
      ) : paying ? (
        <p className="sub">Your wallet burns 10,000 tokens. They leave circulation.</p>
      ) : (
        <>
          <div className="pixel-load" role="status" aria-label="Writing the page">
            {Array.from({ length: LOAD_CELLS }, (_, index) => {
              const behind = (head - index + LOAD_CELLS) % LOAD_CELLS;
              return <i key={index} className={behind < 3 ? "on" : ""} />;
            })}
          </div>
          <ol className="scan">
            {WRITE_STEPS.map((label, index) => (
              <li key={label} className={index === step ? "on" : ""}>
                <i>{index === step ? "→" : ""}</i>
                {label}
              </li>
            ))}
          </ol>
          <p className="sub prompt-so-far">{draft.prompt}</p>
        </>
      )}
      {error ? (
        <p className="after">
          <button className="text" type="button" onClick={() => navigate("/")}>
            Try another sentence
          </button>
          <button
            className="text"
            type="button"
            onClick={() => {
              setError("");
              setRun((value) => value + 1);
            }}
          >
            Try again
          </button>
        </p>
      ) : null}
    </main>
  );
}

function Analyzing() {
  useTitle("Analyzing · site0");
  const navigate = useNavigate();
  const { draft } = useDraft();
  const reading = draft.reading || readSite(draft.url);
  const passes = reading.passes;
  const total = passes.reduce((sum, pass) => sum + pass[1], 0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const target = draft.url?.trim();
    if (!target) return undefined;
    fetch(`/api/warm?url=${encodeURIComponent(target)}`).catch(() => {});
    return undefined;
  }, [draft.url]);

  useEffect(() => {
    const started = performance.now();
    const timer = setInterval(() => {
      setElapsed(Math.min(total, performance.now() - started));
    }, 100);
    return () => clearInterval(timer);
  }, [total]);

  useEffect(() => {
    if (elapsed < total) return undefined;
    const timer = setTimeout(() => navigate("/preview", { replace: true }), 900);
    return () => clearTimeout(timer);
  }, [elapsed, total, navigate]);

  let used = 0;
  let current = passes.length - 1;
  for (let i = 0; i < passes.length; i += 1) {
    used += passes[i][1];
    if (elapsed < used) {
      current = i;
      break;
    }
  }
  const match = Math.min(100, Math.round((elapsed / total) * 100));

  return (
    <main className="narrow status-screen">
      <p className="eyebrow">Analyzing</p>
      <h1>Matching it exactly.</h1>
      <p className="sub">
        {reading.host} stays on screen until the copy lines up with the original.
      </p>
      <div className="match-row">
        <span>{clock(elapsed)}</span>
        <b>{match}%</b>
      </div>
      <div className="meter" aria-hidden="true">
        <span style={{ width: `${match}%` }} />
      </div>
      <ol className="scan">
        {passes.map(([label], index) => (
          <li
            key={label}
            className={index < current ? "done" : index === current ? "on" : ""}
          >
            <i>{index < current ? "✓" : index === current ? "→" : ""}</i>
            {label}
          </li>
        ))}
      </ol>
    </main>
  );
}

export function ReferenceFailed() {
  useTitle("Link did not load · site0");
  const { draft, setDraft } = useDraft();
  const navigate = useNavigate();
  const tried = draft.url.trim() || "That link";

  return (
    <main className="narrow">
      <p className="eyebrow">Reference</p>
      <h1>That link did not load.</h1>
      <p className="sub">{tried} could not be opened. Write the page yourself, or paste another link.</p>
      <p className="after">
        <Link to="/" className="text">
          Paste another link
        </Link>
      </p>
      <Dock>
        <button
          className="btn"
          type="button"
          onClick={() => {
            const text = draft.url.trim();
            if (text && !asUrl(text)) {
              setDraft({ ...draft, mode: "write", url: "", prompt: text, live: null });
              navigate("/generating");
              return;
            }
            setDraft({ ...draft, mode: "write", live: null });
            navigate("/");
          }}
        >
          Write it yourself
        </button>
      </Dock>
    </main>
  );
}

function SitePreview({ reading, url }) {
  const [mode, setMode] = useState("loading");

  useEffect(() => {
    let gone = false;
    setMode("loading");
    fetch(`/api/can-frame?url=${encodeURIComponent(url)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (gone) return;
        if (!response.ok) setMode("blocked");
        else setMode(data.frame ? "live" : "proxy");
      })
      .catch(() => {
        if (!gone) setMode("proxy");
      });
    return () => {
      gone = true;
    };
  }, [url]);

  if (mode === "loading") {
    return <p className="waiting-note">Opening {reading.host}</p>;
  }

  if (mode === "blocked") {
    return <p className="waiting-note">That link is not a public page.</p>;
  }

  if (mode === "live") {
    return (
      <iframe
        className="exact"
        title={`Exact page, ${reading.host}`}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        src={url}
      />
    );
  }

  return (
    <iframe
      className="exact"
      title={`Exact page, ${reading.host}`}
      sandbox="allow-scripts allow-forms"
      referrerPolicy="no-referrer"
      src={`/api/frame?url=${encodeURIComponent(url)}`}
    />
  );
}

function BuiltPreview() {
  const { draft, setDraft, page, setPage } = useDraft();
  const navigate = useNavigate();
  const { account, wallet } = useWallet();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [posted, setPosted] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const html = page.html || "";
    if (!html.trim()) return undefined;
    const live = draft.live?.slug ? draft.live : null;
    const key = writtenPrompt(draft);
    const signature = live?.signature || paidSignature(key);
    if (!signature) return undefined;
    let gone = false;
    const slug = live?.slug || slugify(page.title || draft.name);

    async function post() {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch("/api/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slug,
              html,
              title: page.title || draft.name || slug,
              wallet: account?.address || "",
              signature,
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            if (!gone) {
              setPosted("");
              setDraft((current) => (
                current.live?.slug === slug
                  ? current
                  : { ...current, live: { slug, signature: signature || current.live?.signature || "" } }
              ));
            }
            return;
          }
          const message = data.error || "The page did not go live.";
          if (attempt < 2 && /not confirmed/i.test(message)) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }
          if (/did not burn|failed on the network/i.test(message)) forgetPayment(key);
          if (!gone) setPosted(message);
          return;
        } catch {
          if (!gone) setPosted("The page did not go live.");
          return;
        }
      }
    }

    post();
    return () => {
      gone = true;
    };
  }, [account?.address, draft.data, draft.live, draft.name, draft.prompt, page.html, page.title]);

  async function revise(event) {
    event.preventDefault();
    const change = note.trim();
    if (change.length < 3 || busy) return;
    setBusy(true);
    setError("");
    try {
      const updating = Boolean(draft.live?.slug);
      const signature = updating
        ? ""
        : await payForGenerate({ wallet, account, key: `${draft.prompt}\n${change}` });
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: change,
          html: page.html,
          brief: writtenPrompt(draft),
          wallet: account?.address || "",
          slug: draft.live?.slug || "",
          ...(signature ? { signature } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The page did not get written.");
      setPage(data.page);
      setDraft((current) => ({
        ...current,
        name: data.page.title,
        prompt: `${current.prompt}\n${change}`.trim(),
      }));
      setNote("");
    } catch (cause) {
      setError(cause.message || "The page did not get written.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wide split">
      <Frame url={cardPath(slugify(page.title))}>
        <iframe
          className="exact"
          title={page.title}
          sandbox="allow-scripts"
          srcDoc={page.html}
        />
      </Frame>
      <aside className="side">
        <p className="eyebrow">Prompt</p>
        <p className="sub prompt-so-far">{draft.prompt}</p>
        <form className="revise" onSubmit={revise}>
          <label>
            <span className="eyebrow">Change it</span>
            <textarea
              value={note}
              placeholder="Make the price 5. Keep the rest."
              aria-label="Change the page"
              rows={3}
              disabled={busy}
              onChange={(event) => {
                setNote(event.target.value);
                setError("");
              }}
            />
          </label>
          {error ? <p className="warn">{error}</p> : null}
          <button className="btn" type="submit" disabled={busy || note.trim().length < 3}>
            {busy ? "Updating the page." : "Update the page"}
          </button>
        </form>
        {posted ? <p className="warn">{posted}</p> : null}
        <p className="sub">
          {draft.live?.slug
            ? "This site is already live. A change stays on the same link."
            : tokenCharges()
              ? "A change burns another 10,000 tokens, then the site updates."
              : "A change updates the site. Nothing is burned."}
        </p>
        <Dock>
          <button className="btn" type="button" onClick={() => navigate("/publish")}>
            {draft.live?.slug ? "Update the live page" : "Post this site"}
          </button>
        </Dock>
      </aside>
    </main>
  );
}

export function Preview() {
  useTitle("Preview · site0");
  const { draft, page, setDraft } = useDraft();
  const navigate = useNavigate();
  const reading = draft.reading || readSite(draft.url);

  if (draft.mode === "write" && page.html) {
    return <BuiltPreview />;
  }

  if (draft.mode === "write") {
    return (
      <main className="narrow">
        <h1>Write the site first.</h1>
        <p className="sub">A site comes from one sentence. Nothing is posted until that site exists.</p>
        <p className="after">
          <Link to="/" className="text">
            Write a sentence
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="wide split">
      <Frame url={reading.host}>
        <SitePreview reading={reading} url={draft.url || `https://${reading.host}`} />
      </Frame>
      <aside className="side">
        <p className="eyebrow">UI</p>
        <ul className="notes">
          {reading.ui.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="eyebrow">Logic</p>
        <ul className="notes">
          {reading.logic.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="sub">This is {reading.host}. A site comes from a sentence you write.</p>
        <Dock>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setDraft({ ...draft, mode: "write", live: null });
              navigate("/");
            }}
          >
            Write a site
          </button>
        </Dock>
      </aside>
    </main>
  );
}

const PAY_STEPS = [["publishing", "Publishing"]];

export function Publish() {
  useTitle("Publish · site0");
  const { draft, page, setDraft } = useDraft();
  const { address, account, wallet } = useWallet();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("idle");
  const [copied, setCopied] = useState(false);
  const [domainNote, setDomainNote] = useState("");
  const slug = draft.live?.slug || slugify(page.title || draft.name);
  const kept = Boolean(draft.live?.slug);
  const link = cardPath(slug);
  const payKey = writtenPrompt(draft) || `site:${slug}`;
  const alreadyPaid = kept || Boolean(paidSignature(payKey));

  async function publish() {
    if (!address || phase === "publishing") return;
    const html = page.html || "";
    if (!html.trim()) {
      setDomainNote("Write the page before publishing.");
      return;
    }
    setDomainNote("");
    setCopied(false);
    setPhase("publishing");
    try {
      const signature = kept
        ? draft.live.signature || paidSignature(payKey) || ""
        : await payForGenerate({
            wallet,
            account,
            key: payKey,
          });
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          html,
          title: page.title || draft.name || slug,
          wallet: address,
          signature,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data.error || "The page did not go live.";
        if (/did not burn|failed on the network/i.test(message)) {
          forgetPayment(payKey);
        }
        throw new Error(message);
      }
      try {
        sessionStorage.setItem(
          `siteo-site:${slug}`,
          JSON.stringify({ title: page.title || draft.name || slug, html }),
        );
      } catch {
        // The live address still has the page.
      }
      setDraft((current) => ({
        ...current,
        live: { slug, signature: signature || current.live?.signature || "" },
      }));
      setPhase("done");
    } catch (cause) {
      setPhase("idle");
      setDomainNote(cause instanceof Error ? cause.message : "The page did not go live.");
    }
  }

  function openSite() {
    navigate(link);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${link}`);
    } catch {
      /* The link is still on screen if the browser blocks the clipboard. */
    }
    setCopied(true);
  }

  const current = PAY_STEPS.find(([id]) => id === phase);

  return (
    <main className="narrow">
      <div key={phase} className="swap">
      {phase === "done" ? (
        <>
          <p className="eyebrow">Published</p>
          <h1>Make it sendable.</h1>
          <p className="live-link">{link}</p>
          <Dock>
            <button className="btn" type="button" onClick={openSite}>
              Open the site
            </button>
          </Dock>
          <p className="after">
            <button className="text" type="button" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </p>
        </>
      ) : current ? (
        <section className="status-screen" aria-live="polite">
          <p className="eyebrow">Publish</p>
          <h1>{current[1]}</h1>
        </section>
      ) : (
        <>
          <p className="eyebrow">Publish</p>
          <h1>Make it sendable.</h1>
          <p className="live-link">{link}</p>
          <p className="sub">
            {kept
              ? "This link stays."
              : alreadyPaid
                ? "This site is already paid for. Publish uses that."
                : tokenCharges()
                  ? address
                    ? "Posting burns 10,000 tokens from the wallet in the corner."
                    : "Connect a Solana wallet in the corner. Posting burns 10,000 tokens."
                  : address
                    ? "Publish posts this site. No tokens are burned."
                    : "Connect a Solana wallet in the corner, then publish."}
          </p>
          {domainNote ? <p className="warn">{domainNote}</p> : null}
          <Dock>
            <button className="btn" type="button" disabled={!address} onClick={publish}>
              {kept ? "Update" : "Publish"}
            </button>
          </Dock>
        </>
      )}
      </div>
    </main>
  );
}

export function How() {
  useTitle("How it works · site0");
  const steps = [
    "You want a website. You do not need to code, or to know how one is built.",
    "Write one sentence about the place, the price, or the hours. Or paste a page you like.",
    "site0 builds the page. Publish it, then send the link.",
  ];

  return (
    <main className="narrow">
      <p className="eyebrow">How it works</p>
      <h1>Three steps, then a link.</h1>
      <ol className="steps">
        {steps.map((step, index) => (
          <li key={step}>
            <span>0{index + 1}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}

export function Flow() {
  useTitle("Capital flow · site0");

  return (
    <main className="wide flow">
      <p className="eyebrow">Capital flow</p>
      <h1>Where a generate goes.</h1>
      <p className="sub">
        There is no contract yet. Posting a site does not burn tokens, and nobody is paid.
      </p>
      <div className="flow-split">
        <article>
          <p className="label">The site</p>
          <h2>Posted</h2>
          <p>A connected wallet publishes the site. No tokens leave that wallet.</p>
        </article>
        <article>
          <p className="label">The contract</p>
          <h2>Not set</h2>
          <p>A burn comes back only after a contract is added.</p>
        </article>
      </div>
      <h2 className="flow-title">In four steps</h2>
      <ol className="steps">
        <li>
          <span>01</span>
          <p>Someone writes one sentence. site0 turns it into a site.</p>
        </li>
        <li>
          <span>02</span>
          <p>They connect a Solana wallet.</p>
        </li>
        <li>
          <span>03</span>
          <p>Publish saves the site. Nothing is burned.</p>
        </li>
        <li>
          <span>04</span>
          <p>The site opens at its link. The wallet that posted it can change it.</p>
        </li>
      </ol>
      <h2 className="flow-title">Check it yourself</h2>
      <p className="sub">Every posted site names the wallet that published it.</p>
      <div className="flow-actions">
        <Link className="text" to="/history">
          Site history
        </Link>
        <Link className="text" to="/docs/token">
          Read the docs
        </Link>
      </div>
    </main>
  );
}

function shortWallet(value) {
  if (!value) return "";
  return value.length > 12 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value;
}

function when(value) {
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function History() {
  useTitle("History · site0");
  const navigate = useNavigate();
  const { setDraft, setPage } = useDraft();
  const { address } = useWallet();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState("");

  async function changeSite(site) {
    if (opening) return;
    setOpening(site.slug);
    setError("");
    try {
      const response = await fetch(`/api/site?slug=${encodeURIComponent(site.slug)}`);
      const html = await response.text();
      if (!response.ok || !html.trim()) {
        throw new Error("That page is not on the server.");
      }
      setPage({ title: site.title, html, lede: "" });
      setDraft({
        mode: "write",
        url: "",
        prompt: site.title,
        data: "",
        name: site.title,
        offer: "",
        whatsapp: "",
        live: { slug: site.slug, signature: site.burnSignature || "" },
      });
      navigate("/preview");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That page did not open.");
      setOpening("");
    }
  }

  useEffect(() => {
    let gone = false;
    fetch("/api/history")
      .then((response) => response.json())
      .then((next) => {
        if (!gone) setData(next);
      })
      .catch(() => {
        if (!gone) setError("The history did not load.");
      });
    return () => {
      gone = true;
    };
  }, []);

  const burns = Array.isArray(data?.burns) ? data.burns : [];
  const sites = Array.isArray(data?.sites) ? data.sites : [];

  return (
    <main className="wide">
      <p className="eyebrow">History</p>
      <h1>Published sites.</h1>
      <p className="sub">
        A new site does not burn tokens. Older burns stay listed below.
      </p>
      {error ? <p className="warn">{error}</p> : null}
      {!data && !error ? <p className="sub">Reading history.</p> : null}
      {data ? (
        <div className="history-grid">
          <section>
            <h2 className="flow-title">Burns</h2>
            {data.burnsReady === false ? <p className="sub">The burn list did not load.</p> : null}
            {data.burnsReady !== false && burns.length === 0 ? <p className="sub">No tokens have been burned yet.</p> : null}
            <div className="history-list">
              {burns.map((burn) => (
                <a
                  key={burn.signature}
                  className="history-row"
                  href={`https://solscan.io/tx/${burn.signature}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <strong>{Number(burn.amount).toLocaleString("en-US")} tokens</strong>
                  {shortWallet(burn.wallet) ? <span>{shortWallet(burn.wallet)}</span> : null}
                  <em>{when(burn.time)}</em>
                </a>
              ))}
            </div>
          </section>
          <section>
            <h2 className="flow-title">Sites</h2>
            {sites.length === 0 ? <p className="sub">No sites have been published yet.</p> : null}
            {sites.length > 0 ? (
              <p className="sub">The wallet that published a site can change it. The link stays.</p>
            ) : null}
            <div className="history-list">
              {sites.map((site) => {
                const mine = Boolean(address) && address === site.wallet;
                return (
                  <div key={site.slug} className={mine ? "history-row has-edit" : "history-row"}>
                    <a
                      className="history-main"
                      href={cardPath(site.slug)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <strong>{site.title}</strong>
                      <span>{cardPath(site.slug)}</span>
                      <em>{[shortWallet(site.wallet), when(site.publishedAt)].filter(Boolean).join(" · ")}</em>
                    </a>
                    {mine ? (
                      <button
                        className="text"
                        type="button"
                        disabled={opening === site.slug}
                        onClick={() => changeSite(site)}
                      >
                        {opening === site.slug ? "Opening" : "Change"}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export function Examples() {
  useTitle("Examples · site0");

  return (
    <main className="narrow">
      <p className="eyebrow">Examples</p>
      <h1>Three sites.</h1>
      <p className="sub">Each sentence becomes one site. Open it and site0 builds that site.</p>
      <div className="example-list">
        {examples.map((example) => (
          <Link key={example.id} to={`/examples/${example.id}`} className="example-row">
            <span>{example.kind}</span>
            <strong>{example.title}</strong>
            <em>{example.prompt}</em>
          </Link>
        ))}
      </div>
    </main>
  );
}

export function ExampleDetail() {
  const { id } = useParams();
  const example = examples.find((item) => item.id === id);
  const navigate = useNavigate();
  const { setDraft, setPage } = useDraft();
  useTitle(example ? `${example.title} · site0` : "Example · site0");

  function build() {
    setPage({ title: example.title, html: "" });
    setDraft({
      mode: "write",
      url: "",
      prompt: example.prompt,
      name: example.title,
      offer: "",
      whatsapp: "",
    });
    navigate("/generating");
  }

  if (!example) {
    return (
      <main className="narrow">
        <h1>That example is gone.</h1>
        <Link to="/examples" className="text">
          Examples
        </Link>
      </main>
    );
  }

  return (
    <main className="narrow">
      <p className="eyebrow">{example.kind}</p>
      <h1>{example.title}</h1>
      <p className="sub">This sentence is the site.</p>
      <p className="prompt-block">{example.prompt}</p>
      <Dock>
        <button className="btn" type="button" onClick={build}>
          Make this site
        </button>
      </Dock>
    </main>
  );
}

export function Docs() {
  const { slug } = useParams();
  const article = docs.find((item) => item.slug === slug) || docs[0];
  const navigate = useNavigate();
  useTitle(`${article.title} · Docs · site0`);

  return (
    <main className="wide docs">
      <aside className="toc-desk">
        <p className="label">Docs</p>
        <nav>
          {docs.map((item) => (
            <Link
              key={item.slug}
              to={`/docs/${item.slug}`}
              className={item.slug === article.slug ? "toc on" : "toc"}
            >
              {item.title}
            </Link>
          ))}
        </nav>
      </aside>
      <article>
        <label className="toc-mobile">
          <span>Docs</span>
          <select
            value={article.slug}
            onChange={(event) => navigate(`/docs/${event.target.value}`)}
          >
            {docs.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <h1>{article.title}</h1>
        <p className="sub">{article.paragraph}</p>
        <ol className="doc-steps">
          {article.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="callout">
          <p className="label">Example</p>
          <p>{article.example}</p>
        </div>
      </article>
    </main>
  );
}

export function LiveSite() {
  const { page } = useDraft();
  const { slug } = useParams();
  const [stored, setStored] = useState(null);
  useEffect(() => {
    let gone = false;
    try {
      const raw = sessionStorage.getItem(`siteo-site:${slug}`) || sessionStorage.getItem(`site0-site:${slug}`) || sessionStorage.getItem(`siteO-site:${slug}`) || sessionStorage.getItem(`p0k-site:${slug}`);
      if (raw) setStored(JSON.parse(raw));
    } catch {
      setStored(null);
    }
    fetch(`/api/site?slug=${encodeURIComponent(slug)}`)
      .then((response) => (response.ok ? response.text() : ""))
      .then((html) => {
        if (!gone && html) setStored({ title: slug, html });
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [slug]);
  const own = Boolean(page.html) && slugify(page.title || "") === slug;
  const html = stored?.html ? String(stored.html) : own ? page.html : "";
  const title = stored?.title || (own ? page.title : "") || slug;
  useTitle(`${title} · site0`);

  if (html) {
    return (
      <iframe className="built" title={title} sandbox="allow-scripts allow-forms" srcDoc={html} />
    );
  }

  return (
    <div className="live">
      <p>This site is not published.</p>
      <footer className="badge">
        <Link to="/">site0</Link>
        <span>{cardPath(slug)}</span>
      </footer>
    </div>
  );
}
