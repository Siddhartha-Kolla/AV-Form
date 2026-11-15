// Erzeugt kleine, gültige Beispieldateien (PDF, Word, WAV, Text) für die Entwicklung,
// damit sich die Vorschau in der Übersicht ausprobieren lässt. Enthält nur erfundene Inhalte.
import JSZip from "jszip";

/* PDF ------------------------------------------------------------------------ */

const CP1252: Record<string, string> = { ä: "\\344", ö: "\\366", ü: "\\374", Ä: "\\304", Ö: "\\326", Ü: "\\334", ß: "\\337", "–": "\\226" };

function pdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7e]/g, (z) => CP1252[z] ?? "?");
}

/** Ein PDF mit einer Überschrift und Textzeilen je Seite. */
export function beispielPdf(seiten: { titel: string; zeilen: string[] }[]): Buffer {
  const objekte: string[] = [];
  const kinder: number[] = [];
  // 1 Catalog, 2 Pages, 3 Font, danach je Seite (Page, Content)
  objekte[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objekte[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  seiten.forEach((seite, i) => {
    const seitenNr = 4 + i * 2;
    const inhaltNr = seitenNr + 1;
    kinder.push(seitenNr);
    const zeilen = seite.zeilen.map((z) => `(${pdfText(z)}) Tj T*`).join("\n");
    const strom = `BT /F1 22 Tf 56 770 Td (${pdfText(seite.titel)}) Tj ET\nBT /F1 12 Tf 16 TL 56 735 Td\n${zeilen}\nET`;
    objekte[seitenNr] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${inhaltNr} 0 R >>`;
    objekte[inhaltNr] = `<< /Length ${Buffer.byteLength(strom, "latin1")} >>\nstream\n${strom}\nendstream`;
  });
  objekte[2] = `<< /Type /Pages /Kids [${kinder.map((k) => `${k} 0 R`).join(" ")}] /Count ${kinder.length} >>`;

  let ausgabe = "%PDF-1.4\n";
  const versatz: number[] = [];
  for (let nr = 1; nr < objekte.length; nr++) {
    versatz[nr] = Buffer.byteLength(ausgabe, "latin1");
    ausgabe += `${nr} 0 obj\n${objekte[nr]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(ausgabe, "latin1");
  ausgabe += `xref\n0 ${objekte.length}\n0000000000 65535 f \n`;
  for (let nr = 1; nr < objekte.length; nr++) ausgabe += `${String(versatz[nr]).padStart(10, "0")} 00000 n \n`;
  ausgabe += `trailer\n<< /Size ${objekte.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(ausgabe, "latin1");
}

/* Word ----------------------------------------------------------------------- */

function xml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function absatz(text: string, fett = false, groesse = 22): string {
  return `<w:p><w:r><w:rPr>${fett ? "<w:b/>" : ""}<w:sz w:val="${groesse}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

export async function beispielDocx(titel: string, zeilen: string[][]): Promise<Buffer> {
  const rand = '<w:tcBorders><w:top w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/></w:tcBorders>';
  const tabelle = `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/></w:tblPr>${zeilen
    .map(
      (zeile, i) =>
        `<w:tr>${zeile
          .map((zelle) => `<w:tc><w:tcPr><w:tcW w:w="${Math.floor(9000 / zeile.length)}" w:type="dxa"/>${rand}</w:tcPr>${absatz(zelle, i === 0)}</w:tc>`)
          .join("")}</w:tr>`,
    )
    .join("")}</w:tbl>`;
  const dokument = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${absatz(titel, true, 36)}${absatz("Beispieldokument für die Vorschau.")}${tabelle}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file("word/document.xml", dokument);
  return zip.generateAsync({ type: "nodebuffer" });
}

/* Audio ---------------------------------------------------------------------- */

/** Ein Sinuston als WAV (16 Bit, mono). */
export function beispielWav(sekunden = 2, frequenz = 440): Buffer {
  const rate = 22050;
  const n = rate * sekunden;
  const daten = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const huellkurve = Math.min(1, i / 800, (n - i) / 800);
    daten.writeInt16LE(Math.round(Math.sin((2 * Math.PI * frequenz * i) / rate) * 6000 * huellkurve), i * 2);
  }
  const kopf = Buffer.alloc(44);
  kopf.write("RIFF", 0);
  kopf.writeUInt32LE(36 + daten.length, 4);
  kopf.write("WAVEfmt ", 8);
  kopf.writeUInt32LE(16, 16);
  kopf.writeUInt16LE(1, 20);
  kopf.writeUInt16LE(1, 22);
  kopf.writeUInt32LE(rate, 24);
  kopf.writeUInt32LE(rate * 2, 28);
  kopf.writeUInt16LE(2, 32);
  kopf.writeUInt16LE(16, 34);
  kopf.write("data", 36);
  kopf.writeUInt32LE(daten.length, 40);
  return Buffer.concat([kopf, daten]);
}
