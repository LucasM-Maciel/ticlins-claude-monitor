// hook.js: o que o Claude Code roda a cada evento. Não pode travar o Claude
// nunca, e tem que gravar o estado certo.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const HOOK = path.join(__dirname, "..", "..", "extensao", "out", "hook.js");

const casas = [];  // apagadas no fim do arquivo (arquivo preso no Windows não derruba o teste)
function casaNova() {
    const casa = fs.mkdtempSync(path.join(os.tmpdir(), "cm hook ção-"));  // espaço e acento de propósito
    casas.push(casa);
    return casa;
}
test.after(() => { for (const c of casas) try { fs.rmSync(c, { recursive: true, force: true, maxRetries: 5 }); } catch {} });
function rodar(casa, evento, dados, env = {}) {
    const r = spawnSync(process.execPath, [HOOK, evento], {
        input: typeof dados === "string" ? dados : JSON.stringify(dados),
        env: { ...process.env, HOME: casa, USERPROFILE: casa, CLAUDE_PID: String(process.pid), ...env },
        encoding: "utf8",
        timeout: 15000,
    });
    assert.strictEqual(r.status, 0, `hook saiu com ${r.status}: ${r.stderr}`);
    return r;
}
function sessao(casa, id) {
    return JSON.parse(fs.readFileSync(path.join(casa, ".claude-monitor", "sessions", `${id}.json`), "utf8"));
}
function transcript(casa, linhas) {
    const f = path.join(casa, "t.jsonl");
    fs.writeFileSync(f, linhas.map((l) => JSON.stringify(l)).join("\n") + "\n");
    return f;
}

test("UserPromptSubmit grava 'working' com pid, pasta e nome da pasta", () => {
    const casa = casaNova();
    rodar(casa, "working", { session_id: "s1", cwd: path.join(casa, "meu-projeto") });
    const s = sessao(casa, "s1");
    assert.strictEqual(s.state, "working");
    assert.strictEqual(s.name, "meu-projeto");
    assert.strictEqual(s.pid, process.pid);
    assert.ok(Math.abs(s.since - Date.now() / 1000) < 30);
});

test("nome vem do transcript: /rename ganha do título automático", () => {
    const casa = casaNova();
    const t = transcript(casa, [
        { type: "custom-title", customTitle: "Renomeada", sessionId: "s1" },
        { type: "ai-title", aiTitle: "Automático", sessionId: "s1" },
    ]);
    rodar(casa, "working", { session_id: "s1", cwd: casa, transcript_path: t });
    assert.strictEqual(sessao(casa, "s1").name, "Renomeada");
});

test("título de outra sessão no mesmo transcript não vale", () => {
    const casa = casaNova();
    const t = transcript(casa, [
        { type: "ai-title", aiTitle: "Minha", sessionId: "s1" },
        { type: "ai-title", aiTitle: "De outra", sessionId: "s2" },
    ]);
    rodar(casa, "working", { session_id: "s1", cwd: casa, transcript_path: t });
    assert.strictEqual(sessao(casa, "s1").name, "Minha");
});

test("Stop vira 'waiting'; aviso de ociosidade depois não reinicia o relógio", () => {
    const casa = casaNova();
    rodar(casa, "waiting", { session_id: "s1", cwd: casa });
    const antes = sessao(casa, "s1").since;
    rodar(casa, "notification", { session_id: "s1", cwd: casa, message: "Claude is waiting for your input" });
    const s = sessao(casa, "s1");
    assert.strictEqual(s.state, "waiting");
    assert.strictEqual(s.since, antes);
});

test("pedido de permissão vira 'permission' (pela mensagem, pelo tipo e por elicitation)", () => {
    for (const dados of [
        { message: "Claude needs your permission to use Bash" },
        { notification_type: "permission_prompt", message: "x" },
        { notification_type: "elicitation_dialog", message: "x" },
    ]) {
        const casa = casaNova();
        rodar(casa, "notification", { session_id: "s1", cwd: casa, ...dados });
        assert.strictEqual(sessao(casa, "s1").state, "permission", JSON.stringify(dados));
    }
});

