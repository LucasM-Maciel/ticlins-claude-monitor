// Claude Monitor no Mac: a mesma janelinha do Windows (overlay.ps1) em Swift/AppKit.
// Sempre por cima, com as sessões do Claude Code (arquivos do hook em
// ~/.claude-monitor/sessions) e o usage (mesmo endpoint do /usage, com o login
// do Claude Code guardado no Keychain; só lê, nunca renova o token). O Clawd anda
// pela borda enquanto algo roda, pula parado em cima quando há pergunta/permissão e
// fica parado em cima quando nada roda.
// Temas (Padrão, Minecraft e Dragon Ball, no botão direito): o Clawd, as cenas e os
// enfeites do cartão vêm do motor das animações (motor/motor.js, o mesmo do Windows;
// docs/MOTOR.md), que desenha em software e manda os pixels. Sem node, ou com o motor
// caído, fica o Clawd daqui (picareta e lutas só no Minecraft) e o cartão de sempre;
// ele tenta de novo em 5 s, 30 s e 2 min.
// Sons e texturas do Minecraft vêm do servidor da Mojang (minecraft.js); sem
// eles, sons do Mac e os desenhos daqui.
// Clique numa sessão: abre ela no VS Code. Arrastar: botão esquerdo. Duplo clique:
// traz o VS Code. Botão direito: Temas, Clawd (liga/desliga), Opacidade, Volume e Fechar.
// Saiu versão nova (a extensão consulta o GitHub): linha roxa embaixo; o clique baixa o zip.
// A extensão compila isto (xcrun swiftc -swift-version 5 -O -o ClaudeMonitor
// overlay.swift) e abre; a trava em overlay.lock deixa uma só. Quando o binário
// muda (versão nova), ela se reabre sozinha. Diário em janelinha.log (o mesmo do Windows).
// Teste: ClaudeMonitor --foto arquivo.png desenha, salva o PNG (e, ao lado, um
// .txt com o que viu) e sai. Sem internet: o usage vem de --uso arquivo.json, se
// passar. --pasta troca a ~/.claude-monitor por outra. --clicar id clica na linha
// dessa sessão (o .txt diz o link que abriria). --cena "pedra 2.1" fotografa esse
// instante da cena (pedra ou bug), em segundos. --sem-motor desenha o Clawd daqui (o
// de antes do motor), como quando falta o node.
import Cocoa

let ambiente = ProcessInfo.processInfo.environment
let home = ambiente["HOME"] ?? NSHomeDirectory()
let argumentos = CommandLine.arguments
func argumento(_ nome: String) -> String? {
    if let i = argumentos.firstIndex(of: nome), i + 1 < argumentos.count { return argumentos[i + 1] }
    return nil
}
let arquivoFoto = argumento("--foto")
let pasta = argumento("--pasta") ?? home + "/.claude-monitor"
let dirSessoes = pasta + "/sessions"
let semMotor = argumentos.contains("--sem-motor")

try? FileManager.default.createDirectory(atPath: pasta, withIntermediateDirectories: true)
signal(SIGPIPE, SIG_IGN)  // escrever no motor que caiu dá erro na escrita, não derruba a janelinha

// diário em janelinha.log (o mesmo do Windows e da extensão): o motor, o tema, os sons.
// O --foto não anota: conta no stderr (o teste mostra quando falha).
let diario = pasta + "/janelinha.log"
let horaDoDiario: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
    return f
}()
func anotar(_ texto: String) {
    let limpo = texto.replacingOccurrences(of: "\\s*[\\r\\n]+\\s*", with: " ", options: .regularExpression)
    if arquivoFoto != nil { fputs(limpo + "\n", stderr); return }
    let fm = FileManager.default
    if let tamanho = (try? fm.attributesOfItem(atPath: diario))?[.size] as? NSNumber, tamanho.intValue > 256 * 1024 {
        try? fm.removeItem(atPath: diario + ".1")
        try? fm.moveItem(atPath: diario, toPath: diario + ".1")
    }
    let linha = Array("\(horaDoDiario.string(from: Date())) [\(getpid())] \(limpo)\n".utf8)
    let fd = open(diario, O_WRONLY | O_APPEND | O_CREAT | O_CLOEXEC, 0o644)
    if fd < 0 { return }
    _ = linha.withUnsafeBytes { (p: UnsafeRawBufferPointer) -> Int in Darwin.write(fd, p.baseAddress, p.count) }
    close(fd)
}

// botão direito: tema, Clawd, opacidade e volume, gravados em config.json (o Windows lê o mesmo).
// Sem o arquivo, tudo como antes do menu existir: Minecraft, Clawd ligado, opaco, volume
// cheio. Instalação nova já nasce com o Padrão (o instalador grava o tema).
let temas: [(id: String, nome: String)] = [("padrao", "Padrão"), ("minecraft", "Minecraft"), ("dragonball", "Dragon Ball")]
let arquivoConfig = pasta + "/config.json"
var config = (opacidade: 1.0, clawd: true, volume: 1.0, tema: "minecraft")
func lerJSON(_ caminho: String) -> [String: Any]? {
    guard let dados = FileManager.default.contents(atPath: caminho) else { return nil }
    return (try? JSONSerialization.jsonObject(with: dados)) as? [String: Any]
}
if let o = lerJSON(arquivoConfig) {
    if let v = (o["opacidade"] as? NSNumber)?.doubleValue { config.opacidade = min(1, max(0.2, v)) }
    if let v = o["clawd"] as? Bool { config.clawd = v }
    if let v = (o["volume"] as? NSNumber)?.doubleValue { config.volume = min(1, max(0, v)) }
    if let v = o["tema"] as? String, temas.contains(where: { $0.id == v }) { config.tema = v }
}
func salvarConfig() {
    // por cima do que já tinha: chave que esta versão não conhece continua lá
    var o = lerJSON(arquivoConfig) ?? [:]
    o["opacidade"] = config.opacidade
    o["clawd"] = config.clawd
    o["volume"] = config.volume
    o["tema"] = config.tema
    if let d = try? JSONSerialization.data(withJSONObject: o) { try? d.write(to: URL(fileURLWithPath: arquivoConfig)) }
}
func nomeDoTema() -> String { temas.first(where: { $0.id == config.tema })?.nome ?? config.tema }

// motor das animações (o resto mais embaixo, depois da janela)
var motor: Motor?                        // o processo aberto (vivo, ou ainda sem o 1º quadro)
var motorVivo = false                    // já mandou quadro: o Clawd e os enfeites são dele
var tentativasDoMotor = 0                // quedas seguidas; 99 = desistiu (sem node, sem motor.js)
var enviadoAoMotor = ""                  // o último estado (só manda quando muda)
var layouts: [String: Aparencia]? = nil  // o layout de cada tema (mensagem P)
var pediuFoto = false

if arquivoFoto == nil {
    // O_CLOEXEC: no execv da versão nova (e no node do motor) a trava solta junto
    let trava = open(pasta + "/overlay.lock", O_CREAT | O_RDWR | O_CLOEXEC, 0o644)
    if trava < 0 || flock(trava, LOCK_EX | LOCK_NB) != 0 { exit(0) }
}

func dataDoArquivo(_ caminho: String) -> Date? {
    (try? FileManager.default.attributesOfItem(atPath: caminho))?[.modificationDate] as? Date
}
let binario = Bundle.main.executablePath ?? argumentos[0]
let versao = dataDoArquivo(binario)

func hex(_ codigo: String) -> NSColor {
    var s = codigo.hasPrefix("#") ? String(codigo.dropFirst()) : codigo
    var alfa: CGFloat = 1
    if s.count == 8 {
        alfa = CGFloat(Int(s.prefix(2), radix: 16) ?? 255) / 255
        s = String(s.dropFirst(2))
    }
    let v = Int(s, radix: 16) ?? 0
    return NSColor(srgbRed: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255,
                   blue: CGFloat(v & 0xFF) / 255, alpha: alfa)
}

// situação da sessão (ver situacao) -> cor da bolinha e texto do tooltip
let estados: [String: (cor: String, rotulo: String)] = [
    "working": ("#22C55E", "trabalhando"),
    "finished": ("#EF4444", "terminou"),
    "question": ("#60A5FA", "pergunta pra você"),
    "permission": ("#FACC15", "pedindo permissão"),
]

// --- sons de cada aviso por tema; com mais de um, sorteia. Sem o arquivo, o do Mac.
// Minecraft: "hmm" do aldeão = pergunta/permissão, XP = terminou, subir de nível =
// terminou a última (nada rodando nem esperando). Os do Padrão (sons-padrao/) e do
// Dragon Ball (sons-dragonball/) a extensão copia junto com a janelinha.
let avisoDaSituacao = ["permission": "esperando", "question": "esperando", "finished": "terminou", "tudo": "tudo"]
let sonsDoTema: [String: [String: [String]]] = [
    "minecraft": ["esperando": ["sons/aldeao_hmm1", "sons/aldeao_hmm2"], "terminou": ["sons/xp1", "sons/xp2", "sons/xp3"],
                  "tudo": ["sons/levelup"]],
    "padrao": ["esperando": ["sons-padrao/esperando"], "terminou": ["sons-padrao/terminou"], "tudo": ["sons-padrao/tudo"]],
    "dragonball": ["esperando": ["sons-dragonball/esperando"], "terminou": ["sons-dragonball/terminou"],
                   "tudo": ["sons-dragonball/tudo"]],
]
let somDoMac = ["esperando": "Ping", "terminou": "Glass", "tudo": "Hero"]
let nomeDoSom: [String: [String: String]] = [  // pro diário e pro .txt do --foto
    "minecraft": ["esperando": "aldeao", "terminou": "xp", "tudo": "levelup"],
    "padrao": ["esperando": "sino-esperando", "terminou": "sino-terminou", "tudo": "sino-tudo"],
    "dragonball": ["esperando": "esferas-esperando", "terminou": "esferas-terminou", "tudo": "esferas-tudo"],
]
var tocando: NSSound?  // segura o som até acabar de tocar
func tocar(_ situacao: String) {
    guard let aviso = avisoDaSituacao[situacao] else { return }
    let nome = nomeDoSom[config.tema]?[aviso] ?? aviso
    // no diário: amigo sem som manda o janelinha.log e dá pra ver se ela tentou tocar
    guard config.volume > 0 else { anotar("não toquei \(nome): volume no 0 (botão direito > Volume)"); return }
    let arquivos = (sonsDoTema[config.tema]?[aviso] ?? []).map { pasta + "/" + $0 + ".wav" }
        .filter { FileManager.default.fileExists(atPath: $0) }
    var som: NSSound?
    var qual = ""
    if let arquivo = arquivos.randomElement() {
        som = NSSound(contentsOfFile: arquivo, byReference: true)
        qual = (arquivo as NSString).lastPathComponent
    }
    if som == nil, let doMac = somDoMac[aviso] {
        som = NSSound(named: NSSound.Name(doMac))
        qual = doMac + " do Mac"
    }
    tocando?.stop()
    tocando = som
    som?.volume = Float(config.volume)
    anotar(som?.play() == true ? "tocou \(nome) (\(qual))" : "não toquei \(nome) (\(qual))")
}
// o som das cenas épicas: o motor manda pronto (mensagem S, um .wav ou parar). Outro NSSound,
// pra não cortar nem ser cortado pelos avisos.
var somDaCena: NSSound?
var somDaCenaVisto: String?  // o último que o motor mandou (o --foto grava no .txt em vez de tocar)
func tocarSomDaCena(_ json: String) {
    guard let o = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any] else {
        anotar("motor: mensagem S com defeito: \(json)")
        return
    }
    if o["parar"] as? Bool == true {
        somDaCena?.stop()
        somDaCena = nil
        if arquivoFoto != nil { somDaCenaVisto = "parou" }
        return
    }
    guard let arquivo = o["tocar"] as? String else { return }
    let cena = o["cena"] as? String ?? "?"
    somDaCenaVisto = cena
    if arquivoFoto != nil { return }
    guard config.volume > 0 else { anotar("não toquei o som de \(cena): volume no 0 (botão direito > Volume)"); return }
    somDaCena?.stop()
    somDaCena = NSSound(contentsOfFile: arquivo, byReference: false)  // na memória: o motor regrava o arquivo depois
    somDaCena?.volume = Float(config.volume)
    anotar(somDaCena?.play() == true ? "tocou o som de \(cena)" : "não toquei o som de \(cena) (\(arquivo))")
}

