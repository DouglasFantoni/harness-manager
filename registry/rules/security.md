# Rules: Segurança

## Meta

```yaml
version: "1.0.0"
category: "security"
sync: true
```

## Dados sensíveis

- Nunca logar dados sensíveis (tokens, senhas, CPF, dados bancários, chaves privadas)
- Nunca serializar dados sensíveis em respostas de erro
- Strings de conexão e secrets sempre via variáveis de ambiente — nunca hardcoded
- Certificados digitais sempre criptografados em repouso — nunca em texto plano

## Autenticação e autorização

- Toda rota protegida tem guard explícito — nunca confiar em "está protegido pelo middleware"
- Tokens JWT verificados em cada request — nunca cachear sem validação
- Refresh tokens armazenados com hash — nunca o token bruto
- Permissões verificadas no nível de serviço, não só no controller

## Inputs

- Todo input externo é tratado como não confiável — validar e sanitizar
- Queries SQL parametrizadas — nunca concatenação de strings
- Upload de arquivos com validação de tipo e tamanho no servidor — nunca só no cliente
- Redirecionamentos nunca construídos a partir de input do usuário sem whitelist

## APIs

- Rate limiting em todos os endpoints públicos
- CORS configurado explicitamente — nunca `origin: '*'` em produção
- Headers de segurança via Helmet ou equivalente
- Respostas de erro não expõem stack trace em produção

## Dependências

- Nunca instalar dependência sem revisar o pacote (autor, downloads, manutenção)
- `npm audit` / `pnpm audit` no CI — vulnerabilidades críticas bloqueiam o build
- Lock files sempre commitados — nunca deletar e regenerar sem revisão

## Customizações do projeto

<!-- HARNESS:CUSTOM:START -->
<!-- HARNESS:CUSTOM:END -->
