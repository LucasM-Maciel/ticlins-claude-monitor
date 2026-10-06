"use strict";
/**
 * Sons e texturas do Minecraft, baixados do servidor da Mojang (o mesmo que o
 * launcher do jogo usa): ninguém precisa ter o Minecraft nem o ffmpeg, e nada da
 * Mojang vai no pacote. Grava em ~/.claude-monitor:
 *   sons/*.wav  os .ogg da versão mais nova, decodificados aqui (vorbis.min.js)
 *   picareta.png, espada.png, diamante.png, pedra.png (a pedra é o minério de
 *               diamante) e as do tema Minecraft da janelinha (terra, grama,
 *               orbe de XP, barra de XP, letra): do jar da versão, só os pedaços
 *               que interessam (o jar tem ~40 MB, baixa ~4 MB)
 * Sem internet, fica o que tinha (sons do sistema e os desenhos da janelinha).
 * Uso: node minecraft.js  (o instalador roda; o comando "Usar sons do Minecraft"
 * e a extensão, quando falta som, chamam baixarTudo()).
 * Pra trocar/adicionar som, mexa em SONS (os nomes estão no índice de assets do jogo).
 * Teste: CLAUDE_MONITOR_MOJANG=http://127.0.0.1:porta troca a Mojang por
 * testes/mojang-falso.js.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const SONS = {
    xp: "random/orb", // pegar XP
    levelup: "random/levelup",
    pop: "random/pop", // pegar item
    aldeao_hmm1: "mob/villager/idle1",
    aldeao_hmm2: "mob/villager/idle2",
    aldeao_sim: "mob/villager/yes1",
    pling: "note/pling", // note block
    sino: "note/bell",
    bigorna: "random/anvil_land",
    gato: "mob/cat/meow1",
    // o Ender Dragon (minecraft-dragao.js: a trilha da cena)
    dragao_rugido1: "mob/enderdragon/growl1",
    dragao_rugido2: "mob/enderdragon/growl2",
    dragao_rugido3: "mob/enderdragon/growl3",
    dragao_asa1: "mob/enderdragon/wings1",
    dragao_asa2: "mob/enderdragon/wings2",
    dragao_asa3: "mob/enderdragon/wings3",
    dragao_asa4: "mob/enderdragon/wings4",
    dragao_dano1: "mob/enderdragon/hit1",
    dragao_dano2: "mob/enderdragon/hit2",
    dragao_dano3: "mob/enderdragon/hit3",
    dragao_morte: "mob/enderdragon/end",
    sopro: "mob/ghast/fireball4", // o dragão cospe
    explosao1: "random/explode1",
    explosao2: "random/explode2",
    arco: "random/bow",
    flecha: "random/bowhit1",
    critico1: "entity/player/attack/crit1",
    critico2: "entity/player/attack/crit2",
    teleporte: "mob/endermen/portal",
};
const TONS = { xp: [0.8, 1.0, 1.25] }; // como o jogo, o XP muda de tom a cada vez: xp1, xp2, xp3
const TEXTURAS = {
    picareta: "item/diamond_pickaxe", espada: "item/diamond_sword", diamante: "item/diamond", pedra: "block/diamond_ore",
    // tema Minecraft: borda do cartão, bolinhas, barra do usage e números
    terra: "block/dirt", grama: "block/grass_block_side", orbe: "entity/experience/experience_orb",
    xp_fundo: "gui/sprites/hud/experience_bar_background", xp_barra: "gui/sprites/hud/experience_bar_progress", fonte: "font/ascii",
    // eventos do tema Minecraft (motor/minecraft-*.js): mobs, partículas, corações, blocos e itens.
    // Um caminho por nome: dois nomes no mesmo arquivo do jar, só um seria gravado.
    zumbi: "entity/zombie/zombie", creeper: "entity/creeper/creeper", esqueleto: "entity/skeleton/skeleton",
    aranha: "entity/spider/spider", aranha_olhos: "entity/spider/spider_eyes", slime: "entity/slime/slime",
    silverfish: "entity/silverfish/silverfish", enderman: "entity/enderman/enderman", enderman_olhos: "entity/enderman/enderman_eyes",
    lobo: "entity/wolf/wolf", lobo_manso: "entity/wolf/wolf_tame", lobo_coleira: "entity/wolf/wolf_collar",
    galinha: "entity/chicken/chicken_temperate", flecha: "entity/projectiles/arrow", escudo: "entity/shield/shield_base_nopattern",
    critico: "particle/critical_hit", coracao_part: "particle/heart",
    coracao_cheio: "gui/sprites/hud/heart/full", coracao_meio: "gui/sprites/hud/heart/half", coracao_vazio: "gui/sprites/hud/heart/container",
    coracao_vazio_pisca: "gui/sprites/hud/heart/container_blinking", coracao_ouro: "gui/sprites/hud/heart/absorbing_full",
    rocha: "block/stone", min_carvao: "block/coal_ore", min_ferro: "block/iron_ore", min_ouro: "block/gold_ore",
    min_redstone: "block/redstone_ore", min_lapis: "block/lapis_ore", min_esmeralda: "block/emerald_ore",
    it_carne: "item/rotten_flesh", it_osso: "item/bone", it_linha: "item/string", it_slime: "item/slime_ball", it_ovo: "item/egg",
    it_carvao: "item/coal", it_ferro: "item/raw_iron", it_ouro: "item/raw_gold", it_redstone: "item/redstone",
    it_lapis: "item/lapis_lazuli", it_esmeralda: "item/emerald",
    arco: "item/bow", arco0: "item/bow_pulling_0", arco1: "item/bow_pulling_1", arco2: "item/bow_pulling_2", totem: "item/totem_of_undying",
    // o Ender Dragon (motor/minecraft-dragao.js)
    dragao: "entity/enderdragon/dragon", dragao_olhos: "entity/enderdragon/dragon_eyes", dragao_bola: "entity/enderdragon/dragon_fireball",
    end_stone: "block/end_stone", ceu_end: "environment/end_sky", ovo_dragao: "block/dragon_egg", flash: "particle/flash",
    cristal: "entity/end_crystal/end_crystal", cristal_raio: "entity/end_crystal/end_crystal_beam",
    boss_fundo: "gui/sprites/boss_bar/purple_background", boss_barra: "gui/sprites/boss_bar/purple_progress",
};
// as numeradas: fumaça, explosão, varrida e faísca (partículas) e as rachaduras do bloco
for (let i = 0; i < 8; i++) Object.assign(TEXTURAS, { [`poof${i}`]: `particle/generic_${i}`, [`varrida${i}`]: `particle/sweep_${i}`, [`brilho${i}`]: `particle/glitter_${i}` });
for (let i = 0; i < 16; i++) TEXTURAS[`explosao${i}`] = `particle/explosion_${i}`;
for (let i = 0; i < 10; i++) TEXTURAS[`racha${i}`] = `block/destroy_stage_${i}`;
const TAXA = 44100;

function enderecos() {
    const teste = process.env.CLAUDE_MONITOR_MOJANG;
    if (teste) return { manifesto: `${teste}/version_manifest_v2.json`, objetos: `${teste}/objetos` };
    return { manifesto: "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json", objetos: "https://resources.download.minecraft.net" };
}

/** GET -> Buffer. `faixa` [início, fim] pede só esse pedaço (e exige que o servidor obedeça). */
function baixar(url, faixa, saltos = 0) {
    return new Promise((ok, erro) => {
        const http = require(url.startsWith("https:") ? "https" : "http");
        const pedido = http.get(url, { headers: faixa ? { Range: `bytes=${faixa[0]}-${faixa[1]}` } : {}, timeout: 20000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && saltos < 3) {
                res.resume();
                ok(baixar(new URL(res.headers.location, url).href, faixa, saltos + 1));
                return;
            }
            if (res.statusCode !== (faixa ? 206 : 200)) {
                res.destroy();  // sem Range viria o jar inteiro: nem lê
                erro(new Error(`${url}: HTTP ${res.statusCode}`));
                return;
            }
            const pedacos = [];
            res.on("data", (p) => pedacos.push(p));
            res.on("end", () => ok(Buffer.concat(pedacos)));
            res.on("error", erro);
        });
        pedido.on("timeout", () => pedido.destroy(new Error(`${url}: sem resposta`)));
        pedido.on("error", erro);
    });
}
const baixarJson = async (url) => JSON.parse((await baixar(url)).toString("utf8"));

