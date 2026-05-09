# Skill: NestJS

## Meta

```yaml
version: "1.0.0"
domain: "backend"
weight: ~700
exposes_command: []
required_by: ["/review", "/refactor", "/audit"]
load_with: []
conflicts_with: []
globs: ["**/*.service.ts", "**/*.controller.ts", "**/*.module.ts", "**/*.guard.ts", "**/*.interceptor.ts"]
```

## Quando usar

Ao criar, editar ou revisar qualquer arquivo NestJS — services, controllers,
modules, guards, interceptors, pipes ou providers.

## Quando NÃO usar

Para lógica de domínio puro (cálculos, regras de negócio) que não dependem
de decorators NestJS. Use a skill de domínio correspondente.

## Contexto essencial

- NestJS usa injeção de dependência via decorators TypeScript — nunca instanciar
  classes de serviço diretamente com `new`
- Providers devem ser declarados no `@Module` correspondente antes de usar
- Guards retornam `boolean | Promise<boolean> | Observable<boolean>`
- Interceptors usam `Observable` do RxJS — não misturar com Promises sem `from()`
- `@Injectable()` é obrigatório em qualquer provider injetável

## Regras

- Nunca usar `new MinhaClasse()` para instanciar providers — sempre injetar via construtor
- Nunca exportar um provider sem declará-lo no `providers[]` do módulo
- Controllers não contêm lógica de negócio — apenas delegam para services
- Services não importam `Request` ou `Response` do HTTP — isso é responsabilidade do controller
- Validação de input vai em DTOs com `class-validator`, não nos controllers ou services
- Sempre usar `ConfigService` para variáveis de ambiente — nunca `process.env` diretamente
- Exceptions: usar as classes do NestJS (`BadRequestException`, `NotFoundException`, etc.)

## Padrões

**Service padrão:**
```typescript
@Injectable()
export class MinhaService {
  constructor(
    @InjectRepository(MinhaEntity)
    private readonly repo: Repository<MinhaEntity>,
    private readonly config: ConfigService,
  ) {}
}
```

**Controller padrão:**
```typescript
@Controller('rota')
export class MeuController {
  constructor(private readonly service: MinhaService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }
}
```

**Module padrão:**
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([MinhaEntity])],
  controllers: [MeuController],
  providers: [MinhaService],
  exports: [MinhaService],
})
export class MeuModule {}
```

## Customizações do projeto

<!-- HARNESS:CUSTOM:START -->
<!-- HARNESS:CUSTOM:END -->
