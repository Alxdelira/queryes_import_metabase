<div align="center">
  <img alt="Logo pessoal do Alexandre" src="https://github.com/Alxdelira/Alxdelira/blob/main/.github/assets/logo.png" width="160" />

  <h1 align="center">Importador de Queries para Metabase via API</h1>

</div>


Ferramenta em Node.js para importar em massa perguntas (cards) do Metabase a partir de um arquivo `queries.json` bruto, utilizando a API do Metabase autenticada por API Key. Ideal para recriar queries nativas (SQL) em uma nova instância sem cadastro manual.

---

## Visão geral

Fluxo:
1. Formatar o arquivo bruto (`queries.json`) em `queries_formatted.json`.
2. Importar os itens formatados para a instância Metabase via POST `/api/card`, sobrescrevendo o ID do banco e definindo collection padrão quando necessário.

---

## Arquitetura dos scripts

1. `format-queries.ts` — transforma o `queries.json` bruto em um array JSON estruturado pronto para importação.
  - Lê o arquivo bruto.
  - Agrupa linhas em blocos de 3: índice, nome, JSON do `dataset_query`.
  - Faz `JSON.parse` do bloco JSON e filtra apenas itens com `dataset_query.native.query` como string.
  - Normaliza quebras de linha e tabs.
  - Salva `queries_formatted.json`.

Exemplo de implementação (TypeScript):

```ts
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
    // ignora blocos inválidos
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
```

2. `import-queries.ts` — consome `queries_formatted.json` e cria cards no Metabase via API.
  - Lê o arquivo formatado.
  - Para cada item monta o payload do POST `/api/card`, sobrescrevendo `dataset_query.database` para o `METABASE_DB_ID`.
  - Autentica usando `X-API-Key` e continua em caso de falhas (log de erro).

Exemplo de implementação (TypeScript):

```ts
import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';

const METABASE_URL = process.env.METABASE_URL ?? 'https://seu-metabase.com';
const API_KEY = process.env.METABASE_API_KEY ?? 'SUA_API_KEY';
const TARGET_DB_ID = Number(process.env.METABASE_DB_ID ?? '1');
const DEFAULT_COLLECTION_ID = Number(process.env.METABASE_COLLECTION_ID ?? '1');

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
```

---

## Pré-requisitos

- Node.js 18+ recomendado.
- API Key do Metabase com permissão para criar cards.
- Banco de dados já configurado na instância (ID usado em METABASE_DB_ID).
- Arquivo `queries.json` com as queries originais na raiz do projeto.

---

## Instalação

1. Dependências:
```bash
npm install node-fetch dotenv
```
(TypeScript dev dependencies se aplicável)
```bash
npm install -D typescript ts-node @types/node
```

2. Variáveis de ambiente (`.env`):
```
METABASE_URL=https://seu-metabase.com
METABASE_API_KEY=mb_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
METABASE_DB_ID=1
METABASE_COLLECTION_ID=65
```

---

## Uso

1. Formatar o arquivo bruto:
```bash
npx ts-node format-queries.ts
# ou
ts-node format-queries.ts
```

2. Importar as queries no Metabase:
```bash
npx ts-node import-queries.ts
# ou
ts-node import-queries.ts
```

---

## Notas importantes

- O campo `database` de cada `dataset_query` é sobrescrito para `METABASE_DB_ID` para evitar FK inválidas.
- `collection_id` é definido para `METABASE_COLLECTION_ID` caso não exista no item.
- O script continua a execução mesmo que alguns itens falhem; erros são logados.

---

## Referências

- Documentação da API do Metabase.
- Administração de API Keys e cards (questions) no Metabase.

---
<p align="center">
  <a href="https://portfolioalxdelira.vercel.app/" target="_blank" rel="noreferrer">
    <img src="https://github.com/Alxdelira/Alxdelira/blob/main/.github/assets/footer.png" alt="Banner com link para o portfólio" width="100%" />
  </a>
</p>