/** Grava inteiro de uma vez: a janelinha nunca pega um .wav pela metade. */
function gravar(arquivo, dados) {
    fs.writeFileSync(`${arquivo}.novo`, dados);
    fs.renameSync(`${arquivo}.novo`, arquivo);
}

let OggVorbisDecoder;
/** Ogg Vorbis -> { channelData, sampleRate } (wasm-audio-decoders; licenças em vorbis-licencas.txt). */
async function decodificar(ogg) {
    if (!OggVorbisDecoder) {
        const modulo = { exports: {} };
        // o Worker é só do modo com threads, que não usamos
        new Function("exports", "require", "module", fs.readFileSync(path.join(__dirname, "vorbis.min.js"), "utf8"))(
            modulo.exports, (nome) => (nome === "@eshaz/web-worker" ? class {} : require(nome)), modulo);
        OggVorbisDecoder = modulo.exports.OggVorbisDecoder;
    }
    const decodificador = new OggVorbisDecoder();
    await decodificador.ready;
    try {
        const r = await decodificador.decodeFile(new Uint8Array(ogg));
        if (!r.samplesDecoded) throw new Error("não é um Ogg Vorbis");
        return r;
    } finally {
        decodificador.free();
    }
}

/**
 * Áudio -> WAV mono 16 bits a 44100, com 80% do volume. O tom muda como no jogo:
 * tocar mais rápido (mais agudo = mais curto). A reamostragem é sinc com janela
 * de Hann, que corta o que passaria de 22 kHz quando o tom sobe.
 */
