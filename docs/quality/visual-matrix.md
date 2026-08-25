# Matriz visual Android reversível

## Objetivo e limites

A Task 4.7 fornece uma coleta de screenshots do APK usando um **AVD já iniciado pelo operador**. Os scripts desta tarefa:

- nunca executam `emulator -avd`, não criam AVDs e não usam `-no-window`;
- exigem `--visible` no modo real, como confirmação de que a janela do AVD está visível;
- aceitam somente um emulador pronto (`adb devices` com estado `device`), identificam o AVD e recusam um dispositivo físico;
- capturam pixels somente com `adb exec-out screencap -p`;
- salvam PNGs, metadados e o estado de recuperação em um diretório **fora do checkout**;
- aplicam cada caso dentro de um `try/finally` e restauram size, density, `font_scale`, rotação e modo de navegação;
- recusam sobrescrever uma pasta de saída não vazia.

A captura pixel-based não substitui a inspeção do DOM do WebView. Quando uma jornada precisar de seletores/DOM e o UiAutomator não expuser a árvore, a inspeção deve ser feita por CDP em uma etapa própria; estes scripts não habilitam debugging de WebView nem alteram o APK.

## Arquivos e contrato

| Arquivo | Responsabilidade |
|---|---|
| `scripts/android/avd-matrix.json` | Casos determinísticos de size, density, fonte, rotação e navegação. |
| `scripts/android/run-visual-matrix.mjs` | Valida SDK/AVD/device, aplica os casos, opcionalmente relança a Activity e coleta screenshots. |
| `scripts/android/adb-screenshot.mjs` | Executa exatamente `adb -s SERIAL exec-out screencap -p`, valida a assinatura PNG e registra um JSON por captura. |
| `scripts/android/reset-device-state.mjs` | Lê/restaura um `device-state.json`; também é o mecanismo de recuperação manual. |
| `docs/quality/visual-matrix.md` | Procedimento e limites da evidência. |

O componente padrão é `com.runflow.app/.MainActivity`. Pode ser substituído sem editar o repositório com `--package` e `--activity`.

## Pré-requisitos manuais

Configure o SDK no shell Git Bash. O caminho abaixo é o esperado neste host Windows:

```bash
export ANDROID_HOME='C:/Users/gustavo/AppData/Local/Android/Sdk'
export ANDROID_SDK_ROOT="$ANDROID_HOME"
```

Verifique os nomes sem iniciar nada:

```bash
"$ANDROID_HOME/emulator/emulator.exe" -list-avds
"$ANDROID_HOME/platform-tools/adb.exe" devices -l
```

Para uma execução real, o operador deve iniciar previamente um dos AVDs com a janela visível, por exemplo via Android Studio ou pelo comando normal do SDK **sem `-no-window`**. Depois, confirme a janela e o serial (`emulator-5554`, por exemplo). O executor não inicia o processo do emulador e falha se `--visible` não for informado.

O APK precisa estar instalado no AVD antes de usar o lançamento automático. Esta tarefa não gera APK, não instala APK e não inicia build.

## Dry-run seguro (sem ADB e sem arquivos)

O dry-run valida JSON, IDs, dimensões, density, escala de fonte, rotação, modo de navegação e a montagem dos comandos. Não consulta SDK/AVD, não chama ADB, não inicia emulador e não cria screenshots, dumps ou metadados:

```bash
node scripts/android/run-visual-matrix.mjs \
  --dry-run \
  --avd API37_4GB \
  --serial emulator-5554 \
  --visible

node scripts/android/adb-screenshot.mjs \
  --dry-run \
  --serial emulator-5554 \
  --name smoke

node scripts/android/reset-device-state.mjs --dry-run
```

A saída do primeiro comando informa explicitamente `adbInvoked: false` e `emulatorInvoked: false`. O diretório de saída padrão do dry-run é apenas um caminho planejado em `%LOCALAPPDATA%/Temp`; ele não é criado.