// --- sessões (mesma regra da extensão e do overlay.ps1) ---
struct Sessao {
    var id: String
    var nome: String
    var estado: String
    var since: Double
    var updated: Double
    var pid: Int32?
    var transcript: String
    var situacao = ""
}

func numero(_ v: Any?) -> Double? { (v as? NSNumber)?.doubleValue }

func lerSessoes(agora: Double) -> [Sessao] {
    let fm = FileManager.default
    guard let arquivos = try? fm.contentsOfDirectory(atPath: dirSessoes) else { return [] }
    var vistas: [String: Sessao] = [:]
    for arquivo in arquivos where arquivo.hasSuffix(".json") {
        guard let dados = fm.contents(atPath: dirSessoes + "/" + arquivo),
              let d = (try? JSONSerialization.jsonObject(with: dados)) as? [String: Any] else { continue }
        let pid = numero(d["pid"]).flatMap { Int32(exactly: $0) }
        let updated = numero(d["updated"]) ?? 0
        // pid vivo; sem pid, atualizada nas últimas 6h
        if let p = pid, p > 0 {
            if kill(p, 0) != 0 && errno != EPERM { continue }
        } else if agora - updated > 6 * 3600 { continue }
        let id = String(arquivo.dropLast(5))
        let transcript = d["transcript"] as? String ?? ""
        let s = Sessao(id: id, nome: titulo(transcript) ?? (d["name"] as? String ?? "sessão"),
                       estado: d["state"] as? String ?? "waiting", since: numero(d["since"]) ?? updated,
                       updated: updated, pid: pid, transcript: transcript)
        let chave = pid.map { "pid:\($0)" } ?? "id:\(id)"
        if let v = vistas[chave], v.updated >= s.updated { continue }
        vistas[chave] = s
    }
    return vistas.values.map { s -> Sessao in
        var s = s
        s.situacao = situacao(s)
        return s
    }.sorted { $0.updated > $1.updated }
}

// Título da aba: o do /rename ("custom-title") ganha do automático ("ai-title").
// O hook só grava o nome quando você manda mensagem, e na 1ª ainda não existe
// título. Lê só o pedaço novo do transcript.
final class LeituraTitulo { var lido: UInt64 = 0; var custom: String?; var ai: String? }
var titulos: [String: LeituraTitulo] = [:]
let marcaAI = Data("\"type\":\"ai-title\"".utf8)
let marcaCustom = Data("\"type\":\"custom-title\"".utf8)
func titulo(_ transcript: String) -> String? {
    guard !transcript.isEmpty else { return nil }
    let t = titulos[transcript] ?? LeituraTitulo()
    titulos[transcript] = t
    guard let h = FileHandle(forReadingAtPath: transcript) else { return t.custom ?? t.ai }
    defer { h.closeFile() }
    let tamanho = h.seekToEndOfFile()
    if tamanho < t.lido { t.lido = 0; t.custom = nil; t.ai = nil }
    if tamanho > t.lido {
        h.seek(toFileOffset: t.lido)
        let dados = h.readData(ofLength: Int(tamanho - t.lido))
        if let fim = dados.lastIndex(of: 10) {  // não consome linha pela metade
            let completo = dados[dados.startIndex...fim]
            t.lido += UInt64(completo.count)
            for linha in completo.split(separator: 10) {
                guard linha.range(of: marcaAI) != nil || linha.range(of: marcaCustom) != nil,
                      let o = (try? JSONSerialization.jsonObject(with: Data(linha))) as? [String: Any] else { continue }
                if o["type"] as? String == "custom-title", let v = o["customTitle"] as? String, !v.isEmpty { t.custom = v }
                if o["type"] as? String == "ai-title", let v = o["aiTitle"] as? String, !v.isEmpty { t.ai = v }
            }
        }
    }
    return t.custom ?? t.ai
}

// O que a última mensagem da conversa pede: "caixa" (AskUserQuestion aberto),
// "texto" (resposta terminando em pergunta) ou nada. Lê só o fim do transcript,
// e só quando ele muda de tamanho.
final class LeituraPedido { var tamanho: UInt64 = 0; var resultado: String? }
var pedidos: [String: LeituraPedido] = [:]
func ultimoPedido(_ transcript: String) -> String? {
    guard !transcript.isEmpty, let h = FileHandle(forReadingAtPath: transcript) else { return nil }
    defer { h.closeFile() }
    let tamanho = h.seekToEndOfFile()
    if let c = pedidos[transcript], c.tamanho == tamanho { return c.resultado }
    let n = min(tamanho, 65536)
    h.seek(toFileOffset: tamanho - n)
    var linhas = h.readData(ofLength: Int(n)).split(separator: 10)
    if n < tamanho, !linhas.isEmpty { linhas.removeFirst() }  // leu do meio: a 1ª pode ter vindo pela metade
    var resultado: String?
    for linha in linhas.reversed() {
        guard let o = (try? JSONSerialization.jsonObject(with: Data(linha))) as? [String: Any] else { continue }
        let tipo = o["type"] as? String
        if tipo != "assistant" && tipo != "user" { continue }
        if o["isSidechain"] as? Bool == true { continue }
        if tipo == "assistant", let bloco = ((o["message"] as? [String: Any])?["content"] as? [[String: Any]])?.last {
            if bloco["type"] as? String == "tool_use" {
                if bloco["name"] as? String == "AskUserQuestion" { resultado = "caixa" }
            } else if bloco["type"] as? String == "text", let texto = bloco["text"] as? String {
                // "?" entre aspas ou crases é citação (fala de cliente, exemplo), não pergunta pra você
                let ultima = (texto.trimmingCharacters(in: .whitespacesAndNewlines).components(separatedBy: "\n").last ?? "")
                    .replacingOccurrences(of: "\"[^\"]*\"|“[^”]*”|`[^`]*`", with: "", options: .regularExpression)
                if ultima.contains("?") { resultado = "texto" }
            }
        }
        break
    }
    let c = LeituraPedido()
    c.tamanho = tamanho
    c.resultado = resultado
    pedidos[transcript] = c
    return resultado
}

// Situação a partir do estado do hook + última mensagem. Trabalhando/permissão só
// viram pergunta com a caixinha (texto com "?" no meio do trabalho não conta).
func situacao(_ s: Sessao) -> String {
    var estado = s.estado
    // depois de aprovar uma permissão nenhum hook dispara até a sessão parar; se o
    // transcript mexeu depois do pedido, ela voltou a trabalhar (regra da extensão)
    if estado == "permission", let m = dataDoArquivo(s.transcript), m.timeIntervalSince1970 > s.since + 2 {
        estado = "working"
    }
    let pedido = ultimoPedido(s.transcript)
    if estado == "working" || estado == "permission" { return pedido == "caixa" ? "question" : estado }
    return pedido != nil ? "question" : "finished"
}

// som quando alguma sessão MUDA de situação pra terminou/pergunta/permissão (uma
// vez por mudança; na abertura não toca). Se vierem juntas, o aldeão ganha do XP.
// Terminou a última (todas terminadas, nada rodando nem esperando): sobe de nível.
var ultimaSituacao: [String: String] = [:]
// teste: o --foto parte da situação anterior em antes.json, pra ver qual som tocaria
if arquivoFoto != nil, let dados = FileManager.default.contents(atPath: pasta + "/antes.json"),
   let antes = (try? JSONSerialization.jsonObject(with: dados)) as? [String: String] {
    ultimaSituacao = antes
}
var somDaVez: String?  // o último som decidido (o --foto grava no .txt em vez de tocar)
func avisar(_ sessoes: [Sessao]) {
    var tocar_: String?
    for s in sessoes {
        if let antes = ultimaSituacao[s.id], antes != s.situacao, estados[s.situacao] != nil, s.situacao != "working",
           tocar_ != "permission", tocar_ != "question" {
            tocar_ = s.situacao
        }
        ultimaSituacao[s.id] = s.situacao
    }
    if tocar_ == "finished", sessoes.allSatisfy({ $0.situacao == "finished" }) { tocar_ = "tudo" }
    guard let t = tocar_ else { return }
    // o tema comemora (no motor) na mesma hora em que o som toca
    if t == "finished" || t == "tudo" { motorEvento(t == "tudo" ? "tudo" : "terminou") }
    somDaVez = t
    if arquivoFoto == nil { tocar(t) }
}

func tempo(_ minutos: Double) -> String {
    guard minutos.isFinite else { return "" }
    let m = max(0, Int(minutos.rounded(.down)))
    if m < 1 { return "agora" }
    if m < 60 { return "\(m)m" }
    if m < 1440 { return "\(m / 60)h" + (m % 60 < 10 ? "0" : "") + "\(m % 60)" }
    return "\(m / 1440)d\((m % 1440) / 60)h"
}

// --- usage: o mesmo endpoint do /usage, a cada 2 min ---
struct Medida { let pct: Double; let renova: Date? }
var uso: [(rotulo: String, medida: Medida)]? = nil
var proximaBusca = Date.distantPast
var buscando = false
// quanto falta pra renovar
func faltaPraRenovar(_ m: Medida) -> String { m.renova.map { tempo($0.timeIntervalSinceNow / 60) } ?? "" }

func dataISO(_ texto: String?) -> Date? {
    guard var s = texto else { return nil }
    if let r = s.range(of: "\\.\\d+", options: .regularExpression) { s.removeSubrange(r) }  // fração de segundo
    return ISO8601DateFormatter().date(from: s)
}
func medida(_ v: Any?) -> Medida? {
    guard let o = v as? [String: Any], let pct = numero(o["utilization"]) else { return nil }
    return Medida(pct: pct, renova: dataISO(o["resets_at"] as? String))
}
// Login do Claude Code: no Mac fica no Keychain (item "Claude Code-credentials");
// em alguns casos, no arquivo ~/.claude/.credentials.json.
func token() -> String? {
    var dados = FileManager.default.contents(atPath: home + "/.claude/.credentials.json")
    if dados == nil {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/security")
        p.arguments = ["find-generic-password", "-s", "Claude Code-credentials", "-w"]
        let saida = Pipe()
        p.standardOutput = saida
        p.standardError = FileHandle.nullDevice
        do { try p.run() } catch { return nil }
        dados = saida.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        if p.terminationStatus != 0 { return nil }
    }
    guard let d = dados, let o = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] else { return nil }
    return (o["claudeAiOauth"] as? [String: Any])?["accessToken"] as? String
}
func usoDe(_ o: [String: Any]) -> [(rotulo: String, medida: Medida)]? {
    let pares: [(String, Medida?)] = [("5h", medida(o["five_hour"])), ("7d", medida(o["seven_day"]))]
    let medidas = pares.compactMap { par -> (rotulo: String, medida: Medida)? in
        guard let m = par.1 else { return nil }
        return (rotulo: par.0, medida: m)
    }
    return medidas.isEmpty ? nil : medidas
}
func buscarUso() {
    if arquivoFoto != nil {  // teste: nada de internet
        if uso == nil, let f = argumento("--uso"), let d = FileManager.default.contents(atPath: f),
           let o = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] { uso = usoDe(o) }
        return
    }
    if buscando || Date() < proximaBusca { return }
    buscando = true
    proximaBusca = Date().addingTimeInterval(20)  // se falhar, tenta de novo logo
    DispatchQueue.global().async {
        guard let tk = token(), let url = URL(string: "https://api.anthropic.com/api/oauth/usage") else {
            DispatchQueue.main.async { buscando = false }
            return
        }
        var req = URLRequest(url: url, timeoutInterval: 5)
        req.setValue("Bearer " + tk, forHTTPHeaderField: "Authorization")
        req.setValue("oauth-2025-04-20", forHTTPHeaderField: "anthropic-beta")
        URLSession.shared.dataTask(with: req) { dados, resposta, _ in
            let status = (resposta as? HTTPURLResponse)?.statusCode ?? 0
            let novo: [(rotulo: String, medida: Medida)]? = {
                guard status == 200, let d = dados,
                      let o = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] else { return nil }
                return usoDe(o)
            }()
            DispatchQueue.main.async {
                buscando = false
                if let n = novo {
                    uso = n
                    proximaBusca = Date().addingTimeInterval(120)
                } else if status == 429 {
                    proximaBusca = Date().addingTimeInterval(300)  // limite de requisições: espera mais
                }
            }
        }.resume()
    }
}

