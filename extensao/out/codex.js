"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lerSessoesCodex = lerSessoesCodex;
exports.usoCodex = usoCodex;
exports.sincronizarCodex = sincronizarCodex;
exports.rotuloDaJanela = rotuloDaJanela;
exports.terminaEmPergunta = terminaEmPergunta;
/**
 * Sessões do OpenAI Codex na mesma lista do Claude, sem hook: lê os rollouts que o
 * Codex grava em ~/.codex/sessions/AAAA/MM/DD/rollout-<data>-<id>.jsonl e traduz cada
 * sessão aberta para ~/.claude-monitor/sessions/codex-<id>.json, no formato do hook do
 * Claude mais `"agente": "codex"` (e `"pergunta": true` quando a última fala do agente
 * termina em pergunta). O uso (janelas de limite) vai pra ~/.claude-monitor/uso-codex.json.
 *
 * "Aberta" = rollout mexido nas últimas 6 h (os .lock do Codex nunca somem, não servem).
 * Só lê ~/.codex se ela existir; nunca toca em auth.json nem em secrets. Cada rollout é
 * lido a partir de onde parou (tamanho guardado), sem reler o arquivo todo a cada ciclo.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const sessions_1 = require("./sessions");
const processes_1 = require("./processes");
const ABERTA_ATE_SEC = 6 * 60 * 60; // mesma ideia do STALE_AFTER_SEC do sessions.js
const DIAS_PARA_TRAS = 3; // pastas AAAA/MM/DD varridas
const LIMITE_PRIMEIRA_LEITURA = 4 * 1024 * 1024; // rollout maior que isso: só o final
const REGRAVAR_A_CADA_SEC = 30; // `updated` muda a cada gravação do Codex; não regrava o arquivo por isso
const SO_ESTES = ['"session_meta"', '"task_started"', '"task_complete"', '"turn_aborted"', '"token_count"'];
const lidos = new Map(); // arquivo do rollout -> { offset, id, cwd, originator, state, since, pergunta, limites, limitesEm }
const gravados = new Map(); // id -> { texto, quando } do que já foi pro codex-<id>.json
let ultimoUso = "";
function pastaCodex() {
    return path.join(os.homedir(), ".codex");
}
/** AAAA/MM/DD das últimas pastas, no horário local e no UTC (o Codex nomeia por um deles). */
function pastasDosUltimosDias(agoraMs) {
    const nomes = new Set();
    const dois = (n) => String(n).padStart(2, "0");
    for (let i = 0; i < DIAS_PARA_TRAS; i++) {
        const d = new Date(agoraMs - i * 86400000);
        nomes.add(path.join(String(d.getFullYear()), dois(d.getMonth() + 1), dois(d.getDate())));
        nomes.add(path.join(String(d.getUTCFullYear()), dois(d.getUTCMonth() + 1), dois(d.getUTCDate())));
    }
    return [...nomes];
}
/** "5h", "7d", "30d" ou "<n>min" a partir de window_minutes. */
function rotuloDaJanela(minutos) {
    if (minutos === 300)
        return "5h";
    if (minutos === 10080)
        return "7d";
    if (minutos === 43200)
        return "30d";
    return `${minutos}min`;
}
/** Mesma regra do UltimoPedido das janelinhas: "?" na última linha, fora de aspas e crases. */
function terminaEmPergunta(texto) {
    if (typeof texto !== "string")
        return false;
    const linhas = texto.trim().split("\n");
    const ultima = linhas[linhas.length - 1].replace(/"[^"]*"|“[^”]*”|`[^`]*`/g, "");
    return ultima.includes("?");
}
/** Os bytes de `de` até o fim do arquivo (só as linhas inteiras). */
function lerDesde(arquivo, de, tamanho) {
    const buf = Buffer.alloc(tamanho - de);
    const fd = fs.openSync(arquivo, "r");
    try {
        let lido = 0;
        while (lido < buf.length) {
            const n = fs.readSync(fd, buf, lido, buf.length - lido, de + lido);
            if (n <= 0)
                break;
            lido += n;
        }
        return buf.subarray(0, lido);
    }
    finally {
        fs.closeSync(fd);
    }
}
function primeiraLinha(arquivo) {
    const fd = fs.openSync(arquivo, "r");
    try {
        const buf = Buffer.alloc(1024 * 1024);
        const n = fs.readSync(fd, buf, 0, buf.length, 0);
        const fim = buf.subarray(0, n).indexOf(10);
        return fim < 0 ? "" : buf.subarray(0, fim).toString("utf8");
    }
    finally {
        fs.closeSync(fd);
    }
}
function aplicarLinha(e, linha) {
    if (!SO_ESTES.some((marca) => linha.includes(marca)))
        return;
    let obj;
    try {
        obj = JSON.parse(linha);
    }
    catch {
        return; // linha quebrada
    }
    const p = obj.payload || {};
    const quando = Date.parse(obj.timestamp) / 1000;
    if (obj.type === "session_meta") {
        if (p.id && !e.id)
            e.id = String(p.id);
        if (p.cwd)
            e.cwd = String(p.cwd);
        if (p.originator)
            e.originator = String(p.originator);
    }
    else if (obj.type === "event_msg") {
        if (p.type === "task_started") {
            e.state = "working";
            e.pergunta = false;
            if (quando)
                e.since = quando;
        }
        else if (p.type === "task_complete" || p.type === "turn_aborted") {
            e.state = "waiting";
            e.pergunta = terminaEmPergunta(p.last_agent_message);
            if (quando)
                e.since = quando;
        }
        else if (p.type === "token_count" && p.rate_limits && quando) {
            const janelas = [];
            for (const chave of ["primary", "secondary"]) {
                const j = p.rate_limits[chave];
                if (j && typeof j.used_percent === "number") {
                    janelas.push({
                        rotulo: rotuloDaJanela(Number(j.window_minutes)),
                        usado: j.used_percent,
                        reinicia: typeof j.resets_at === "number" ? new Date(j.resets_at * 1000).toISOString() : null,
                    });
                }
            }
            if (janelas.length) {
                e.limites = { janelas, plano: p.rate_limits.plan_type || null };
                e.limitesEm = quando;
            }
        }
    }
}
/** Lê o que o rollout ganhou desde a última vez (ou o começo/final, na 1ª vez). */
function atualizarRollout(arquivo, stat) {
    let e = lidos.get(arquivo);
    if (!e) {
        const achado = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i.exec(arquivo);
        e = { offset: 0, id: achado ? achado[1] : "", cwd: "", originator: "", state: "waiting", since: stat.mtimeMs / 1000, pergunta: false, limites: null, limitesEm: 0 };
        lidos.set(arquivo, e);
        if (stat.size > LIMITE_PRIMEIRA_LEITURA) {
            aplicarLinha(e, primeiraLinha(arquivo));
            e.offset = stat.size - LIMITE_PRIMEIRA_LEITURA;
            e.state = "working"; // se o final não tem início nem fim de turno, o turno é longo: segue trabalhando
            const buf = lerDesde(arquivo, e.offset, stat.size);
            const comeco = buf.indexOf(10) + 1; // joga fora a linha cortada
            e.offset += comeco;
        }
    }
    if (stat.size < e.offset)
        Object.assign(e, { offset: 0, state: "waiting", pergunta: false, limites: null, limitesEm: 0 }); // arquivo recomeçou
    if (stat.size > e.offset) {
        const buf = lerDesde(arquivo, e.offset, stat.size);
        const fim = buf.lastIndexOf(10) + 1; // não consome linha pela metade
        e.offset += fim;
        for (const linha of buf.subarray(0, fim).toString("utf8").split("\n"))
            if (linha)
                aplicarLinha(e, linha);
    }
    return e;
}
/** thread_name de cada id no session_index.jsonl (relido só quando o arquivo muda). */
let indice = { chave: "", nomes: new Map() };
function titulos() {
    const arquivo = path.join(pastaCodex(), "session_index.jsonl");
    try {
        const st = fs.statSync(arquivo);
        const chave = `${st.size}:${st.mtimeMs}`;
        if (chave !== indice.chave) {
            const nomes = new Map();
            for (const linha of fs.readFileSync(arquivo, "utf8").split("\n")) {
                if (!linha)
                    continue;
                try {
                    const o = JSON.parse(linha);
                    if (o.id && o.thread_name)
                        nomes.set(String(o.id), String(o.thread_name));
                }
                catch {
                    // linha quebrada
                }
            }
            indice = { chave, nomes };
        }
    }
    catch {
        indice = { chave: "", nomes: new Map() };
    }
    return indice.nomes;
}
function rolloutsRecentes(agoraMs) {
    const achados = [];
    const raiz = path.join(pastaCodex(), "sessions");
    for (const rel of pastasDosUltimosDias(agoraMs)) {
        let nomes;
        try {
            nomes = fs.readdirSync(path.join(raiz, rel));
        }
        catch {
            continue;
        }
        for (const nome of nomes) {
            if (!/^rollout-.*\.jsonl$/.test(nome))
                continue;
            const arquivo = path.join(raiz, rel, nome);
            try {
                const stat = fs.statSync(arquivo);
                if (agoraMs / 1000 - stat.mtimeMs / 1000 <= ABERTA_ATE_SEC)
                    achados.push({ arquivo, stat });
            }
            catch {
                // sumiu entre o readdir e o stat
            }
        }
    }
    return achados;
}
function removerArquivo(file) {
    try {
        fs.unlinkSync(file);
    }
    catch {
        // já apagado
    }
}
/**
 * Sincroniza ~/.claude-monitor/sessions/codex-*.json com os rollouts abertos e devolve as
 * sessões. Sem ~/.codex: não faz nada e devolve [].
 */
