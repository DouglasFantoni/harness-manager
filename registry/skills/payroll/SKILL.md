# Skill: Payroll

## Meta

```yaml
version: "1.0.0"
domain: "domínio"
weight: ~800
exposes_command: []
required_by: ["/review", "/audit"]
load_with: ["fiscal"]
conflicts_with: []
globs: ["**/*.payroll.ts", "**/payroll/**/*.ts", "**/folha/**/*.ts"]
```

## Quando usar

Ao criar, editar ou revisar qualquer lógica de cálculo de folha de pagamento,
incluindo INSS, IRRF, FGTS, férias, 13º e rescisão. Também ao lidar com
tabelas de tributação e regras do eSocial relacionadas a folha.

## Quando NÃO usar

Para emissão de NFS-e, eventos eSocial ou certificados digitais — use a skill `fiscal`.
Para UI de holerite ou relatórios — use a skill de frontend correspondente.

## Contexto essencial

- Tabelas INSS e IRRF mudam anualmente — nunca hardcodar alíquotas no código
- INSS usa tabela progressiva desde março de 2023 — alíquota flat está errada
- `taxSnapshot` deve ser gravado junto com todo cálculo persistido para garantir
  imutabilidade fiscal (auditoria futura mesmo com tabelas alteradas)
- FGTS: 8% sobre remuneração bruta (11.2% para domésticos)
- 13º salário tem INSS e IRRF calculados separadamente da folha mensal

## Regras

- Nunca calcular INSS com alíquota flat — sempre usar tabela progressiva vigente
- Nunca persistir resultado de cálculo sem gravar o `taxSnapshot` correspondente
- Nunca duplicar tabelas de tributação — usar a fonte canônica do projeto
- IRRF: calcular sobre base = salário bruto - INSS - dependentes - pensão alimentícia
- Rescisão: calcular proporcionais com precisão de dias, não meses cheios
- Sempre logar a versão da tabela usada no cálculo para auditoria

## Padrões

**Estrutura de resultado:**
```typescript
interface PayrollResult {
  grossSalary: number
  inss: number
  irrf: number
  fgts: number
  netSalary: number
  taxSnapshot: TaxSnapshot   // obrigatório — captura as tabelas usadas
  calculatedAt: Date
}
```

**taxSnapshot:**
```typescript
interface TaxSnapshot {
  inssTable: InssRange[]     // tabela INSS vigente no momento do cálculo
  irrfTable: IrrfRange[]     // tabela IRRF vigente
  tableYear: number          // ano de referência
  tableVersion: string       // versão/portaria
}
```

## Customizações do projeto

<!-- HARNESS:CUSTOM:START -->
<!-- HARNESS:CUSTOM:END -->
