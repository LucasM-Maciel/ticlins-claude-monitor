// codex.js: sessões e uso do OpenAI Codex, lidos dos rollouts de ~/.codex (uma casa de mentira,
// com arquivos no formato real do Codex CLI e texto inventado: nada pessoal).
const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const casa = fs.mkdtempSync(path.join(os.tmpdir(), "cm-codex-"));
test.after(() => { try { fs.rmSync(casa, { recursive: true, force: true, maxRetries: 5 }); } catch {} });  // preso no Windows: fica
process.env.HOME = casa;
process.env.USERPROFILE = casa;
const sessions = require("../../extensao/out/sessions.js");
const codex = require("../../extensao/out/codex.js");

const CODEX = path.join(casa, ".codex");
const USO = path.join(sessions.MONITOR_DIR, "uso-codex.json");
const agora = () => Date.now() / 1000;
const ID1 = "00000000-0000-4000-8000-000000000001";
const ID2 = "00000000-0000-4000-8000-000000000002";
const ID3 = "00000000-0000-4000-8000-000000000003";
beforeEach(() => {
    fs.rmSync(CODEX, { recursive: true, force: true });
    fs.rmSync(sessions.MONITOR_DIR, { recursive: true, force: true });
    codex.lerSessoesCodex();  // sem ~/.codex: esquece o que leu no teste anterior
});

// --- o formato do rollout: uma linha JSON { timestamp, type, payload } ---
const quando = (segundos) => new Date((agora() - segundos) * 1000).toISOString();
const meta = (id, cwd = path.join(casa, "projetos", "meu-projeto"), originator = "codex_vscode") =>
    ({ timestamp: quando(60), type: "session_meta", payload: { id, cwd, originator, source: "vscode" } });
const evento = (tipo, segundos, extra = {}) => ({ timestamp: quando(segundos), type: "event_msg", payload: { type: tipo, ...extra } });
const comecou = (segundos = 30) => evento("task_started", segundos);
const terminou = (texto, segundos = 10) => evento("task_complete", segundos, { last_agent_message: texto });
const limites = (primary, secondary = null, plano = "free") =>
    evento("token_count", 5, { info: null, rate_limits: { primary, secondary, plan_type: plano } });
const resposta = (texto) => ({ timestamp: quando(20), type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: texto }] } });

function rollout(id, linhas, { mtimeHa = 0, diasAtras = 0 } = {}) {
    const d = new Date(Date.now() - diasAtras * 86400000);
    const dois = (n) => String(n).padStart(2, "0");
    const dir = path.join(CODEX, "sessions", String(d.getFullYear()), dois(d.getMonth() + 1), dois(d.getDate()));
    fs.mkdirSync(dir, { recursive: true });
    const arquivo = path.join(dir, `rollout-2026-10-16T10-00-00-${id}.jsonl`);
    fs.writeFileSync(arquivo, linhas.map((l) => JSON.stringify(l)).join("\n") + "\n");
    if (mtimeHa) { const t = agora() - mtimeHa; fs.utimesSync(arquivo, t, t); }
    return arquivo;
}
const indice = (...itens) => fs.writeFileSync(path.join(CODEX, "session_index.jsonl"),
    itens.map(([id, nome]) => JSON.stringify({ id, thread_name: nome, updated_at: quando(5) })).join("\n") + "\n");
const arquivoDaSessao = (id) => path.join(sessions.SESS_DIR, `codex-${id}.json`);
const lerSessao = (id) => JSON.parse(fs.readFileSync(arquivoDaSessao(id), "utf8"));

test("trabalhando: task_started sem task_complete depois", () => {
    rollout(ID1, [meta(ID1), comecou(), resposta("Vou editar o arquivo.")]);
    const lista = codex.lerSessoesCodex();
    assert.strictEqual(lista.length, 1);
    const s = lerSessao(ID1);
    assert.strictEqual(s.agente, "codex");
    assert.strictEqual(s.state, "working");
    assert.strictEqual(s.cwd, path.join(casa, "projetos", "meu-projeto"));
    assert.strictEqual(s.entrypoint, "codex_vscode");
    assert.ok(s.transcript.endsWith(`${ID1}.jsonl`));
    assert.ok(!("pergunta" in s));
    assert.ok(Math.abs(s.updated - agora()) < 5);
    assert.ok(s.since > agora() - 60 && s.since < agora());
});

test("esperando: task_complete depois do task_started; sem pergunta", () => {
    rollout(ID1, [meta(ID1), comecou(30), terminou("Pronto, alterei o arquivo.")]);
    codex.lerSessoesCodex();
    const s = lerSessao(ID1);
    assert.strictEqual(s.state, "waiting");
    assert.ok(!("pergunta" in s));
});