test("2º pedido de permissão seguido reinicia o relógio (senão o transcript do trabalho entre os dois vira 'working')", () => {
    const casa = casaNova();
    const pedido = { session_id: "s1", cwd: casa, notification_type: "permission_prompt", message: "x" };
    rodar(casa, "notification", pedido);
    const antes = sessao(casa, "s1").since;
    rodar(casa, "notification", pedido);  // aprovou o 1º, ela trabalhou e pediu de novo: nenhum hook no meio
    const s = sessao(casa, "s1");
    assert.strictEqual(s.state, "permission");
    assert.ok(s.since > antes, `since ${s.since} devia passar de ${antes}`);
});

test("SessionEnd apaga a sessão", () => {
    const casa = casaNova();
    rodar(casa, "working", { session_id: "s1", cwd: casa });
    rodar(casa, "end", { session_id: "s1" });
    assert.ok(!fs.existsSync(path.join(casa, ".claude-monitor", "sessions", "s1.json")));
});

test("pid fica o mesmo a sessão inteira (não recalcula a cada evento)", () => {
    const casa = casaNova();
    rodar(casa, "working", { session_id: "s1", cwd: casa });
    rodar(casa, "waiting", { session_id: "s1", cwd: casa }, { CLAUDE_PID: "12345" });
    assert.strictEqual(sessao(casa, "s1").pid, process.pid);
});

test("entrada quebrada ou vazia não derruba o hook", () => {
    const casa = casaNova();
    rodar(casa, "working", "isso não é json");
    rodar(casa, "working", "");
    assert.strictEqual(sessao(casa, "unknown").state, "working");
});

test("hook nunca falha, nem com a pasta de casa impossível de usar", () => {
    const casa = casaNova();
    const arquivo = path.join(casa, "sou-um-arquivo");
    fs.writeFileSync(arquivo, "x");
    rodar(arquivo, "working", { session_id: "s1", cwd: casa });  // .claude-monitor dentro de um ARQUIVO
});

test("hook é rápido (o UserPromptSubmit segura o Claude enquanto roda)", () => {
    const casa = casaNova();
    const inicio = Date.now();
    rodar(casa, "working", { session_id: "s1", cwd: casa });
    assert.ok(Date.now() - inicio < 3000, `demorou ${Date.now() - inicio} ms`);
});

// --- sem-node.sh: o plano B do hook, de verdade (no sh do Git no Windows, no /bin/sh no resto) ---
function acharSh() {
    const candidatos = [process.env.CM_SH, "C:/Program Files/Git/usr/bin/sh.exe", "C:/Program Files (x86)/Git/usr/bin/sh.exe", "/bin/sh", "/usr/bin/sh"].filter(Boolean);
    const achado = candidatos.find((c) => fs.existsSync(c));
    if (achado) return achado;
    const w = spawnSync(process.platform === "win32" ? "where" : "which", ["sh"], { encoding: "utf8" });
    return w.status === 0 ? w.stdout.split(/\r?\n/)[0].trim() || null : null;
}
const SH = acharSh();
const SEM_NODE = path.join(__dirname, "..", "..", "extensao", "out", "sem-node.sh");

