import { readFile } from 'node:fs/promises';
import PDFParser from 'pdf2json';

function decodeText(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function parsePdfTextItems(path) {
  const buffer = await readFile(path);

  return new Promise((resolve, reject) => {
    const parser = new PDFParser();

    parser.once('pdfParser_dataError', error => {
      parser.destroy();
      reject(error?.parserError || error);
    });
    parser.once('pdfParser_dataReady', data => {
      const items = data.Pages.flatMap((page, pageIndex) =>
        page.Texts.map(item => ({
          page: pageIndex + 1,
          x: item.x,
          y: item.y,
          text: item.R.map(run => decodeText(run.T)).join(''),
        })),
      );
      parser.destroy();
      resolve(items);
    });

    parser.parseBuffer(buffer, 0);
  });
}
