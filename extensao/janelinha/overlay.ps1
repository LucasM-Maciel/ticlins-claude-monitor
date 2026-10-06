# Claude Monitor fora do VS Code: janelinha sempre por cima com as sessões do
# Claude Code (arquivos do hook em ~/.claude-monitor/sessions) e o usage
# (mesmo endpoint do /usage, com o login do Claude Code; não renova o token).
# Toca som quando uma sessão passa a esperar você. O Clawd anda pela borda enquanto
# algo roda, pula parado em cima quando há pergunta/permissão e fica parado em cima
# quando nada roda.
# Dois temas: Padrão (sons de sino, Clawd sem ferramenta) e Minecraft (picareta de
# diamante e lutas, sons do jogo, orbe de XP nas bolinhas, borda de terra com grama,
# barra de XP no usage e a letra do jogo). Sons e texturas do Minecraft vêm do
# servidor da Mojang (minecraft.js); sem eles, sons do Windows e os desenhos daqui.
# Clique numa sessão: abre ela no VS Code. Arrastar: botão esquerdo. Duplo clique:
# traz o VS Code. Botão direito: Temas, Clawd (liga/desliga), Opacidade, Volume e Fechar.
# Passar o mouse numa sessão: o estado dela.
# Saiu versão nova (a extensão consulta o GitHub): linha roxa embaixo; o clique baixa o zip.
# A extensão abre isto a cada janela do VS Code; o mutex deixa uma só. Quando a
# extensão atualiza este arquivo, a janelinha se reabre sozinha com a versão nova.
# Teste: -Foto arquivo.png desenha, salva e sai (sem internet: o usage vem de -ArquivoUso
# arquivo.json, se passar); -Pasta troca a ~/.claude-monitor por outra; -Clicar id
# clica na linha dessa sessão (o .txt diz o link que abriria); -Cena "pedra 2.1"
# fotografa esse instante da cena (pedra ou bug), em segundos; -Pulso 0.5 fotografa a
# bolinha verde nesse ponto do pulso (0 = acesa, 0.5 = o mais apagada); -SemMotor desenha
# o Clawd daqui (o de antes do motor), como quando falta o node.
param([string]$Foto, [string]$Pasta, [string]$ArquivoUso, [string]$Clicar, [string]$Cena, [string]$Pulso, [switch]$SemMotor)
Add-Type -AssemblyName PresentationFramework
if (-not $Pasta) { $Pasta = Join-Path $HOME '.claude-monitor' }
# quem me abre de dentro do VS Code me passa ELECTRON_RUN_AS_NODE=1; com ele, o Code.exe
# que o vscode:// do clique chama roda como Node e morre calado (visto 29/09)
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction Ignore

# diário em janelinha.log: quem abriu, quem desistiu, quando se reabriu, erros.
# Às vezes ela some ao atualizar e não se sabe por quê. O -Foto não anota.
$diario = Join-Path $Pasta 'janelinha.log'
function Anotar($t) {
    if ($Foto) { return }
    try {
        if ((Test-Path -LiteralPath $diario) -and (Get-Item -LiteralPath $diario).Length -gt 256KB) { Move-Item -LiteralPath $diario "$diario.1" -Force }
        [IO.File]::AppendAllText($diario, "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff') [$PID] $($t -replace '\s*[\r\n]+\s*', ' ')`r`n", [Text.UTF8Encoding]::new($false))
    } catch {}
}
function Hora($utc) { if ($utc) { $utc.ToLocalTime().ToString('yyyy-MM-dd HH:mm:ss.fff') } else { 'sumiu' } }
# quem me abriu: extensão (cmd, que já saiu), instalador, atalho (explorer) ou a janelinha velha
function Pai {
    try {
        $id = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID" -ErrorAction Stop).ParentProcessId
        $p = Get-Process -Id $id -ErrorAction Ignore  # Ignore: o pai que já saiu não conta nos erros do "fechou"
        "pai $id $(if ($p) { $p.ProcessName } else { '(já saiu)' })"
    } catch { 'pai ?' }
}

if (-not $Foto) {
    $primeira = $false
    $mutex = [Threading.Mutex]::new($true, 'ClaudeMonitorOverlay', [ref]$primeira)
    # solta o handle antes de anotar: enquanto ele existir, a que está se reabrindo acha que já tem uma
    if (-not $primeira) { $mutex.Dispose(); Anotar "saiu: já tem uma aberta ($(Pai))"; exit }
}
$versao = (Get-Item -LiteralPath $PSCommandPath).LastWriteTimeUtc
Anotar "abriu: arquivo de $(Hora $versao) ($(Pai))"
$dir = Join-Path $Pasta 'sessions'
$cred = Join-Path $HOME '.claude\.credentials.json'
# situação da sessão (ver Situacao) -> cor da bolinha e texto do tooltip
$estados = @{
    working    = @('#22C55E', 'trabalhando')
    finished   = @('#EF4444', 'terminou')
    question   = @('#60A5FA', 'pergunta pra você')
    permission = @('#FACC15', 'pedindo permissão')
}
# Som de cada aviso por tema; com mais de um, sorteia. Sem o arquivo, o do Windows.
# Outros na pasta sons\: pop, aldeao_sim, pling, sino, bigorna, gato. Os do Padrão
# (sons-padrao\) são feitos pelo sons-padrao.py. Com a janelinha aberta a extensão não toca som.
function SonsOuWindows($arquivos, $doWindows) {
    $achados = @($arquivos | Where-Object { Test-Path -LiteralPath $_ })
    if ($achados) { $achados } else { @("$env:WINDIR\Media\$doWindows") }
}
$sonsDoTema = @{
    minecraft = @{
        esperando = SonsOuWindows (1..2 | ForEach-Object { "$Pasta\sons\aldeao_hmm$_.wav" }) 'Windows Notify Messaging.wav'  # "hmm" do aldeão
        terminou  = SonsOuWindows (1..3 | ForEach-Object { "$Pasta\sons\xp$_.wav" }) 'Windows Notify System Generic.wav'  # pegar XP
        tudo      = SonsOuWindows "$Pasta\sons\levelup.wav" 'tada.wav'  # subir de nível
    }
    padrao = @{
        esperando = SonsOuWindows "$Pasta\sons-padrao\esperando.wav" 'Windows Notify Messaging.wav'
        terminou  = SonsOuWindows "$Pasta\sons-padrao\terminou.wav" 'Windows Notify System Generic.wav'
        tudo      = SonsOuWindows "$Pasta\sons-padrao\tudo.wav" 'tada.wav'
    }
    dragonball = @{  # tilins de vidro e cristal; o trovão do dragão quando acaba tudo (sons-dragonball\LICENCAS.txt)
        esperando = SonsOuWindows "$Pasta\sons-dragonball\esperando.wav" 'Windows Notify Messaging.wav'
        terminou  = SonsOuWindows "$Pasta\sons-dragonball\terminou.wav" 'Windows Notify System Generic.wav'
        tudo      = SonsOuWindows "$Pasta\sons-dragonball\tudo.wav" 'tada.wav'
    }
}
# tudo = a última terminou e não sobrou nada rodando nem esperando
$avisoDaSituacao = @{ permission = 'esperando'; question = 'esperando'; finished = 'terminou'; tudo = 'tudo' }
$nomeDoSom = @{  # pro diário e pro .txt do -Foto
    minecraft = @{ esperando = 'aldeao'; terminou = 'xp'; tudo = 'levelup' }
    padrao    = @{ esperando = 'sino-esperando'; terminou = 'sino-terminou'; tudo = 'sino-tudo' }
    dragonball = @{ esperando = 'esferas-esperando'; terminou = 'esferas-terminou'; tudo = 'esferas-tudo' }
}
# botão direito: tema, Clawd, opacidade e volume, gravados em config.json (o Mac lê o mesmo).
# Sem o arquivo, tudo como antes do menu existir: Minecraft, Clawd ligado, opaca, volume
# cheio. Instalação nova já nasce com o Padrão (o instalador grava o tema).
$temas = [ordered]@{ padrao = 'Padrão'; minecraft = 'Minecraft'; dragonball = 'Dragon Ball' }
$configArquivo = Join-Path $Pasta 'config.json'
$config = @{ opacidade = 1.0; clawd = $true; volume = 1.0; tema = 'minecraft' }
# Exists antes: arquivo que não existe soma no $Error mesmo pego no try (o "fechou (1 erros)" do diário)
if ([IO.File]::Exists($configArquivo)) {
    try {
        $configLido = [IO.File]::ReadAllText($configArquivo) | ConvertFrom-Json
        # 1.0, não 1: o [math]::Min(1, x) escolhe a versão inteira e 0,5 vira 0
        if ($null -ne $configLido.opacidade) { $config.opacidade = [math]::Min(1.0, [math]::Max(0.2, [double]$configLido.opacidade)) }
        if ($null -ne $configLido.clawd) { $config.clawd = [bool]$configLido.clawd }
        if ($null -ne $configLido.volume) { $config.volume = [math]::Min(1.0, [math]::Max(0.0, [double]$configLido.volume)) }
        if ($temas.Contains("$($configLido.tema)")) { $config.tema = "$($configLido.tema)" }
    } catch { Anotar "config.json com defeito, fiquei com o padrão: $_" }
}
function SalvarConfig {
    try { [IO.File]::WriteAllText($configArquivo, ($config | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false)) } catch {}
}
# MediaPlayer (o do WPF) tem volume; o SoundPlayer não. O Open não dá erro: a falha chega
# depois, no MediaFailed. Sem o Windows Media Player (Windows "N" sem o pacote de mídia)
# ele não toca nada: aí vai pelo SoundPlayer, sem volume.
$tocador = New-Object Windows.Media.MediaPlayer
$tocador.Volume = $config.volume
$tocador.Add_MediaOpened({ $tocador.Play() })
$tocadorSemVolume = New-Object Media.SoundPlayer
$tocador.Add_MediaFailed({
    $motivoDaFalha = $_.ErrorException.Message
    $somQueFalhou = $tocador.Source.LocalPath
    try { $tocadorSemVolume.SoundLocation = $somQueFalhou; $tocadorSemVolume.Play(); Anotar "toquei $(Split-Path $somQueFalhou -Leaf) sem volume (o player com volume falhou: $motivoDaFalha)" }
    catch { Anotar "não toquei $($somQueFalhou): $motivoDaFalha / $($_.Exception.Message)" }
})
# o som das cenas épicas: o motor manda pronto (mensagem S, um .wav ou parar). Outro tocador,
# pra não cortar nem ser cortado pelos avisos; acabou, solta o arquivo (o motor regrava depois).
$tocadorDaCena = New-Object Windows.Media.MediaPlayer
$tocadorDaCena.Add_MediaOpened({ $tocadorDaCena.Volume = $config.volume; $tocadorDaCena.Play() })
$tocadorDaCena.Add_MediaEnded({ $tocadorDaCena.Close() })
$tocadorDaCenaSemVolume = New-Object Media.SoundPlayer
$tocadorDaCena.Add_MediaFailed({
    $motivoDaFalhaDaCena = $_.ErrorException.Message
    try { $tocadorDaCenaSemVolume.SoundLocation = $tocadorDaCena.Source.LocalPath; $tocadorDaCenaSemVolume.Play(); Anotar "toquei o som da cena sem volume (o player com volume falhou: $motivoDaFalhaDaCena)" }
    catch { Anotar "não toquei o som da cena: $motivoDaFalhaDaCena / $($_.Exception.Message)" }
})
$somDaCena = $null  # o último som de cena que o motor mandou (o -Foto grava no .txt em vez de tocar)
function SomDaCena($jsonDoSom) {
    try { $pedidoDeSom = $jsonDoSom | ConvertFrom-Json -ErrorAction Stop } catch { Anotar "motor: mensagem S com defeito: $jsonDoSom"; return }
    if ($pedidoDeSom.parar) {
        $tocadorDaCena.Stop(); $tocadorDaCena.Close(); $tocadorDaCenaSemVolume.Stop()
        if ($Foto) { $script:somDaCena = 'parou' }
        return
    }
    $script:somDaCena = $pedidoDeSom.cena
    if ($Foto) { return }
    if ($config.volume -le 0) { Anotar "não toquei o som de $($pedidoDeSom.cena): volume no 0 (botão direito > Volume)"; return }
    try { $tocadorDaCena.Open([Uri]::new($pedidoDeSom.tocar)); Anotar "tocou o som de $($pedidoDeSom.cena)" }
    catch { Anotar "não toquei o som de $($pedidoDeSom.cena): $($_.Exception.Message)" }
}
$ultimo = @{}  # id da sessão -> última situação vista
# teste: o -Foto parte da situação anterior em antes.json, pra ver qual som tocaria
if ($Foto -and (Test-Path -LiteralPath "$Pasta\antes.json")) {
    (Get-Content -LiteralPath "$Pasta\antes.json" -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $ultimo[$_.Name] = $_.Value }
}
$somDaVez = $null  # o último som decidido (o -Foto grava no .txt em vez de tocar)
$cliqueDaVez = $null  # o link do último clique numa sessão (o -Foto grava no .txt em vez de abrir)
$uso = @{ proxima = [DateTime]::MinValue; dados = $null; pedido = $null; http = $null; url = 'https://api.anthropic.com/api/oauth/usage' }  # usage é buscado a cada 2 min (BuscarUso)
# o último usage que veio fica em ultimo-uso.json: reabrir com 429 ou token vencido mostra ele, não "indisponível"
$usoGuardado = Join-Path $Pasta 'ultimo-uso.json'
if (-not $Foto -and [IO.File]::Exists($usoGuardado)) { try { $uso.dados = [IO.File]::ReadAllText($usoGuardado) | ConvertFrom-Json } catch {} }
if ($Foto) { $uso = @{ proxima = [DateTime]::MaxValue; dados = $(if ($ArquivoUso) { Get-Content $ArquivoUso -Raw | ConvertFrom-Json }) } }
$margem = 34  # espaço em volta do cartão, por onde o Clawd anda e pula com a picareta

