export const TOKEN_MINT = "";
export const X_URL = "https://x.com/site0app";
export const TELEGRAM_URL = "";
export const GENERATE_TOKENS = 10_000;
export const SITE_HOST = "";

export function cardPath(slug) {
  return `/s/${slug}`;
}

export const sampleDraft = {
  mode: "link",
  url: "",
  prompt: "",
  data: "",
  name: "",
  offer: "",
  whatsapp: "",
};

export function readSite(url) {
  let host = "that site";
  try {
    host = new URL(url).host.replace(/^www\./, "");
  } catch {
    host = url.replace(/^https?:\/\//, "").split("/")[0] || host;
  }

  const name = host.split(".")[0] || "site";
  return {
    host,
    name,
    line: `The public page at ${host}.`,
    passes: [
      ["Opening the page", 2400],
      ["Layout, type, and color", 3200],
      ["Every section, in the same order", 3000],
      ["Buttons and where they go", 2800],
      ["Checking it against the original", 3000],
    ],
    ui: [
      "The original page, in this frame.",
      "Scroll it and press its links.",
      "Clicks stay inside the frame.",
    ],
    logic: [
      "What the first screen asks the visitor to do.",
      "Where the buttons go.",
      "What the page is for.",
    ],
  };
}

export function slugify(name) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "page";
}

export function pageFromDraft(draft) {
  return {
    layout: "shop",
    kicker: "Open from dawn",
    title: draft.name.trim() || "Your page",
    lede: draft.offer.trim() || "What you sell.",
    note:
      draft.mode === "write" && draft.prompt.trim()
        ? draft.prompt.trim()
        : "Walk in, or send a message. We answer between pours.",
    hours: "Daily, 7:00 – 14:00",
    address: "12 Lane Street",
    whatsapp: draft.whatsapp.trim(),
    rows: [],
  };
}

export const examples = [
  {
    id: "barbershop",
    kind: "Barbershop",
    title: "North Chair",
    prompt: `North Chair, a one-chair barbershop. Walk in. Cut 18. Shave 12. Both 26. Tue – Sat, 10:00 – 18:00. 8 Mercer Alley.`,
  },
  {
    id: "catering",
    kind: "Catering",
    title: "Sunday Table",
    prompt: `Sunday Table, a catering kitchen. A shared meal for ten, cooked in the morning. Roast chicken feeds 10. Orders close Friday at noon. Delivered in the city.`,
  },
  {
    id: "clinic",
    kind: "Clinic",
    title: "Harbor Room",
    prompt: `Harbor Room, a small clinic. Checkups and stitches. Monday 8:00 – 16:00. Wednesday 8:00 – 12:00. Friday 8:00 – 16:00. 2 Wharf Lane.`,
  },
];

export const docs = [
  {
    slug: "who",
    title: "Who it's for",
    paragraph:
      "site0 is for anyone who wants a website and does not know how to make one. You do not need to code, pick a design, or understand how the web is built. Describe the site in one sentence. site0 makes the page.",
    steps: [
      "This is for a shop, a clinic, a menu, a service, or any one-page site. If you can say what it does, that is enough.",
      "You do not write code, buy hosting, or hire someone to design it. site0 turns your sentence into the page.",
      "Read the page, fix a line that is wrong, then publish it and send the link.",
    ],
    example:
      "Lane Coffee has hours and a price, and nobody there builds websites. “Open until 2. Milk is 4. Second door on the left.” becomes the page.",
  },
  {
    slug: "start",
    title: "Start",
    paragraph:
      "You end up with one site and, after you publish, a link you can send. Until you publish, the site is only a preview on this screen.",
    steps: [
      "On the home page, paste any public link as an example, or switch to Write it yourself and write one sentence: the name, the line, the price, the time, or the place.",
      "Open the preview. A pasted link comes back as a new site in that spirit. A sentence comes back as one site.",
      "Read it. Fix a line that is wrong, then publish if you want a public link.",
    ],
    example:
      "Paste a public page to use as the example, or write “Lane Coffee. Open until 2. Milk is 4. Second door on the left.” to get that site.",
  },
  {
    slug: "paste",
    title: "Pasting a reference link",
    paragraph:
      "Paste the address of any public page you like. site0 looks at that page and builds a new site from it. The result is your page, not a copy of theirs.",
    steps: [
      "Copy a full address that starts with http:// or https://.",
      "Leave Paste a link selected, put the address in the field, and press the arrow.",
      "After the wait, the preview is a new site in that spirit. Say what to change if the name or the details are wrong.",
    ],
    example:
      "A public address is an example. site0 writes a different site from it. The field starts empty. Nothing is filled in for you.",
  },
  {
    slug: "prompt",
    title: "Writing a prompt",
    paragraph:
      "Write one sentence for the site. Name the place, then the line, the price, the time, or the door. site0 keeps what you wrote.",
    steps: [
      "Switch to Write it yourself.",
      "Start with the name. Then the line a visitor should see: a price, the hours, a place. Write it in English.",
      "Press the arrow. site0 keeps the names, prices, and times you wrote.",
      "Under Database, write what a visitor can save, such as a name and a message. The published site stores those records and lists them.",
      "Posting does not burn tokens until a contract is set.",
    ],
    example:
      "“Lane Coffee. Open until 2. Black coffee 3, coffee with milk 4. Second door. No phone number.” The site stays in English and does not invent a phone number.",
  },
  {
    slug: "edit",
    title: "Changing the site",
    paragraph:
      "When the site is built, you change it by writing what is wrong. The same site is updated. The earlier prompt stays listed above the box.",
    steps: [
      "On the preview, read the prompt so far.",
      "In Change it, write only the correction. Say what should stay if the rest is already right.",
      "Press Update the page. A site that is already live keeps its link.",
    ],
    example:
      "“Change the button to Order now. Make the coffee with milk 5. Leave the rest.” The name, the other prices, and the layout stay.",
  },
  {
    slug: "publish",
    title: "Publishing",
    paragraph:
      "Publish is what gives the site an address. Before that, the preview exists only in your browser.",
    steps: [
      "From the preview, press Post this site.",
      "Connect a Solana wallet from the button at the top right.",
      "Press Publish. Then copy the link, or open the site.",
    ],
    example: "A site titled Lane Coffee is published at /s/lane-coffee.",
  },
  {
    slug: "pay",
    title: "Publishing for now",
    paragraph:
      "There is no contract yet, so posting a site does not burn tokens. Connect a wallet, then publish.",
    steps: [
      "Press Connect wallet at the top right and pick the Solana wallet on this browser.",
      "On the publish screen, press Publish.",
      "Copy the link once the site is saved.",
    ],
    example: "A site titled Lane Coffee goes live at /s/lane-coffee once the wallet is connected.",
  },
  {
    slug: "links",
    title: "The link",
    paragraph:
      "A published site has one address. It works as soon as publish finishes.",
    steps: [
      "The link looks like /s/lane-coffee.",
      "Copy it from the publish screen, or press Open the site.",
      "Send that link. The site opens on that address.",
    ],
    example: "A site titled Lane Coffee opens at /s/lane-coffee.",
  },
  {
    slug: "token",
    title: "The token",
    paragraph:
      "site0 has no contract right now. Writing and posting a site does not burn tokens. A later change to a live site stays on the same link.",
    steps: [
      "Connect a Solana wallet from the button at the top right.",
      "Write the site, then publish it.",
      "A later change to a live site keeps the link.",
    ],
    example: "Lane Coffee is posted at /s/lane-coffee. No tokens leave the wallet.",
  },
];
