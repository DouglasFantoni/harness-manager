# Skill: Next.js

## Meta

```yaml
version: "1.0.0"
domain: "frontend"
weight: ~650
exposes_command: []
required_by: ["/review", "/refactor"]
load_with: []
conflicts_with: []
globs: ["**/app/**/*.tsx", "**/app/**/*.ts", "**/components/**/*.tsx", "next.config.*"]
```

## Quando usar

Ao criar, editar ou revisar qualquer arquivo Next.js — pages, layouts,
server components, client components, actions, route handlers ou configuração.

## Quando NÃO usar

Para lógica de API pura sem Next.js (ex: NestJS backend). Use a skill `nestjs`.
Para componentes de UI puros sem dependência de Next.js. Use a skill de frontend.

## Contexto essencial

- Next.js App Router: todo componente é Server Component por padrão
- `'use client'` torna o componente Client Component — use só quando necessário
  (eventos, hooks, estado local, browser APIs)
- Server Components podem ser `async` — Client Components não
- `fetch` em Server Components tem cache por padrão — use `cache: 'no-store'`
  para dados dinâmicos
- Metadata é exportada como objeto, não componente, em Server Components
- `'use server'` marca Server Actions — podem ser chamadas de Client Components

## Regras

- Nunca usar `useState`, `useEffect` ou outros hooks em Server Components
- Nunca importar `'use client'` apenas para passar props entre server components
- Sempre preferir Server Components para fetching de dados — evita waterfall
- `loading.tsx` e `error.tsx` são automáticos por segmento de rota — usar sempre
- Imagens: sempre `<Image>` do `next/image`, nunca `<img>` raw
- Links: sempre `<Link>` do `next/link`, nunca `<a>` para rotas internas
- Fonts: carregar via `next/font` — nunca importar de CDN externo
- Variáveis de ambiente client-side exigem prefixo `NEXT_PUBLIC_`

## Padrões

**Server Component com fetch:**
```typescript
// Sem 'use client' — Server Component por padrão
export default async function Page({ params }: { params: { id: string } }) {
  const data = await fetch(`/api/items/${params.id}`, { cache: 'no-store' })
  const item = await data.json()
  return <div>{item.name}</div>
}
```

**Client Component:**
```typescript
'use client'

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

**Server Action:**
```typescript
'use server'

export async function criarItem(formData: FormData) {
  const nome = formData.get('nome') as string
  await db.insert({ nome })
  revalidatePath('/itens')
}
```

**Route Handler:**
```typescript
// app/api/items/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const items = await getItems(searchParams.get('q'))
  return Response.json(items)
}
```

## Customizações do projeto

<!-- HARNESS:CUSTOM:START -->
<!-- HARNESS:CUSTOM:END -->