# Janela de tamanho fixo que nunca se move sozinha: o cartão fica preso no canto
# de baixo à direita e cresce pra cima por dentro dela. (Mover janela transparente
# depois de aberta faz o WPF às vezes desenhá-la na posição antiga.) O resto é
# transparente e o clique passa pro que está atrás.
[xml]$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" ResizeMode="NoResize"
        Width="380" Height="440" FontFamily="Segoe UI" FontSize="12">
  <Grid>
    <Grid Name="Moldura" HorizontalAlignment="Right" VerticalAlignment="Bottom">
      <Border Name="Cartao" Background="#E6181818" CornerRadius="8" Padding="10,6">
        <StackPanel>
          <StackPanel Name="Sessoes"/>
          <Border Height="1" Background="#33FFFFFF" Margin="0,5,0,4"/>
          <StackPanel Name="Uso"/>
          <StackPanel Name="Aviso"/>
        </StackPanel>
      </Border>
      <!-- tema Minecraft: grama em cima da borda de terra e uma sombrinha embaixo dela -->
      <Rectangle Name="Grama" Height="8" VerticalAlignment="Top" IsHitTestVisible="False" Visibility="Collapsed"/>
      <Rectangle Name="Sombra" Height="1" Margin="6,8,6,0" VerticalAlignment="Top" Fill="#59000000" IsHitTestVisible="False" Visibility="Collapsed"/>
    </Grid>
    <Canvas Name="Mascote" IsHitTestVisible="False" HorizontalAlignment="Left" VerticalAlignment="Top">
      <Canvas.RenderTransform><MatrixTransform/></Canvas.RenderTransform>
    </Canvas>
    <!-- o que o motor (motor\motor.js) desenha: Clawd, cenas e enfeites do tema -->
    <Image Name="Palco" IsHitTestVisible="False" Stretch="Fill" HorizontalAlignment="Left" VerticalAlignment="Top"
           RenderOptions.BitmapScalingMode="NearestNeighbor"/>
  </Grid>
</Window>
'@
$win = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader $xaml))
$cartao = $win.FindName('Cartao')
$painelSessoes = $win.FindName('Sessoes')
$painelUso = $win.FindName('Uso')
$painelAviso = $win.FindName('Aviso')
$mascote = $win.FindName('Mascote')
$moldura = $win.FindName('Moldura')
$grama = $win.FindName('Grama')
$sombra = $win.FindName('Sombra')
$moldura.Margin = [Windows.Thickness]::new($margem)
$moldura.Opacity = $config.opacidade
if (-not $config.clawd) { $mascote.Visibility = 'Hidden' }

function Cor($hex) { [Windows.Media.BrushConverter]::new().ConvertFromString($hex) }

# trabalhando: a bolinha verde pulsa, pra quem não distingue verde de vermelho (e pra
# não ler "verde = pronto"). Um pincel só, animado: a lista se refaz a cada 2 s e o
# pulso continua. Opacidade 0,65 + 0,35·cos(2π·fase), volta inteira em 1,6 s.
$bolaVerde = New-Object Windows.Media.SolidColorBrush ([Windows.Media.ColorConverter]::ConvertFromString($estados.working[0]))
if ($Foto) {
    $fase = $(if ($Pulso) { [double]::Parse($Pulso, [Globalization.CultureInfo]::InvariantCulture) } else { 0 })
    $bolaVerde.Opacity = 0.65 + 0.35 * [math]::Cos(2 * [math]::PI * $fase)
} else {
    $pulsando = [Windows.Media.Animation.DoubleAnimation]::new(1, 0.3, [Windows.Duration]::new([TimeSpan]::FromMilliseconds(800)))
    $pulsando.AutoReverse = $true
    $pulsando.RepeatBehavior = [Windows.Media.Animation.RepeatBehavior]::Forever
    $pulsando.EasingFunction = New-Object Windows.Media.Animation.SineEase -Property @{ EasingMode = 'EaseInOut' }
    [Windows.Media.Animation.Timeline]::SetDesiredFrameRate($pulsando, 20)
    $bolaVerde.BeginAnimation([Windows.Media.Brush]::OpacityProperty, $pulsando)
}

function Texto($texto, $cor, $largura) {
    $t = New-Object Windows.Controls.TextBlock
    $t.Text = $texto
    $t.Foreground = Cor $cor
    $t.VerticalAlignment = 'Center'
    if ($largura) { $t.Width = $largura }
    $t
}

function Linha {
    $l = New-Object Windows.Controls.StackPanel
    $l.Orientation = 'Horizontal'
    $l.Margin = [Windows.Thickness]::new(0, 2, 0, 2)
    foreach ($e in $args) { [void]$l.Children.Add($e) }
    $l
}

# --- Tema Minecraft: texturas do jogo (minecraft.js) na borda, nas bolinhas, na barra
# do usage e nos números. Faltando alguma (sem internet na instalação), aquela parte
# fica com o desenho do Padrão.
function PNG($nome) {
    $arquivo = "$Pasta\$nome.png"
    if (-not [IO.File]::Exists($arquivo)) { return $null }
    try {
        $imagemPng = New-Object Windows.Media.Imaging.BitmapImage
        $imagemPng.BeginInit(); $imagemPng.UriSource = [Uri]$arquivo; $imagemPng.CacheOption = 'OnLoad'; $imagemPng.EndInit()
        [Windows.Media.Imaging.FormatConvertedBitmap]::new($imagemPng, [Windows.Media.PixelFormats]::Bgra32, $null, 0)
    } catch { Anotar "textura $nome.png com defeito: $_"; $null }
}
# os pixels (BGRA) de um pedaço da textura, e de volta pra imagem
function PedacoDe($bitmap, $x, $y, $largura, $altura) {
    $bytes = New-Object byte[] ($largura * $altura * 4)
    $bitmap.CopyPixels([Windows.Int32Rect]::new($x, $y, $largura, $altura), $bytes, $largura * 4, 0)
    return , $bytes  # a vírgula: senão o PowerShell desmonta o byte[] num object[]
}
function Bitmap($bytes, $largura, $altura) {
    [Windows.Media.Imaging.BitmapSource]::Create($largura, $altura, 96, 96, [Windows.Media.PixelFormats]::Bgra32, $null, $bytes, $largura * 4)
}
function Rgb($hex) { $c = [Windows.Media.ColorConverter]::ConvertFromString($hex); ($c.R / 255), ($c.G / 255), ($c.B / 255) }

# bolinhas = o menor quadro do orbe de XP (8x8 no canto 4,4 da textura), que é cinza:
# o jogo pinta por cima, e aqui também. Trabalhando: vermelho e azul oscilam com o verde
# no máximo, como no jogo (fica entre verde e amarelo); um pincel só, que um relógio
# troca de quadro, pra lista se refazer a cada 2 s sem reiniciar.
$orbe = PNG 'orbe'
$orbes = $null
function OrbePintado($r, $g, $b) {
    $px = $orbeCinza.Clone()
    for ($k = 0; $k -lt $px.Length; $k += 4) { $px[$k] = $px[$k] * $b; $px[$k + 1] = $px[$k + 1] * $g; $px[$k + 2] = $px[$k + 2] * $r }
    Bitmap $px 8 8
}
function PincelPixelado($imagemDoPincel) {
    $pincel = [Windows.Media.ImageBrush]::new($imagemDoPincel)
    [Windows.Media.RenderOptions]::SetBitmapScalingMode($pincel, 'NearestNeighbor')
    $pincel
}
if ($orbe -and $orbe.PixelWidth -ge 12 -and $orbe.PixelHeight -ge 12) {
    $orbeCinza = PedacoDe $orbe 4 4 8 8
    $orbes = @{ outro = PincelPixelado (OrbePintado 0.61 0.64 0.69) }
    foreach ($situacaoDoOrbe in $estados.Keys) {
        $r, $g, $b = Rgb $estados[$situacaoDoOrbe][0]
        $orbes[$situacaoDoOrbe] = PincelPixelado (OrbePintado $r $g $b)
    }
    # f = ms/100 no jogo: uma volta a cada 0,63 s, em 32 quadros
    $quadrosOrbe = foreach ($q in 0..31) {
        $f = 2 * [math]::PI * $q / 32
        OrbePintado (([math]::Sin($f) + 1) / 2) 1 (([math]::Sin($f + 4.18879) + 1) * 0.1)
    }
    $orbeVerde = PincelPixelado $quadrosOrbe[0]
    if ($Foto) { $orbeVerde.ImageSource = $quadrosOrbe[[int][math]::Floor($fase * 32) % 32] }
}
$relogioOrbe = [Diagnostics.Stopwatch]::StartNew()
$tiqueOrbe = New-Object Windows.Threading.DispatcherTimer
$tiqueOrbe.Interval = [TimeSpan]::FromMilliseconds(50)
$tiqueOrbe.Add_Tick({ $orbeVerde.ImageSource = $quadrosOrbe[[int][math]::Floor($relogioOrbe.Elapsed.TotalSeconds * 10 / (2 * [math]::PI) * 32) % 32] })

# borda de terra com grama em cima: a textura repetida em blocos de 32 (2 px por pixel)
function Ladrilho($nome, $semTextura) {
    $textura = PNG $nome
    if (-not $textura) { return Cor $semTextura }
    $pincel = PincelPixelado $textura
    $pincel.TileMode = 'Tile'
    $pincel.ViewportUnits = 'Absolute'
    $pincel.Viewport = [Windows.Rect]::new(0, 0, 32, 32)
    $pincel
}
$terra = Ladrilho 'terra' '#866043'
$grama.Fill = Ladrilho 'grama' '#5D9C36'

# barra do usage = a barra de XP (182 de largura no jogo, 118 aqui): 117 colunas + a
# ponta, que esticar entorta os gomos. Dourada e vermelha: a verde com outra cor, mesmo brilho
$barraXP = $null
$xpFundo = PNG 'xp_fundo'
$xpBarra = PNG 'xp_barra'
function Cortada($bitmap, $x, $largura) { [Windows.Media.Imaging.CroppedBitmap]::new($bitmap, [Windows.Int32Rect]::new($x, 0, $largura, 5)) }
if ($xpFundo -and $xpBarra -and $xpFundo.PixelWidth -eq 182 -and $xpBarra.PixelWidth -eq 182) {
    $barraXP = @{ fundo = Cortada $xpFundo 0 117; fundoPonta = Cortada $xpFundo 181 1 }
    $xpVerde = PedacoDe $xpBarra 0 0 182 5
    foreach ($tinta in @(@('verde', $null), @('ouro', '#FFAA00'), @('vermelho', '#FF5555'))) {
        $px = $xpVerde.Clone()
        if ($tinta[1]) {
            $r, $g, $b = Rgb $tinta[1]
            for ($k = 0; $k -lt $px.Length; $k += 4) {
                $brilho = [math]::Max($px[$k], [math]::Max($px[$k + 1], $px[$k + 2])) / 0xF5 * 1.05
                $px[$k] = [math]::Min(255, $b * $brilho * 255); $px[$k + 1] = [math]::Min(255, $g * $brilho * 255); $px[$k + 2] = [math]::Min(255, $r * $brilho * 255)
            }
        }
        $barraXP[$tinta[0]] = Bitmap $px 182 5
    }
}
$coresDoUso = @{ padrao = '#D1D5DB', '#F59E0B', '#EF4444'; minecraft = '#80FF20', '#FFAA00', '#FF5555'; dragonball = '#FDE047', '#F59E0B', '#EF4444' }  # normal, >= 80%, >= 95%

