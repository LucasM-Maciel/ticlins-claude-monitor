// fundo.js: sessão "terminou" com comando rodando por baixo (a esteira, um codex exec) ainda trabalha.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const casa = fs.mkdtempSync(path.join(os.tmpdir(), "cm-fundo-"));
test.after(() => { try { fs.rmSync(casa, { recursive: true, force: true, maxRetries: 5 }); } catch {} });
process.env.HOME = casa;
process.env.USERPROFILE = casa;
const fundo = require("../../extensao/out/fundo.js");

const tabela = (...linhas) => new Map(linhas.map(([pid, ppid, name]) => [pid, { ppid, name, tty: null }]));

test("shell em qualquer nível debaixo do claude conta; o próprio claude e servidor MCP (node, cmd) não", () => {
    const t = tabela([100, 1, "code"], [200, 100, "claude"], [201, 200, "node"], [202, 200, "cmd"], [203, 202, "node"]);
    assert.strictEqual(fundo.shellsDeFundo(t, 200), 0);
    t.set(204, { ppid: 200, name: "bash", tty: null });
    t.set(205, { ppid: 204, name: "python", tty: null });
    t.set(206, { ppid: 205, name: "sh", tty: null });  // o codex exec lançado pelo script, dois níveis abaixo
    assert.strictEqual(fundo.shellsDeFundo(t, 200), 2);
    assert.strictEqual(fundo.shellsDeFundo(t, 100), 2, 'a árvore do pai também enxerga');
    assert.strictEqual(fundo.shellsDeFundo(t, 999), 0);
});

test("shell de 1 varredura só (o hook do Stop) não vale; 2 seguidas valem; sumiu, zera", () => {
    const com = tabela([200, 1, "claude"], [204, 200, "bash"]);
    const sem = tabela([200, 1, "claude"]);
    const s = [{ id: "a", pid: 200 }];
    assert.deepStrictEqual([...fundo.atualizarContagem(com, s)], []);
    assert.deepStrictEqual([...fundo.atualizarContagem(com, s)], ["a"]);
    assert.deepStrictEqual([...fundo.atualizarContagem(sem, s)], []);
    assert.deepStrictEqual([...fundo.atualizarContagem(com, s)], [], 'recomeça a contar');
});

test("sincronizarFundo grava fundo.json só com quem tem shell em 2 varreduras, e lerFundo respeita a validade", async () => {
    const sess = path.join(casa, ".claude-monitor", "sessions");
    fs.mkdirSync(sess, { recursive: true });
    fs.writeFileSync(path.join(sess, "x.json"), JSON.stringify({ state: "waiting", pid: 300 }));
    fs.writeFileSync(path.join(sess, "y.json"), JSON.stringify({ state: "working", pid: 301 }));  // trabalhando: nem olha
    fs.writeFileSync(path.join(sess, "codex-z.json"), JSON.stringify({ agente: "codex", state: "waiting", pid: 302 }));
    const t = tabela([300, 1, "claude"], [310, 300, "bash"], [301, 1, "claude"], [311, 301, "bash"], [302, 1, "codex"], [312, 302, "bash"]);
    const agora = Date.now() / 1000;
    await fundo.sincronizarFundo(async () => t, agora);
    assert.deepStrictEqual([...fundo.lerFundo(agora)], [], '1ª varredura: ainda não');
    await fundo.sincronizarFundo(async () => t, agora + 9);
    assert.deepStrictEqual([...fundo.lerFundo(agora + 9)], ["x"]);
    await fundo.sincronizarFundo(async () => t, agora + 10);  // dentro dos 8 s: nem varre
    assert.deepStrictEqual([...fundo.lerFundo(agora + 10)], ["x"]);
    assert.deepStrictEqual([...fundo.lerFundo(agora + 200)], [], 'arquivo velho = extensão parou');
    await fundo.sincronizarFundo(async () => null, agora + 30);  // não listou os processos: mantém
    assert.deepStrictEqual([...fundo.lerFundo(agora + 30)], ["x"]);
});