Também é possível selecionar um caso sem executar a matriz completa:

```bash
node scripts/android/run-visual-matrix.mjs \
  --dry-run --case phone-compact-portrait-200-gesture
```

## Execução real

Use sempre uma pasta temporária fora do repositório. O script rejeita caminhos dentro de `E:/projetos/runflow-app` e exige que a pasta esteja vazia:

```bash
# O mkdir é opcional; a pasta precisa estar vazia.
mkdir -p '/c/Users/gustavo/AppData/Local/Temp/runflow-visual-api37'

node scripts/android/run-visual-matrix.mjs \
  --avd API37_4GB \
  --serial emulator-5554 \
  --visible \
  --output 'C:/Users/gustavo/AppData/Local/Temp/runflow-visual-api37'
```

O executor faz, nesta ordem:

1. verifica `emulator -list-avds` e `adb devices -l`;
2. confirma `ro.kernel.qemu=1`, API, modelo, release e o nome do AVD (`adb emu avd name` ou `ro.boot.qemu.avd_name`);
3. captura o estado original antes de qualquer mutação;
4. grava `device-state.json` e o estado `running` em `run.json` fora do checkout;
5. para cada caso, aplica `wm size`, `wm density`, `settings put system font_scale`, rotação e `settings put secure navigation_mode`;
6. relança a Activity, salvo `--skip-launch`, aguarda o settle configurado e coleta `<case-id>.png` + `<case-id>.json`;
7. no `finally`, restaura o estado original e verifica todos os valores restaurados.

Para deixar o app já aberto e não relançá-lo a cada caso:

```bash
node scripts/android/run-visual-matrix.mjs \
  --avd Pixel_8 \
  --serial emulator-5554 \
  --visible \
  --skip-launch \
  --case phone-compact-portrait-100-gesture \
  --output 'C:/Users/gustavo/AppData/Local/Temp/runflow-visual-one-case'
```

A matriz padrão cobre compactos, telefone, paisagem, tablet, fonte 100/150/200% e gestos/três botões. Os nomes `API33_4GB`–`API37_8GB` em `avd-matrix.json` são recomendações, não uma alegação de que estejam instalados no host.

## Recuperação manual

Se o processo for encerrado de forma que o `finally` não possa rodar, o diretório de saída ainda contém o estado capturado. Não apague `device-state.json` antes de restaurar:

```bash
node scripts/android/reset-device-state.mjs \
  --serial emulator-5554 \
  --state-file 'C:/Users/gustavo/AppData/Local/Temp/runflow-visual-api37/device-state.json'
```

O reset é fail-closed: tenta todos os comandos de restauração, relê size/density/fonte/rotação/navegação e retorna código diferente de zero se algum comando falhar ou se a leitura final divergir.

## Metadados e privacidade

Uma execução bem-sucedida produz somente fora do repositório:

- `run.json`: AVD, serial, API, modelo, casos, bytes e status de restauração;
- `device-state.json`: estado original necessário para recuperação;
- `<case-id>.png`: screenshot PNG validado;
- `<case-id>.json`: comando de captura, timestamp, caso, estado aplicado e metadados do dispositivo.

Nenhum APK, dump, screenshot, credencial, perfil pessoal ou dado persistente é criado no checkout. A ferramenta não lê banco de dados, GPX/FIT ou arquivos da aplicação.

## Evidência e limitações

A existência de um dry-run verde prova apenas validação estática do contrato e dos comandos. Ela **não** prova:

- que um AVD recomendado está instalado;
- que há um serial `device` conectado;
- que a janela do AVD está visível;
- que o APK está instalado ou que a Activity abre;
- que `navigation_mode` é aceito pela imagem;
- que a captura real ou a restauração real foram executadas.

Esses pontos só podem ser declarados após uma execução real com AVD visível, `run.json`, PNGs e verificação de restauração fora do repositório. Nesta implementação, não se inicia emulador e não se declara a matriz real como executada.