# letra do Minecraft (font/ascii.png: 16x16 letras de 8x8), com a sombra do jogo (cor/4,
# 1 px pra direita e pra baixo). Cada letra vai até a última coluna pintada, como no jogo.
$letraMC = PNG 'fonte'
$larguraDaLetra = $null
if ($letraMC -and $letraMC.PixelWidth -eq 128 -and $letraMC.PixelHeight -eq 128) {
    $letraPixels = PedacoDe $letraMC 0 0 128 128
    $larguraDaLetra = @{ 32 = 3 }
    for ($k = 33; $k -lt 256; $k++) {
        $cx = ($k % 16) * 8; $cy = [math]::Floor($k / 16) * 8; $w = 0
        for ($x = 7; $x -ge 0 -and -not $w; $x--) { for ($y = 0; $y -lt 8; $y++) { if ($letraPixels[(($cy + $y) * 128 + $cx + $x) * 4 + 3]) { $w = $x + 1; break } } }
        $larguraDaLetra[$k] = $w
    }
}
$letreiros = @{}  # "cor texto" -> imagem pronta (tempo e usage mudam pouco)
function TextoMC($texto, $hex) {
    $chave = "$hex $texto"
    if ($letreiros.Contains($chave)) { return $letreiros[$chave] }
    if ($letreiros.Count -gt 300) { $letreiros.Clear() }
    $r, $g, $b = Rgb $hex
    $codigos = @($texto.ToCharArray() | ForEach-Object { [int]$_ } | Where-Object { $_ -lt 256 })
    $larguraTotal = 1
    foreach ($k in $codigos) { $larguraTotal += $larguraDaLetra[$k] + 1 }
    $px = New-Object byte[] ($larguraTotal * 9 * 4)
    foreach ($camada in @(@(1, 0.25), @(0, 1))) {  # a sombra, e a letra por cima
        $d, $brilho = $camada
        $x0 = $d
        foreach ($k in $codigos) {
            $cx = ($k % 16) * 8; $cy = [math]::Floor($k / 16) * 8
            for ($y = 0; $y -lt 8; $y++) {
                for ($x = 0; $x -lt $larguraDaLetra[$k]; $x++) {
                    if (-not $letraPixels[(($cy + $y) * 128 + $cx + $x) * 4 + 3]) { continue }
                    $o = (($y + $d) * $larguraTotal + $x0 + $x) * 4
                    $px[$o] = $b * $brilho * 255; $px[$o + 1] = $g * $brilho * 255; $px[$o + 2] = $r * $brilho * 255; $px[$o + 3] = 255
                }
            }
            $x0 += $larguraDaLetra[$k] + 1
        }
    }
    $letreiros[$chave] = Bitmap $px $larguraTotal 9
    $letreiros[$chave]
}
# números e rótulos curtos: no Minecraft com a letra do jogo; no Padrão (ou sem a
# textura), Segoe como o resto. $alinhar: 'Right' encosta na direita da $largura.
# A letra do jogo vai ~22% maior (9 -> 11 px; em 1x ficava difícil de ler; 2x ficou
# grande demais), suavizada: em tamanho quebrado o pixel duro sai torto. $larguraMC:
# a coluna tem que caber "agora" e "15h47" (38 px)
function Rotulo($texto, $hex, $largura, $alinhar, $larguraMC) {
    if ($config.tema -ne 'minecraft' -or -not $larguraDaLetra) {
        $t = Texto $texto $hex $largura
        if ($alinhar) { $t.TextAlignment = $alinhar }
        return $t
    }
    $largura = $larguraMC
    $letreiro = New-Object Windows.Controls.Image
    $letreiro.Source = TextoMC $texto $hex
    $letreiro.Width = [math]::Round($letreiro.Source.PixelWidth * 11 / 9); $letreiro.Height = 11
    $letreiro.HorizontalAlignment = $(if ($alinhar -eq 'Right') { 'Right' } else { 'Left' })
    $letreiro.UseLayoutRounding = $true
    [Windows.Media.RenderOptions]::SetBitmapScalingMode($letreiro, 'HighQuality')
    $caixa = New-Object Windows.Controls.Border
    $caixa.Width = $largura; $caixa.VerticalAlignment = 'Center'; $caixa.UseLayoutRounding = $true
    $caixa.Child = $letreiro
    $caixa
}
# troca o texto de um Rotulo sem refazer a linha (o tempo "12m" e o "falta" andam a cada minuto)
function TrocarTexto($elemento, $texto, $hex) {
    if ($elemento -is [Windows.Controls.TextBlock]) { $elemento.Text = $texto; return }
    $elemento.Child.Source = TextoMC $texto $hex
    $elemento.Child.Width = [math]::Round($elemento.Child.Source.PixelWidth * 11 / 9)
}

function Tempo($min) {
    $m = [math]::Max(0, [int][math]::Floor($min))
    if ($m -lt 1) { return 'agora' }
    if ($m -lt 60) { return "${m}m" }
    if ($m -lt 1440) { return '{0}h{1:00}' -f [math]::Floor($m / 60), ($m % 60) }
    return '{0}d{1}h' -f [math]::Floor($m / 1440), [math]::Floor(($m % 1440) / 60)
}

# pid vivo sem o Get-Process: ele varre os processos todos da máquina a cada chamada (6
# sessões = 30-57 ms a cada 2 s no thread da janela, e os quadros do motor travavam junto;
# medido 06/10). Sem compilar, fica o Get-Process.
try {
    Add-Type -Namespace ClaudeMonitor -Name Processo -MemberDefinition @'
[DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint acesso, bool herda, int id);
[DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr h, out uint codigo);
[DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
public static bool Vivo(int id) {
    IntPtr h = OpenProcess(0x1000, false, id);  // 0x1000 = só consultar
    if (h == IntPtr.Zero) return Marshal.GetLastWin32Error() == 5;  // 5 = sem permissão: existe
    try { uint codigo; return GetExitCodeProcess(h, out codigo) && codigo == 259; } finally { CloseHandle(h); }  // 259 = rodando
}
'@
} catch { Anotar "sem o teste rápido de pid vivo (fica o Get-Process): $_" }
function PidVivo($id) {
    if ('ClaudeMonitor.Processo' -as [type]) { return [ClaudeMonitor.Processo]::Vivo($id) }
    [bool](Get-Process -Id $id -ErrorAction Ignore)  # Ignore: sessão morta não conta nos erros do "fechou"
}

function Sessoes($agora) {
    $vistas = @{}
    Get-ChildItem $dir -Filter *.json -ErrorAction Ignore | ForEach-Object {
        try { $s = Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return }
        # mesma regra da extensão: pid vivo; sem pid, atualizada nas últimas 6h
        if ($s.pid) { if (-not (PidVivo $s.pid)) { return } }
        elseif ($agora - $s.updated -gt 6 * 3600) { return }
        $s | Add-Member -NotePropertyName id -NotePropertyValue $_.BaseName
        $titulo = Titulo $s.transcript
        if ($titulo) { $s.name = $titulo }
        $chave = if ($s.pid) { $s.pid } else { $s.id }
        if (-not $vistas[$chave] -or $vistas[$chave].updated -lt $s.updated) { $vistas[$chave] = $s }
    }
    $vistas.Values | ForEach-Object { $_ | Add-Member -NotePropertyName situacao -NotePropertyValue (Situacao $_) -PassThru } |
        Sort-Object updated -Descending
}

# Título da aba: o do /rename ("custom-title") ganha do automático ("ai-title").
# O hook só grava o nome quando você manda mensagem, e na 1ª ainda não existe
# título (ficava o nome da pasta). Lê só o pedaço novo do transcript.
$titulos = @{}  # transcript -> @{ lido; custom; ai }
function Titulo($transcript) {
    if (-not $transcript) { return $null }
    $t = $titulos[$transcript]
    if (-not $t) { $t = @{ lido = 0L; custom = $null; ai = $null }; $titulos[$transcript] = $t }
    try {
        $fs = [IO.File]::Open($transcript, 'Open', 'Read', 'ReadWrite')
        try {
            if ($fs.Length -lt $t.lido) { $t.lido = 0L; $t.custom = $null; $t.ai = $null }
            $n = [int]($fs.Length - $t.lido)
            if ($n -gt 0) {
                [void]$fs.Seek($t.lido, 'Begin')
                $buf = New-Object byte[] $n
                $lidos = 0
                while ($lidos -lt $n) { $k = $fs.Read($buf, $lidos, $n - $lidos); if ($k -le 0) { break }; $lidos += $k }
                $fim = [Array]::LastIndexOf($buf, [byte]10, $lidos - 1) + 1  # não consome linha pela metade
                $t.lido += $fim
                $texto = [Text.Encoding]::UTF8.GetString($buf, 0, $fim)
                foreach ($m in [regex]::Matches($texto, '(?m)^.*"type":"(?:custom|ai)-title".*$')) {
                    try { $o = $m.Value | ConvertFrom-Json } catch { continue }
                    if ($o.type -eq 'custom-title' -and $o.customTitle) { $t.custom = $o.customTitle }
                    elseif ($o.type -eq 'ai-title' -and $o.aiTitle) { $t.ai = $o.aiTitle }
                }
            }
        } finally { $fs.Dispose() }
    } catch { }
    if ($t.custom) { $t.custom } else { $t.ai }
}

# O que a última mensagem da conversa pede: 'caixa' (AskUserQuestion aberto),
# 'texto' (resposta terminando em pergunta) ou nada. Lê só o fim do transcript,
# e só quando ele muda de tamanho.
$leituras = @{}  # transcript -> @{ tamanho; resultado }
function UltimoPedido($transcript) {
    if (-not $transcript) { return $null }
    $info = Get-Item -LiteralPath $transcript -ErrorAction Ignore  # Ignore: transcript apagado não conta nos erros do "fechou"
    if (-not $info) { return $null }
    $cache = $leituras[$transcript]
    if ($cache -and $cache.tamanho -eq $info.Length) { return $cache.resultado }
    $resultado = $null
    try {
        $fs = [IO.File]::Open($transcript, 'Open', 'Read', 'ReadWrite')
        try {
            $n = [int][math]::Min($fs.Length, 65536)
            $cortou = $n -lt $fs.Length  # leu do meio: a 1ª linha pode ter vindo pela metade
            [void]$fs.Seek(-$n, 'End')
            $buf = New-Object byte[] $n
            [void]$fs.Read($buf, 0, $n)
        } finally { $fs.Dispose() }
        $linhas = [Text.Encoding]::UTF8.GetString($buf).Split("`n")
        for ($i = $linhas.Count - 1; $i -ge [int]$cortou; $i--) {
            $l = $linhas[$i]
            if ($l -notmatch '"type":"(assistant|user)"' -or $l -match '"isSidechain":true') { continue }
            # cada bloco da resposta vem numa linha; só converte o JSON (lento no
            # PowerShell 5) quando é texto — ferramenta se resolve pelo nome
            if ($l -match '"type":"assistant"') {
                if ($l -match '"type":"tool_use"') { if ($l -match '"name":"AskUserQuestion"') { $resultado = 'caixa' } }
                elseif ($l -match '"type":"text"') {
                    $bloco = @(($l | ConvertFrom-Json).message.content)[-1]
                    # "?" entre aspas ou crases é citação (fala de cliente, exemplo), não pergunta pra você
                    $ultima = ($bloco.text.Trim() -split "`n")[-1] -replace '"[^"]*"|“[^”]*”|`[^`]*`', ''
                    if ($ultima -match '\?') { $resultado = 'texto' }
                }
            }
            break
        }
    } catch { }
    $leituras[$transcript] = @{ tamanho = $info.Length; resultado = $resultado }
    $resultado
}

# Situação a partir do estado do hook + última mensagem. Trabalhando/permissão só
# viram pergunta com a caixinha (texto com "?" no meio do trabalho não conta).
function Situacao($s) {
    $estado = $s.state
    # depois de aprovar uma permissão nenhum hook dispara até a sessão parar; se o
    # transcript mexeu depois do pedido, ela voltou a trabalhar (regra da extensão)
    if ($estado -eq 'permission' -and $s.transcript) {
        $mexeu = (Get-Item -LiteralPath $s.transcript -ErrorAction Ignore).LastWriteTimeUtc
        if ($mexeu -and ([DateTimeOffset]$mexeu).ToUnixTimeMilliseconds() / 1000 -gt $s.since + 2) { $estado = 'working' }
    }
    $pedido = UltimoPedido $s.transcript
    switch ($estado) {
        'waiting' { if ($pedido) { 'question' } else { 'finished' } }
        default   { if ($pedido -eq 'caixa') { 'question' } else { $estado } }
    }
}

# som quando alguma sessão MUDA de situação pra terminou/pergunta/permissão (uma
# vez por mudança; na abertura não toca). Se vierem juntas, o aldeão ganha do XP.
# Terminou a última (todas terminadas, nada rodando nem esperando): sobe de nível.
function Avisar($sessoes) {
    $tocar = $null
    foreach ($s in $sessoes) {
        $antes = $ultimo[$s.id]
        if ($antes -and $antes -ne $s.situacao -and $avisoDaSituacao[$s.situacao] -and $tocar -notin 'permission', 'question') { $tocar = $s.situacao }
        $ultimo[$s.id] = $s.situacao
    }
    if ($tocar -eq 'finished' -and -not @($sessoes | Where-Object { $_.situacao -ne 'finished' })) { $tocar = 'tudo' }
    if ($tocar -in 'finished', 'tudo') { MotorEvento $(if ($tocar -eq 'tudo') { 'tudo' } else { 'terminou' }) }
    if ($tocar) {
        $script:somDaVez = $tocar
        if ($Foto) { return }
        $qualAviso = $avisoDaSituacao[$tocar]
        $nomeDesteSom = $nomeDoSom[$config.tema][$qualAviso]
        $arquivo = $sonsDoTema[$config.tema][$qualAviso] | Get-Random
        # no diário: amigo sem som manda o janelinha.log e dá pra ver se ela tentou tocar
        if ($config.volume -le 0) { Anotar "não toquei $($nomeDesteSom): volume no 0 (botão direito > Volume)"; return }
        # [Uri]::new e não "file:///" + caminho: com # no caminho (C:\Users\a#b) o resto virava âncora
        try { $tocador.Open([Uri]::new($arquivo)); Anotar "tocou $nomeDesteSom ($(Split-Path $arquivo -Leaf))" }
        catch { Anotar "não toquei $arquivo : $($_.Exception.Message)" }
    }
}

function DadosDoMedidor($rotulo, $dado) {
    $pct = [double]$dado.utilization
    # já renovou e ainda não veio o novo (o guardado de ontem, ou a busca falhando): zerou
    if ($dado.resets_at -and [DateTimeOffset]$dado.resets_at -le [DateTimeOffset]::Now) { $dado = $null; $pct = 0 }
    $nivel = $(if ($pct -ge 95) { 2 } elseif ($pct -ge 80) { 1 } else { 0 })
    @{
        rotulo = $rotulo; pct = $pct; nivel = $nivel; cor = $coresDoUso[$config.tema][$nivel]; pctTexto = '{0:0}%' -f $pct
        # quanto falta pra renovar
        falta = $(if ($dado.resets_at) { Tempo ([DateTimeOffset]$dado.resets_at - [DateTimeOffset]::Now).TotalMinutes } else { '' })
    }
}
# a linha de um medidor (DadosDoMedidor); guarda em lugares onde ficou cada parte, pro motor
function Medidor($medidor) {
    $rotulo, $pct, $nivel, $cor, $pctTexto, $falta = $medidor.rotulo, $medidor.pct, $medidor.nivel, $medidor.cor, $medidor.pctTexto, $medidor.falta
    $layoutDoTema = LayoutDoMotor
    if ($layoutDoTema.enfeites) {
        # quem desenha é o motor: aqui só o lugar de cada coisa
        $lugarDoRotulo = Lugar $layoutDoTema.colunas.rotulo $layoutDoTema.letra
        $trilho = Lugar $layoutDoTema.barra[0] $layoutDoTema.barra[1]
        $p = Lugar $layoutDoTema.colunas.pct $layoutDoTema.letra
        $f = Lugar $layoutDoTema.colunas.falta $layoutDoTema.letra
    } elseif ($config.tema -eq 'minecraft' -and $barraXP) {
        $trilho = New-Object Windows.Controls.Canvas
        $trilho.Width = 118; $trilho.Height = 5
        $trilho.VerticalAlignment = 'Center'
        $tinta = $barraXP[@('verde', 'ouro', 'vermelho')[$nivel]]
        $cheia = [int][math]::Round(118 * [math]::Min($pct, 100) / 100)
        $pedacos = @(@($barraXP.fundo, 0), @($barraXP.fundoPonta, 117))
        if ($cheia -gt 0) { $pedacos += , @((Cortada $tinta 0 ([math]::Min($cheia, 117))), 0) }
        if ($cheia -ge 118) { $pedacos += , @((Cortada $tinta 181 1), 117) }
        foreach ($pedaco in $pedacos) {
            $img = New-Object Windows.Controls.Image
            $img.Source = $pedaco[0]; $img.Width = $pedaco[0].PixelWidth; $img.Height = 5
            [Windows.Media.RenderOptions]::SetBitmapScalingMode($img, 'NearestNeighbor')
            [Windows.Controls.Canvas]::SetLeft($img, $pedaco[1])
            [void]$trilho.Children.Add($img)
        }
    } else {
        $trilho = New-Object Windows.Controls.Border
        $trilho.Width = 118; $trilho.Height = 4
        $trilho.CornerRadius = [Windows.CornerRadius]::new(2)
        $trilho.Background = Cor '#3F3F46'
        $trilho.VerticalAlignment = 'Center'
        $barra = New-Object Windows.Controls.Border
        $barra.Width = 118 * [math]::Min($pct, 100) / 100
        $barra.CornerRadius = [Windows.CornerRadius]::new(2)
        $barra.Background = Cor $cor
        $barra.HorizontalAlignment = 'Left'
        $trilho.Child = $barra
    }
    if (-not $layoutDoTema.enfeites) {
        $p = Rotulo $pctTexto $cor 38 'Right' 38
        $f = Rotulo $falta '#6B7280' 48 'Right' 56
        $lugarDoRotulo = Rotulo $rotulo '#9CA3AF' 18 $null 18
    }
    $medidor.lugares = @($lugarDoRotulo, $trilho, $p, $f, $falta)  # e o "falta" que está na tela
    Linha $lugarDoRotulo $trilho $p $f
}

# versão nova: a extensão pergunta pro GitHub 1x por dia e grava a publicada em
# consulta-versao; a instalada está em versao-janelinha (o instalador grava).
# Sem os dois, nada (Exists antes: erro pego no catch ainda soma no "fechou (N erros)").
function VersaoNova {
    $publicada, $instalada = "$Pasta\consulta-versao", "$Pasta\versao-janelinha"
    if (-not ([IO.File]::Exists($publicada) -and [IO.File]::Exists($instalada))) { return }
    $p = $i = $null
    try { $publicada, $instalada = [IO.File]::ReadAllText($publicada).Trim(), [IO.File]::ReadAllText($instalada).Trim() } catch { return }
    if ([version]::TryParse($publicada, [ref]$p) -and [version]::TryParse($instalada, [ref]$i) -and $p -gt $i) { $publicada }
}

# Usage a cada 2 min, sem esperar a resposta: o Invoke-RestMethod parava a janela inteira
# (~0,4 s; até 5 s sem rede) e os quadros do motor junto. Cada tick vê se o pedido voltou.
function BuscarUso {
    if ($uso.pedido) {
        if (-not $uso.pedido.IsCompleted) { return }
        $pedidoFeito = $uso.pedido
        $uso.pedido = $null
        if ($pedidoFeito.Status -ne 'RanToCompletion') { return }  # sem rede ou demorou: tenta de novo em 20 s
        $resposta = $pedidoFeito.Result
        try {
            if ($resposta.IsSuccessStatusCode) {
                $textoDoUso = $resposta.Content.ReadAsStringAsync().Result
                $uso.dados = $textoDoUso | ConvertFrom-Json
                $uso.proxima = [DateTime]::Now.AddMinutes(2)
                [IO.File]::WriteAllText($usoGuardado, $textoDoUso)
            } elseif ([int]$resposta.StatusCode -eq 429) {
                $uso.proxima = [DateTime]::Now.AddMinutes(5)  # limite de requisições: espera mais
            }  # outra falha: fica o último valor e tenta de novo em 20 s
        } catch {} finally { $resposta.Dispose() }
        return
    }
    if ([DateTime]::Now -lt $uso.proxima) { return }
    $uso.proxima = [DateTime]::Now.AddSeconds(20)
    try {
        if (-not $uso.http) {
            Add-Type -AssemblyName System.Net.Http
            $uso.http = [Net.Http.HttpClient]::new()
            $uso.http.Timeout = [TimeSpan]::FromSeconds(5)
        }
        $token = (Get-Content $cred -Raw | ConvertFrom-Json).claudeAiOauth.accessToken
        $pergunta = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, $uso.url)
        $pergunta.Headers.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token)
        [void]$pergunta.Headers.TryAddWithoutValidation('anthropic-beta', 'oauth-2025-04-20')
        [void]$pergunta.Headers.TryAddWithoutValidation('User-Agent', 'ClaudeMonitor')
        $uso.pedido = $uso.http.SendAsync($pergunta)
    } catch {}
}