function wav(canais, taxa, tom = 1) {
    const mono = new Float32Array(canais[0].length);
    for (const c of canais) for (let i = 0; i < mono.length; i++) mono[i] += c[i] / canais.length;
    const passo = (taxa * tom) / TAXA;  // amostras de entrada por amostra de saída
    const corte = Math.min(1, 1 / passo);
    const raio = Math.ceil(8 / corte);
    const n = Math.floor(mono.length / passo);
    const saida = Buffer.alloc(44 + 2 * n);
    for (let i = 0; i < n; i++) {
        const t = i * passo;
        let soma = 0;
        for (let k = Math.max(0, Math.floor(t) - raio + 1); k <= Math.min(mono.length - 1, Math.floor(t) + raio); k++) {
            const d = t - k;
            const x = Math.PI * corte * d;
            soma += mono[k] * corte * (x === 0 ? 1 : Math.sin(x) / x) * (0.5 + 0.5 * Math.cos((Math.PI * d) / raio));
        }
        saida.writeInt16LE(Math.round(Math.max(-1, Math.min(1, soma * 0.8)) * 32767), 44 + 2 * i);
    }
    saida.write("RIFF", 0);
    saida.writeUInt32LE(36 + 2 * n, 4);
    saida.write("WAVEfmt ", 8);
    saida.writeUInt32LE(16, 16);
    saida.writeUInt16LE(1, 20);  // PCM
    saida.writeUInt16LE(1, 22);  // mono
    saida.writeUInt32LE(TAXA, 24);
    saida.writeUInt32LE(TAXA * 2, 28);
    saida.writeUInt16LE(2, 32);
    saida.writeUInt16LE(16, 34);
    saida.write("data", 36);
    saida.writeUInt32LE(2 * n, 40);
    return saida;
}

