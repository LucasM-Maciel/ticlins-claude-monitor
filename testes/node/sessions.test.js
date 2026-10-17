// sessions.js: a lista de sessões da barra lateral do VS Code.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const casa = fs.mkdtempSync(path.join(os.tmpdir(), "cm-sessions-"));
test.after(() => { try { fs.rmSync(casa, { recursive: true, force: true, maxRetries: 5 }); } catch {} });  // preso no Windows: fica
process.env.HOME = casa;
process.env.USERPROFILE = casa;
const sessions = require("../../extensao/out/sessions.js");

const agora = () => Date.now() / 1000;
const pidMorto = () => spawnSync(process.execPath, ["-e", ""]).pid;
function gravar(id, dados) {
    fs.mkdirSync(sessions.SESS_DIR, { recursive: true });
    fs.writeFileSync(path.join(sessions.SESS_DIR, `${id}.json`), JSON.stringify({ cwd: casa, updated: agora(), ...dados }));
}
beforeEach(() => fs.rmSync(sessions.SESS_DIR, { recursive: true, force: true }));

test("sem pasta de sessões: lista vazia", async () => {
    assert.deepStrictEqual(await sessions.readSessions(), []);
});

test("pid morto sai da lista e o arquivo é apagado", async () => {
    gravar("viva", { name: "viva", state: "working", pid: process.pid });
    gravar("morta", { name: "morta", state: "working", pid: pidMorto() });
    const lista = await sessions.readSessions();
    assert.deepStrictEqual(lista.map((s) => s.name), ["viva"]);
    assert.ok(!fs.existsSync(path.join(sessions.SESS_DIR, "morta.json")));
});

test("mesmo processo com 2 arquivos (/clear): fica o mais novo", async () => {
    gravar("velho", { name: "velho", state: "working", pid: process.pid, updated: agora() - 100 });
    gravar("novo", { name: "novo", state: "waiting", pid: process.pid });
    assert.deepStrictEqual((await sessions.readSessions()).map((s) => s.name), ["novo"]);
});

test("permissão aprovada (transcript mexeu depois) vira 'working'", async () => {
    const t = path.join(casa, "t.jsonl");
    fs.writeFileSync(t, "{}\n");
    gravar("p", { name: "p", state: "permission", pid: process.pid, since: agora() - 600, transcript: t });
    assert.strictEqual((await sessions.readSessions())[0].state, "working");
});

test("permissão ainda aberta continua 'permission'", async () => {
    const t = path.join(casa, "t2.jsonl");
    fs.writeFileSync(t, "{}\n");
    const antes = agora() - 60;
    fs.utimesSync(t, antes, antes);
    gravar("p", { name: "p", state: "permission", pid: process.pid, since: agora(), transcript: t });
    assert.strictEqual((await sessions.readSessions())[0].state, "permission");
});

// o Stop grava "waiting" quando o agente principal encerra a vez, mesmo com subagentes rodando; quando eles
// voltam nenhum hook marca "working". Atividade no transcript (ou nos dos subagentes) depois do Stop = ainda trabalhando.
test("Stop no meio da tarefa: transcript mexendo depois dele continua 'working'", async () => {
    const t = path.join(casa, "m1.jsonl");
    fs.writeFileSync(t, "{}\n");
    gravar("m1", { name: "m1", state: "waiting", pid: process.pid, since: agora() - 30, transcript: t });
    assert.strictEqual((await sessions.readSessions())[0].state, "working");
});

test("Stop no meio da tarefa: subagente ainda escrevendo continua 'working'", async () => {
    const t = path.join(casa, "m2.jsonl");
    fs.writeFileSync(t, "{}\n");
    const velho = agora() - 120;
    fs.utimesSync(t, velho, velho);
    fs.mkdirSync(path.join(casa, "m2", "subagents"), { recursive: true });
    fs.writeFileSync(path.join(casa, "m2", "subagents", "agent-x.jsonl"), "{}\n");
    gravar("m2", { name: "m2", state: "waiting", pid: process.pid, since: agora() - 60, transcript: t });
    assert.strictEqual((await sessions.readSessions())[0].state, "working");
});

test("terminou de verdade: transcript e subagentes parados continuam 'waiting'", async () => {
    const t = path.join(casa, "m3.jsonl");
    fs.writeFileSync(t, "{}\n");
    fs.mkdirSync(path.join(casa, "m3", "subagents"), { recursive: true });
    const sub = path.join(casa, "m3", "subagents", "agent-y.jsonl");
    fs.writeFileSync(sub, "{}\n");
    const velho = agora() - 300;
    fs.utimesSync(t, velho, velho);
    fs.utimesSync(sub, velho, velho);
    gravar("m3", { name: "m3", state: "waiting", pid: process.pid, since: agora() - 400, transcript: t });
    assert.strictEqual((await sessions.readSessions())[0].state, "waiting");
});

test("escrita colada no Stop (título, snapshot) não vira 'working'", async () => {
    const t = path.join(casa, "m4.jsonl");
    fs.writeFileSync(t, "{}\n");
    gravar("m4", { name: "m4", state: "waiting", pid: process.pid, since: agora() + 1, transcript: t });
    assert.strictEqual((await sessions.readSessions())[0].state, "waiting");
});

test("título do transcript ganha do nome gravado; /rename ganha do automático", async () => {
    const t = path.join(casa, "t3.jsonl");
    fs.writeFileSync(t, [
        JSON.stringify({ type: "ai-title", aiTitle: "Automático" }),
        JSON.stringify({ type: "custom-title", customTitle: "Renomeada" }),
    ].join("\n") + "\n");
    gravar("r", { name: "meu-projeto", state: "working", pid: process.pid, transcript: t });
    assert.strictEqual((await sessions.readSessions())[0].name, "Renomeada");
});

test("arquivo quebrado é ignorado sem derrubar a lista", async () => {
    gravar("boa", { name: "boa", state: "working", pid: process.pid });
    fs.writeFileSync(path.join(sessions.SESS_DIR, "ruim.json"), "{quebr");
    assert.deepStrictEqual((await sessions.readSessions()).map((s) => s.name), ["boa"]);
});

test("formatElapsed", () => {
    assert.strictEqual(sessions.formatElapsed(5), "5s");
    assert.strictEqual(sessions.formatElapsed(125), "2min");
    assert.strictEqual(sessions.formatElapsed(3600), "1h");
    assert.strictEqual(sessions.formatElapsed(3 * 3600 + 7 * 60), "3h07");
    assert.strictEqual(sessions.formatElapsed(-10), "0s");
});

test("som: só o 1º que pede toca (várias janelas do VS Code)", () => {
    const s = { id: "som", since: agora() };
    assert.strictEqual(sessions.claimSound(s), true);
    assert.strictEqual(sessions.claimSound(s), false);
});
