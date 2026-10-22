# Instala o Claude Monitor no Windows: a extensão no VS Code/Cursor, os hooks no
# Claude Code, a janelinha e os sons e texturas do Minecraft (do servidor da Mojang).
# Quem chama é o instalar-windows.cmd (duplo clique). Rodar de novo não estraga:
# reinstala por cima.
# Testes: -SemAtalho (não cria atalho na Área de Trabalho), -SemAbrir (não abre a janelinha).
param([switch]$SemAtalho, [switch]$SemAbrir)
if ($env:CLAUDE_MONITOR_TESTE) { $SemAtalho = $true; $SemAbrir = $true }  # teste pelo .cmd

function Passo($t) { Write-Host ''; Write-Host "== $t" -ForegroundColor Cyan }
function Ok($t) { Write-Host "   OK  $t" -ForegroundColor Green }
function Aviso($t) { Write-Host "   !!  $t" -ForegroundColor Yellow }
function Falhou($t) { Write-Host ''; Write-Host "   XX  $t" -ForegroundColor Red; exit 1 }

$casa = $env:USERPROFILE
$pasta = Join-Path $casa '.claude-monitor'
# o idioma do botão direito da janelinha (config.json): quem já escolheu inglês reinstala em inglês
$ingles = $false
try { $ingles = (Get-Content -Raw (Join-Path $pasta 'config.json') -ErrorAction Stop | ConvertFrom-Json).idioma -eq 'en' } catch {}
function Tr($pt, $en) {
    if ($ingles) { $en } else { $pt }
}
$vsix = Get-ChildItem (Join-Path $PSScriptRoot 'claude-monitor-*.vsix') -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
if (-not $vsix) { Falhou (Tr "Não achei o claude-monitor-*.vsix na pasta $PSScriptRoot. Extraia o .zip inteiro antes de rodar." "Couldn't find claude-monitor-*.vsix in $PSScriptRoot. Extract the whole .zip before running this.") }
$versao = $vsix.BaseName -replace '^claude-monitor-', ''
Write-Host "Claude Monitor $versao" -ForegroundColor Cyan

Passo (Tr 'Procurando o VS Code / Cursor' 'Looking for VS Code / Cursor')
$editores = @()
foreach ($e in @(
        # o Cursor põe um code.cmd dele no PATH (...\cursor\resources\app\codeBin): esse não é o VS Code
        @{ nome = 'VS Code'; cmd = 'code.cmd'; fora = '\\cursor\\'; fixos = @("$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd", "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd") },
        @{ nome = 'Cursor'; cmd = 'cursor.cmd'; fixos = @("$env:LOCALAPPDATA\Programs\cursor\resources\app\bin\cursor.cmd") })) {
    $exe = Get-Command $e.cmd -All -ErrorAction SilentlyContinue | ForEach-Object { $_.Source } |
        Where-Object { -not $e.fora -or $_ -notmatch $e.fora } | Select-Object -First 1
    if (-not $exe) { $exe = $e.fixos | Where-Object { Test-Path $_ } | Select-Object -First 1 }
    if ($exe) { $editores += @{ nome = $e.nome; exe = $exe }; Ok "$($e.nome): $exe" }
}
if (-not $editores) { Falhou (Tr 'Não achei o VS Code nem o Cursor. Instale o VS Code (https://code.visualstudio.com) e rode de novo.' "Couldn't find VS Code or Cursor. Install VS Code (https://code.visualstudio.com) and run this again.") }

Passo (Tr 'Instalando a extensão' 'Installing the extension')
foreach ($e in $editores) {
    $saida = & $e.exe --install-extension $vsix.FullName --force 2>&1
    if ($LASTEXITCODE -ne 0) { Aviso (Tr "$($e.nome) não aceitou a extensão:" "$($e.nome) didn't accept the extension:"); $saida | ForEach-Object { Write-Host "       $_" } }
    else { Ok $e.nome }
}