/** Tira os PNGs do jar pela internet: o fim do zip, o índice dele e cada arquivo. */
async function texturas({ url, size }, destino) {
    const fim = await baixar(url, [Math.max(0, size - 65557), size - 1]);
    const eocd = fim.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) throw new Error("o jar não parece um zip");
    const inicio = fim.readUInt32LE(eocd + 16);
    const indice = await baixar(url, [inicio, inicio + fim.readUInt32LE(eocd + 12) - 1]);
    const procuradas = new Map(Object.entries(TEXTURAS).map(([nome, t]) => [`assets/minecraft/textures/${t}.png`, nome]));
    const feitas = [];
    for (let p = 0; p + 46 <= indice.length && indice.readUInt32LE(p) === 0x02014b50;) {
        const tamNome = indice.readUInt16LE(p + 28);
        const nome = procuradas.get(indice.toString("utf8", p + 46, p + 46 + tamNome));
        const metodo = indice.readUInt16LE(p + 10), tamanho = indice.readUInt32LE(p + 20), local = indice.readUInt32LE(p + 42);
        p += 46 + tamNome + indice.readUInt16LE(p + 30) + indice.readUInt16LE(p + 32);
        if (!nome || (metodo !== 0 && metodo !== 8) || !tamanho) continue;
        const cabecalho = await baixar(url, [local, local + 29]);
        const dados = local + 30 + cabecalho.readUInt16LE(26) + cabecalho.readUInt16LE(28);
        const comprimido = await baixar(url, [dados, dados + tamanho - 1]);
        const png = metodo === 8 ? zlib.inflateRawSync(comprimido) : comprimido;
        if (png.readUInt32BE(0) !== 0x89504e47) continue;
        gravar(path.join(destino, `${nome}.png`), png);
        feitas.push(nome);
    }
    return feitas;
}

/** Baixa tudo. Som ou textura que falhar só avisa (log); sem manifesto, rejeita. */
async function baixarTudo({ destino = path.join(os.homedir(), ".claude-monitor"), log = () => {} } = {}) {
    const end = enderecos();
    const manifesto = await baixarJson(end.manifesto);
    const ultima = manifesto.versions.find((v) => v.id === manifesto.latest.release);
    if (!ultima) throw new Error("o manifesto da Mojang não tem a versão mais nova");
    const versao = await baixarJson(ultima.url);
    const objetos = (await baixarJson(versao.assetIndex.url)).objects;
    const pastaSons = path.join(destino, "sons");
    fs.mkdirSync(pastaSons, { recursive: true });
    let sons = 0;
    for (const [nome, som] of Object.entries(SONS)) {
        const objeto = objetos[`minecraft/sounds/${som}.ogg`];
        if (!objeto) {
            log(`aviso: ${nome} (${som}) não está no Minecraft ${ultima.id}`);
            continue;
        }
        try {
            const audio = await decodificar(await baixar(`${end.objetos}/${objeto.hash.slice(0, 2)}/${objeto.hash}`));
            const tons = TONS[nome] || [1];
            tons.forEach((tom, i) => {
                const arquivo = tons.length > 1 ? `${nome}${i + 1}.wav` : `${nome}.wav`;
                gravar(path.join(pastaSons, arquivo), wav(audio.channelData, audio.sampleRate, tom));
                log(arquivo);
                sons++;
            });
        } catch (err) {
            log(`aviso: ${nome}: ${err.message}`);
        }
    }
    let feitas = [];
    try {
        feitas = await texturas(versao.downloads.client, destino);
        for (const nome of feitas) log(`${nome}.png`);
    } catch (err) {
        log(`aviso: texturas: ${err.message}`);
    }
    // a janelinha aberta vê o arquivo dela "mudar" e se reabre já com os sons
    if (sons || feitas.length) {
        for (const f of ["overlay.ps1", "ClaudeMonitor"]) {
            const arquivo = path.join(destino, f);
            if (fs.existsSync(arquivo)) fs.utimesSync(arquivo, new Date(), new Date());
        }
    }
    return { versao: ultima.id, sons, texturas: feitas.length };
}

if (require.main === module) {
    const atalho = process.platform === "darwin" ? "Cmd+Shift+P" : "Ctrl+Shift+P";
    console.log("Baixando do servidor da Mojang...");
    baixarTudo({ log: (t) => console.log(`   ${t}`) }).then((r) => {
        if (r.sons) {
            console.log(`Pronto! A janelinha já está com os sons do Minecraft ${r.versao}.`);
            return;
        }
        console.log("Nenhum som baixado (veja os avisos acima): a janelinha fica com os sons do sistema.");
        process.exitCode = 1;
    }, (err) => {
        console.log(`Não consegui falar com o servidor da Mojang (${err.message}).`);
        console.log(`Sem internet? Depois, no VS Code: ${atalho} > "Claude Monitor: Usar sons do Minecraft".`);
        process.exitCode = 1;
    });
}

module.exports = { baixarTudo, wav, SONS, TONS, TEXTURAS };
