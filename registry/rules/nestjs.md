# Rules: NestJS

## Meta

```yaml
version: "1.0.0"
category: "nestjs"
sync: true
```

## Estrutura

- Controllers não contêm lógica de negócio — apenas delegam para services
- Services não importam tipos HTTP (`Request`, `Response`) — responsabilidade do controller
- Módulos devem ter escopo mínimo — não exportar o que não precisa ser compartilhado
- Nunca usar `forwardRef` sem documentar a dependência circular e por que existe

## Providers e injeção

- Nunca instanciar providers com `new` — sempre injetar via construtor
- Nunca declarar provider sem incluir no `providers[]` do módulo correspondente
- Serviços compartilhados entre módulos devem estar em um módulo dedicado (`SharedModule`, `CoreModule`)

## Validação e DTOs

- Todo input HTTP passa por DTO com `class-validator` — nunca validar manualmente no controller
- DTOs de request e response são classes separadas — nunca reutilizar o mesmo DTO
- `ValidationPipe` com `whitelist: true` e `forbidNonWhitelisted: true` globalmente

## Configuração

- Nunca acessar `process.env` diretamente — sempre via `ConfigService`
- Variáveis de ambiente validadas no startup via `Joi` ou similar
- Secrets nunca em código — sempre via variáveis de ambiente

## Exceptions

- Usar as classes do NestJS (`BadRequestException`, `NotFoundException`, `UnauthorizedException`)
- Nunca lançar `Error` genérico — sempre uma exception tipada
- Exceptions de domínio mapeadas para HTTP no filtro global, não nos controllers

## Customizações do projeto

<!-- HARNESS:CUSTOM:START -->
<!-- HARNESS:CUSTOM:END -->
