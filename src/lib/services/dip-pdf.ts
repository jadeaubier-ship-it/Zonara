type RichBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "image"; dataUrl: string };

type PageDraft = {
  commands: string[];
  xObjects: Array<{ name: string; objectId: number }>;
};

type BuiltPdf = {
  base64: string;
  pageCount: number;
  receiptPageNumber: number | null;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 56;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 70;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const RECEIPT_SIGNATURE_BLOCK_HEIGHT = 170;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripInlineTags(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(strong|b|em|i|u|span|a)[^>]*>/gi, "")
      .replace(/<[^>]*>/g, "")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseRichHtml(html: string): RichBlock[] {
  const normalized = html
    .replace(/\r/g, "")
    .replace(/<div><br><\/div>/gi, "<p></p>")
    .replace(/<div>/gi, "<p>")
    .replace(/<\/div>/gi, "</p>");

  const blocks: RichBlock[] = [];
  const tokenRegex = /<(h1|h2|h3|p|ul|ol)(?:\s[^>]*)?>([\s\S]*?)<\/\1>|<img\b([^>]*)\/?>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(normalized))) {
    const preceding = normalized.slice(lastIndex, match.index).trim();
    if (preceding) {
      const text = stripInlineTags(preceding);
      if (text) {
        blocks.push({ type: "paragraph", text });
      }
    }

    if (match[1]) {
      const tag = match[1].toLowerCase();
      const inner = match[2] || "";

      if (tag === "ul" || tag === "ol") {
        const items = Array.from(inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
          .map((itemMatch) => stripInlineTags(itemMatch[1] || ""))
          .filter(Boolean);
        if (items.length) {
          blocks.push({ type: "list", ordered: tag === "ol", items });
        }
      } else {
        const text = stripInlineTags(inner);
        if (text) {
          if (tag === "h1" || tag === "h2" || tag === "h3") {
            blocks.push({ type: "heading", level: Number(tag[1]) as 1 | 2 | 3, text });
          } else {
            blocks.push({ type: "paragraph", text });
          }
        }
      }
    } else if (match[3]) {
      const srcMatch = match[3].match(/src=["']([^"']+)["']/i);
      if (srcMatch?.[1]) {
        blocks.push({ type: "image", dataUrl: srcMatch[1] });
      }
    }

    lastIndex = tokenRegex.lastIndex;
  }

  const trailing = normalized.slice(lastIndex).trim();
  if (trailing) {
    const text = stripInlineTags(trailing);
    if (text) {
      blocks.push({ type: "paragraph", text });
    }
  }

  return blocks;
}

function normalizePdfText(value: string) {
  return value
    .normalize("NFC")
    .replace(/\u00A0/g, " ")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u0153/g, "oe")
    .replace(/\u0152/g, "OE")
    .replace(/\u2022/g, "-")
    .replace(/\u20AC/g, "EUR");
}

function encodePdfTextHex(value: string) {
  const normalized = normalizePdfText(value);
  const bytes: number[] = [];

  for (const char of normalized) {
    const codePoint = char.codePointAt(0) ?? 63;
    bytes.push(codePoint <= 0xff ? codePoint : 63);
  }

  return Buffer.from(bytes).toString("hex").toUpperCase();
}

function wrapText(text: string, fontSize: number, maxWidth: number) {
  const approxCharWidth = fontSize * 0.52;
  const maxChars = Math.max(12, Math.floor(maxWidth / approxCharWidth));
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) {
      lines.push(current);
    }
  }

  return lines;
}

function hexEncode(buffer: Buffer) {
  return buffer.toString("hex").toUpperCase();
}

function getJpegDimensions(buffer: Buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }

    offset += 2 + length;
  }

  return { width: 1200, height: 675 };
}