// clique numa sessão: a extensão recebe o link e abre a aba (ou o terminal) dela,
// como o clique na lista dela. Sem VS Code pra receber: só traz o editor.
var cliqueDaVez: String?  // o --foto grava no .txt em vez de abrir
let livresNaUrl = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")  // os do EscapeDataString do Windows
func abrirSessao(_ id: String) {
    let url = "vscode://local.claude-monitor/sessao?id=" + (id.addingPercentEncoding(withAllowedCharacters: livresNaUrl) ?? id)
    if arquivoFoto != nil { cliqueDaVez = url; return }
    if let u = URL(string: url), NSWorkspace.shared.open(u) { return }
    trazerEditor()
}

// versão nova: a extensão pergunta pro GitHub 1x por dia e grava a publicada em
// consulta-versao; a instalada está em versao-janelinha (o instalador grava)
func versaoNova() -> String? {
    func ler(_ nome: String) -> String? {
        (try? String(contentsOfFile: pasta + "/" + nome, encoding: .utf8))?.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    guard let publicada = ler("consulta-versao"), let instalada = ler("versao-janelinha"), !instalada.isEmpty,
          publicada.compare(instalada, options: .numeric) == .orderedDescending else { return nil }
    return publicada
}
// o mesmo zip do botão Baixar da extensão (com o COMO ATUALIZAR.txt dentro)
let zip = "https://github.com/LucasM-Maciel/ticlins-claude-monitor/releases/latest/download/ClaudeMonitor.zip"
func clicar(_ alvo: String) {
    if alvo.hasPrefix("sessao:") { abrirSessao(String(alvo.dropFirst(7))); return }
    guard alvo == "baixar" else { return }
    if arquivoFoto != nil { cliqueDaVez = zip; return }
    if let u = URL(string: zip) { NSWorkspace.shared.open(u) }
}

func trazerEditor() {
    for id in ["com.microsoft.VSCode", "com.microsoft.VSCodeInsiders", "com.todesktop.230313mzl4w4u92"]
    where !NSRunningApplication.runningApplications(withBundleIdentifier: id).isEmpty {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        p.arguments = ["-b", id]
        try? p.run()
        return
    }
}

// --- desenho ---
// janela fixa (a mesma do Windows: o motor desenha nela inteira); o resto é transparente e o clique passa
let L: CGFloat = 380, A: CGFloat = 440
let M: CGFloat = 34                      // espaço em volta do cartão, por onde o Clawd anda
let fonte = NSFont.systemFont(ofSize: 12)

func escrever(_ s: String, _ c: NSColor, _ r: NSRect, _ alinhamento: NSTextAlignment = .left) {
    let p = NSMutableParagraphStyle()
    p.lineBreakMode = .byTruncatingTail
    p.alignment = alinhamento
    let h = ceil(fonte.ascender - fonte.descender)
    (s as NSString).draw(in: NSRect(x: r.minX, y: r.minY + (r.height - h) / 2, width: r.width, height: h + 1),
                         withAttributes: [.font: fonte, .foregroundColor: c, .paragraphStyle: p])
}

final class Raiz: NSView {
    override var isFlipped: Bool { true }
}

// trabalhando: a bolinha verde pulsa, pra quem não distingue verde de vermelho (e pra
// não ler "verde = pronto"). Opacidade 0,65 + 0,35·cos(2π·fase), volta inteira em 1,6 s;
// o --foto fica na fase do --pulso (0 = acesa, 0.5 = o mais apagada).
func opacidadeDoPulso() -> CGFloat {
    let fase = arquivoFoto != nil ? Double(argumento("--pulso") ?? "0") ?? 0
        : Date().timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.6) / 1.6
    return CGFloat(0.65 + 0.35 * cos(2 * Double.pi * fase))
}

// cor do % do usage em cada tema, pro motor (o cartão daqui fica com as de sempre): normal, >= 80%, >= 95%
let coresDoUso: [String: [String]] = [
    "padrao": ["#D1D5DB", "#F59E0B", "#EF4444"], "minecraft": ["#80FF20", "#FFAA00", "#FF5555"],
    "dragonball": ["#FDE047", "#F59E0B", "#EF4444"],
]

// A cara do cartão: a de sempre ou, com o motor vivo, o layout do tema (mensagem P,
// docs/MOTOR.md). enfeites: o tema desenha bolinha, tempo, rótulo, barra, % e falta nos
// lugares que a janelinha guarda; o nome da sessão e os avisos continuam daqui.
struct Aparencia {
    var raio: CGFloat = 8
    var fundo = "#E6181818"
    var moldura: [CGFloat] = [0, 0, 0, 0]  // esq, cima, dir, baixo: livre pra moldura que o tema desenha
    var padding: [CGFloat] = [10, 6, 10, 6]
    var enfeites = false
    var colTempo: CGFloat = 36, colPct: CGFloat = 38, colFalta: CGFloat = 48, colRotulo: CGFloat = 18
    var letra: CGFloat = 16                // altura das caixas de número
    var barra = CGSize(width: 118, height: 4)
}
func aparencia(_ o: [String: Any]) -> Aparencia {
    func n(_ v: Any?) -> CGFloat? { (v as? NSNumber).map { CGFloat($0.doubleValue) } }
    func quatro(_ v: Any?) -> [CGFloat]? {
        guard let l = v as? [Any] else { return nil }
        let r = l.compactMap { n($0) }
        return r.count == 4 ? r : nil
    }
    var a = Aparencia()
    if let v = n(o["raio"]) { a.raio = v }
    if let v = o["fundo"] as? String { a.fundo = v }
    if let v = quatro(o["moldura"]) { a.moldura = v }
    if let v = quatro(o["padding"]) { a.padding = v }
    if let v = o["enfeites"] as? Bool { a.enfeites = v }
    if let c = o["colunas"] as? [String: Any] {
        if let v = n(c["tempo"]) { a.colTempo = v }
        if let v = n(c["pct"]) { a.colPct = v }
        if let v = n(c["falta"]) { a.colFalta = v }
        if let v = n(c["rotulo"]) { a.colRotulo = v }
    }
    if let v = n(o["letra"]) { a.letra = v }
    if let b = o["barra"] as? [Any], b.count == 2, let w = n(b[0]), let h = n(b[1]) { a.barra = CGSize(width: w, height: h) }
    return a
}
// Com o motor vivo (ou no --foto, que espera por ele), o cartão tem a moldura, o padding e
// as colunas do layout do tema, como o do Windows (que tem os do Minecraft em WPF);
// sem motor, o de sempre em todos os temas.
func aparenciaAtual() -> Aparencia {
    if let l = layouts, motorVivo || arquivoFoto != nil, let a = l[config.tema] { return a }
    return Aparencia()
}

// botão direito: os itens que mexem no config.json (o Fechar fica no Cartao)
final class Preferencias: NSObject {
    @objc func trocarTema(_ b: NSButton) {
        guard let i = temas.firstIndex(where: { $0.id == config.tema }) else { return }
        config.tema = temas[(i + b.tag + temas.count) % temas.count].id
        (b.superview?.viewWithTag(2) as? NSTextField)?.stringValue = nomeDoTema()
        salvarConfig()
        anotar("tema: \(config.tema)")
        if config.tema != "minecraft" { palco.luta = nil }  // as lutas daqui são só do Minecraft
        atualizar()
    }
    @objc func alternarClawd(_ item: NSMenuItem) {
        config.clawd.toggle()
        salvarConfig()
        aplicarConfig()
    }
    @objc func mudouOpacidade(_ s: NSSlider) {
        config.opacidade = s.doubleValue.rounded() / 100
        rotular(s)
        salvarConfig()
        aplicarConfig()
    }
    @objc func mudouVolume(_ s: NSSlider) {
        config.volume = s.doubleValue.rounded() / 100
        somDaCena?.volume = Float(config.volume)
        rotular(s)
        salvarConfig()
    }
    func rotular(_ s: NSSlider) { (s.superview?.viewWithTag(1) as? NSTextField)?.stringValue = "\(Int(s.doubleValue.rounded()))%" }
    // "Temas ◀ Minecraft ▶": setinhas são botões (e não itens) pro menu ficar aberto enquanto troca
    func itemDosTemas() -> NSMenuItem {
        let caixa = NSView(frame: NSRect(x: 0, y: 0, width: 230, height: 26))
        let rotulo = NSTextField(labelWithString: "Temas")
        rotulo.font = NSFont.menuFont(ofSize: 0)
        rotulo.frame = NSRect(x: 20, y: 4, width: 72, height: 18)
        caixa.addSubview(rotulo)
        let nome = NSTextField(labelWithString: nomeDoTema())
        nome.font = NSFont.systemFont(ofSize: 12, weight: .semibold)
        nome.alignment = .center
        nome.tag = 2
        nome.frame = NSRect(x: 112, y: 4, width: 86, height: 18)
        caixa.addSubview(nome)
        let setas: [(String, Int, CGFloat)] = [("◀", -1, 92), ("▶", 1, 198)]
        for (simbolo, direcao, x) in setas {
            let b = NSButton(title: simbolo, target: self, action: #selector(trocarTema(_:)))
            b.isBordered = false
            b.font = NSFont.menuFont(ofSize: 11)
            b.tag = direcao
            b.frame = NSRect(x: x, y: 4, width: 20, height: 18)
            caixa.addSubview(b)
        }
        let item = NSMenuItem()
        item.view = caixa
        return item
    }
    // "Opacidade ——o—— 90%": item de menu com um slider dentro
    func itemComSlider(_ nome: String, _ minimo: Double, _ valor: Double, _ acao: Selector) -> NSMenuItem {
        let caixa = NSView(frame: NSRect(x: 0, y: 0, width: 230, height: 26))
        let rotulo = NSTextField(labelWithString: nome)
        rotulo.font = NSFont.menuFont(ofSize: 0)
        rotulo.frame = NSRect(x: 20, y: 4, width: 72, height: 18)
        let slider = NSSlider(value: valor, minValue: minimo, maxValue: 100, target: self, action: acao)
        slider.controlSize = .small
        slider.isContinuous = true
        slider.frame = NSRect(x: 92, y: 3, width: 94, height: 20)
        let pct = NSTextField(labelWithString: "\(Int(valor.rounded()))%")
        pct.font = NSFont.menuFont(ofSize: 12)
        pct.textColor = .secondaryLabelColor
        pct.alignment = .right
        pct.tag = 1
        pct.frame = NSRect(x: 186, y: 4, width: 36, height: 18)
        for v in [rotulo, slider, pct] as [NSView] { caixa.addSubview(v) }
        let item = NSMenuItem()
        item.view = caixa
        return item
    }
}
let preferencias = Preferencias()

// uma linha da lista
struct LinhaDoCartao {
    var id: String
    var sit: String     // a situação (working, finished, question, permission...)
    var cor: String     // a da bolinha, '#RRGGBB'
    var nome: String
    var tempo: String
    var rotulo: String  // o tooltip
}

final class Cartao: NSView {
    var linhas: [LinhaDoCartao] = []
    var dicas: [NSString] = []  // o tooltip não segura o dono
    var aviso: String?  // saiu versão nova: a linha roxa embaixo
    // onde fica cada coisa (coordenadas do cartão, y pra baixo); refeito no arrumar
    var ap = Aparencia()
    var x0: CGFloat = 10, y0: CGFloat = 6, largura: CGFloat = 222  // começo e largura do conteúdo
    var alturaLinha: CGFloat = 20, alturaUso: CGFloat = 20
    var yUso: CGFloat = 0, yAviso: CGFloat = 0
    override var isFlipped: Bool { true }

