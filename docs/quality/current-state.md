# Estado verificável do RunFlow 0.9.8

## Proveniência

- Repositório: `E:\projetos\runflow-app`
- Versão: `0.9.8`
- Branch: `main`
- APIs Android 33–36 e hardware físico estão fora do escopo desta entrega.

## Evidência final desta rodada

- `npm test`: **71 arquivos / 284 testes** aprovados.
- `npm run test:e2e`: **26/26** aprovados.
- Bundle: **2.790.957 bytes total / 417.541 bytes inicial**, dentro do orçamento.
- `npm run build:mobile`: aprovado.
- APK debug: `android/app/build/outputs/apk/debug/app-debug.apk`.
- `git diff --check`: aprovado.

## Correções cobertas

- WebDAV usa HTTPS, não persiste senha, valida respostas antes de sobrescrever o cofre e aplica timeout tanto à resposta quanto à leitura do body.
- Streams WebDAV são cancelados em timeout, overflow e falhas de leitura antes da liberação do reader.
- `SyncPanel` reativa o lifecycle no setup do efeito e mantém persistência, relatório, timestamp e loading corretos sob React StrictMode.
- Merge remoto preserva `updatedAt`; backup exportado sanitiza perfil e idioma; `lastSyncedAt` persiste após sincronização.
- Tiles e egressos opcionais permanecem default-deny; o Android mantém Auto Backup desabilitado.
- A etapa 7 do ROADMAP está implementada: listas longas usam virtualização e os cenários E2E cobrem listas de tamanhos variados. O benchmark formal de INP/P50/P95/P99 permanece pendente; nenhuma métrica foi fabricada.

## Limitações e entrega

- A matriz Android 33–36, hardware físico, medição acústica e CI hospedado permanecem pendentes ou fora do escopo definido.
- Esta página registra evidências técnicas da rodada; o estado de publicação deve ser confirmado no repositório após o gate de entrega.
- A aprovação independente continua obrigatória antes de qualquer commit ou push.

## Política de artefatos

Traces, heaps, vídeos, dumps UiAutomator, APKs e screenshots devem permanecer em diretórios ignorados de build ou em `.hermes/artifacts/`. Somente relatórios e screenshots aprovados podem ser versionados.