/** Roda o sem-node.sh como o Claude Code roda (sh "<caminho>" working, JSON no stdin), com o PATH dado. */
function rodarSemNode(casa, pathDoTeste, nodeReserva) {
    const dir = path.join(casa, ".claude-monitor");
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ["hook.js", "processes.js", "sem-node.sh"]) fs.copyFileSync(path.join(path.dirname(SEM_NODE), f), path.join(dir, f));
    if (nodeReserva) fs.writeFileSync(path.join(dir, "node-reserva"), nodeReserva.split(path.sep).join("/"));
    // o PATH do teste vira o único (no Windows a variável se chama "Path": tira todas as grafias)
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toLowerCase() !== "path"));
    Object.assign(env, { PATH: pathDoTeste, HOME: casa, USERPROFILE: casa, CLAUDE_PID: String(process.pid) });
    return spawnSync(SH, [path.join(dir, "sem-node.sh").split(path.sep).join("/"), "working"], {
        input: JSON.stringify({ session_id: "sn1", cwd: path.join(casa, "projeto").split(path.sep).join("/") }),
        env, encoding: "utf8", timeout: 20000,
    });
}
const pastaDoSh = SH && path.dirname(SH);
const semNodeNoPath = SH && spawnSync(SH, ["-c", "command -v node"], { env: { PATH: pastaDoSh }, encoding: "utf8" }).status !== 0;

test("sem-node.sh com node no PATH: sai 0 sem fazer nada (quem roda é o outro hook)", { skip: !SH && "sem sh nesta máquina" }, () => {
    const casa = casaNova();
    const r = rodarSemNode(casa, [pastaDoSh, path.dirname(process.execPath)].join(path.delimiter), process.execPath);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(!fs.existsSync(path.join(casa, ".claude-monitor", "sessions", "sn1.json")), "gravou a sessão mesmo com node no PATH");
});

test("sem-node.sh sem node no PATH: roda o hook.js no node do node-reserva e grava a sessão", { skip: (!SH && "sem sh nesta máquina") || (!semNodeNoPath && "o sh vive na mesma pasta de um node") }, () => {
    const casa = casaNova();
    const r = rodarSemNode(casa, pastaDoSh, process.execPath);
    assert.strictEqual(r.status, 0, r.stderr);
    const s = sessao(casa, "sn1");
    assert.strictEqual(s.state, "working");
    assert.strictEqual(s.name, "projeto");
});

test("sem-node.sh sem node no PATH e sem node-reserva (ou com caminho morto): sai 0 calado, sem gravar", { skip: (!SH && "sem sh nesta máquina") || (!semNodeNoPath && "o sh vive na mesma pasta de um node") }, () => {
    const casa = casaNova();
    for (const reserva of [null, path.join(casa, "nao-existe", "node")]) {
        const r = rodarSemNode(casa, pastaDoSh, reserva);
        assert.strictEqual(r.status, 0, r.stderr);
    }
    assert.ok(!fs.existsSync(path.join(casa, ".claude-monitor", "sessions", "sn1.json")));
});

test("automatica: CLAUDE_CODE_ENTRYPOINT sdk-* grava automatica:true; claude-vscode e vazio não", () => {
    const casa = casaNova();
    rodar(casa, "working", { session_id: "sdk1", cwd: casa }, { CLAUDE_CODE_ENTRYPOINT: "sdk-cli" });
    rodar(casa, "working", { session_id: "aba1", cwd: casa }, { CLAUDE_CODE_ENTRYPOINT: "claude-vscode" });
    rodar(casa, "working", { session_id: "vazio1", cwd: casa }, { CLAUDE_CODE_ENTRYPOINT: "" });
    assert.strictEqual(sessao(casa, "sdk1").automatica, true);
    assert.strictEqual(sessao(casa, "aba1").automatica, undefined);
    assert.strictEqual(sessao(casa, "vazio1").automatica, undefined);
});

test("ehAutomatica: a regra única das duas fontes", () => {
    const { ehAutomatica } = require("../../extensao/out/processes.js");
    for (const o of ["codex_exec", "Claude Code"]) assert.strictEqual(ehAutomatica(o, "codex"), true, o);
    for (const o of ["codex_vscode", "codex-tui", "", null, undefined]) assert.strictEqual(ehAutomatica(o, "codex"), false, String(o));
    assert.strictEqual(ehAutomatica("sdk-cli", "claude"), true);
    assert.strictEqual(ehAutomatica("sdk-ts"), true);
    for (const o of ["claude-vscode", "cli", "", null, undefined]) assert.strictEqual(ehAutomatica(o, "claude"), false, String(o));
});