# A lista só é refeita quando muda o que o WPF desenha nela: TextBlock novo sai em branco
# no 1º quadro, e refazer a cada 2 s piscava os nomes (filmado 06/10). A chave de cada
# painel é o que ele mostra; os lugares são onde ficou cada coisa que o motor desenha.
$listaFeita = @{ sessoes = $null; uso = $null; aviso = $null; lugaresDasSessoes = @(); lugaresDoUso = @() }
function Atualizar {
    $agora = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() / 1000
    $sessoes = @(Sessoes $agora)
    Avisar $sessoes
    $script:caixasDoMotor = @{ linhas = [Collections.ArrayList]::new(); uso = [Collections.ArrayList]::new() }
    $layoutDoTema = LayoutDoMotor
    $doMotor = [bool]$layoutDoTema.enfeites  # o motor desenha bolinha, tempo e barra
    $linhasDaLista = @(foreach ($s in $sessoes) {
        $cor, $rotulo = $estados[$s.situacao]
        if (-not $cor) { $cor, $rotulo = '#9CA3AF', $s.situacao }
        @{ s = $s; cor = $cor; rotulo = $rotulo; tempo = Tempo (($agora - $s.since) / 60) }
    })
    # o tempo não entra: cada sessão vira o minuto num segundo diferente (TrocarTexto, abaixo)
    $chaveDaLista = "$($config.tema) $doMotor`n" + (@($linhasDaLista | ForEach-Object { "$($_.s.id) $($_.s.situacao) $($_.s.name)" }) -join "`n")
    if ($chaveDaLista -ne $listaFeita.sessoes) {
        $listaFeita.sessoes = $chaveDaLista
        $listaFeita.lugaresDasSessoes = @()
        $painelSessoes.Children.Clear()
        if (-not $sessoes) { [void]$painelSessoes.Children.Add((Texto 'nenhuma sessão aberta' '#9CA3AF')) }
        foreach ($linhaDaLista in $linhasDaLista) {
            $s, $cor, $rotulo, $tempoTexto = $linhaDaLista.s, $linhaDaLista.cor, $linhaDaLista.rotulo, $linhaDaLista.tempo
            if ($doMotor) {
                $bola = Lugar 8 8  # o motor desenha a bolinha
            } elseif ($config.tema -eq 'minecraft' -and $orbes) {
                $bola = New-Object Windows.Shapes.Rectangle
                $bola.Fill = $(if ($s.situacao -eq 'working') { $orbeVerde } elseif ($orbes[$s.situacao]) { $orbes[$s.situacao] } else { $orbes.outro })
                [Windows.Media.RenderOptions]::SetBitmapScalingMode($bola, 'NearestNeighbor')
                $bola.UseLayoutRounding = $true
            } else {
                $bola = New-Object Windows.Shapes.Ellipse
                $bola.Fill = $(if ($s.situacao -eq 'working') { $bolaVerde } else { Cor $cor })
            }
            $bola.Width = 8; $bola.Height = 8
            $bola.Margin = [Windows.Thickness]::new(0, 0, 8, 0)
            $bola.VerticalAlignment = 'Center'
            $nomeSessao = Texto $s.name '#E5E7EB' 170
            $nomeSessao.TextTrimming = 'CharacterEllipsis'
            $tempo = $(if ($doMotor) { Lugar $layoutDoTema.colunas.tempo $layoutDoTema.letra } else { Rotulo $tempoTexto $cor 36 'Right' 44 })
            $listaFeita.lugaresDasSessoes += , @($bola, $tempo, $tempoTexto)
            $linha = Linha $bola $nomeSessao $tempo
            $linha.Background = [Windows.Media.Brushes]::Transparent
            $linha.ToolTip = $rotulo
            $linha.Tag = "sessao:$($s.id)"  # o clique acha a sessão por aqui
            $linha.Cursor = [Windows.Input.Cursors]::Hand
            [void]$painelSessoes.Children.Add($linha)
        }
    }
    for ($iLinha = 0; $iLinha -lt $linhasDaLista.Count; $iLinha++) {
        $linhaDaLista, $lugares = $linhasDaLista[$iLinha], $listaFeita.lugaresDasSessoes[$iLinha]
        if (-not $doMotor -and $lugares[2] -ne $linhaDaLista.tempo) { TrocarTexto $lugares[1] $linhaDaLista.tempo $linhaDaLista.cor; $lugares[2] = $linhaDaLista.tempo }
        [void]$caixasDoMotor.linhas.Add(@{ id = $linhaDaLista.s.id; sit = $linhaDaLista.s.situacao; cor = $linhaDaLista.cor; bola = $lugares[0]; tempo = @($linhaDaLista.tempo, $linhaDaLista.cor, $lugares[1]) })
    }
    # pedindo algo (pergunta/permissão) ganha de trabalhando, que ganha de parado
    $situacoes = @($sessoes | ForEach-Object { $_.situacao })
    Clawd $(if ($situacoes -contains 'question' -or $situacoes -contains 'permission') { 'pulando' }
            elseif ($situacoes -contains 'working') { 'andando' } else { 'parado' })
    if ($config.tema -eq 'minecraft' -and $passeio.modo -eq 'andando' -and -not $luta.tipo -and -not $Foto -and -not $motor.vivo -and [DateTime]::Now -ge $luta.proxima) {
        ComecarCena $(if ($luta.ferramenta -eq 'espada') { 'bug' } else { 'pedra' })
    }

    BuscarUso
    $medidores = @(if ($uso.dados) { DadosDoMedidor '5h' $uso.dados.five_hour; DadosDoMedidor '7d' $uso.dados.seven_day })
    # sem o motor, a barra muda com a %; o "falta" anda a cada minuto e é trocado no lugar
    $chaveDoUso = "$($config.tema) $doMotor $($medidores.Count)" + (@($medidores | ForEach-Object { $(if (-not $doMotor) { " $($_.pct)" }) }) -join '')
    if ($chaveDoUso -ne $listaFeita.uso) {
        $listaFeita.uso = $chaveDoUso
        $listaFeita.lugaresDoUso = @()
        $painelUso.Children.Clear()
        foreach ($medidor in $medidores) {
            [void]$painelUso.Children.Add((Medidor $medidor))
            $listaFeita.lugaresDoUso += , $medidor.lugares
        }
        if (-not $medidores) { [void]$painelUso.Children.Add((Texto 'usage indisponível' '#6B7280')) }
    }
    for ($iMedidor = 0; $iMedidor -lt $medidores.Count; $iMedidor++) {
        $medidor, $lugares = $medidores[$iMedidor], $listaFeita.lugaresDoUso[$iMedidor]
        if (-not $doMotor -and $lugares[4] -ne $medidor.falta) { TrocarTexto $lugares[3] $medidor.falta '#6B7280'; $lugares[4] = $medidor.falta }
        [void]$caixasDoMotor.uso.Add(@{ rotulo = @($medidor.rotulo, '#9CA3AF', $lugares[0]); barra = $lugares[1]; pct = $medidor.pct; nivel = $medidor.nivel; pctTxt = @($medidor.pctTexto, $medidor.cor, $lugares[2]); falta = @($medidor.falta, '#6B7280', $lugares[3]) })
    }
    $nova = VersaoNova
    if ("$nova" -ne $listaFeita.aviso) {
        $listaFeita.aviso = "$nova"
        $painelAviso.Children.Clear()
        if ($nova) {
            $traco = New-Object Windows.Controls.Border
            $traco.Height = 1; $traco.Background = Cor '#33FFFFFF'; $traco.Margin = [Windows.Thickness]::new(0, 5, 0, 4)
            $texto = Texto "↑ versão $nova disponível · baixar" '#A78BFA' 222
            $texto.TextTrimming = 'CharacterEllipsis'
            $aviso = Linha $texto
            $aviso.Background = [Windows.Media.Brushes]::Transparent
            $aviso.ToolTip = 'Baixa o zip: extraia e siga o COMO ATUALIZAR.txt'
            $aviso.Tag = 'baixar'
            $aviso.Cursor = [Windows.Input.Cursors]::Hand
            [void]$painelAviso.Children.Add($traco)
            [void]$painelAviso.Children.Add($aviso)
        }
    }
    if ($motor.obj) { $win.UpdateLayout() }  # o motor precisa de onde a lista nova ficou
    MotorEstado
}