    // preso no canto de baixo à direita, cresce pra cima
    func arrumar() {
        ap = aparenciaAtual()
        x0 = ap.moldura[0] + ap.padding[0]
        y0 = ap.moldura[1] + ap.padding[1]
        // a linha tem o nome (16) e, com enfeites, o lugar dos números do tema (letra)
        alturaLinha = max(16, ap.letra) + 4
        // a do usage: com enfeites só tem os lugares do motor; sem, o texto daqui (16)
        alturaUso = max(ap.enfeites ? CGFloat(0) : CGFloat(16), ap.letra, ap.barra.height) + 4
        largura = max(186 + ap.colTempo, ap.colRotulo + ap.barra.width + ap.colPct + ap.colFalta)
        yUso = y0 + (linhas.isEmpty ? 20 : CGFloat(linhas.count) * alturaLinha) + 10
        let alturaDoUso: CGFloat = uso.map { CGFloat($0.count) * self.alturaUso } ?? 20
        yAviso = yUso + alturaDoUso + 10
        let w = x0 + largura + ap.padding[2] + ap.moldura[2]
        let h = yAviso - 10 + (aviso == nil ? 0 : 10 + 20) + ap.padding[3] + ap.moldura[3]
        frame = NSRect(x: L - M - w, y: A - M - h, width: w, height: h)
        removeAllToolTips()
        dicas = linhas.map { $0.rotulo as NSString }
        for (i, d) in dicas.enumerated() {
            addToolTip(NSRect(x: 0, y: y0 + CGFloat(i) * alturaLinha, width: w, height: alturaLinha), owner: d, userData: nil)
        }
        if aviso != nil {
            dicas.append("Baixa o zip: extraia e siga o COMO ATUALIZAR.txt")
            addToolTip(NSRect(x: 0, y: yAviso, width: w, height: 20), owner: dicas[dicas.count - 1], userData: nil)
        }
        needsDisplay = true
    }

    override func draw(_ dirtyRect: NSRect) {
        // opacidade do botão direito: o cartão inteiro numa camada só (como o Opacity do
        // Windows); opaco, desenha direto como sempre
        let camada = config.opacidade < 1 ? NSGraphicsContext.current?.cgContext : nil
        camada?.saveGState()
        camada?.setAlpha(CGFloat(config.opacidade))
        camada?.beginTransparencyLayer(auxiliaryInfo: nil)
        defer {
            camada?.endTransparencyLayer()
            camada?.restoreGState()
        }
        // o fundo fica por dentro da moldura (a moldura quem desenha é o tema, no motor)
        let mo = ap.moldura
        let raio = max(0, ap.raio - (mo.max() ?? 0))
        hex(ap.fundo).setFill()
        NSBezierPath(roundedRect: NSRect(x: mo[0], y: mo[1], width: bounds.width - mo[0] - mo[2], height: bounds.height - mo[1] - mo[3]),
                     xRadius: raio, yRadius: raio).fill()
        var y = y0
        if linhas.isEmpty {
            escrever("nenhuma sessão aberta", hex("#9CA3AF"), NSRect(x: x0, y: y, width: largura, height: 20))
            y += 20
        }
        for l in linhas {
            let cor = hex(l.cor)
            if !ap.enfeites {  // com enfeites, a bolinha e o tempo são do motor
                (l.sit == "working" ? cor.withAlphaComponent(opacidadeDoPulso()) : cor).setFill()
                NSBezierPath(ovalIn: NSRect(x: x0, y: y + (alturaLinha - 8) / 2, width: 8, height: 8)).fill()
                escrever(l.tempo, cor, NSRect(x: x0 + 186, y: y, width: ap.colTempo, height: alturaLinha), .right)
            }
            escrever(l.nome, hex("#E5E7EB"), NSRect(x: x0 + 16, y: y, width: 170, height: alturaLinha))
            y += alturaLinha
        }
        y += 5
        hex("#33FFFFFF").setFill()
        NSRect(x: x0, y: y, width: largura, height: 1).fill()
        y += 5
        if let nova = aviso {
            hex("#33FFFFFF").setFill()
            NSRect(x: x0, y: yAviso - 5, width: largura, height: 1).fill()
            escrever("↑ versão \(nova) disponível · baixar", hex("#A78BFA"), NSRect(x: x0, y: yAviso, width: largura, height: 20))
        }
        guard let medidas = uso else {
            escrever("usage indisponível", hex("#6B7280"), NSRect(x: x0, y: y, width: largura, height: 20))
            return
        }
        if ap.enfeites { return }  // rótulo, barra, % e falta: o motor desenha
        let b = ap.barra
        let r = min(2, b.height / 2)
        for (rotulo, m) in medidas {
            let c = m.pct >= 95 ? hex("#EF4444") : m.pct >= 80 ? hex("#F59E0B") : hex("#D1D5DB")
            escrever(rotulo, hex("#9CA3AF"), NSRect(x: x0, y: y, width: ap.colRotulo, height: alturaUso))
            let trilho = NSRect(x: x0 + ap.colRotulo, y: y + (alturaUso - b.height) / 2, width: b.width, height: b.height)
            hex("#3F3F46").setFill()
            NSBezierPath(roundedRect: trilho, xRadius: r, yRadius: r).fill()
            c.setFill()
            let cheio = b.width * CGFloat(min(max(m.pct, 0), 100)) / 100
            NSBezierPath(roundedRect: NSRect(x: trilho.minX, y: trilho.minY, width: cheio, height: b.height), xRadius: r, yRadius: r).fill()
            escrever(String(format: "%.0f%%", m.pct), c, NSRect(x: trilho.maxX, y: y, width: ap.colPct, height: alturaUso), .right)
            escrever(faltaPraRenovar(m), hex("#6B7280"), NSRect(x: trilho.maxX + ap.colPct, y: y, width: ap.colFalta, height: alturaUso), .right)
            y += alturaUso
        }
    }

