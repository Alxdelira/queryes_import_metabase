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

    const index = Number(indexLine);
    try {
      const dataset_query = JSON.parse(jsonLine);
      result.push({ index, name: nameLine, dataset_query });
    } catch {
      // se não for JSON, ignora esse bloco
    }

    i += 3;
  }

  return result;
}

function main() {
  const raw = fs.readFileSync('./queries.json', 'utf8');
  const items = parseRawFile(raw);

  const formatted = items
    .filter(
      (item) =>
        item.dataset_query &&
        item.dataset_query.native &&
        typeof item.dataset_query.native.query === 'string',
    )
    .map((item) => {
      let queryText = item.dataset_query.native.query as string;

      // normalização opcional
      queryText = queryText
        .replace(/\\r\\n/g, '\n')
        .replace(/\r\n/g, '\n')
        .replace(/\t/g, ' ');

      return {
        name: item.name,
        dataset_query: {
          database: item.dataset_query.database,
          type: item.dataset_query.type,
          native: {
            ...item.dataset_query.native,
            query: queryText,
          },
        },
      };
    });

  fs.writeFileSync(
    './queries_formatted.json',
    JSON.stringify(formatted, null, 2),
    'utf8',
  );

  console.log(
    `Parseados ${items.length} itens, aproveitados ${formatted.length} com native.query em queries_formatted.json`,
  );
}

main();
