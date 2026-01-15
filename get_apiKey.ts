import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';

const METABASE_URL = process.env.METABASE_URL;
const API_KEY = process.env.METABASE_API_KEY;
const TARGET_DB_ID = 1; // id do DB na instância
const DEFAULT_COLLECTION_ID = 67; // id da coleção onde os cards serão criados

type QueryItem = {
  name: string;
  description?: string;
  collection_id?: number;
  dataset_query: {
    database: number;
    type: string;
    native: {
      query: string;
      'template-tags': Record<string, any>;
    };
  };
};

async function createCardFromItem(item: QueryItem) {
  const body = {
    name: item.name,
    description: item.description ?? 'Importado via script',
    collection_id: item.collection_id ?? DEFAULT_COLLECTION_ID,
    display: 'table',
    type: 'question',
    dataset_query: {
      ...item.dataset_query,
      database: TARGET_DB_ID,
    },
    visualization_settings: {},
  };

  const res = await fetch(`${METABASE_URL}/api/card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Erro ao criar "${item.name}": ${res.status} - ${txt}`);
  }

  const json = (await res.json()) as { id: number; name: string };
  console.log(`Criado card #${json.id} - ${json.name}`);
}

async function main() {
  const raw = fs.readFileSync('./queries_formatted.json', 'utf8');
  const items: QueryItem[] = JSON.parse(raw);

  for (const item of items) {
    try {
      await createCardFromItem(item);
    } catch (err) {
      console.error(err);
    }
  }
}

main().catch(console.error);