    // --- o que o motor precisa saber (docs/MOTOR.md): onde ficou cada coisa, na janela ---
    // [x, y, w, h] em DIPs com y pra baixo a partir do canto de cima à esquerda da janela
    func naJanela(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> [Double] {
        [x + frame.minX, y + frame.minY, w, h].map { (Double($0) * 100).rounded() / 100 }
    }
    func texto(_ txt: String, _ cor: String, _ caixa: [Double]) -> [String: Any] { ["txt": txt, "cor": cor, "caixa": caixa] }
    // a bolinha e o tempo (encostado à direita da caixa) de cada sessão
    func caixasDasLinhas() -> [[String: Any]] {
        var r: [[String: Any]] = []
        for (i, l) in linhas.enumerated() {
            let ly = y0 + CGFloat(i) * alturaLinha
            let linha: [String: Any] = [
                "id": l.id, "sit": l.sit, "cor": l.cor,
                "bola": naJanela(x0, ly + (alturaLinha - 8) / 2, 8, 8),
                "tempo": texto(l.tempo, l.cor, naJanela(x0 + 186, ly + (alturaLinha - ap.letra) / 2, ap.colTempo, ap.letra)),
            ]
            r.append(linha)
        }
        return r
    }
    // as barras do usage; [] = indisponível (quem escreve isso é a janelinha)
    func caixasDoUso() -> [[String: Any]] {
        guard let medidas = uso else { return [] }
        let cores = coresDoUso[config.tema] ?? ["#D1D5DB", "#F59E0B", "#EF4444"]
        var r: [[String: Any]] = []
        for (j, par) in medidas.enumerated() {
            let m = par.medida
            let uy = yUso + CGFloat(j) * alturaUso
            let yl = uy + (alturaUso - ap.letra) / 2
            let nivel = m.pct >= 95 ? 2 : m.pct >= 80 ? 1 : 0
            let xb = x0 + ap.colRotulo, xp = xb + ap.barra.width, xf = xp + ap.colPct
            let medidor: [String: Any] = [
                "rotulo": texto(par.rotulo, "#9CA3AF", naJanela(x0, yl, ap.colRotulo, ap.letra)),
                "barra": naJanela(xb, uy + (alturaUso - ap.barra.height) / 2, ap.barra.width, ap.barra.height),
                "pct": m.pct, "nivel": nivel,
                "pctTxt": texto(String(format: "%.0f%%", m.pct), cores[nivel], naJanela(xp, yl, ap.colPct, ap.letra)),
                "falta": texto(faltaPraRenovar(m), "#6B7280", naJanela(xf, yl, ap.colFalta, ap.letra)),
            ]
            r.append(medidor)
        }
        return r
    }

    // a linha nesse ponto (coordenadas do cartão: sessões a partir de y0, o aviso em
    // yAviso): "sessao:<id>" ou "baixar", como o Tag do Windows
    func alvoNoPonto(_ p: NSPoint) -> String? {
        guard bounds.contains(p), p.y >= y0 else { return nil }
        if aviso != nil, p.y >= yAviso, p.y < yAviso + 20 { return "baixar" }
        let i = Int((p.y - y0) / alturaLinha)
        return i < linhas.count ? "sessao:" + linhas[i].id : nil
    }

    // arrasto na mão (o performDrag deixa o arrasto com o sistema e aí não dá pra
    // saber se foi só um clique): andou menos de 3 pontos = clique
    var inicioMouse = NSPoint.zero, inicioJanela = NSPoint.zero
    var alvoClicado: String?
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func mouseDown(with event: NSEvent) {
        alvoClicado = nil
        if event.clickCount == 2 { trazerEditor(); return }
        inicioMouse = NSEvent.mouseLocation
        inicioJanela = window?.frame.origin ?? .zero
        // já na descida: durante o arrasto a lista pode se redesenhar
        alvoClicado = alvoNoPonto(convert(event.locationInWindow, from: nil))
    }
    override func mouseDragged(with event: NSEvent) {
        let m = NSEvent.mouseLocation
        window?.setFrameOrigin(NSPoint(x: inicioJanela.x + m.x - inicioMouse.x, y: inicioJanela.y + m.y - inicioMouse.y))
    }
    override func mouseUp(with event: NSEvent) {
        let m = NSEvent.mouseLocation
        if let alvo = alvoClicado, hypot(m.x - inicioMouse.x, m.y - inicioMouse.y) < 3 { clicar(alvo) }
        alvoClicado = nil
    }
    override func rightMouseDown(with event: NSEvent) {
        let menu = NSMenu()
        menu.addItem(preferencias.itemDosTemas())
        let clawd = NSMenuItem(title: "Clawd", action: #selector(Preferencias.alternarClawd(_:)), keyEquivalent: "")
        clawd.target = preferencias
        clawd.state = config.clawd ? .on : .off
        menu.addItem(clawd)
        menu.addItem(preferencias.itemComSlider("Opacidade", 20, config.opacidade * 100, #selector(Preferencias.mudouOpacidade(_:))))
        menu.addItem(preferencias.itemComSlider("Volume", 0, config.volume * 100, #selector(Preferencias.mudouVolume(_:))))
        menu.addItem(.separator())
        let fechar = NSMenuItem(title: "Fechar", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "")
        fechar.target = NSApp
        menu.addItem(fechar)
        NSMenu.popUpContextMenu(menu, with: event, for: self)
    }
}

// --- Clawd: pixel art do mascote do Claude Code (o do banner do terminal) ---
// O daqui só aparece sem o motor (sem node, ou com ele caído).
// '#' corpo, 'o' olho, 'A'/'B' os dois pares de pernas, que se alternam.
// Origem (0,0) = entre os pés, então ele "pisa" na trilha e o corpo fica pra fora.
// Pixel 2x mais alto que largo, como os meio-blocos do terminal (senão fica achatado).
let sprite = [
    "...############...",
    "...##o######o##...",
    ".################.",
    "...############...",
    "....A.B....A.B....",
]
let pw: CGFloat = 1.5, ph: CGFloat = 3

// Sem Minecraft: 16x16 desenhados aqui, com o cabo no mesmo pixel das texturas
// do jogo. d/c/b = diamante (contorno, cor, brilho); k/h = cabo; s/e/l = pedra
// (cor, escuro, claro). O bug é sempre daqui (o Minecraft não tem um que sirva).
let cores16: [(Character, String)] = [("d", "#1B6E73"), ("c", "#4AEDD9"), ("b", "#C9FFF6"), ("k", "#3B2A14"),
                                      ("h", "#8A5A2B"), ("s", "#7D7D7D"), ("e", "#5E5E5E"), ("l", "#A0A0A0")]
let desenhos: [String: [String]] = [
    "picareta": [
        "................",
        "....ddddd.......",
        "...dbbcccdd.....",
        "....dddcccbd....",
        ".......ddcccd...",
        ".........dccd...",
        "........kdcbcd..",
        ".......khkdccd..",
        "......khk..dcd..",
        ".....khk...dcd..",
        "....khk.....dd..",
        "...khk..........",
        "..khk...........",
        "..kk............",
        "................",
        "................",
    ],
    "espada": [
        "................",
        "............ddd.",
        "...........dbcd.",
        "..........dbcd..",
        ".........dbcd...",
        "........dbcd....",
        ".......dbcd.....",
        "......dbcd......",
        "..dd.dbcd.......",
        "..dcdbcd........",
        "...dccd.........",
        "...kdcdd........",
        "..khkddcd.......",
        ".khk...dd.......",
        ".kk.............",
        "................",
    ],
    "diamante": [
        "................",
        "................",
        "....dddddddd....",
        "...dbbcccccbd...",
        "..dbbccccccccd..",
        "..dccccccccccd..",
        "...dcccccccbd...",
        "....dccccccd....",
        ".....dccccd.....",
        "......dccd......",
        ".......dd.......",
        "................",
        "................",
        "................",
        "................",
        "................",
    ],
    "pedra": [
        "ssslssssesssslss",
        "sesssssssslsssse",
        "sssbcssesssssbcs",
        "lsdccdsssssesdcd",
        "ssssdsslssssssds",
        "sesssssssbcsssss",
        "ssslsssesdccdsls",
        "ssssssssssdsssss",
        "sbcsslssssssesss",
        "dccdsssssslssbcs",
        "sdsssesssssssdcc",
        "ssssssssbcssssds",
        "slssssesdccdslss",
        "sssesssssdssssss",
        "ssssslsssssssess",
        "esssssssslssssss",
    ],
]
// de lado, olhando pra esquerda (pro Clawd); p/q = as pernas, que se alternam
let bugLinhas = [
    "a............",
    ".a...vvvvv...",
    "..a.vwwvvvvv.",
    ".aaavwvvxvvvv",
    "aoaavvvvvxvvv",
    ".aaaavvvvvxv.",
    "..pq..pq..pq.",
    ".p..qp..qp..q",
]
let coresBug: [(Character, String)] = [("v", "#65A30D"), ("w", "#A3E635"), ("x", "#365314"), ("a", "#111827"),
                                       ("o", "#F8FAFC"), ("p", "#111827"), ("q", "#111827")]
let coresBugVermelho: [(Character, String)] = [("v", "#EF4444"), ("w", "#FCA5A5"), ("x", "#991B1B"), ("a", "#450A0A"),
                                               ("o", "#FEE2E2"), ("p", "#450A0A"), ("q", "#450A0A")]  // levou o golpe

// retângulos de mesma cor num caminho só: pixels vizinhos sem risco entre eles
func forma(_ linhas: [String], _ largura: CGFloat, _ altura: CGFloat, _ dx: CGFloat, _ dy: CGFloat,
           _ pega: (Character) -> Bool) -> CGPath {
    let caminho = CGMutablePath()
    for (lin, linha) in linhas.enumerated() {
        let cs = Array(linha)
        var col = 0
        while col < cs.count {
            if !pega(cs[col]) { col += 1; continue }
            var fim = col
            while fim + 1 < cs.count && pega(cs[fim + 1]) { fim += 1 }
            caminho.addRect(CGRect(x: (CGFloat(col) + dx) * largura, y: (CGFloat(lin) + dy) * altura,
                                   width: CGFloat(fim - col + 1) * largura, height: altura))
            col = fim + 1
        }
    }
    return caminho
}
let corpo = forma(sprite, pw, ph, -9, -5) { $0 == "#" || $0 == "o" }
let olhos = forma(sprite, pw, ph, -9, -5) { $0 == "o" }
let pernaA = forma(sprite, pw, ph, -9, -5) { $0 == "A" }
let pernaB = forma(sprite, pw, ph, -9, -5) { $0 == "B" }
// desenho em 1 px por pixel; quem pinta escala
typealias Desenho = [(CGPath, NSColor)]
func desenho(_ linhas: [String], _ cores: [(Character, String)]) -> Desenho {
    cores.map { par -> (CGPath, NSColor) in (forma(linhas, 1, 1, 0, 0, { $0 == par.0 }), hex(par.1)) }
}
let desenhosProntos = desenhos.mapValues { desenho($0, cores16) }
func bug(_ perna: Character, _ cores: [(Character, String)]) -> Desenho {
    let outra: Character = perna == "p" ? "q" : "p"
    return desenho(bugLinhas.map { String($0.map { $0 == outra ? "." : $0 }) }, cores)
}
let bugs: [String: Desenho] = ["p": bug("p", coresBug), "q": bug("q", coresBug),
                               "p!": bug("p", coresBugVermelho), "q!": bug("q", coresBugVermelho)]
// textura do Minecraft (minecraft.js), se tiver; senão, o desenho daqui
var texturas: [String: NSImage] = [:]
for nome in desenhos.keys { texturas[nome] = NSImage(contentsOfFile: pasta + "/\(nome).png") }
func pintar(_ ctx: CGContext, _ d: Desenho, _ r: CGRect, _ grade: CGSize) {
    ctx.saveGState()
    ctx.translateBy(x: r.minX, y: r.minY)
    ctx.scaleBy(x: r.width / grade.width, y: r.height / grade.height)
    ctx.setShouldAntialias(false)
    for (caminho, cor) in d {
        ctx.addPath(caminho)
        ctx.setFillColor(cor.cgColor)
        ctx.fillPath()
    }
    ctx.restoreGState()
}
func pintar(_ ctx: CGContext, _ nome: String, _ r: CGRect) {
    if let img = texturas[nome] {
        NSGraphicsContext.current?.imageInterpolation = .none
        img.draw(in: r, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
    } else if let d = desenhosProntos[nome] {
        pintar(ctx, d, r, CGSize(width: 16, height: 16))
    }
}
let cabo = CGPoint(x: 2.75, y: 14.85)  // pixel (2,5; 13,5) da textura, em 1,1 por pixel
let mao = CGPoint(x: 12, y: -7.5)       // ponta do braço direito do Clawd

// --- Cenas: de vez em quando, andando, ele para e luta (igual ao overlay.ps1) ---
// picareta: aparece uma pedra de diamante na frente, ele bate 3x, ela vira farelo
// e sobe um diamante. espada: chega um bug, 3 espadadas, o bug vira fumaça. A
// ferramenta é sorteada cada vez que ele começa a andar. Tudo no referencial de
// quem anda (x+ = pra frente, y- = pra fora do cartão), em função do tempo, então
// o --foto fotografa qualquer instante (--cena "pedra 2.1"). Só no tema Minecraft.
// em segundos: o alvo chega, leva 3 golpes (o 3º mata) e a cena acaba em "fim"
let roteiros: [String: (chega: CGFloat, golpe: CGFloat, fim: CGFloat)] = ["pedra": (0.3, 0.5, 3.2), "bug": (1.0, 0.45, 2.9)]
let voos: [(CGFloat, CGFloat)] = [(-30, -60), (-12, -80), (10, -75), (28, -55), (-22, -30), (20, -35), (0, -90), (34, -20)]  // px/s
let coresFarelo = ["pedra": ["#7D7D7D", "#4AEDD9", "#A0A0A0", "#5E5E5E"], "bug": ["#E5E7EB", "#9CA3AF"]]
// ângulo da ferramenta num golpe (u de 0 a 1): levanta devagar, desce rápido
func golpe(_ u: CGFloat) -> CGFloat { u < 0.7 ? -40 * u / 0.7 : -40 + 110 * (u - 0.7) / 0.3 }
// no instante t da cena: ângulo da ferramenta, s desde o último golpe e s desde que o alvo morreu
func momento(_ tipo: String, _ t: CGFloat) -> (angulo: CGFloat, acerto: CGFloat, morto: CGFloat) {
    let r = roteiros[tipo]!
    let morre = r.chega + 3 * r.golpe
    let g = (t - r.chega) / r.golpe
    return (g >= 0 && g < 3 ? golpe(g.truncatingRemainder(dividingBy: 1)) : 0,
            g >= 1 && t < morre ? g.truncatingRemainder(dividingBy: 1) * r.golpe : 99, t - morre)
}
// a pedra (brota do chão, treme no golpe) ou o bug (chega andando, recua e fica vermelho no golpe)
func pintarAlvo(_ ctx: CGContext, _ tipo: String, _ t: CGFloat) {
    let (_, acerto, morto) = momento(tipo, t)
    guard morto < 0 else { return }
    let r = roteiros[tipo]!
    if tipo == "pedra" {
        let s = min(1, t / r.chega)
        pintar(ctx, "pedra", CGRect(x: 16 + (acerto < 0.1 ? 1 : 0), y: -12 * s, width: 12, height: 12 * s))
    } else {
        let x = t < r.chega ? 42 - 25 * t / r.chega : 17 + (acerto < 0.15 ? 2 : 0)
        let perna = Int(floor(t / 0.1)) % 2 == 1 ? "q" : "p"
        pintar(ctx, bugs[perna + (acerto < 0.15 ? "!" : "")]!, CGRect(x: x, y: -12.8, width: 13 * 1.6, height: 8 * 1.6),
               CGSize(width: 13, height: 8))
    }
}
// farelos da pedra (caem) ou fumaça do bug (nasce em roda, sobe e cresce), por 0,6 s; e o diamante sobe e some
func pintarRestos(_ ctx: CGContext, _ tipo: String, _ t: CGFloat) {
    let d = momento(tipo, t).morto
    guard d >= 0 else { return }
    if d < 0.6 {
        let cores = coresFarelo[tipo]!
        for (i, v) in voos.enumerated() {
            let q: CGRect
            if tipo == "pedra" {
                q = CGRect(x: 22 + v.0 * d, y: -6 + v.1 * d + 150 * d * d, width: 2, height: 2)
            } else {
                let l = 3 + 5 * d
                q = CGRect(x: 27.4 + v.0 * (0.06 + d * 0.3) - l / 2, y: -6.4 + v.1 * (0.06 + d * 0.2) - 10 * d - l / 2, width: l, height: l)
            }
            ctx.setFillColor(hex(cores[i % cores.count]).withAlphaComponent(1 - d / 0.6).cgColor)
            ctx.fill(q)
        }
    }
    if tipo == "pedra" {
        let s = min(1, d / 0.6)
        ctx.saveGState()
        ctx.setAlpha(d < 1 ? 1 : max(0, 1 - (d - 1) / 0.4))
        pintar(ctx, "diamante", CGRect(x: 16.5, y: -11.5 - 16 * (1 - (1 - s) * (1 - s)) + sin(d * 7) * 0.8, width: 11, height: 11))
        ctx.restoreGState()
    }
}

// Trilha = borda arredondada do cartão, no sentido horário; o Clawd gira junto
// nas curvas. Fora do modo "andando" ele fica parado no meio da borda de cima.
final class Palco: NSView {
    weak var cartao: Cartao?
    var modo = ""
    var fracao: CGFloat = 0  // onde ele está na volta (0-1); sobrevive ao cartão mudar de tamanho
    var antes = ProcessInfo.processInfo.systemUptime
    var ferramenta = "picareta"
    var luta: String?  // "pedra" ou "bug" enquanto luta, parado
    var lutaDesde: TimeInterval = 0
    var proxima: TimeInterval = .infinity
    var instante: CGFloat?  // --foto --cena: o instante fixo da cena
    override var isFlipped: Bool { true }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    // "andando" (algo rodando): anda, pula, troca de perna e minera (e às vezes luta).
    // "pulando" (pergunta/permissão): parado em cima do cartão, pulando.
    // "parado" (nada rodando): parado em cima do cartão, com as 4 pernas no chão.
    func mudar(_ novo: String) {
        if novo == modo { return }
        luta = nil  // mudou no meio da luta
        if novo == "andando" {
            if let c = cartao?.frame { fracao = (c.width / 2 - 8) / perimetro(c) }  // sai do meio de cima
            if arquivoFoto == nil {  // a foto fica sempre na picareta
                ferramenta = Bool.random() ? "picareta" : "espada"
                proxima = ProcessInfo.processInfo.systemUptime + .random(in: 20...45)
            }
        }
        modo = novo
        needsDisplay = true
    }
    // --cena "pedra 2.1": aquele instante da cena (só no --foto)
    func fotografar(_ cena: String) {
        let partes = cena.split(separator: " ")
        guard partes.count == 2, let t = Double(partes[1]) else { return }
        luta = String(partes[0])
        ferramenta = luta == "bug" ? "espada" : "picareta"
        instante = CGFloat(t)
    }

    func perimetro(_ c: NSRect) -> CGFloat { 2 * (c.width + c.height) - (8 - 2 * .pi) * 8 }

    // ponto e direção a uma distância d do começo da borda de cima (y pra baixo)
    func naBorda(_ c: NSRect, _ distancia: CGFloat) -> (CGPoint, CGFloat) {
        let r: CGFloat = 8
        let reta = c.width - 2 * r, lado = c.height - 2 * r, curva = CGFloat.pi * r / 2
        let trechos: [CGFloat] = [reta, curva, lado, curva, reta, curva, lado, curva]
        var d = distancia
        var i = 0
        while i < 7 && d > trechos[i] {
            d -= trechos[i]
            i += 1
        }
        switch i {
        case 0: return (CGPoint(x: c.minX + r + d, y: c.minY), 0)
        case 1: return arco(CGPoint(x: c.maxX - r, y: c.minY + r), -.pi / 2, d / r)
        case 2: return (CGPoint(x: c.maxX, y: c.minY + r + d), .pi / 2)
        case 3: return arco(CGPoint(x: c.maxX - r, y: c.maxY - r), 0, d / r)
        case 4: return (CGPoint(x: c.maxX - r - d, y: c.maxY), .pi)
        case 5: return arco(CGPoint(x: c.minX + r, y: c.maxY - r), .pi / 2, d / r)
        case 6: return (CGPoint(x: c.minX, y: c.maxY - r - d), -.pi / 2)
        default: return arco(CGPoint(x: c.minX + r, y: c.minY + r), .pi, d / r)
        }
    }
    func arco(_ centro: CGPoint, _ inicio: CGFloat, _ andou: CGFloat) -> (CGPoint, CGFloat) {
        let a = inicio + andou
        return (CGPoint(x: centro.x + 8 * cos(a), y: centro.y + 8 * sin(a)), a + .pi / 2)
    }

    func tique() {
        let agora = ProcessInfo.processInfo.systemUptime
        let dt = CGFloat(min(agora - antes, 0.1))
        antes = agora
        // com o motor vivo este Clawd fica escondido e parado (nada de luta escondida)
        guard !motorVivo, modo != "parado", let c = cartao?.frame, c.width > 0 else { return }
        if modo == "andando" && instante == nil {
            if let tipo = luta {
                if CGFloat(agora - lutaDesde) >= roteiros[tipo]!.fim {  // acabou: volta a andar de onde parou
                    luta = nil
                    proxima = agora + .random(in: 20...45)
                }
            } else if agora >= proxima && config.tema == "minecraft" {  // picareta, pedra e bug são do Minecraft
                luta = ferramenta == "espada" ? "bug" : "pedra"
                lutaDesde = agora
            } else {
                fracao += 50 * dt / perimetro(c)  // ~50 px/s
                fracao -= fracao.rounded(.down)
            }
        }
        needsDisplay = true
    }

    override func draw(_ dirtyRect: NSRect) {
        guard let c = cartao?.frame, c.width > 0, let ctx = NSGraphicsContext.current?.cgContext else { return }
        let t = ProcessInfo.processInfo.systemUptime
        var (ponto, angulo) = (CGPoint(x: c.midX, y: c.minY), CGFloat(0))
        if modo == "andando" { (ponto, angulo) = naBorda(c, fracao * perimetro(c)) }
        ctx.saveGState()
        ctx.translateBy(x: ponto.x, y: ponto.y)
        ctx.rotate(by: angulo)
        // lutando: parado, sem pulo, as 4 pernas no chão e a ferramenta golpeando
        let cena = luta.map { ($0, instante ?? CGFloat(t - lutaDesde)) }
        if let c = cena { pintarAlvo(ctx, c.0, c.1) }  // atrás da ferramenta, que bate por cima
        ctx.saveGState()
        if modo != "parado" && cena == nil {
            // pulinhos: sobe rápido e desacelera no alto; a volta acelera
            let u = t.truncatingRemainder(dividingBy: 0.32) / 0.16
            let p = CGFloat(u <= 1 ? u : 2 - u)
            ctx.translateBy(x: 0, y: -5 * (1 - (1 - p) * (1 - p)))
        }
        for (caminho, cor) in [(corpo, hex("#D77757")), (olhos, hex("#1A1A1A"))] {
            ctx.addPath(caminho)
            ctx.setFillColor(cor.cgColor)
            ctx.fillPath()
        }
        // andando troca de perna a cada meio pulo; parado ou lutando, as 4 no chão
        let passo = Int(t / 0.16) % 2 == 0
        let anda = modo == "andando" && cena == nil
        ctx.setFillColor(hex("#D77757").cgColor)
        if !anda || passo { ctx.addPath(pernaA) }
        if !anda || !passo { ctx.addPath(pernaB) }
        ctx.fillPath()

        // ferramenta na mão direita; andando, balança como quem minera. O Padrão e o
        // Dragon Ball não têm ferramenta (como no Windows)
        if config.tema == "minecraft" {
            ctx.translateBy(x: mao.x, y: mao.y)
            if let c = cena {
                ctx.rotate(by: momento(c.0, c.1).angulo * .pi / 180)
            } else if anda {
                let u = t.truncatingRemainder(dividingBy: 0.64) / 0.32
                let p = u <= 1 ? u : 2 - u
                ctx.rotate(by: CGFloat(-25 + 40 * sin(p * .pi / 2)) * .pi / 180)
            }
            ctx.translateBy(x: -cabo.x, y: -cabo.y)
            pintar(ctx, ferramenta, CGRect(x: 0, y: 0, width: 17.6, height: 17.6))
        }
        ctx.restoreGState()
        if let c = cena { pintarRestos(ctx, c.0, c.1) }
        ctx.restoreGState()
    }
}

// --- Motor das animações (motor/motor.js, o mesmo código do Windows; docs/MOTOR.md) ---
// Lado Mac (o Motor.cs do Windows): abre o node, manda o estado da janelinha (uma linha
// JSON por mensagem) e guarda os quadros que voltam ("CM" + tipo + 0 + tamanho uint32 LE
// + dados). Ler e escrever ficam em threads próprias: a janela nunca espera o motor. Os
// avisos (ao...) chegam na thread da janela.
final class Motor {
    static let srgb: CGColorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
    // BGRA pré-multiplicado, como o motor manda
    static let bgra = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)

    let alvo: PalcoDoMotor
    let proc = Process()
    let entrada = Pipe(), saida = Pipe(), erros = Pipe()
    let fila = DispatchQueue(label: "motor-escrever")
    let fimDaLeitura = DispatchSemaphore(value: 0)
    let trava = NSLock()
    // com a trava (a thread que lê escreve, a janela lê)
    var buf: [UInt8] = []  // o quadro inteiro, W x H
    var W = 0, H = 0
    var sujoX0 = Int.max, sujoY0 = Int.max, sujoX1 = 0, sujoY1 = 0
    var pendente = false  // a janela ainda não viu o último pedaço sujo
    var quadros = 0
    var naFila = 0        // mensagens esperando pra ir
    // só na thread da janela
    var vivo = false
    var pronto = ""       // o JSON da mensagem P
    var aplicadoW = 0, aplicadoH = 0
    var aoLinha: ((String) -> Void)?   // uma linha pro diário
    var aoPronto: (() -> Void)?        // chegou a mensagem P: o layout de cada tema
    var aoPrimeiro: (() -> Void)?      // chegou o 1º quadro
    var aoSair: ((Int32) -> Void)?     // o processo saiu (depois de tudo que ele mandou)
    var aoSom: ((String) -> Void)?     // mensagem S: o JSON do som da cena épica

    init(alvo: PalcoDoMotor) { self.alvo = alvo }

    // node: o node; comoNode: é o executável do VS Code (Electron), que só vira node com
    // ELECTRON_RUN_AS_NODE=1
    func iniciar(_ node: String, _ comoNode: Bool, _ argumentos: [String]) throws {
        proc.executableURL = URL(fileURLWithPath: node)
        proc.arguments = argumentos
        var env = ProcessInfo.processInfo.environment
        if comoNode { env["ELECTRON_RUN_AS_NODE"] = "1" } else { env.removeValue(forKey: "ELECTRON_RUN_AS_NODE") }
        proc.environment = env
        proc.standardInput = entrada
        proc.standardOutput = saida
        proc.standardError = erros
        // avisa da saída só depois de ler tudo que ele mandou: o último quadro chega antes
        proc.terminationHandler = { p in
            _ = self.fimDaLeitura.wait(timeout: .now() + 2)
            let codigo = p.terminationStatus
            p.terminationHandler = nil
            DispatchQueue.main.async {
                self.vivo = false
                self.aoSair?(codigo)
            }
        }
        try proc.run()
        vivo = true
        // nossas pontas dos canos não passam pela versão nova no execv: senão o motor velho
        // nunca vê o fim da entrada e fica órfão
        for fd in [entrada.fileHandleForWriting.fileDescriptor, saida.fileHandleForReading.fileDescriptor,
                   erros.fileHandleForReading.fileDescriptor] {
            _ = fcntl(fd, F_SETFD, FD_CLOEXEC)
        }
        let leitor = Thread { self.ler() }
        leitor.name = "motor-ler"
        leitor.start()
        let leitorDeErros = Thread { self.lerErros() }
        leitorDeErros.name = "motor-stderr"
        leitorDeErros.start()
    }

    // fila cheia = motor travado: descarta em vez de travar a janela
    func enviar(_ json: String) {
        if !vivo { return }
        trava.lock()
        let cabe = naFila < 64
        if cabe { naFila += 1 }
        trava.unlock()
        if !cabe { return }
        let bytes = Array((json + "\n").utf8)
        let fd = entrada.fileHandleForWriting.fileDescriptor
        fila.async {
            var feito = 0
            while feito < bytes.count {
                let k = bytes.withUnsafeBytes { (p: UnsafeRawBufferPointer) -> Int in
                    Darwin.write(fd, p.baseAddress! + feito, bytes.count - feito)
                }
                if k < 0 && errno == EINTR { continue }
                if k <= 0 { break }  // o motor saiu: o terminationHandler avisa
                feito += k
            }
            self.trava.lock()
            self.naFila -= 1
            self.trava.unlock()
        }
    }

    func parar() {
        if proc.isRunning { proc.terminate() }
    }

    private func contar(_ texto: String) {
        DispatchQueue.main.async { self.aoLinha?(texto) }
    }

    private func lerTudo(_ fd: Int32, _ b: inout [UInt8], _ n: Int) -> Bool {
        var lido = 0
        while lido < n {
            let k = b.withUnsafeMutableBytes { (p: UnsafeMutableRawBufferPointer) -> Int in
                Darwin.read(fd, p.baseAddress! + lido, n - lido)
            }
            if k < 0 && errno == EINTR { continue }
            if k <= 0 { return false }
            lido += k
        }
        return true
    }

    private func ler() {
        defer { fimDaLeitura.signal() }
        let fd = saida.fileHandleForReading.fileDescriptor
        var cab = [UInt8](repeating: 0, count: 8)
        var dados: [UInt8] = []
        while lerTudo(fd, &cab, 8) {
            if cab[0] != 67 || cab[1] != 77 {  // "CM"
                contar("motor: mensagem fora do formato, parei de ler")
                parar()
                return
            }
            let n = Int(cab[4]) | (Int(cab[5]) << 8) | (Int(cab[6]) << 16) | (Int(cab[7]) << 24)
            if n > 64 * 1024 * 1024 {
                contar("motor: mensagem grande demais (\(n))")
                parar()
                return
            }
            if dados.count < n { dados = [UInt8](repeating: 0, count: n) }  // reaproveita: um quadro novo a cada 33 ms
            if !lerTudo(fd, &dados, n) { return }
            switch cab[2] {
            case 81:  // Q: um quadro
                quadro(dados, n)
            case 76:  // L: uma linha pro diário
                contar(String(decoding: dados[0..<n], as: UTF8.self))
            case 80:  // P: pronto, com o layout de cada tema
                let texto = String(decoding: dados[0..<n], as: UTF8.self)
                DispatchQueue.main.async {
                    self.pronto = texto
                    self.aoPronto?()
                }
            case 83:  // S: o som da cena épica (tocar um .wav ou parar)
                let texto = String(decoding: dados[0..<n], as: UTF8.self)
                DispatchQueue.main.async { self.aoSom?(texto) }
            default:
                break
            }
        }
    }

    // o que o node reclama no stderr vai pro diário, uma linha por vez
    private func lerErros() {
        let fd = erros.fileHandleForReading.fileDescriptor
        var bloco = [UInt8](repeating: 0, count: 4096)
        var resto: [UInt8] = []
        while true {
            let k = bloco.withUnsafeMutableBytes { (p: UnsafeMutableRawBufferPointer) -> Int in
                Darwin.read(fd, p.baseAddress!, p.count)
            }
            if k < 0 && errno == EINTR { continue }
            if k <= 0 { break }
            resto += bloco[0..<k]
            while let i = resto.firstIndex(of: 10) {
                let linha = String(decoding: resto[0..<i], as: UTF8.self).trimmingCharacters(in: .whitespaces)
                resto.removeSubrange(0...i)
                if !linha.isEmpty { contar("motor (stderr): " + linha) }
            }
        }
        if !resto.isEmpty { contar("motor (stderr): " + String(decoding: resto, as: UTF8.self)) }
    }

    // Q: W,H (o tamanho da tela), x,y,w,h (uint16 LE) + w*h*4 bytes do pedaço que mudou
    private func quadro(_ d: [UInt8], _ n: Int) {
        func u16(_ i: Int) -> Int { Int(d[i]) | (Int(d[i + 1]) << 8) }
        if n < 12 { contar("motor: quadro com tamanho errado"); return }
        let w0 = u16(0), h0 = u16(2), x = u16(4), y = u16(6), w = u16(8), h = u16(10)
        if w0 == 0 || h0 == 0 || 12 + w * h * 4 > n || x + w > w0 || y + h > h0 {
            contar("motor: quadro com tamanho errado")
            return
        }
        trava.lock()
        if w0 != W || h0 != H || buf.isEmpty {
            W = w0
            H = h0
            buf = [UInt8](repeating: 0, count: W * H * 4)
        }
        if w > 0 && h > 0 {
            let largura = W
            d.withUnsafeBytes { (de: UnsafeRawBufferPointer) -> Void in
                self.buf.withUnsafeMutableBytes { (para: UnsafeMutableRawBufferPointer) -> Void in
                    for r in 0..<h {
                        memcpy(para.baseAddress! + ((y + r) * largura + x) * 4, de.baseAddress! + 12 + r * w * 4, w * 4)
                    }
                }
            }
            sujoX0 = min(sujoX0, x)
            sujoY0 = min(sujoY0, y)
            sujoX1 = max(sujoX1, x + w)
            sujoY1 = max(sujoY1, y + h)
        }
        quadros += 1
        let primeiro = quadros == 1
        let postar = !pendente  // a janela ainda não viu o anterior: junta os dois
        pendente = true
        trava.unlock()
        if postar { DispatchQueue.main.async { self.aplicar() } }
        if primeiro { DispatchQueue.main.async { self.aoPrimeiro?() } }  // depois do aplicar: já tem o que mostrar
    }

    // na janela: pede pra redesenhar só o pedaço que mudou
    private func aplicar() {
        trava.lock()
        pendente = false
        let (x0, y0, x1, y1, w, h) = (sujoX0, sujoY0, sujoX1, sujoY1, W, H)
        sujoX0 = Int.max
        sujoY0 = Int.max
        sujoX1 = 0
        sujoY1 = 0
        trava.unlock()
        guard alvo.motor === self, w > 0, h > 0 else { return }
        if w != aplicadoW || h != aplicadoH {  // tamanho novo (outra escala): tudo
            aplicadoW = w
            aplicadoH = h
            alvo.needsDisplay = true
            return
        }
        if x1 <= x0 || y1 <= y0 { return }
        let b = alvo.bounds, sx = b.width / CGFloat(w), sy = b.height / CGFloat(h)
        alvo.setNeedsDisplay(NSRect(x: CGFloat(x0) * sx, y: b.height - CGFloat(y1) * sy,
                                    width: CGFloat(x1 - x0) * sx, height: CGFloat(y1 - y0) * sy).insetBy(dx: -1, dy: -1))
    }

    // Um pedaço do quadro atual pra desenhar: f = a fração da janela (0-1, y pra baixo).
    // Copia só esse pedaço (o resto não mudou). espaco: o espaço de cor da imagem (nil = sRGB).
    func pedaco(_ f: CGRect, espaco: CGColorSpace?) -> (imagem: CGImage, x: Int, y: Int, W: Int, H: Int)? {
        trava.lock()
        defer { trava.unlock() }
        if W <= 0 || H <= 0 || buf.count != W * H * 4 { return nil }
        let x0 = max(0, Int(floor(f.minX * CGFloat(W)))), y0 = max(0, Int(floor(f.minY * CGFloat(H))))
        let x1 = min(W, Int(ceil(f.maxX * CGFloat(W)))), y1 = min(H, Int(ceil(f.maxY * CGFloat(H))))
        if x1 <= x0 || y1 <= y0 { return nil }
        let lw = x1 - x0, lh = y1 - y0, largura = W
        var copia = Data(count: lw * lh * 4)
        copia.withUnsafeMutableBytes { (para: UnsafeMutableRawBufferPointer) -> Void in
            self.buf.withUnsafeBytes { (de: UnsafeRawBufferPointer) -> Void in
                for r in 0..<lh {
                    memcpy(para.baseAddress! + r * lw * 4, de.baseAddress! + ((y0 + r) * largura + x0) * 4, lw * 4)
                }
            }
        }
        guard let provedor = CGDataProvider(data: copia as CFData) else { return nil }
        var espacos: [CGColorSpace] = [Motor.srgb]
        if let e = espaco, e.model == .rgb { espacos.insert(e, at: 0) }  // o pedido; não deu, sRGB
        for e in espacos {
            if let imagem = CGImage(width: lw, height: lh, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: lw * 4,
                                    space: e, bitmapInfo: Motor.bgra, provider: provedor, decode: nil,
                                    shouldInterpolate: false, intent: .defaultIntent) {
                return (imagem, x0, y0, W, H)
            }
        }
        return nil
    }
}

// O que o motor desenha (o Clawd, as cenas e os enfeites do tema), por cima de tudo e sem
// pegar clique. y pra cima (não é flipped): o CGImage sai em pé sem virar nada.
final class PalcoDoMotor: NSView {
    var motor: Motor?
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func draw(_ dirtyRect: NSRect) {
        guard let m = motor, bounds.width > 0, bounds.height > 0, let ctx = NSGraphicsContext.current?.cgContext else { return }
        let b = bounds
        // o pedaço a redesenhar, em fração da janela com y pra baixo (o do motor)
        let fracao = CGRect(x: dirtyRect.minX / b.width, y: (b.height - dirtyRect.maxY) / b.height,
                            width: dirtyRect.width / b.width, height: dirtyRect.height / b.height)
        // --foto: no espaço de cor de onde desenha, os pixels do motor chegam iguais no PNG (o
        // teste confere as cores com pouca folga, como no Windows); na tela, sRGB como o resto
        guard let p = m.pedaco(fracao, espaco: arquivoFoto != nil ? ctx.colorSpace : nil) else { return }
        let sx = b.width / CGFloat(p.W), sy = b.height / CGFloat(p.H)
        ctx.saveGState()
        ctx.interpolationQuality = .none  // pixel duro, como o NearestNeighbor do Windows
        ctx.draw(p.imagem, in: CGRect(x: CGFloat(p.x) * sx, y: b.height - CGFloat(p.y + p.imagem.height) * sy,
                                      width: CGFloat(p.imagem.width) * sx, height: CGFloat(p.imagem.height) * sy))
        ctx.restoreGState()
    }
}

// --- janela ---
let app = NSApplication.shared
app.setActivationPolicy(.accessory)  // sem ícone no Dock
let janela = NSPanel(contentRect: NSRect(x: 0, y: 0, width: L, height: A),
                     styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
janela.isOpaque = false
janela.backgroundColor = .clear
janela.hasShadow = false
janela.level = .floating
janela.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
janela.hidesOnDeactivate = false
janela.isReleasedWhenClosed = false
janela.allowsToolTipsWhenApplicationIsInactive = true
let raiz = Raiz(frame: NSRect(x: 0, y: 0, width: L, height: A))
let cartao = Cartao(frame: .zero)
let palco = Palco(frame: raiz.bounds)
let palcoDoMotor = PalcoDoMotor(frame: raiz.bounds)
palco.cartao = cartao
palcoDoMotor.isHidden = true
raiz.addSubview(cartao)
raiz.addSubview(palco)
raiz.addSubview(palcoDoMotor)  // por cima de tudo, como o Palco do Windows
janela.contentView = raiz
// o que o botão direito mudou: Clawd desligado = o palco some; a opacidade o Cartao.draw
// lê. Com o motor vivo o Clawd é dele (o daqui some) e ele fica sabendo pelo estado
func aplicarConfig() {
    palco.isHidden = !config.clawd || motorVivo
    palcoDoMotor.isHidden = !motorVivo
    cartao.needsDisplay = true
    motorEstado()
}
// nasce no canto de baixo à direita (a margem M já afasta o cartão da borda)
if let tela = NSScreen.main?.visibleFrame { janela.setFrameOrigin(NSPoint(x: tela.maxX - L, y: tela.minY)) }

// o node dos hooks (no PATH, ou onde o Homebrew e o instalador do Node põem); sem ele, o do
// VS Code que me abriu (Electron fazendo de node, com ELECTRON_RUN_AS_NODE=1)
func acharNode() -> (caminho: String, comoNode: Bool)? {
    let fm = FileManager.default
    let candidatos = (ambiente["PATH"] ?? "").split(separator: ":").map { String($0) + "/node" }
        + ["/opt/homebrew/bin/node", "/usr/local/bin/node"]
    for c in candidatos where fm.isExecutableFile(atPath: c) { return (c, false) }
    if let c = ambiente["CLAUDE_MONITOR_NODE"], fm.isExecutableFile(atPath: c) { return (c, true) }
    return nil
}
// motor/ fica ao lado do binário (~/.claude-monitor/motor), como no Windows ao lado do overlay.ps1
let scriptDoMotor = (binario as NSString).deletingLastPathComponent + "/motor/motor.js"

// Abre o motor. Ele desenha o Clawd, as cenas e os enfeites do tema; enquanto não manda o
// 1º quadro, e se cair, fica o Clawd daqui. Caiu: tenta de novo em 5 s, 30 s e 2 min.
func ligarMotor() {
    if semMotor || motor != nil { return }
    let achado = acharNode()
    guard let node = achado, FileManager.default.fileExists(atPath: scriptDoMotor) else {
        if tentativasDoMotor == 0 { anotar("motor desligado: \(achado == nil ? "sem node" : "sem motor.js"); fica o Clawd daqui") }
        tentativasDoMotor = 99
        return
    }
    let m = Motor(alvo: palcoDoMotor)
    m.aoLinha = { anotar($0) }
    m.aoSom = { [weak m] json in
        guard let m = m, motor === m else { return }
        tocarSomDaCena(json)
    }
    // o layout de cada tema; no --foto, monta o cartão com ele e só então pede a foto (motorEstado)
    m.aoPronto = { [weak m] in
        guard let m = m, motor === m else { return }
        layouts = nil
        if let o = (try? JSONSerialization.jsonObject(with: Data(m.pronto.utf8))) as? [String: Any],
           let doTema = o["temas"] as? [String: Any] {
            var novos: [String: Aparencia] = [:]
            for (nome, v) in doTema {
                if let l = v as? [String: Any] { novos[nome] = aparencia(l) }
            }
            layouts = novos
        } else {
            anotar("motor: mensagem P com defeito")
        }
        if arquivoFoto != nil { atualizar() }
    }
    m.aoPrimeiro = { [weak m] in
        guard let m = m, motor === m else { return }
        if tentativasDoMotor > 0 && tentativasDoMotor < 99 { anotar("motor voltou") }
        motorVivo = true
        tentativasDoMotor = 0
        palco.luta = nil
        palcoDoMotor.needsDisplay = true
        aplicarConfig()  // o Clawd daqui some, o do motor aparece
        atualizar()      // os enfeites do tema passam pro motor
    }
    m.aoSair = { [weak m] codigo in
        guard let m = m, motor === m else { return }
        if arquivoFoto != nil {
            // o --foto sai depois do quadro: fica o quadro. Sem quadro, a foto é a de sempre
            if !motorVivo {
                tentativasDoMotor = 99
                layouts = nil
                atualizar()
            }
            return
        }
        motor = nil
        motorVivo = false
        somDaCena?.stop()  // a cena morreu junto
        enviadoAoMotor = ""
        palcoDoMotor.motor = nil
        tentativasDoMotor += 1
        aplicarConfig()  // o Clawd daqui volta
        atualizar()      // e o cartão de sempre
        let espera = [5, 30, 120][min(2, tentativasDoMotor - 1)]
        if tentativasDoMotor <= 5 {
            anotar("motor saiu (\(codigo)); tento de novo em \(espera) s")
            DispatchQueue.main.asyncAfter(deadline: .now() + .seconds(espera)) { ligarMotor() }
        } else {
            anotar("motor saiu (\(codigo)) de novo; desisti até reabrir")
        }
    }
    var args = [scriptDoMotor, "--pasta", pasta]
    if arquivoFoto != nil {
        // a foto: o quadro desse instante (da cena, com --cena), com sorteio e hora fixos
        let partes = (argumento("--cena") ?? "").split(separator: " ").map { String($0) }
        args += ["--foto", partes.count == 2 ? partes[1] : "1", "--semente", "7", "--hora", "12"]
        if partes.count == 2 { args += ["--cena", partes[0]] }
    }
    do {
        try m.iniciar(node.caminho, node.comoNode, args)
    } catch {
        anotar("não abri o motor (\(node.caminho)): \(error.localizedDescription)")
        tentativasDoMotor = 99
        return
    }
    motor = m
    palcoDoMotor.motor = m
    enviadoAoMotor = ""
    motorEstado()
}

// o que o motor precisa saber (docs/MOTOR.md); só manda quando mudou
func motorEstado() {
    guard let m = motor, cartao.frame.width > 0 else { return }
    let f = cartao.frame
    let estado: [String: Any] = [
        "msg": "estado", "tema": config.tema, "clawd": config.clawd, "modo": palco.modo,
        "escala": Double(janela.backingScaleFactor), "janela": [Double(L), Double(A)],
        "cartao": cartao.naJanela(0, 0, f.width, f.height), "raio": Double(cartao.ap.raio), "opacidade": config.opacidade,
        "linhas": cartao.caixasDasLinhas(), "uso": cartao.caixasDoUso(),
    ]
    guard JSONSerialization.isValidJSONObject(estado),
          let dados = try? JSONSerialization.data(withJSONObject: estado, options: [.sortedKeys]),
          let json = String(data: dados, encoding: .utf8) else { return }
    if json != enviadoAoMotor {
        enviadoAoMotor = json
        m.enviar(json)
    }
    // --foto: a foto sai com o cartão já montado pelo layout do tema
    if arquivoFoto != nil && layouts != nil && !pediuFoto {
        pediuFoto = true
        m.enviar("{\"msg\":\"foto\"}")
    }
}
func motorEvento(_ tipo: String) {
    if motorVivo { motor?.enviar("{\"msg\":\"evento\",\"tipo\":\"\(tipo)\"}") }
}

// a extensão trocou o binário por uma versão nova: vira ela (mesmo processo)
func seAtualizou() {
    guard arquivoFoto == nil, let v = versao, let agora = dataDoArquivo(binario), agora != v else { return }
    motor?.parar()  // a versão nova abre o motor dela; este não pode ficar órfão
    var args: [UnsafeMutablePointer<CChar>?] = argumentos.map { strdup($0) }
    args.append(nil)
    execv(binario, &args)
}

func atualizar() {
    let agora = Date().timeIntervalSince1970
    let sessoes = lerSessoes(agora: agora)
    avisar(sessoes)
    cartao.linhas = sessoes.map { s -> LinhaDoCartao in
        let e = estados[s.situacao] ?? (cor: "#9CA3AF", rotulo: s.situacao)
        return LinhaDoCartao(id: s.id, sit: s.situacao, cor: e.cor, nome: s.nome, tempo: tempo((agora - s.since) / 60),
                             rotulo: e.rotulo)
    }
    buscarUso()
    cartao.aviso = versaoNova()
    cartao.arrumar()  // redesenha a cada 2 s pra contagem de "falta" andar entre as buscas
    // pedindo algo (pergunta/permissão) ganha de trabalhando, que ganha de parado.
    // Depois do arrumar: na 1ª vez o cartão ainda tem largura 0 e o Clawd sairia por baixo
    let situacoes = Set(sessoes.map { $0.situacao })
    palco.mudar(situacoes.contains("question") || situacoes.contains("permission") ? "pulando"
                : situacoes.contains("working") ? "andando" : "parado")
    palco.needsDisplay = true
    motorEstado()  // depois do arrumar e do mudar: onde a lista nova ficou e o que o Clawd faz
    if let foto = arquivoFoto {
        // --clicar: o meio da linha daquela sessão (ou do aviso, com "baixar"), pelo mesmo caminho do clique de verdade
        if let alvo = argumento("--clicar") {
            let y: CGFloat? = alvo == "baixar" ? cartao.yAviso + 10
                : cartao.linhas.firstIndex(where: { $0.id == alvo }).map { cartao.y0 + CGFloat($0) * cartao.alturaLinha + cartao.alturaLinha / 2 }
            if let y = y, let achou = cartao.alvoNoPonto(NSPoint(x: cartao.bounds.midX, y: y)) { clicar(achou) }
        }
        let clawd = config.clawd ? palco.modo + (palco.luta.map { " (\($0))" } ?? "") : "desligado"
        let som = somDaVez.flatMap { avisoDaSituacao[$0] }.flatMap { nomeDoSom[config.tema]?[$0] } ?? "nenhum"
        let visto = sessoes.map { "sessao: \($0.nome) | hook=\($0.estado) | janelinha=\($0.situacao)" }
            + ["clawd: \(clawd)", "usage: \(uso == nil ? "indisponivel" : "ok")",
               "som: \(som)", "som da cena: \(somDaCenaVisto ?? "nenhum")", "clique: \(cliqueDaVez ?? "nenhum")",
               "atualizacao: \(cartao.aviso ?? "nenhuma")"]
        try? (visto.joined(separator: "\n") + "\n").write(toFile: foto + ".txt", atomically: true, encoding: .utf8)
    }
    seAtualizou()
}

func repetir(_ intervalo: TimeInterval, _ bloco: @escaping () -> Void) {
    let t = Timer(timeInterval: intervalo, repeats: true) { _ in bloco() }
    RunLoop.main.add(t, forMode: .common)  // continua durante arrasto e menu
}

aplicarConfig()
atualizar()
janela.orderFrontRegardless()
ligarMotor()
repetir(2) { atualizar() }
repetir(1.0 / 30) {
    palco.tique()
    // o pulso da bolinha verde: só a coluna das bolinhas (com enfeites, quem desenha é o motor)
    if !cartao.ap.enfeites && cartao.linhas.contains(where: { $0.sit == "working" }) {
        cartao.setNeedsDisplay(NSRect(x: cartao.x0 - 2, y: 0, width: 12, height: cartao.bounds.height))
    }
}
// mudou de tela (Retina ou não): o motor desenha na escala nova
_ = NotificationCenter.default.addObserver(forName: NSWindow.didChangeBackingPropertiesNotification, object: janela,
                                           queue: .main) { _ in motorEstado() }

if let foto = arquivoFoto {
    // 1,2 s pra assentar; com o motor, até 8 s pelo 1º quadro (o node leva ~1 s pra abrir)
    var tiques = 0
    repetir(0.2) {
        tiques += 1
        if tiques < 6 { return }
        if motor != nil && !motorVivo && tentativasDoMotor < 99 && tiques < 40 { motorEstado(); return }
        if !motorVivo, let cena = argumento("--cena") { palco.fotografar(cena) }  // sem o motor, as lutas daqui
        atualizar()
        if let rep = raiz.bitmapImageRepForCachingDisplay(in: raiz.bounds) {
            raiz.cacheDisplay(in: raiz.bounds, to: rep)
            try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: foto))
            print("foto: \(foto)")
            print("motor: \(motorVivo ? "desenhou" : "desligado")")  // o teste confere quem desenhou o Clawd
        }
        exit(0)
    }
}
app.run()
