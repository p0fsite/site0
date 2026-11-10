export const TOKEN_MINT = "";
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
    slug: "start",
    title: "Start",
    paragraph:
      "You end up with one card and, after you publish, a link you can send. Until you publish, the card is only a preview on this screen.",
    steps: [
      "On the home page, paste a public link, or switch to Write it yourself and write one sentence: the name, the line, the price, the time, or the place.",
      "Open the preview. A pasted link shows that site. A sentence comes back as one card.",
      "Read it. Fix a line that is wrong, then publish if you want a public link.",
    ],
    example:
      "Paste a public page to study that site, or write “Lane Coffee. Open until 2. Milk is 4. Second door on the left.” to get that card.",
  },
  {
    slug: "paste",
    title: "Pasting a reference link",
    paragraph:
      "Paste the address of a public page. The preview opens that same page, so you can scroll it and press its links without leaving site0.",
    steps: [
      "Copy a full address that starts with http:// or https://.",
      "Leave Paste a link selected, put the address in the field, and press the arrow.",
      "After the short wait, the site sits in the frame. Clicks stay inside that frame.",
    ],
    example:
      "A public address opens that page in the preview, including its buttons. The field starts empty. Nothing is filled in for you.",
  },
  {
    slug: "prompt",
    title: "Writing a prompt",
    paragraph:
      "Write one sentence for the card. Name the place, then the line, the price, the time, or the door. site0 keeps what you wrote.",
    steps: [
      "Switch to Write it yourself.",
      "Start with the name. Then the line a visitor should see: a price, the hours, a place. Write it in English.",
      "Press the arrow. site0 keeps the names, prices, and times you wrote.",
      "Under Database, write what a visitor can save, such as a name and a message. The published card stores those records and lists them.",
      "Posting does not burn tokens until a contract is set.",
    ],
    example:
      "“Lane Coffee. Open until 2. Black coffee 3, coffee with milk 4. Second door. No phone number.” The card stays in English and does not invent a phone number.",
  },
  {
    slug: "edit",
    title: "Changing the card",
    paragraph:
      "When the card is built, you change it by writing what is wrong. The same card is updated. The earlier prompt stays listed above the box.",
    steps: [
      "On the preview, read the prompt so far.",
      "In Change it, write only the correction. Say what should stay if the rest is already right.",
      "Press Update the page. A card that is already live keeps its link.",
    ],
    example:
      "“Change the button to Order now. Make the coffee with milk 5. Leave the rest.” The name, the other prices, and the layout stay.",
  },
  {
    slug: "publish",
    title: "Publishing",
    paragraph:
      "Publish is what gives the card an address. Before that, the preview exists only in your browser.",
    steps: [
      "From the preview, press Post this card.",
      "Connect a Solana wallet from the button at the top right.",
      "Press Publish. Then copy the link, or open the card.",
    ],
    example: "A card titled Lane Coffee is published at /s/lane-coffee.",
  },
  {
    slug: "pay",
    title: "Publishing for now",
    paragraph:
      "There is no contract yet, so posting a card does not burn tokens. Connect a wallet, then publish.",
    steps: [
      "Press Connect wallet at the top right and pick the Solana wallet on this browser.",
      "On the publish screen, press Publish.",
      "Copy the link once the card is saved.",
    ],
    example: "A card titled Lane Coffee goes live at /s/lane-coffee once the wallet is connected.",
  },
  {
    slug: "links",
    title: "The link",
    paragraph:
      "A published card has one address. It works as soon as publish finishes.",
    steps: [
      "The link looks like /s/lane-coffee.",
      "Copy it from the publish screen, or press Open the card.",
      "Send that link. The card opens on that address.",
    ],
    example: "A card titled Lane Coffee opens at /s/lane-coffee.",
  },
  {
    slug: "token",
    title: "The token",
    paragraph:
      "site0 has no contract right now. Writing and posting a card does not burn tokens. A later change to a live card stays on the same link.",
    steps: [
      "Connect a Solana wallet from the button at the top right.",
      "Write the card, then publish it.",
      "A later change to a live card keeps the link.",
    ],
    example: "Lane Coffee is posted at /s/lane-coffee. No tokens leave the wallet.",
  },
];