# --- Clawd: pixel art do mascote do Claude Code (o do banner do terminal) ---
# '#' corpo, 'o' olho, 'A'/'B' os dois pares de pernas, que se alternam.
# Origem (0,0) = entre os pés, então ele "pisa" na trilha e o corpo fica pra fora.
# Pixel 2x mais alto que largo, como os meio-blocos do terminal (senão fica achatado).
$sprite = @(
    '...############...',
    '...##o######o##...',
    '.################.',
    '...############...',
    '....A.B....A.B....'
)
$pw = 1.5; $ph = 3

# pulinhos: sobe rápido e desacelera no alto; o AutoReverse faz a volta acelerar
$pulo = New-Object Windows.Controls.Canvas
$pulo.RenderTransform = New-Object Windows.Media.TranslateTransform
[void]$mascote.Children.Add($pulo)
$salto = [Windows.Media.Animation.DoubleAnimation]::new(0, -5, [Windows.Duration]::new([TimeSpan]::FromMilliseconds(160)))
$salto.AutoReverse = $true
$salto.RepeatBehavior = [Windows.Media.Animation.RepeatBehavior]::Forever
$salto.EasingFunction = New-Object Windows.Media.Animation.QuadraticEase -Property @{ EasingMode = 'EaseOut' }
[Windows.Media.Animation.Timeline]::SetDesiredFrameRate($salto, 40)
$pulo.RenderTransform.BeginAnimation([Windows.Media.TranslateTransform]::YProperty, $salto)

function Forma($padrao, $cor) {
    $g = New-Object Windows.Media.GeometryGroup
    for ($lin = 0; $lin -lt $sprite.Count; $lin++) {
        foreach ($m in [regex]::Matches($sprite[$lin], $padrao)) {
            $r = [Windows.Rect]::new(($m.Index - 9) * $pw, ($lin - 5) * $ph, $m.Length * $pw, $ph)
            [void]$g.Children.Add([Windows.Media.RectangleGeometry]::new($r))
        }
    }
    $p = New-Object Windows.Shapes.Path
    $p.Data = $g
    $p.Fill = Cor $cor
    [void]$pulo.Children.Add($p)
    $p
}
[void](Forma '[#o]+' '#D77757')
[void](Forma 'o+' '#1A1A1A')
$pernaA = Forma 'A+' '#D77757'
$pernaB = Forma 'B+' '#D77757'
$pernaB.Visibility = 'Hidden'

# Sem Minecraft: 16x16 desenhados aqui, com o cabo no mesmo pixel das texturas
# do jogo. d/c/b = diamante (contorno, cor, brilho); k/h = cabo; s/e/l = pedra
# (cor, escuro, claro). O bug é sempre daqui (o Minecraft não tem um que sirva).
$cores16 = [ordered]@{ d = '#1B6E73'; c = '#4AEDD9'; b = '#C9FFF6'; k = '#3B2A14'; h = '#8A5A2B'; s = '#7D7D7D'; e = '#5E5E5E'; l = '#A0A0A0' }
$desenhos = @{
    picareta = @(
        '................',
        '....ddddd.......',
        '...dbbcccdd.....',
        '....dddcccbd....',
        '.......ddcccd...',
        '.........dccd...',
        '........kdcbcd..',
        '.......khkdccd..',
        '......khk..dcd..',
        '.....khk...dcd..',
        '....khk.....dd..',
        '...khk..........',
        '..khk...........',
        '..kk............',
        '................',
        '................')
    espada = @(
        '................',
        '............ddd.',
        '...........dbcd.',
        '..........dbcd..',
        '.........dbcd...',
        '........dbcd....',
        '.......dbcd.....',
        '......dbcd......',
        '..dd.dbcd.......',
        '..dcdbcd........',
        '...dccd.........',
        '...kdcdd........',
        '..khkddcd.......',
        '.khk...dd.......',
        '.kk.............',
        '................')
    diamante = @(
        '................',
        '................',
        '....dddddddd....',
        '...dbbcccccbd...',
        '..dbbccccccccd..',
        '..dccccccccccd..',
        '...dcccccccbd...',
        '....dccccccd....',
        '.....dccccd.....',
        '......dccd......',
        '.......dd.......',
        '................',
        '................',
        '................',
        '................',
        '................')
    pedra = @(
        'ssslssssesssslss',
        'sesssssssslsssse',
        'sssbcssesssssbcs',
        'lsdccdsssssesdcd',
        'ssssdsslssssssds',
        'sesssssssbcsssss',
        'ssslsssesdccdsls',
        'ssssssssssdsssss',
        'sbcsslssssssesss',
        'dccdsssssslssbcs',
        'sdsssesssssssdcc',
        'ssssssssbcssssds',
        'slssssesdccdslss',
        'sssesssssdssssss',
        'ssssslsssssssess',
        'esssssssslssssss')
    # de lado, olhando pra esquerda (pro Clawd); p/q = as pernas, que se alternam
    bug = @(
        'a............',
        '.a...vvvvv...',
        '..a.vwwvvvvv.',
        '.aaavwvvxvvvv',
        'aoaavvvvvxvvv',
        '.aaaavvvvvxv.',
        '..pq..pq..pq.',
        '.p..qp..qp..q')
}
$coresBug = [ordered]@{ v = '#65A30D'; w = '#A3E635'; x = '#365314'; a = '#111827'; o = '#F8FAFC'; p = '#111827'; q = '#111827' }
$coresBugVermelho = [ordered]@{ v = '#EF4444'; w = '#FCA5A5'; x = '#991B1B'; a = '#450A0A'; o = '#FEE2E2'; p = '#450A0A'; q = '#450A0A' }  # levou o golpe
function Desenho($linhas, $cores) {
    $grupo = New-Object Windows.Media.DrawingGroup
    # retângulo invisível do tamanho todo: sem ele a imagem encolhe pro tamanho do desenho
    [void]$grupo.Children.Add([Windows.Media.GeometryDrawing]::new([Windows.Media.Brushes]::Transparent, $null,
        [Windows.Media.RectangleGeometry]::new([Windows.Rect]::new(0, 0, $linhas[0].Length, $linhas.Count))))
    foreach ($c in $cores.Keys) {
        $g = New-Object Windows.Media.GeometryGroup
        for ($y = 0; $y -lt $linhas.Count; $y++) {
            for ($x = 0; $x -lt $linhas[$y].Length; $x++) {
                if ($linhas[$y][$x] -ceq $c) { [void]$g.Children.Add([Windows.Media.RectangleGeometry]::new([Windows.Rect]::new($x, $y, 1, 1))) }
            }
        }
        [void]$grupo.Children.Add([Windows.Media.GeometryDrawing]::new((Cor $cores[$c]), $null, $g))
    }
    [Windows.Media.DrawingImage]::new($grupo)
}
# textura do Minecraft (minecraft.js), se tiver; senão, o desenho daqui
function Textura($nome) {
    $arquivo = "$Pasta\$nome.png"
    if (-not (Test-Path $arquivo)) { return Desenho $desenhos[$nome] $cores16 }
    $textura = New-Object Windows.Media.Imaging.BitmapImage
    $textura.BeginInit()
    $textura.UriSource = [Uri]$arquivo
    $textura.CacheOption = 'OnLoad'
    $textura.EndInit()
    $textura
}
function Imagem($fonte, $lado, $altura) {
    $i = New-Object Windows.Controls.Image
    $i.Source = $fonte
    $i.Width = $lado; $i.Height = $(if ($altura) { $altura } else { $lado })
    [Windows.Media.RenderOptions]::SetEdgeMode($i, 'Aliased')
    [Windows.Media.RenderOptions]::SetBitmapScalingMode($i, 'NearestNeighbor')
    $i
}
$texturas = @{}
foreach ($n in 'picareta', 'espada', 'diamante', 'pedra') { $texturas[$n] = Textura $n }

# a ferramenta (picareta ou espada) na mão direita, balançando como quem minera;
# o cabo (canto de baixo à esquerda da textura) fica na mão
$ferramenta = Imagem $texturas.picareta 17.6  # 1,1 por pixel da textura 16x16
$cabo = [Windows.Point]::new(2.75, 14.85)  # pixel (2,5; 13,5) da textura
$mao = [Windows.Point]::new(12, -7.5)      # ponta do braço direito do Clawd
[Windows.Controls.Canvas]::SetLeft($ferramenta, $mao.X - $cabo.X)
[Windows.Controls.Canvas]::SetTop($ferramenta, $mao.Y - $cabo.Y)
$giro = [Windows.Media.RotateTransform]::new(0, $cabo.X, $cabo.Y)
$ferramenta.RenderTransform = $giro
$balanco = [Windows.Media.Animation.DoubleAnimation]::new(-25, 15, [Windows.Duration]::new([TimeSpan]::FromMilliseconds(320)))
$balanco.AutoReverse = $true
$balanco.RepeatBehavior = [Windows.Media.Animation.RepeatBehavior]::Forever
$balanco.EasingFunction = New-Object Windows.Media.Animation.SineEase
[Windows.Media.Animation.Timeline]::SetDesiredFrameRate($balanco, 40)
$giro.BeginAnimation([Windows.Media.RotateTransform]::AngleProperty, $balanco)
[void]$pulo.Children.Add($ferramenta)

# Trilha = borda arredondada do cartão, no sentido horário; o Clawd gira junto
# nas curvas. Refeita quando o cartão muda de tamanho, sem perder o lugar dele.
# Fora do modo 'andando' ele fica parado no meio da borda de cima.
$passeio = @{ relogio = [Diagnostics.Stopwatch]::StartNew(); duracao = 0; inicio = 0; modo = $null }
function Trilha {
    if ($luta.tipo) { return }  # parado lutando; o fim da cena refaz a trilha
    if ($motor.vivo) { $mascote.RenderTransform.BeginAnimation([Windows.Media.MatrixTransform]::MatrixProperty, $null); MotorEstado; return }
    $w = $cartao.ActualWidth; $h = $cartao.ActualHeight
    if (-not $w) { return }
    $o = $cartao.TranslatePoint([Windows.Point]::new(0, 0), $mascote.Parent)
    if ($passeio.modo -ne 'andando') {
        $mascote.RenderTransform.BeginAnimation([Windows.Media.MatrixTransform]::MatrixProperty, $null)
        $mascote.RenderTransform.Matrix = [Windows.Media.Matrix]::new(1, 0, 0, 1, $o.X + $w / 2, $o.Y)
        $passeio.duracao = 0  # quando voltar a andar, sai daqui
        return
    }
    $r = $(if ($config.tema -eq 'minecraft') { 1 } else { 8 })  # o cartão do Minecraft é quadrado
    $esq = $o.X; $dir_ = $o.X + $w; $topo = $o.Y; $base = $o.Y + $h
    $d = [string]::Format([Globalization.CultureInfo]::InvariantCulture,
        'M {0},{2} L {1},{2} A {8},{8} 0 0 1 {3},{4} L {3},{5} A {8},{8} 0 0 1 {1},{6} L {0},{6} A {8},{8} 0 0 1 {7},{5} L {7},{4} A {8},{8} 0 0 1 {0},{2} Z',
        [object[]]@(($esq + $r), ($dir_ - $r), $topo, $dir_, ($topo + $r), ($base - $r), $base, $esq, $r))
    $perimetro = 2 * ($w + $h) - (8 - 2 * [math]::PI) * $r
    # fração da volta onde ele está; parado, estava no meio de cima
    $fracao = if ($passeio.duracao) { ($passeio.relogio.Elapsed.TotalSeconds + $passeio.inicio) % $passeio.duracao / $passeio.duracao }
              else { ($w / 2 - $r) / $perimetro }
    $passeio.duracao = $perimetro / 50  # ~50 px/s
    $passeio.inicio = $fracao * $passeio.duracao
    $passeio.relogio.Restart()

    $a = New-Object Windows.Media.Animation.MatrixAnimationUsingPath
    $a.PathGeometry = [Windows.Media.PathGeometry]::CreateFromGeometry([Windows.Media.Geometry]::Parse($d))
    $a.DoesRotateWithTangent = $true
    $a.Duration = [Windows.Duration]::new([TimeSpan]::FromSeconds($passeio.duracao))
    $a.BeginTime = [TimeSpan]::FromSeconds(-$passeio.inicio)
    $a.RepeatBehavior = [Windows.Media.Animation.RepeatBehavior]::Forever
    [Windows.Media.Animation.Timeline]::SetDesiredFrameRate($a, 40)
    $mascote.RenderTransform.BeginAnimation([Windows.Media.MatrixTransform]::MatrixProperty, $a)
}
$cartao.Add_SizeChanged({ Trilha })