export function buildDipPdf(params: {
  title: string;
  dipHtml: string;
  receiptHtml?: string;
}): BuiltPdf {
  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };

  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const pages: PageDraft[] = [];
  let currentPage: PageDraft = { commands: [], xObjects: [] };
  let y = PAGE_HEIGHT - MARGIN_TOP;
  let currentBottomMargin = MARGIN_BOTTOM;

  const ensurePage = () => {
    if (!pages.includes(currentPage)) {
      pages.push(currentPage);
    }
  };

  const newPage = () => {
    ensurePage();
    currentPage = { commands: [], xObjects: [] };
    y = PAGE_HEIGHT - MARGIN_TOP;
    currentBottomMargin = MARGIN_BOTTOM;
  };

  const reserveSpace = (height: number) => {
    if (y - height < currentBottomMargin) {
      newPage();
    }
  };

  const drawTextBlock = (lines: string[], fontId: number, fontSize: number, lineHeight: number, x = MARGIN_X) => {
    for (const line of lines) {
      reserveSpace(lineHeight);
      currentPage.commands.push(`BT /F${fontId} ${fontSize} Tf ${x} ${y} Td <${encodePdfTextHex(line)}> Tj ET`);
      y -= lineHeight;
    }
  };

  const drawTextAt = (text: string, fontId: number, fontSize: number, x: number, textY: number) => {
    currentPage.commands.push(`BT /F${fontId} ${fontSize} Tf ${x} ${textY} Td <${encodePdfTextHex(text)}> Tj ET`);
  };

  const drawImage = (dataUrl: string) => {
    const dataMatch = dataUrl.match(/^data:(image\/(?:jpeg|jpg));base64,(.*)$/i);
    if (!dataMatch) {
      drawTextBlock(["[Image intégrée non supportée dans le PDF final]"], 1, 10, 15);
      y -= 8;
      return;
    }

    const imageBuffer = Buffer.from(dataMatch[2], "base64");
    const { width, height } = getJpegDimensions(imageBuffer);
    const maxWidth = CONTENT_WIDTH;
    const maxHeight = 260;
    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
    const drawWidth = Math.round(width * ratio);
    const drawHeight = Math.round(height * ratio);

    reserveSpace(drawHeight + 16);

    const objectId = addObject(
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hexEncode(imageBuffer).length + 1} >>\nstream\n${hexEncode(imageBuffer)}>\nendstream`
    );
    const name = `Im${currentPage.xObjects.length + 1}`;
    currentPage.xObjects.push({ name, objectId });
    const imageY = y - drawHeight;
    currentPage.commands.push(`q ${drawWidth} 0 0 ${drawHeight} ${MARGIN_X} ${imageY} cm /${name} Do Q`);
    y = imageY - 16;
  };

  const renderBlocks = (blocks: RichBlock[]) => {
    for (const block of blocks) {
      if (block.type === "heading") {
        const fontSize = block.level === 1 ? 20 : block.level === 2 ? 16 : 14;
        const lineHeight = fontSize + 8;
        const lines = wrapText(block.text, fontSize, CONTENT_WIDTH);
        drawTextBlock(lines, 2, fontSize, lineHeight);
        y -= 8;
        continue;
      }

      if (block.type === "paragraph") {
        const lines = wrapText(block.text, 11, CONTENT_WIDTH);
        drawTextBlock(lines, 1, 11, 16);
        y -= 8;
        continue;
      }

      if (block.type === "list") {
        block.items.forEach((item, index) => {
          const prefix = block.ordered ? `${index + 1}. ` : "- ";
          const lines = wrapText(`${prefix}${item}`, 11, CONTENT_WIDTH - 12);
          drawTextBlock(lines, 1, 11, 16, MARGIN_X + 12);
        });
        y -= 6;
        continue;
      }

      if (block.type === "image") {
        drawImage(block.dataUrl);
      }
    }
  };

  drawTextBlock([params.title], 2, 22, 30);
  y -= 12;
  renderBlocks(parseRichHtml(params.dipHtml));

  let receiptPageNumber: number | null = null;
  if (params.receiptHtml?.trim()) {
    newPage();
    receiptPageNumber = pages.length + 1;
    currentBottomMargin = MARGIN_BOTTOM + RECEIPT_SIGNATURE_BLOCK_HEIGHT;
    drawTextBlock(["Accusé de réception"], 2, 20, 28);
    y -= 12;
    renderBlocks(parseRichHtml(params.receiptHtml));
    const dividerY = MARGIN_BOTTOM + 136;
    const nameLabelY = MARGIN_BOTTOM + 108;
    const nameLineY = MARGIN_BOTTOM + 96;
    const dateLabelY = MARGIN_BOTTOM + 108;
    const dateLineY = MARGIN_BOTTOM + 96;
    const signatureLabelY = MARGIN_BOTTOM + 62;
    const signatureLineY = MARGIN_BOTTOM + 20;

    currentPage.commands.push(`${MARGIN_X} ${dividerY} m ${PAGE_WIDTH - MARGIN_X} ${dividerY} l S`);
    drawTextAt("Nom complet :", 2, 11, MARGIN_X, nameLabelY);
    currentPage.commands.push(`${MARGIN_X} ${nameLineY} m ${MARGIN_X + 240} ${nameLineY} l S`);
    drawTextAt("Date :", 2, 11, MARGIN_X + 286, dateLabelY);
    currentPage.commands.push(`${MARGIN_X + 286} ${dateLineY} m ${MARGIN_X + 446} ${dateLineY} l S`);
    drawTextAt("Signature électronique :", 2, 11, MARGIN_X, signatureLabelY);
    currentPage.commands.push(`${MARGIN_X} ${signatureLineY} m ${PAGE_WIDTH - MARGIN_X} ${signatureLineY} l S`);
    currentBottomMargin = MARGIN_BOTTOM;
  }
  ensurePage();

  const pageIds: number[] = [];
  for (const page of pages) {
    const resourceParts = [`/Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >>`];
    if (page.xObjects.length) {
      resourceParts.push(`/XObject << ${page.xObjects.map((image) => `/${image.name} ${image.objectId} 0 R`).join(" ")} >>`);
    }

    const contentStream = page.commands.join("\n");
    const contentId = addObject(`<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << ${resourceParts.join(" ")} >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  const pagesId = addObject(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);
  for (const pageId of pageIds) {
    objects[pageId - 1] = objects[pageId - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  }

  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return {
    base64: Buffer.from(pdf, "utf8").toString("base64"),
    pageCount: pages.length,
    receiptPageNumber
  };
}