function lerSessoesCodex(agora = Date.now() / 1000) {
    if (!fs.existsSync(pastaCodex())) {
        lidos.clear();
        gravados.clear();
        return [];
    }
    const abertas = rolloutsRecentes(agora * 1000);
    const nomes = titulos();
    const resultado = [];
    const vivos = new Set();
    const arquivos = new Set(abertas.map((a) => a.arquivo));
    for (const chave of lidos.keys())
        if (!arquivos.has(chave))
            lidos.delete(chave);
    for (const { arquivo, stat } of abertas) {
        let e;
        try {
            e = atualizarRollout(arquivo, stat);
        }
        catch {
            continue; // rollout sumiu ou ocupado: tenta no próximo ciclo
        }
        if (!e.id)
            continue;
        const nome = nomes.get(e.id) || path.basename((e.cwd || "").replace(/[\\/]+$/, "")) || "sessão";
        const sessao = {
            agente: "codex",
            name: nome,
            cwd: e.cwd,
            state: e.state,
            since: e.since,
            updated: stat.mtimeMs / 1000,
            transcript: arquivo,
            entrypoint: e.originator || null,
        };
        if ((0, processes_1.ehAutomatica)(e.originator, "codex"))
            sessao.automatica = true;
        if (e.pergunta && e.state === "waiting")
            sessao.pergunta = true;
        const id = `codex-${e.id}`;
        vivos.add(id);
        const { updated, ...resto } = sessao;
        const texto = JSON.stringify(resto);
        const antes = gravados.get(id);
        const arquivoDaSessao = path.join(sessions_1.SESS_DIR, `${id}.json`);
        if (!antes || antes.texto !== texto || updated - antes.quando >= REGRAVAR_A_CADA_SEC || !fs.existsSync(arquivoDaSessao)) {
            try {
                fs.mkdirSync(sessions_1.SESS_DIR, { recursive: true });
                fs.writeFileSync(arquivoDaSessao, JSON.stringify(sessao));
                gravados.set(id, { texto, quando: updated });
            }
            catch {
                // sem pasta de sessões agora: tenta no próximo ciclo
            }
        }
        resultado.push({ id, ...sessao });
    }
    // sessão que fechou (rollout parado há mais de 6 h ou apagado): some junto com o arquivo
    try {
        for (const entrada of fs.readdirSync(sessions_1.SESS_DIR)) {
            if (/^codex-.*\.json$/.test(entrada) && !vivos.has(entrada.replace(/\.json$/, ""))) {
                removerArquivo(path.join(sessions_1.SESS_DIR, entrada));
                gravados.delete(entrada.replace(/\.json$/, ""));
            }
        }
    }
    catch {
        // sem pasta de sessões
    }
    return resultado;
}
/**
 * Grava ~/.claude-monitor/uso-codex.json com o último rate_limits visto (o do rollout que
 * falou por último). Chamar depois do lerSessoesCodex. Sem rate_limits: não grava nada.
 */
function usoCodex(agora = Date.now() / 1000) {
    let melhor = null;
    for (const e of lidos.values())
        if (e.limites && (!melhor || e.limitesEm > melhor.limitesEm))
            melhor = e;
    if (!melhor || !melhor.limites)
        return null;
    const dados = { janelas: melhor.limites.janelas, plano: melhor.limites.plano, atualizado: melhor.limitesEm };
    const texto = JSON.stringify(dados);
    if (texto !== ultimoUso || !fs.existsSync(path.join(sessions_1.MONITOR_DIR, "uso-codex.json"))) {
        try {
            fs.mkdirSync(sessions_1.MONITOR_DIR, { recursive: true });
            fs.writeFileSync(path.join(sessions_1.MONITOR_DIR, "uso-codex.json"), texto);
            ultimoUso = texto;
        }
        catch {
            // tenta no próximo ciclo
        }
    }
    return dados;
}
/** O que o tick da extensão chama: sessões + uso, sem nunca estourar. */
function sincronizarCodex(agora = Date.now() / 1000) {
    try {
        const lista = lerSessoesCodex(agora);
        usoCodex(agora);
        return lista;
    }
    catch {
        return [];
    }
}