$passo = New-Object Windows.Threading.DispatcherTimer
$passo.Interval = [TimeSpan]::FromMilliseconds(160)  # troca de perna a cada meio pulo
$passo.Add_Tick({
    $v = $pernaA.Visibility
    $pernaA.Visibility = $pernaB.Visibility
    $pernaB.Visibility = $v
})

# --- Cenas: de vez em quando, andando, ele para e luta ---
# picareta: aparece uma pedra de diamante na frente, ele bate 3x, ela vira farelo
# e sobe um diamante. espada: chega um bug, 3 espadadas, o bug vira fumaça. A
# ferramenta é sorteada cada vez que ele começa a andar. Tudo mora no Canvas que
# anda pela trilha (x+ = pra frente, y- = pra fora do cartão) e cada quadro é
# função do tempo (Quadro), então o -Foto fotografa qualquer instante (-Cena).
$bugs = @{}
foreach ($perna in 'p', 'q') {
    $linhas = $desenhos.bug | ForEach-Object { $_.Replace($(if ($perna -eq 'p') { 'q' } else { 'p' }), '.') }
    $bugs[$perna] = Desenho $linhas $coresBug
    $bugs["$perna!"] = Desenho $linhas $coresBugVermelho
}
$alvo = Imagem $texturas.pedra 12
$alvo.Visibility = 'Hidden'
$mascote.Children.Insert(0, $alvo)  # atrás da ferramenta, que bate por cima
$diamante = Imagem $texturas.diamante 11
$diamante.Visibility = 'Hidden'
[void]$mascote.Children.Add($diamante)
$farelos = foreach ($i in 1..8) {
    $f = New-Object Windows.Shapes.Rectangle
    $f.Visibility = 'Hidden'
    [void]$mascote.Children.Add($f)
    $f
}
$voos = @(@(-30, -60), @(-12, -80), @(10, -75), @(28, -55), @(-22, -30), @(20, -35), @(0, -90), @(34, -20))  # px/s
$coresFarelo = @{ pedra = '#7D7D7D', '#4AEDD9', '#A0A0A0', '#5E5E5E'; bug = '#E5E7EB', '#9CA3AF' }
# em segundos: o alvo chega, leva 3 golpes (o 3º mata) e a cena acaba em "fim"
$roteiros = @{ pedra = @{ chega = 0.3; golpe = 0.5; fim = 3.2 }; bug = @{ chega = 1.0; golpe = 0.45; fim = 2.9 } }
$luta = @{ tipo = $null; relogio = New-Object Diagnostics.Stopwatch; proxima = [DateTime]::MaxValue; ferramenta = 'picareta' }
function Pos($e, $x, $y) { [Windows.Controls.Canvas]::SetLeft($e, $x); [Windows.Controls.Canvas]::SetTop($e, $y) }
# ângulo da ferramenta num golpe (u de 0 a 1): levanta devagar, desce rápido
function Golpe($u) { if ($u -lt 0.7) { -40 * $u / 0.7 } else { -40 + 110 * ($u - 0.7) / 0.3 } }
function Quadro($t) {
    $c = $roteiros[$luta.tipo]
    $morre = $c.chega + 3 * $c.golpe
    $g = ($t - $c.chega) / $c.golpe  # golpes dados, com fração
    $giro.Angle = $(if ($g -ge 0 -and $g -lt 3) { Golpe ($g % 1) } else { 0 })
    $acerto = $(if ($g -ge 1 -and $t -lt $morre) { ($g % 1) * $c.golpe } else { 99 })  # s desde o último golpe
    $d = $t - $morre  # s desde que morreu
    $alvo.Visibility = $(if ($d -lt 0) { 'Visible' } else { 'Hidden' })
    if ($luta.tipo -eq 'pedra') {
        $alvo.RenderTransform = [Windows.Media.ScaleTransform]::new(1, [math]::Min(1.0, $t / $c.chega), 6, 12)  # brota do chão
        Pos $alvo (16 + $(if ($acerto -lt 0.1) { 1 } else { 0 })) -12  # treme com o golpe
        $centro = 22, -6
    } else {
        $x = $(if ($t -lt $c.chega) { 42 - 25 * $t / $c.chega } else { 17 + $(if ($acerto -lt 0.15) { 2 } else { 0 }) })  # chega; recua no golpe
        Pos $alvo $x -12.8
        $alvo.Source = $bugs["$(if ([math]::Floor($t / 0.1) % 2) { 'q' } else { 'p' })$(if ($acerto -lt 0.15) { '!' })"]
        $centro = 27.4, -6.4
    }
    # farelos da pedra (caem) ou fumaça do bug (sobe devagar e cresce), por 0,6 s
    for ($i = 0; $i -lt 8; $i++) {
        $f = $farelos[$i]
        $f.Visibility = $(if ($d -ge 0 -and $d -lt 0.6) { 'Visible' } else { 'Hidden' })
        if ($f.Visibility -ne 'Visible') { continue }
        $f.Opacity = 1 - $d / 0.6
        if ($luta.tipo -eq 'pedra') {
            $f.Width = 2; $f.Height = 2
            Pos $f ($centro[0] + $voos[$i][0] * $d) ($centro[1] + $voos[$i][1] * $d + 150 * $d * $d)
        } else {
            # nasce numa roda em volta do bug e se abre
            $f.Width = 3 + 5 * $d; $f.Height = $f.Width
            $x = $centro[0] + $voos[$i][0] * (0.06 + $d * 0.3) - $f.Width / 2
            Pos $f $x ($centro[1] + $voos[$i][1] * (0.06 + $d * 0.2) - 10 * $d - $f.Width / 2)
        }
    }
    # o diamante sobe da pedra, fica balançando e some
    $diamante.Visibility = $(if ($luta.tipo -eq 'pedra' -and $d -ge 0) { 'Visible' } else { 'Hidden' })
    if ($diamante.Visibility -eq 'Visible') {
        $s = [math]::Min(1.0, $d / 0.6)
        Pos $diamante 16.5 (-11.5 - 16 * (1 - (1 - $s) * (1 - $s)) + [math]::Sin($d * 7) * 0.8)
        $diamante.Opacity = $(if ($d -lt 1) { 1 } else { [math]::Max(0.0, 1 - ($d - 1) / 0.4) })
    }
}
$quadros = New-Object Windows.Threading.DispatcherTimer
$quadros.Interval = [TimeSpan]::FromMilliseconds(40)
$quadros.Add_Tick({
    $t = $luta.relogio.Elapsed.TotalSeconds
    if ($t -lt $roteiros[$luta.tipo].fim) { Quadro $t } else { FimDaCena; Movimento }
})
function ComecarCena($tipo) {
    $luta.tipo = $tipo
    $ferramenta.Source = $texturas[$(if ($tipo -eq 'bug') { 'espada' } else { 'picareta' })]
    if ($tipo -eq 'pedra') { $alvo.Source = $texturas.pedra; $alvo.Width = 12; $alvo.Height = 12 }
    else { $alvo.RenderTransform = $null; $alvo.Width = 13 * 1.6; $alvo.Height = 8 * 1.6 }
    for ($i = 0; $i -lt 8; $i++) { $farelos[$i].Fill = Cor $coresFarelo[$tipo][$i % $coresFarelo[$tipo].Count] }
    # congela onde está: sem trilha, pulo, troca de perna nem balanço
    $passeio.relogio.Stop()
    $m = $mascote.RenderTransform.Value
    $mascote.RenderTransform.BeginAnimation([Windows.Media.MatrixTransform]::MatrixProperty, $null)
    $mascote.RenderTransform.Matrix = $m
    $pulo.RenderTransform.BeginAnimation([Windows.Media.TranslateTransform]::YProperty, $null)
    $passo.Stop()
    $pernaA.Visibility = 'Visible'; $pernaB.Visibility = 'Visible'
    $giro.BeginAnimation([Windows.Media.RotateTransform]::AngleProperty, $null)
    $luta.relogio.Restart()
    Quadro 0
    $quadros.Start()
}
function FimDaCena {
    $quadros.Stop()
    $luta.tipo = $null
    $alvo.Visibility = 'Hidden'; $diamante.Visibility = 'Hidden'
    foreach ($f in $farelos) { $f.Visibility = 'Hidden' }
    $giro.Angle = 0
    $luta.proxima = [DateTime]::Now.AddSeconds((Get-Random -Minimum 20 -Maximum 45))
    $passeio.relogio.Start()  # a trilha continua de onde parou
}

# 'andando' (algo rodando): anda, pula, troca de perna e minera (e às vezes luta).
# 'pulando' (pergunta/permissão): parado em cima do cartão, pulando.
# 'parado' (nada rodando): parado em cima do cartão, com as 4 pernas no chão.
function Clawd($modo) {
    if (-not $config.clawd) {
        if ($luta.tipo) { FimDaCena }
        $passo.Stop()
        $mascote.Visibility = 'Hidden'
        return
    }
    $mascote.Visibility = $(if ($motor.vivo) { 'Hidden' } else { 'Visible' })
    if ($passeio.modo -eq $modo) { return }
    if ($luta.tipo) { FimDaCena }  # mudou no meio da luta
    if ($modo -eq 'andando' -and -not $Foto) {  # o -Foto fica sempre na picareta
        $luta.ferramenta = Get-Random -InputObject 'picareta', 'espada'
        $ferramenta.Source = $texturas[$luta.ferramenta]
        $luta.proxima = [DateTime]::Now.AddSeconds((Get-Random -Minimum 20 -Maximum 45))
    }
    $passeio.modo = $modo
    Movimento
    MotorEstado
}
# troca a cara da janelinha pro tema do config.json (ao abrir e quando o menu troca)
function AplicarTema {
    $mc = $config.tema -eq 'minecraft'
    $cartao.CornerRadius = [Windows.CornerRadius]::new($(if ($mc) { 0 } else { 8 }))
    $cartao.BorderThickness = $(if ($mc) { [Windows.Thickness]::new(6, 8, 6, 6) } else { [Windows.Thickness]::new(0) })
    $cartao.BorderBrush = $terra
    $cartao.Background = Cor $(if ($mc) { '#F0181818' } else { '#E6181818' })
    # 8 e não 10 dos lados: com a borda, 10 passaria da janela
    $cartao.Padding = $(if ($mc) { [Windows.Thickness]::new(8, 6, 8, 6) } else { [Windows.Thickness]::new(10, 6, 10, 6) })
    $grama.Visibility = $(if ($mc) { 'Visible' } else { 'Collapsed' })
    $sombra.Visibility = $grama.Visibility
    # com o motor desenhando a moldura e os enfeites, o cartão segue o layout do tema
    # (mensagem P) e fica só o fundo; os enfeites daqui voltam se o motor cair
    $layoutDoTema = LayoutDoMotor
    if ($layoutDoTema.enfeites) {
        $moldura4, $padding4 = $layoutDoTema.moldura, $layoutDoTema.padding
        $cartao.CornerRadius = [Windows.CornerRadius]::new($layoutDoTema.raio)
        $cartao.BorderThickness = [Windows.Thickness]::new($moldura4[0], $moldura4[1], $moldura4[2], $moldura4[3])
        $cartao.BorderBrush = [Windows.Media.Brushes]::Transparent
        $cartao.Background = Cor $layoutDoTema.fundo
        $cartao.Padding = [Windows.Thickness]::new($padding4[0], $padding4[1], $padding4[2], $padding4[3])
        $grama.Visibility = 'Collapsed'; $sombra.Visibility = 'Collapsed'
    }
    # Padrão: Clawd sem ferramenta e sem lutas (picareta, pedra e bug são do Minecraft)
    $ferramenta.Visibility = $(if ($mc) { 'Visible' } else { 'Collapsed' })
    if (-not $mc -and $luta.tipo) { FimDaCena; Movimento }
    if ($mc -and $orbes -and -not $Foto -and -not $layoutDoTema.enfeites) { $tiqueOrbe.Start() } else { $tiqueOrbe.Stop() }
}
function TrocarTema($direcao) {
    $nomesDosTemas = @($temas.Keys)
    $config.tema = $nomesDosTemas[($nomesDosTemas.IndexOf($config.tema) + $direcao + $nomesDosTemas.Count) % $nomesDosTemas.Count]
    $nomeDoTema.Text = $temas[$config.tema]
    SalvarConfig
    Anotar "tema: $($config.tema)"
    AplicarTema
    Atualizar
}
function Movimento {
    $modo = $passeio.modo
    $anda = $modo -eq 'andando' -and -not $motor.vivo  # com o motor, o Clawd daqui fica parado e escondido
    $pulo.RenderTransform.BeginAnimation([Windows.Media.TranslateTransform]::YProperty, $(if ($modo -eq 'parado' -or $motor.vivo) { $null } else { $salto }))
    $passo.Stop()
    $pernaA.Visibility = 'Visible'
    $pernaB.Visibility = $(if ($anda) { 'Hidden' } else { 'Visible' })
    if ($anda) { $passo.Start() }
    if ($giro) { $giro.BeginAnimation([Windows.Media.RotateTransform]::AngleProperty, $(if ($anda) { $balanco } else { $null })) }
    Trilha
}