Passo (Tr 'Copiando os arquivos pra ~/.claude-monitor' 'Copying the files to ~/.claude-monitor')
# os mesmos que a extensão copia quando o VS Code abre; aqui já saem de dentro do .vsix (é um zip)
New-Item -ItemType Directory -Force $pasta | Out-Null
# instalação nova começa no tema Padrão; quem já usava (tem versao-janelinha) fica no
# Minecraft, que é o da janelinha sem tema no config.json. Antes de copiar: a janelinha
# aberta se reabre ao ver o arquivo novo e lê o config.json na hora
if (-not (Test-Path (Join-Path $pasta 'versao-janelinha')) -and -not (Test-Path (Join-Path $pasta 'config.json'))) {
    [IO.File]::WriteAllText((Join-Path $pasta 'config.json'), '{"tema":"padrao"}')
}
$temp = Join-Path ([IO.Path]::GetTempPath()) "claude-monitor-$PID"
New-Item -ItemType Directory -Force $temp | Out-Null
# no diário da janelinha
function Anotar($t) { [IO.File]::AppendAllText((Join-Path $pasta 'janelinha.log'), "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff') [instalador $PID] $t`r`n") }
# a janelinha aberta prende o último som que tocou (o MediaPlayer do WPF segura o .wav) e a
# cópia por cima dele falhava: o resto ficava de fora calado (09/10, a 0.8.0 sem o Star Wars).
# Fecha antes de copiar; no fim o instalador abre de novo
$overlayDaPasta = Join-Path $pasta 'overlay.ps1'
foreach ($processo in @(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction Ignore)) {
    if ($processo.CommandLine -and $processo.CommandLine.IndexOf($overlayDaPasta, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Stop-Process -Id $processo.ProcessId -Force -ErrorAction Ignore
        Wait-Process -Id $processo.ProcessId -Timeout 5 -ErrorAction Ignore
        Anotar "fechei a janelinha [$($processo.ProcessId)] pra copiar"
    }
}
# arquivo preso (a janelinha que acabou de fechar, um antivírus olhando) ganha uns segundos
function Extrair($entrada, $destino) {
    for ($vez = 1; ; $vez++) {
        try { [IO.Compression.ZipFileExtensions]::ExtractToFile($entrada, $destino, $true); return }
        catch { if ($vez -ge 10) { throw }; Start-Sleep -Milliseconds 300 }
    }
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($vsix.FullName)
try {
    # pastas inteiras (o motor das animações e os sons dos temas) ANTES do overlay.ps1: a
    # janelinha aberta se reabre ao ver o overlay novo e já acha o motor novo
    foreach ($pastaDoVsix in 'motor', 'sons-padrao', 'sons-dragonball', 'sons-sith', 'sons-akatsuki', 'sons-elden') {
        $entradas = @($zip.Entries | Where-Object { $_.FullName -like "extension/janelinha/$pastaDoVsix/*" -and $_.Name })
        if (-not $entradas) { Falhou (Tr "O .vsix está incompleto (falta janelinha/$pastaDoVsix/). Baixe de novo." "The .vsix is incomplete (janelinha/$pastaDoVsix/ is missing). Download it again.") }
        New-Item -ItemType Directory -Force "$pasta\$pastaDoVsix" | Out-Null
        foreach ($entrada in $entradas) { Extrair $entrada (Join-Path "$pasta\$pastaDoVsix" $entrada.Name) }
    }
    $copias = @{
        'out/hook.js' = $pasta; 'out/processes.js' = $pasta; 'out/sem-node.sh' = $pasta; 'out/install.js' = $temp
        'janelinha/overlay.ps1' = $pasta; 'janelinha/minecraft.js' = $pasta; 'janelinha/vorbis.min.js' = $pasta
    }
    foreach ($nome in $copias.Keys) {
        $entrada = $zip.GetEntry("extension/$nome")
        if (-not $entrada) { Falhou (Tr "O .vsix está incompleto (falta $nome). Baixe de novo." "The .vsix is incomplete ($nome is missing). Download it again.") }
        Extrair $entrada (Join-Path $copias[$nome] (Split-Path $nome -Leaf))
    }
} catch {
    # erro de .NET aqui dentro só parava este bloco: o instalador seguia e dizia "Pronto!"
    $motivo = if ($_.Exception.InnerException) { $_.Exception.InnerException.Message } else { $_.Exception.Message }
    Falhou (Tr "Não consegui trocar um arquivo em $pasta`n       $motivo`n       Feche a janelinha (botão direito > Fechar) e o que estiver usando esse arquivo, e rode o instalador de novo." "Couldn't replace a file in $pasta`n       $motivo`n       Close the floating window (right-click > Close) and whatever is using that file, then run the installer again.")
} finally { $zip.Dispose() }
# a extensão só recopia quando a versão muda: só marca com tudo copiado
[IO.File]::WriteAllText((Join-Path $pasta 'versao-janelinha'), $versao)
# no diário da janelinha (ela se reabre ao ver o arquivo mudar)
Anotar "copiou a janelinha $versao"
Ok $pasta

Passo (Tr 'Ligando o Claude Code na extensão (hooks)' 'Connecting Claude Code to the extension (hooks)')
$node = (Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $node -and (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
    Aviso (Tr 'Falta o Node.js: o Claude Code usa ele pra avisar quais sessões estão rodando.' 'Node.js is missing: Claude Code uses it to report which sessions are running.')
    $r = Read-Host (Tr '       Instalar agora? (S/n)' '       Install it now? (Y/n)')
    if ($r -notmatch '^[nN]') {
        winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        $node = @("$env:ProgramFiles\nodejs\node.exe", "$env:LOCALAPPDATA\Programs\nodejs\node.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
    }
}
if ($node) {
    $saida = & $node -e "require(process.argv[1]).installHooks()" (Join-Path $temp 'install.js') 2>&1
    if ($LASTEXITCODE -eq 0) { Ok (Tr 'hooks no ~/.claude/settings.json (cópia do anterior em settings.json.bak-claude-monitor)' 'hooks in ~/.claude/settings.json (the previous one is copied to settings.json.bak-claude-monitor)') }
    else { Aviso (Tr "Não consegui mexer no ~/.claude/settings.json: $saida" "Couldn't change ~/.claude/settings.json: $saida"); Aviso (Tr 'Depois, no VS Code: Ctrl+Shift+P > "Claude Monitor: Instalar hooks no Claude Code".' 'Later, in VS Code: Ctrl+Shift+P > "Claude Monitor: Instalar hooks no Claude Code".') }
} else {
    Aviso (Tr 'Sem Node.js as sessões não aparecem. Instale a versão LTS em https://nodejs.org e rode este instalador de novo.' "Without Node.js the sessions don't show up. Install the LTS version from https://nodejs.org and run this installer again.")
}
Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue

Passo (Tr 'Sons do Minecraft (do servidor da Mojang: não precisa ter o jogo)' "Minecraft sounds (from Mojang's server: you don't need the game)")
if ($node) { & $node (Join-Path $pasta 'minecraft.js') }
else { Aviso (Tr 'Sem Node.js a janelinha fica com os sons do Windows.' 'Without Node.js the floating window keeps the Windows sounds.') }

if (-not $SemAtalho) {
    Passo (Tr 'Atalho "Claude Monitor" na Área de Trabalho (reabre a janelinha)' '"Claude Monitor" shortcut on the Desktop (reopens the floating window)')
    $atalho = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Claude Monitor.lnk'))
    $atalho.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
    $atalho.Arguments = "-WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File `"$pasta\overlay.ps1`""
    $atalho.WindowStyle = 7  # minimizado
    $atalho.Save()
    Ok (Tr 'feito' 'done')
}

if (-not $SemAbrir) {
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$pasta\overlay.ps1`""
}

Write-Host ''
if ($ingles) {
    Write-Host 'Done! The floating window shows up in the bottom-right corner.' -ForegroundColor Green
    Write-Host 'Close and reopen VS Code. Claude sessions that were already open'
    Write-Host 'need to be reopened to show up (new ones show up on their own).'
} else {
    Write-Host 'Pronto! A janelinha aparece no canto de baixo à direita.' -ForegroundColor Green
    Write-Host 'Feche e abra o VS Code de novo. Sessões do Claude que já estavam abertas'
    Write-Host 'precisam ser reabertas pra aparecer (as novas aparecem sozinhas).'
    Write-Host 'Language: right-click the floating window > "Idioma" > English.'
}
