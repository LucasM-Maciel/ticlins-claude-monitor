'use strict';
// "Parado há muito tempo" (dono 07/10): depois de ESPERA s parado (nada rodando), o tema
// começa uma das cenas de parado dele (parado-<tema>-<id>.js), uma vez cada uma
// (m.salvo.paradoVez sobrevive a reabrir). Quando algo volta a rodar, a saída da cena
// (≤ 1,2 s) toca no lugar e só depois ele sai andando: o tema chama clawd() e bloqueia()
// daqui. Pergunta, festa ou dragão cortam sem a saída e não gastam a vez (volta a mesma).
// Cada cena: { texturas, linhaDoTempo, cena(m) (dur Infinity, modos ['parado']),
// saida: { dur, quadro(g, t, m, tCorte) } }; a saída roda no MESMO Mundo da cena (refaz o
// estado do corte com o que cena(m) guardou nele).
const { temTexturas } = require('./comum');

const ESPERA = 60;  // s parado até começar

function paradas(tema, ids) {
  const mods = Object.fromEntries(ids.map(id => [id, require(`./parado-${tema}-${id}`)]));
  const cena = (m, id) => (mods[id] ? { ...mods[id].cena(m), nome: id, parado: id } : null);
  const saida = m => { const s = m.estado.saida; return s && m.andando && m.T - s.t0 < mods[s.id].saida.dur ? s : null; };
  return {
    ids,
    texturas: [...new Set(ids.flatMap(id => mods[id].texturas || []))],
    cena,
    passo(m) {
      if (m.modo !== 'parado' || m.cena || m.T - m.desdeModo < ESPERA) return;
      const n = m.salvo.paradoVez || 0;
      for (let i = 0; i < ids.length && !m.cena; i++) {
        const id = ids[(n + i) % ids.length];  // a da vez; quebrada ou sem textura: a próxima
        if (!m.ruins.has(id) && temTexturas(...(mods[id].texturas || []))) m.comecarCena(cena(m, id));
      }
    },
    aoComecarCena(m, c) { if (c.parado) { m.salvo.paradoVez = ids.indexOf(c.parado) + 1; m.salvar(); } },
    aoFimCena(m, c) {
      if (!c || !c.parado) return;
      if (m.andando) m.estado.saida = { id: c.parado, t0: m.T, tCorte: m.T - c.t0 };
      else if (!m.ruins.has(c.nome)) { m.salvo.paradoVez = ids.indexOf(c.parado); m.salvar(); }
    },
    bloqueia: m => !!saida(m),
    // a saída no lugar do Clawd (false = não tem saída tocando); quebrou: anota e larga
    clawd(g, m) {
      const s = saida(m);
      if (!s) return false;
      g.save();
      try { mods[s.id].saida.quadro(g, m.T - s.t0, m, s.tCorte); } catch (e) {
        g.restore();
        m.estado.saida = null; m.ruins.add(s.id);
        if (m.aoErro) m.aoErro(`saída de ${s.id} quebrou: ${e.stack || e.message}`);
        return false;
      }
      g.restore();
      return true;
    },
  };
}

module.exports = { paradas, ESPERA };