# --- Motor das animações (motor\motor.js, o mesmo código no Mac) ---
# Desenha o Clawd, as cenas e os enfeites do tema em software e manda os pixels; aqui
# só colamos (motor\Motor.cs) por cima do cartão e mandamos o estado (tema, onde está o
# cartão, o que o Clawd faz). Sem node, ou com o motor caído, fica o Clawd daqui (o de
# antes), sem cenas; ele tenta de novo em 5 s, 30 s e 2 min.
$motor = @{ obj = $null; vivo = $false; tentativas = 0; enviado = ''; pasta = (Join-Path $PSScriptRoot 'motor'); layouts = $null; pediuFoto = $false }
# Tema que desenha os próprios enfeites (layout.enfeites: bolinha, números, barra e
# moldura): a lista monta só o lugar deles (Lugar) e o MotorEstado manda onde ficaram.
$caixasDoMotor = @{ linhas = [Collections.ArrayList]::new(); uso = [Collections.ArrayList]::new() }
function LayoutDoMotor {
    if (-not $motor.layouts -or -not ($motor.vivo -or $Foto)) { return $null }
    $motor.layouts[$config.tema]
}
function Lugar($largura, $altura) {
    $lugarVazio = New-Object Windows.Controls.Border
    $lugarVazio.Width = $largura; $lugarVazio.Height = $altura; $lugarVazio.VerticalAlignment = 'Center'
    $lugarVazio
}
# [x, y, w, h] na janela (DIPs); fora da árvore (lista refeita no meio), zeros
function CaixaNaJanela($elemento) {
    try { $canto = $elemento.TranslatePoint([Windows.Point]::new(0, 0), $win) } catch { return @(0, 0, 0, 0) }
    @([math]::Round($canto.X, 2), [math]::Round($canto.Y, 2), [math]::Round($elemento.ActualWidth, 2), [math]::Round($elemento.ActualHeight, 2))
}
function TextoNaJanela($textoCorLugar) { [ordered]@{ txt = "$($textoCorLugar[0])"; cor = $textoCorLugar[1]; caixa = @(CaixaNaJanela $textoCorLugar[2]) } }
$religarMotor = New-Object Windows.Threading.DispatcherTimer
$religarMotor.Add_Tick({ $religarMotor.Stop(); LigarMotor })
# o node dos hooks (no PATH); sem ele, o do VS Code que me abriu (Electron fazendo de node)
function AcharNode {
    $noPath = Get-Command node.exe -ErrorAction Ignore | Select-Object -First 1
    if ($noPath) { return @($noPath.Source, $false) }
    if ($env:CLAUDE_MONITOR_NODE -and [IO.File]::Exists($env:CLAUDE_MONITOR_NODE)) { return @($env:CLAUDE_MONITOR_NODE, $true) }
    $null
}
# Motor.cs compilado 1x e guardado (o Add-Type leva ~1 s); o nome leva o hash do .cs,
# então versão nova compila de novo sem brigar com a dll que a janelinha velha está usando
function CarregarMotorCs {
    if ('ClaudeMonitor.Motor' -as [type]) { return $true }
    $cs = Join-Path $motor.pasta 'Motor.cs'
    if (-not [IO.File]::Exists($cs)) { return $false }
    $fonte = [IO.File]::ReadAllText($cs)
    $hash = [BitConverter]::ToString([Security.Cryptography.SHA1]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($fonte))).Replace('-', '').Substring(0, 12)
    $dll = Join-Path $Pasta "motor-$hash.dll"
    $refs = 'PresentationFramework', 'PresentationCore', 'WindowsBase', 'System.Xaml'
    if (-not [IO.File]::Exists($dll)) {
        try { Add-Type -TypeDefinition $fonte -ReferencedAssemblies $refs -OutputAssembly $dll -OutputType Library -ErrorAction Stop }
        catch { Anotar "não compilei o motor (Motor.cs): $($_.Exception.Message)"; return $false }
        Get-ChildItem $Pasta -Filter 'motor-*.dll' -ErrorAction Ignore | Where-Object { $_.FullName -ne $dll } | Remove-Item -ErrorAction Ignore
    }
    try { Add-Type -Path $dll -ErrorAction Stop; $true } catch { Anotar "não carreguei $dll : $($_.Exception.Message)"; $false }
}
function LigarMotor {
    if ($SemMotor -or $motor.vivo) { return }
    $script = Join-Path $motor.pasta 'motor.js'
    $achado = AcharNode
    if (-not $achado -or -not [IO.File]::Exists($script) -or -not (CarregarMotorCs)) {
        if ($motor.tentativas -eq 0) { Anotar "motor desligado: $(if (-not $achado) { 'sem node' } elseif (-not [IO.File]::Exists($script)) { 'sem motor.js' } else { 'sem Motor.cs' }); fica o Clawd daqui" }
        $motor.tentativas = 99
        return
    }
    $motorNovo = New-Object ClaudeMonitor.Motor $palco
    $motorNovo.add_Linha({ param($textoDoMotor) Anotar $textoDoMotor })
    $motorNovo.add_Som({ param($jsonDoSomDoMotor) SomDaCena $jsonDoSomDoMotor })
    # o layout de cada tema; no -Foto, monta o cartão com ele e só então pede a foto (MotorEstado)
    $motorNovo.add_ChegouPronto({
        try {
            $motor.layouts = @{}
            # $motor.obj e não $motorNovo: este bloco roda depois, quando a local já sumiu
            foreach ($temaDoMotor in ($motor.obj.Pronto | ConvertFrom-Json -ErrorAction Stop).temas.PSObject.Properties) { $motor.layouts[$temaDoMotor.Name] = $temaDoMotor.Value }
        } catch { Anotar "motor: mensagem P com defeito: $($_.Exception.Message)"; $motor.layouts = $null }
        if ($Foto) { AplicarTema; Atualizar }
    })
    $motorNovo.add_Primeiro({
        if ($motor.tentativas -gt 0 -and $motor.tentativas -lt 99) { Anotar 'motor voltou' }
        $motor.vivo = $true
        $motor.tentativas = 0
        $palco.Visibility = 'Visible'
        Movimento  # para e esconde o Clawd daqui
        $mascote.Visibility = 'Hidden'
        AplicarTema; Atualizar  # os enfeites do tema passam pro motor
    })
    $motorNovo.add_Saiu({
        param($codigoDeSaida)
        if ($Foto) { if (-not $motor.vivo) { $motor.tentativas = 99 }; return }  # o -Foto sai depois do quadro: fica o quadro
        $motor.vivo = $false
        $motor.enviado = ''
        $tocadorDaCena.Stop()  # a cena morreu junto
        $palco.Visibility = 'Hidden'
        $motor.tentativas++
        if ($passeio.modo) { $modoAntes = $passeio.modo; $passeio.modo = $null; Clawd $modoAntes }  # o Clawd daqui volta
        AplicarTema; Atualizar  # e os enfeites daqui
        $espera = @(5, 30, 120)[[math]::Min(2, $motor.tentativas - 1)]
        if ($motor.tentativas -le 5) { Anotar "motor saiu ($codigoDeSaida); tento de novo em $espera s"; $religarMotor.Interval = [TimeSpan]::FromSeconds($espera); $religarMotor.Start() }
        else { Anotar "motor saiu ($codigoDeSaida) de novo; desisti até reabrir" }
    })
    $argumentos = "--pasta `"$Pasta`""
    if ($Foto) { $argumentos += " --foto $(if ($Cena) { ($Cena -split ' ')[1] } else { '1' }) --semente 7 --hora 12$(if ($Cena) { ' --cena ' + ($Cena -split ' ')[0] })" }
    try { $motorNovo.Iniciar($achado[0], $achado[1], $script, $argumentos) }
    catch { Anotar "não abri o motor ($($achado[0])): $($_.Exception.Message)"; $motor.tentativas = 99; return }
    $motor.obj = $motorNovo
    $motor.enviado = ''
    MotorEstado
}
# o que o motor precisa saber; só manda quando mudou
function MotorEstado {
    if (-not $motor.obj -or -not $cartao.ActualWidth) { return }
    $origem = $cartao.TranslatePoint([Windows.Point]::new(0, 0), $win)
    $fonteDaTela = [Windows.PresentationSource]::FromVisual($win)
    $escala = $(if ($Foto -or -not $fonteDaTela) { 1 } else { $fonteDaTela.CompositionTarget.TransformToDevice.M11 })
    $estadoDoMotor = [ordered]@{
        msg = 'estado'; tema = $config.tema; clawd = [bool]$config.clawd; modo = "$($passeio.modo)"
        escala = $escala; janela = @($win.Width, $win.Height)
        cartao = @([math]::Round($origem.X, 2), [math]::Round($origem.Y, 2), [math]::Round($cartao.ActualWidth, 2), [math]::Round($cartao.ActualHeight, 2))
        raio = $(if ($config.tema -eq 'minecraft') { 1 } else { 8 }); opacidade = $config.opacidade
        # onde ficou cada bolinha, número e barra (docs/MOTOR.md)
        linhas = @(foreach ($umaLinha in $caixasDoMotor.linhas) {
            [ordered]@{ id = $umaLinha.id; sit = $umaLinha.sit; cor = $umaLinha.cor; bola = @(CaixaNaJanela $umaLinha.bola); tempo = (TextoNaJanela $umaLinha.tempo) }
        })
        uso = @(foreach ($umUso in $caixasDoMotor.uso) {
            [ordered]@{ rotulo = (TextoNaJanela $umUso.rotulo); barra = @(CaixaNaJanela $umUso.barra); pct = $umUso.pct; nivel = $umUso.nivel; pctTxt = (TextoNaJanela $umUso.pctTxt); falta = (TextoNaJanela $umUso.falta) }
        })
    }
    $json = $estadoDoMotor | ConvertTo-Json -Compress -Depth 6
    if ($json -ne $motor.enviado) {
        $motor.enviado = $json
        $motor.obj.Enviar($json)
    }
    # -Foto: a foto sai com o cartão já montado pelo layout do tema
    if ($Foto -and $motor.layouts -and -not $motor.pediuFoto) { $motor.pediuFoto = $true; $motor.obj.Enviar('{"msg":"foto"}') }
}
function MotorEvento($tipoDoEvento) { if ($motor.vivo) { $motor.obj.Enviar("{`"msg`":`"evento`",`"tipo`":`"$tipoDoEvento`"}") } }
$palco = $win.FindName('Palco')
$palco.Width = $win.Width; $palco.Height = $win.Height
$palco.Visibility = 'Hidden'
$cartao.Add_SizeChanged({ MotorEstado })

# nasce no canto de baixo à direita (a $margem já afasta o cartão da borda)
# Só o arrasto muda o lugar dela. Às vezes, logo depois de abrir, o Windows/WPF
# joga a janela pra outro canto sozinho; aí ela volta (na hora e a cada 2 s).
$area = [Windows.SystemParameters]::WorkArea
$lugar = @{ x = $area.Right - $win.Width; y = $area.Bottom - $win.Height; arrastando = $false }
if ($Foto) { $lugar.x = -10000; $win.ShowActivated = $false }  # teste: desenha fora da tela
function Recolocar {
    if ($lugar.arrastando) { return }
    if ([math]::Abs($win.Left - $lugar.x) -gt 1 -or [math]::Abs($win.Top - $lugar.y) -gt 1) {
        $win.Left = $lugar.x
        $win.Top = $lugar.y
    }
}
$win.Left = $lugar.x
$win.Top = $lugar.y
$win.Add_LocationChanged({ Recolocar })