test("pergunta: última fala termina em '?'; '?' entre aspas ou crases é citação", () => {
    rollout(ID1, [meta(ID1), comecou(30), terminou("Mudei o banco.\n\nPosso rodar a migração?")]);
    rollout(ID2, [meta(ID2), comecou(30), terminou("Testei o \"vem hoje?\" e o `troca?` agora.")]);
    rollout(ID3, [meta(ID3), comecou(30), terminou(null)]);
    codex.lerSessoesCodex();
    assert.strictEqual(lerSessao(ID1).pergunta, true);
    assert.ok(!("pergunta" in lerSessao(ID2)));
    assert.ok(!("pergunta" in lerSessao(ID3)));
});

test("pergunta de um turno que já recomeçou some (estado volta a trabalhando)", () => {
    const arquivo = rollout(ID1, [meta(ID1), comecou(60), terminou("Seguimos?", 50)]);
    codex.lerSessoesCodex();
    assert.strictEqual(lerSessao(ID1).pergunta, true);
    fs.appendFileSync(arquivo, JSON.stringify(comecou(1)) + "\n");
    codex.lerSessoesCodex();
    const s = lerSessao(ID1);
    assert.strictEqual(s.state, "working");
    assert.ok(!("pergunta" in s));
});

test("título vem do session_index.jsonl; sem ele, o nome da pasta do cwd", () => {
    rollout(ID1, [meta(ID1, path.join(casa, "projetos", "loja-do-ze")), comecou()]);
    rollout(ID2, [meta(ID2, path.join(casa, "projetos", "outro-app") + path.sep), comecou()]);
    indice([ID1, "Arrumar o carrinho"], ["99999999-0000-4000-8000-000000000009", "De outra sessão"]);
    codex.lerSessoesCodex();
    assert.strictEqual(lerSessao(ID1).name, "Arrumar o carrinho");
    assert.strictEqual(lerSessao(ID2).name, "outro-app");
});

test("lê só o que o rollout ganhou: o estado acompanha o que foi anexado", () => {
    const arquivo = rollout(ID1, [meta(ID1), comecou()]);
    codex.lerSessoesCodex();
    assert.strictEqual(lerSessao(ID1).state, "working");
    // linha pela metade: não conta até chegar inteira
    const linha = JSON.stringify(terminou("Feito."));
    fs.appendFileSync(arquivo, linha.slice(0, 20));
    codex.lerSessoesCodex();
    assert.strictEqual(lerSessao(ID1).state, "working");
    fs.appendFileSync(arquivo, linha.slice(20) + "\n");
    codex.lerSessoesCodex();
    assert.strictEqual(lerSessao(ID1).state, "waiting");
});

test("rollout grande: na 1ª leitura só o final é lido, e o id e a pasta vêm da 1ª linha", () => {
    const grande = rollout(ID1, [meta(ID1), comecou(900), terminou("Antigo.", 800)]);
    const enchimento = JSON.stringify(resposta("x".repeat(200 * 1024))) + "\n";
    for (let i = 0; i < 25; i++) fs.appendFileSync(grande, enchimento);  // ~5 MB
    fs.appendFileSync(grande, JSON.stringify(comecou(5)) + "\n");
    codex.lerSessoesCodex();
    const s = lerSessao(ID1);
    assert.strictEqual(s.state, "working");
    assert.strictEqual(s.cwd, path.join(casa, "projetos", "meu-projeto"));
});

test("sessão fechada (rollout parado há mais de 6 h) some junto com o arquivo", () => {
    const arquivo = rollout(ID1, [meta(ID1), comecou()]);
    rollout(ID2, [meta(ID2), comecou()], { mtimeHa: 7 * 3600 });
    codex.lerSessoesCodex();
    assert.ok(fs.existsSync(arquivoDaSessao(ID1)));
    assert.ok(!fs.existsSync(arquivoDaSessao(ID2)), "a parada há 7 h não pode aparecer");
    const antiga = agora() - 7 * 3600;
    fs.utimesSync(arquivo, antiga, antiga);
    codex.lerSessoesCodex();
    assert.ok(!fs.existsSync(arquivoDaSessao(ID1)), "ficou o arquivo da sessão que fechou");
    // rollout apagado também some
    const outro = rollout(ID3, [meta(ID3), comecou()]);
    codex.lerSessoesCodex();
    assert.ok(fs.existsSync(arquivoDaSessao(ID3)));
    fs.rmSync(outro);
    assert.deepStrictEqual(codex.lerSessoesCodex(), []);
    assert.ok(!fs.existsSync(arquivoDaSessao(ID3)));
});

