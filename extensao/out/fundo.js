"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FUNDO_ARQ = void 0;
exports.shellsDeFundo = shellsDeFundo;
exports.atualizarContagem = atualizarContagem;
exports.sincronizarFundo = sincronizarFundo;
exports.lerFundo = lerFundo;
/**
 * Sessão do Claude que encerrou a vez (Stop) mas deixou um comando rodando em segundo plano
 * (um script, a esteira, um `codex exec`) ainda está trabalhando, só que sem escrever nada na
 * conversa. A extensão olha a árvore de processos de cada sessão "terminou" e grava os ids das
 * que têm um shell vivo debaixo dela em ~/.claude-monitor/fundo.json; as 3 janelinhas e a
 * própria extensão leem esse arquivo.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const processes_1 = require("./processes");
const MONITOR_DIR = path.join(os.homedir(), ".claude-monitor");
const SESS_DIR = path.join(MONITOR_DIR, "sessions");
exports.FUNDO_ARQ = path.join(MONITOR_DIR, "fundo.json");
const SHELLS = new Set(["bash", "sh", "zsh", "fish", "dash", "powershell", "pwsh"]); // cmd fica de fora: servidor MCP no Windows sobe por ele
const INTERVALO_SEC = 8; // varrer processos custa ~1 s de PowerShell no Windows
const VALE_SEC = 60; // fundo.json mais velho que isso = a extensão parou; ninguém confia
const ARVORE_MAX = 20;
const contagem = new Map(); // id da sessão -> varreduras seguidas com shell vivo
let ultimaVarredura = 0;
let varrendo = false;
/** A sessão com este pid tem algum shell vivo em qualquer nível debaixo dela? */
function shellsDeFundo(tabela, pid) {
    let achou = 0;
    for (const [filho, info] of tabela) {
        if (!SHELLS.has(info.name) || filho === pid)
            continue;
        let atual = info.ppid;
        for (let nivel = 0; atual && nivel < ARVORE_MAX; nivel++) {
            if (atual === pid) {
                achou++;
                break;
            }
            atual = tabela.get(atual)?.ppid;
        }
    }
    return achou;
}
/**
 * Só vale shell visto em 2 varreduras seguidas: o próprio hook do Stop roda num shell por
 * ~1 s e não pode virar "trabalhando". Devolve os ids que têm trabalho de fundo.
 */
function atualizarContagem(tabela, sessoes) {
    const ids = new Set();
    const vivos = new Set(sessoes.map((s) => s.id));
    for (const id of [...contagem.keys()])
        if (!vivos.has(id))
            contagem.delete(id);
    for (const s of sessoes) {
        const n = shellsDeFundo(tabela, s.pid) ? (contagem.get(s.id) || 0) + 1 : 0;
        contagem.set(s.id, n);
        if (n >= 2)
            ids.add(s.id);
    }
    return ids;
}
/** Sessões do Claude "terminou" com pid: as únicas que podem estar escondendo trabalho. */
function candidatas() {
    const lista = [];
    try {
        for (const entry of fs.readdirSync(SESS_DIR)) {
            if (!entry.endsWith(".json"))
                continue;
            try {
                const d = JSON.parse(fs.readFileSync(path.join(SESS_DIR, entry), "utf8"));
                if (d.agente !== "codex" && d.pid && d.state === "waiting")
                    lista.push({ id: entry.replace(/\.json$/, ""), pid: d.pid });
            }
            catch {
                // arquivo sendo escrito
            }
        }
    }
    catch {
        // sem pasta de sessões
    }
    return lista;
}
function gravar(ids) {
    const tmp = `${exports.FUNDO_ARQ}.${process.pid}.tmp`;
    try {
        fs.mkdirSync(MONITOR_DIR, { recursive: true });
        fs.writeFileSync(tmp, JSON.stringify({ updated: Date.now() / 1000, ids: [...ids] }));
        fs.renameSync(tmp, exports.FUNDO_ARQ);
    }
    catch {
        try {
            fs.rmSync(tmp, { force: true });
        }
        catch {
            // sem permissão: segue sem
        }
    }
}
/** Chamada a cada tick da extensão; só varre a cada INTERVALO_SEC e nunca trava o tick. */
async function sincronizarFundo(tabelaAsync = processes_1.processTableAsync, agora = Date.now() / 1000) {
    if (varrendo || agora - ultimaVarredura < INTERVALO_SEC)
        return;
    varrendo = true;
    ultimaVarredura = agora;
    try {
        const sessoes = candidatas();
        const tabela = sessoes.length ? await tabelaAsync() : null;
        if (sessoes.length && !tabela)
            return; // não deu pra listar processos: mantém o que estava gravado
        gravar(sessoes.length ? atualizarContagem(tabela, sessoes) : new Set());
    }
    finally {
        varrendo = false;
    }
}
/** Ids com trabalho em segundo plano (vazio se o arquivo não existe ou está velho). */
function lerFundo(agora = Date.now() / 1000) {
    try {
        const d = JSON.parse(fs.readFileSync(exports.FUNDO_ARQ, "utf8"));
        if (agora - (d.updated || 0) <= VALE_SEC && Array.isArray(d.ids))
            return new Set(d.ids);
    }
    catch {
        // sem arquivo
    }
    return new Set();
}