function TrazerVSCode {
    $shell = New-Object -ComObject WScript.Shell
    if (-not $shell.AppActivate('Visual Studio Code')) { [void]$shell.AppActivate('Cursor') }
}
# a linha nesse ponto da janela: "sessao:<id>" (sessão) ou "baixar" (versão nova), guardado no Tag; ou nada
function AlvoNoPonto($ponto) {
    # InputHitTest, não VisualTreeHelper.HitTest: esse acerta o Palco do motor (a janela
    # inteira) mesmo com IsHitTestVisible=False, e o clique não achava a sessão
    for ($e = $win.InputHitTest($ponto); $e; $e = [Windows.Media.VisualTreeHelper]::GetParent($e)) {
        if ("$($e.Tag)" -like 'sessao:*' -or "$($e.Tag)" -eq 'baixar') { return "$($e.Tag)" }
    }
}
# a extensão recebe o link e abre a aba (ou o terminal) da sessão, como o clique na lista dela
function AbrirSessao($id) {
    $url = "vscode://local.claude-monitor/sessao?id=$([uri]::EscapeDataString($id))"
    if ($Foto) { $script:cliqueDaVez = $url; return }
    try { Start-Process $url -ErrorAction Stop } catch { Anotar "não abri $url ($_)"; TrazerVSCode }
}
# o mesmo zip do botão Baixar da extensão (com o COMO ATUALIZAR.txt dentro)
$zip = 'https://github.com/LucasM-Maciel/ticlins-claude-monitor/releases/latest/download/ClaudeMonitor.zip'
function Clicar($qual) {
    if ($qual -like 'sessao:*') { AbrirSessao $qual.Substring(7); return }
    if ($qual -ne 'baixar') { return }
    if ($Foto) { $script:cliqueDaVez = $zip; return }
    try { Start-Process $zip -ErrorAction Stop; Anotar "baixando a versão nova pelo aviso" } catch { Anotar "não abri $zip ($_)" }
}
$win.Add_MouseLeftButtonDown({
    if ($_.ClickCount -eq 2) { TrazerVSCode; return }
    # já na descida: durante o arrasto a lista pode se redesenhar
    # O DragMove roda os timers (Clawd, cenas) DENTRO deste bloco, e o PowerShell acha
    # variável pela pilha: nome daqui igual a um do script (ex. $alvo, a pedra) troca
    # o dele no meio do arrasto (crash 29/09, 0.5.2). O teste "nomes do clique" barra.
    $clicado = AlvoNoPonto ($_.GetPosition($win))
    $lugar.arrastando = $true
    try { $win.DragMove() } finally { $lugar.arrastando = $false }
    $clicou = [math]::Abs($win.Left - $lugar.x) -le 2 -and [math]::Abs($win.Top - $lugar.y) -le 2  # não arrastou
    $lugar.x = $win.Left
    $lugar.y = $win.Top
    if ($clicou -and $clicado) { Clicar $clicado }
})
# só anota: o erro segue o caminho de sempre
$win.Dispatcher.Add_UnhandledException({ Anotar "erro: $($_.Exception.Message)" })
$menu = [Windows.Markup.XamlReader]::Parse(@'
<ContextMenu xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             HasDropShadow="False"
             FontFamily="Segoe UI" FontSize="12">
  <ContextMenu.Template>
    <ControlTemplate TargetType="ContextMenu">
      <Border Background="#1E1E1E" BorderBrush="#3F3F46" BorderThickness="1,1,0,0" Padding="0,4">
        <ItemsPresenter/>
      </Border>
    </ControlTemplate>
  </ContextMenu.Template>
  <ContextMenu.Resources>
    <Style TargetType="MenuItem">
      <Setter Property="Foreground" Value="#D1D5DB"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="MenuItem">
            <Border x:Name="bd" Background="Transparent" Padding="12,5">
              <StackPanel Orientation="Horizontal">
                <Border x:Name="cbox" Width="11" Height="11" BorderBrush="#4B5563"
                        BorderThickness="1" CornerRadius="2" VerticalAlignment="Center"
                        Margin="0,0,6,0" Visibility="Collapsed">
                  <TextBlock x:Name="chk" Text="✓" Foreground="#D1D5DB" FontSize="9"
                             HorizontalAlignment="Center" VerticalAlignment="Center"
                             Visibility="Collapsed"/>
                </Border>
                <ContentPresenter ContentSource="Header"
                                  VerticalAlignment="Center" RecognizesAccessKey="True"/>
              </StackPanel>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsHighlighted" Value="True">
                <Setter TargetName="bd" Property="Background" Value="#2A2A2A"/>
              </Trigger>
              <Trigger Property="IsCheckable" Value="True">
                <Setter TargetName="cbox" Property="Visibility" Value="Visible"/>
              </Trigger>
              <Trigger Property="IsChecked" Value="True">
                <Setter TargetName="chk" Property="Visibility" Value="Visible"/>
                <Setter TargetName="cbox" Property="BorderBrush" Value="#9CA3AF"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <Style TargetType="Separator">
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Separator">
            <Border Background="#33FFFFFF" Height="1" Margin="0,3"/>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
    <!-- as setinhas do tema: botão (e não item) pro menu ficar aberto enquanto troca -->
    <Style TargetType="Button">
      <Setter Property="Foreground" Value="#E5E7EB"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="fundo" Background="Transparent" CornerRadius="3" Width="18" Height="18">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="fundo" Property="Background" Value="#3A3F4B"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
  </ContextMenu.Resources>
</ContextMenu>
'@)

# tema: Temas ◀ nome ▶
$painelTema = New-Object Windows.Controls.StackPanel
$painelTema.Orientation = 'Horizontal'
$painelTema.Margin = [Windows.Thickness]::new(0, 2, 0, 2)
[void]$painelTema.Children.Add((Texto 'Temas' '#D1D5DB' 70))
$nomeDoTema = Texto $temas[$config.tema] '#FFFFFF' 70
$nomeDoTema.TextAlignment = 'Center'
$nomeDoTema.FontWeight = 'SemiBold'
function SetaDoTema($simbolo, $direcao) {
    $botaoTema = New-Object Windows.Controls.Button
    $botaoTema.Content = $simbolo
    $botaoTema.Tag = $direcao
    $botaoTema.Add_Click({ TrocarTema $this.Tag })
    [void]$painelTema.Children.Add($botaoTema)
}
SetaDoTema '◀' -1
[void]$painelTema.Children.Add($nomeDoTema)
SetaDoTema '▶' 1
[void]$menu.Items.Add($painelTema)

# toggle do Clawd
$itemClawd = New-Object Windows.Controls.MenuItem
$itemClawd.Header = 'Clawd'
$itemClawd.IsCheckable = $true
$itemClawd.IsChecked = $config.clawd
# Atualizar: aparece/some na hora, sem esperar o próximo tique de 2 s
$itemClawd.Add_Checked({ $config.clawd = $true; $passeio.modo = $null; SalvarConfig; Atualizar })
$itemClawd.Add_Unchecked({ $config.clawd = $false; SalvarConfig; Atualizar })
[void]$menu.Items.Add($itemClawd)

# opacidade
$painelOpac = New-Object Windows.Controls.StackPanel
$painelOpac.Orientation = 'Horizontal'
$painelOpac.Margin = [Windows.Thickness]::new(0, 2, 0, 2)
[void]$painelOpac.Children.Add((Texto 'Opacidade' '#D1D5DB' 70))
$slOpac = New-Object Windows.Controls.Slider
$slOpac.Minimum = 20; $slOpac.Maximum = 100; $slOpac.Value = $config.opacidade * 100
$slOpac.Width = 85; $slOpac.VerticalAlignment = 'Center'
$lblOpac = Texto ('{0}%' -f [int]($config.opacidade * 100)) '#9CA3AF' 32
$lblOpac.TextAlignment = 'Right'
$slOpac.Add_ValueChanged({
    $v = $slOpac.Value / 100
    $lblOpac.Text = '{0}%' -f [int]($slOpac.Value)
    $config.opacidade = [math]::Round($v, 2); $moldura.Opacity = $v; SalvarConfig
})
[void]$painelOpac.Children.Add($slOpac)
[void]$painelOpac.Children.Add($lblOpac)
[void]$menu.Items.Add($painelOpac)

# volume
$painelVol = New-Object Windows.Controls.StackPanel
$painelVol.Orientation = 'Horizontal'
$painelVol.Margin = [Windows.Thickness]::new(0, 2, 0, 2)
[void]$painelVol.Children.Add((Texto 'Volume' '#D1D5DB' 70))
$slVol = New-Object Windows.Controls.Slider
$slVol.Minimum = 0; $slVol.Maximum = 100; $slVol.Value = $config.volume * 100
$slVol.Width = 85; $slVol.VerticalAlignment = 'Center'
$lblVol = Texto ('{0}%' -f [int]($config.volume * 100)) '#9CA3AF' 32
$lblVol.TextAlignment = 'Right'
$slVol.Add_ValueChanged({
    $v = $slVol.Value / 100
    $lblVol.Text = '{0}%' -f [int]($slVol.Value)
    $config.volume = [math]::Round($v, 2); $tocador.Volume = $v; $tocadorDaCena.Volume = $v; SalvarConfig
})
[void]$painelVol.Children.Add($slVol)
[void]$painelVol.Children.Add($lblVol)
[void]$menu.Items.Add($painelVol)

$fechar = New-Object Windows.Controls.MenuItem
$fechar.Header = 'Fechar'
$fechar.Add_Click({ Anotar 'fechada pelo menu'; $win.Close() })
[void]$menu.Items.Add($fechar)
$win.ContextMenu = $menu
try { Add-Type -Namespace ClaudeMonitor -Name DWM -MemberDefinition '[DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr h, uint a, ref int v, uint s);' } catch {}
$menu.Add_Opened({
    try {
        $src = [Windows.PresentationSource]::FromVisual($fechar)
        if ($src -is [Windows.Interop.HwndSource]) {
            $v = -2  # 0xFFFFFFFE = DWMWA_COLOR_NONE: remove a borda branca do popup
            [ClaudeMonitor.DWM]::DwmSetWindowAttribute($src.Handle, 34, [ref]$v, 4)
        }
    } catch {}
})

# "sempre por cima" às vezes quebra: o Windows deixa janela normal passar na frente
# (visto 29/09: VS Code, Fotos e Opera na frente dela). Se tiver alguma, volta pro
# topo sem roubar o foco. Só quando quebrou: senão brigaria com o menu Iniciar,
# o recorte de tela e as outras "sempre por cima".
if (-not $Foto) {
    try {
        Add-Type -Namespace ClaudeMonitor -Name Topo -MemberDefinition @'
[DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
[DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
[DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr depois, int x, int y, int cx, int cy, uint f);
// devolve o pid da 1ª janela normal (de outro processo) acima desta, depois de voltar pro topo; 0 = nada na frente
public static uint Voltar(IntPtr h, uint eu) {
    for (IntPtr w = GetWindow(h, 3); w != IntPtr.Zero; w = GetWindow(w, 3)) {  // 3 = a de cima
        uint pid;
        GetWindowThreadProcessId(w, out pid);
        if (pid == eu || !IsWindowVisible(w) || (GetWindowLong(w, -20) & 0x8) != 0) continue;  // 0x8 = sempre por cima
        SetWindowPos(h, new IntPtr(-1), 0, 0, 0, 0, 0x13);  // -1 = topo; 0x13 = sem mover, redimensionar nem ativar
        return pid;
    }
    return 0;
}
'@
    } catch { Anotar "sem o conserto do sempre por cima: $_" }
}
function NoTopo {
    if (-not ('ClaudeMonitor.Topo' -as [type])) { return }
    $na = [ClaudeMonitor.Topo]::Voltar((New-Object Windows.Interop.WindowInteropHelper $win).Handle, $PID)
    if ($na) { Anotar "voltei pro topo: $((Get-Process -Id $na -ErrorAction Ignore).ProcessName) [$na] estava na frente" }
}

# a extensão trocou este arquivo por uma versão nova: solta a vaga e abre a nova
function SeAtualizou {
    if ($Foto) { return }
    $agora = (Get-Item -LiteralPath $PSCommandPath).LastWriteTimeUtc
    if ($agora -eq $versao) { return }
    $timer.Stop()
    try {
        # fecha o handle, não só solta: enquanto existir handle, a nova acha que já tem uma aberta
        $mutex.ReleaseMutex()
        $mutex.Dispose()
        $nova = Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Pasta', "`"$Pasta`""
        Anotar "arquivo mudou ($(Hora $versao) -> $(Hora $agora)): reabri como [$($nova.Id)]"
    } catch { Anotar "erro ao reabrir: $_"; throw }
    $win.Close()
}

$timer = New-Object Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromSeconds(2)
$timer.Add_Tick({ Atualizar; Recolocar; NoTopo; SeAtualizou })
$timer.Start()

# teste: depois de desenhar, salva o PNG e, ao lado (.txt), o que viu; e fecha
if ($Foto) {
    $espera = New-Object Windows.Threading.DispatcherTimer
    $espera.Interval = [TimeSpan]::FromMilliseconds(200)
    $esperando = @{ tiques = 0 }
    $espera.Add_Tick({
        # 1,2 s pra assentar; com o motor, até 8 s pelo 1º quadro (o node leva ~1 s pra abrir)
        $esperando.tiques++
        if ($esperando.tiques -lt 6) { return }
        if ($motor.obj -and -not $motor.vivo -and $motor.tentativas -lt 99 -and $esperando.tiques -lt 40) { MotorEstado; return }
        $espera.Stop()
        if ($Cena -and -not $motor.vivo) {
            $tipo, $t = -split $Cena
            ComecarCena $tipo
            $quadros.Stop()
            Quadro ([double]::Parse($t, [Globalization.CultureInfo]::InvariantCulture))
            $win.UpdateLayout()
        }
        $imagem = [Windows.Media.Imaging.RenderTargetBitmap]::new($win.Width, $win.Height, 96, 96, [Windows.Media.PixelFormats]::Pbgra32)
        $imagem.Render($win.Content)
        $png = New-Object Windows.Media.Imaging.PngBitmapEncoder
        $png.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($imagem))
        $arquivo = [IO.File]::Create($Foto)
        try { $png.Save($arquivo) } finally { $arquivo.Dispose() }
        # -Clicar: o meio da linha daquela sessão (ou do aviso, com "baixar"), pelo mesmo caminho do clique de verdade
        $linha = @(@($painelSessoes.Children) + @($painelAviso.Children) | Where-Object { "$($_.Tag)" -in "sessao:$Clicar", $Clicar })[0]
        if ($Clicar -and $linha) {
            $achou = AlvoNoPonto ($linha.TranslatePoint([Windows.Point]::new($linha.ActualWidth / 2, $linha.ActualHeight / 2), $win))
            if ($achou) { Clicar $achou }
        }
        $visto = @(Sessoes ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() / 1000) | ForEach-Object {
            "sessao: $($_.name) | hook=$($_.state) | janelinha=$($_.situacao)"
        }) + "clawd: $(if (-not $config.clawd) { 'desligado' } else { "$($passeio.modo)$(if ($luta.tipo) { " ($($luta.tipo))" })" })" + "usage: $(if ($uso.dados) { 'ok' } else { 'indisponivel' })" +
            "som: $(if ($somDaVez) { $nomeDoSom[$config.tema][$avisoDaSituacao[$somDaVez]] } else { 'nenhum' })" +
            "som da cena: $(if ($somDaCena) { $somDaCena } else { 'nenhum' })" +
            "clique: $(if ($cliqueDaVez) { $cliqueDaVez } else { 'nenhum' })" +
            "atualizacao: $(if ($n = VersaoNova) { $n } else { 'nenhuma' })"
        [IO.File]::WriteAllLines("$Foto.txt", [string[]]$visto, [Text.UTF8Encoding]::new($false))
        $win.Close()
    })
    $win.Add_ContentRendered({ $espera.Start() })
}

AplicarTema
Atualizar
LigarMotor
[void]$win.ShowDialog()
if ($motor.obj) { $motor.obj.Parar() }
Anotar "fechou ($($Error.Count) erros$(if ($Error.Count) { "; último: $($Error[0])" }))"