test("não mexe nas sessões do Claude da mesma pasta", () => {
    fs.mkdirSync(sessions.SESS_DIR, { recursive: true });
    const doClaude = path.join(sessions.SESS_DIR, "abc-123.json");
    fs.writeFileSync(doClaude, JSON.stringify({ name: "x", state: "working", pid: process.pid, updated: agora() }));
    rollout(ID1, [meta(ID1), comecou()]);
    codex.lerSessoesCodex();
    fs.rmSync(path.join(CODEX, "sessions"), { recursive: true });
    codex.lerSessoesCodex();
    assert.ok(fs.existsSync(doClaude));
});

test("sem ~/.codex: não faz nada (nem cria pasta)", () => {
    assert.deepStrictEqual(codex.lerSessoesCodex(), []);
    assert.strictEqual(codex.usoCodex(), null);
    assert.deepStrictEqual(codex.sincronizarCodex(), []);
    assert.ok(!fs.existsSync(sessions.MONITOR_DIR), "criou ~/.claude-monitor sem ter Codex");
});

test("só varre os últimos dias: rollout de uma pasta antiga fica de fora", () => {
    rollout(ID1, [meta(ID1), comecou()], { diasAtras: 10 });
    assert.deepStrictEqual(codex.lerSessoesCodex(), []);
});

test("rótulos da janela: 300 = 5h, 10080 = 7d, 43200 = 30d, outro = minutos", () => {
    assert.deepStrictEqual([300, 10080, 43200, 90].map(codex.rotuloDaJanela), ["5h", "7d", "30d", "90min"]);
});

test("uso do plano Free: uma janela só, de 30 dias", () => {
    const reinicia = Math.floor(agora()) + 20 * 86400;
    rollout(ID1, [meta(ID1), comecou(), limites({ used_percent: 12.5, window_minutes: 43200, resets_at: reinicia })]);
    codex.sincronizarCodex();
    const u = JSON.parse(fs.readFileSync(USO, "utf8"));
    assert.deepStrictEqual(u.janelas, [{ rotulo: "30d", usado: 12.5, reinicia: new Date(reinicia * 1000).toISOString() }]);
    assert.strictEqual(u.plano, "free");
    assert.ok(typeof u.atualizado === "number");
});

test("uso de plano pago: 5h e 7d, do rollout que falou por último", () => {
    const reinicia = Math.floor(agora()) + 3600;
    rollout(ID1, [meta(ID1), comecou(), limites({ used_percent: 99, window_minutes: 300, resets_at: reinicia }, null, "plus")]);
    rollout(ID2, [meta(ID2), comecou(),
        { ...limites({ used_percent: 20, window_minutes: 300, resets_at: reinicia }, { used_percent: 61, window_minutes: 10080, resets_at: reinicia + 86400 }, "plus"), timestamp: quando(1) }]);
    codex.sincronizarCodex();
    const u = JSON.parse(fs.readFileSync(USO, "utf8"));
    assert.deepStrictEqual(u.janelas.map((j) => [j.rotulo, j.usado]), [["5h", 20], ["7d", 61]]);
    assert.strictEqual(u.plano, "plus");
});

test("sem rate_limits nos rollouts: não grava uso-codex.json", () => {
    rollout(ID1, [meta(ID1), comecou()]);
    codex.sincronizarCodex();
    assert.ok(!fs.existsSync(USO));
});

test("readSessions leva o agente e a pergunta adiante; sessão do Claude é 'claude'", async () => {
    rollout(ID1, [meta(ID1), comecou(30), terminou("Posso seguir?")]);
    fs.mkdirSync(sessions.SESS_DIR, { recursive: true });
    fs.writeFileSync(path.join(sessions.SESS_DIR, "abc-123.json"), JSON.stringify({ name: "do Claude", state: "working", pid: process.pid, updated: agora(), cwd: casa }));
    codex.sincronizarCodex();
    const lista = await sessions.readSessions();
    const c = lista.find((s) => s.id === `codex-${ID1}`);
    assert.ok(c, JSON.stringify(lista));
    assert.strictEqual(c.agente, "codex");
    assert.strictEqual(c.pergunta, true);
    assert.strictEqual(c.state, "waiting");
    assert.strictEqual(c.pid, null);
    const claude = lista.find((s) => s.id === "abc-123");
    assert.strictEqual(claude.agente, "claude");
    assert.strictEqual(claude.pergunta, false);
});

test("readSessions: sessão do Codex sem pid segue na lista (o título do arquivo vale) e a velha sai", async () => {
    rollout(ID1, [meta(ID1), comecou()]);
    indice([ID1, "Título do índice"]);
    codex.sincronizarCodex();
    // o rollout é de outro formato: o leitor de título do Claude não pode mexer no nome
    assert.deepStrictEqual((await sessions.readSessions()).map((s) => s.name), ["Título do índice"]);
    const velho = lerSessao(ID1);
    fs.writeFileSync(arquivoDaSessao(ID1), JSON.stringify({ ...velho, updated: agora() - 7 * 3600 }));
    assert.deepStrictEqual(await sessions.readSessions(), []);
});
