// format-queries.ts
import fs from 'fs';

type RawItem = {
  index: number;
  name: string;
  dataset_query: any;
};

function parseRawFile(content: string): RawItem[] {
  const lines = content.split(/\r?\n/);
  const result: RawItem[] = [];

  let i = 0;
  while (i < lines.length) {
    const indexLine = lines[i]?.trim();
    const nameLine = lines[i + 1]?.trim();
    const jsonLine = lines[i + 2]?.trim();

    if (!indexLine || !nameLine || !jsonLine) break;

    // tenta converter o índice e o JSON
    const index = Number(indexLine);
    try {
      const dataset_query = JSON.parse(jsonLine);
      result.push({ index, name: nameLine, dataset_query });
    } catch {
      // se der erro de parse, pula esse bloco
    }

    i += 3;
  }

  return result;
}

function main() {
  const raw = fs.readFileSync('./queries.json', 'utf8');
  const items = parseRawFile(raw);

  const formatted = items.map((item) => ({
    name: item.name,
    dataset_query: {
      database: item.dataset_query.database,
      type: item.dataset_query.type,
      native: item.dataset_query.native,
    },
  }));

  fs.writeFileSync(
    './queries_formatted.json',
    JSON.stringify(formatted, null, 2),
    'utf8',
  );

  console.log(`Formatado ${formatted.length} itens em queries_formatted.json`);
}

main();
