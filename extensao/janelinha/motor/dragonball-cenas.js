'use strict';
// Tema Dragon Ball: as cenas de luta das paradas (prévia 3). Sem arma: ele luta com ki.
// quadro(g, t, R, m) no referencial do Clawd (x+ pra frente, y- pra fora do cartão, chão = 0);
// R = o que ele veste agora (a transformação, se houver). Tudo função de t: k (o alvo da vez)
// é sorteado quando a cena começa.
const { lim, sai, entra, rgba } = require('./comum');
const {
  ALTURA, fatia, clawdDB, desenhaInimigo, chegando, disco, bolaKi, feixe, fumaca, estrelinhas, impacto, linhasVel,
  desenhaNuvemP, fiapo, largPx, textoPx,
} = require('./dragonball-arte');

const MAO_Y = -7.5, MAO_FRENTE = 14, MAO_TRAS = -13;
const ALVOS_ONDA = ['robo', 'meteoro', 'monstro'];

const CENAS = {
  // carrega uma bola azul na mão de trás, empurra pra frente e dispara o feixe; o alvo some em fumaça
  onda: k => {
    const alvo = ALVOS_ONDA[k % 3], AX = 46, BATE = 2.12;
    return {
      dur: 3.8, espaco: { frente: 84, tras: 30 },
      quadro(g, t, R) {
        let ax = AX, ay = 0;
        if (alvo === 'meteoro') { const u = fatia(t, 0, BATE); ax = 92 + (AX - 92) * u; ay = -50 + (-8 + 50) * u; }
        else ({ x: ax, y: ay } = chegando(alvo, t, 76, AX));
        const segura = t >= BATE && t < 2.8;
        if (t < 2.75) desenhaInimigo(g, alvo, ax + (segura ? (Math.floor(t / 0.04) % 2 ? 1 : -1) : 0), ay, { t, branco: segura && Math.floor(t / 0.06) % 2 === 0, golpe: segura && Math.floor(t / 0.06) % 2 === 1 });
        let rot = 0, x = 0, sy = 1, y = 0;
        if (t >= 0.8 && t < 1.85) { rot = -8 * sai(fatia(t, 0.8, 1.0)); sy = 1 - 0.08 * sai(fatia(t, 0.8, 1.0)); }
        else if (t >= 1.85 && t < 2.95) { const u = sai(fatia(t, 1.85, 1.97)); rot = -8 + 15 * u; x = 1.5 * u; sy = 0.92; }
        else if (t >= 2.95 && t < 3.3) { const u = fatia(t, 2.95, 3.3); rot = 7 * (1 - u); x = 1.5 * (1 - u); sy = 0.92 + 0.08 * u; }
        else if (t >= 3.3 && t < 3.55) y = -4 * Math.sin(Math.PI * fatia(t, 3.3, 3.55));
        clawdDB(g, { ...R, x, y, rot, sy, olhos: t >= 1.0 && t < 1.85 ? 'fechados' : 'abertos' });
        if (t >= 1.0 && t < 1.85) {  // carga: faíscas vêm até a mão
          const u = fatia(t, 1.0, 1.85), r = 0.75 + 2.75 * sai(u);
          for (let j = 0; j < 6; j++) {
            const f = (t / 0.4 + j / 6) % 1, an = j * 1.05 + 0.4, d = 12 * (1 - f);
            g.fillStyle = rgba('#BFDBFE', f); g.fillRect(Math.round(MAO_TRAS + Math.cos(an) * d), Math.round(MAO_Y + Math.sin(an) * d * 0.7), 1, 1);
          }
          bolaKi(g, MAO_TRAS, MAO_Y, r, t);
        } else if (t >= 1.85 && t < 1.97) bolaKi(g, MAO_TRAS + (MAO_FRENTE - MAO_TRAS) * sai(fatia(t, 1.85, 1.97)), MAO_Y, 3.5, t);
        else if (t >= 1.97 && t < 2.95) {
          const alvoX = alvo === 'meteoro' ? AX - 6 : AX - 8, frente = t < BATE ? MAO_FRENTE + (alvoX - MAO_FRENTE) * fatia(t, 1.97, BATE) : alvoX;
          const k2 = t < 2.8 ? 1 : 1 - fatia(t, 2.8, 2.95);
          feixe(g, MAO_FRENTE, frente, MAO_Y, t, k2);
          bolaKi(g, MAO_FRENTE, MAO_Y, 3.2 * k2, t);
          if (t < BATE) bolaKi(g, frente, MAO_Y, 4, t);
        }
        impacto(g, AX - 4, alvo === 'meteoro' ? -8 : -9, t - BATE, 1.2);
        fumaca(g, AX, alvo === 'meteoro' ? -8 : -7, t - 2.75);
        estrelinhas(g, AX, alvo === 'meteoro' ? -8 : -9, t - 2.75);
      },
    };
  },
  // some num "zip", reaparece atrás do alvo virado pra ele e dá um soco; depois volta do mesmo jeito
  teleporte: k => {
    const alvo = k % 2 ? 'robo' : 'monstro', AX = 40, ATRAS = 58;
    return {
      dur: 3.2, espaco: { frente: 78, tras: 20 },
      quadro(g, t, R) {
        if (t < 2.1) {
          let { x, y } = chegando(alvo, t, 70, AX), rot = 0, e = { t };
          if (t >= 1.6) { const u = fatia(t, 1.6, 2.1); x = AX - 22 * sai(u); y = -10 * Math.sin(Math.PI * u); rot = -360 * u; e = { t, golpe: t < 1.75 }; }
          desenhaInimigo(g, alvo, x, y, { ...e, rot });
        }
        estrelinhas(g, AX - 22, -8, t - 2.1); fumaca(g, AX - 22, -6, t - 2.1, 0.6);
        const estica = (u, ida) => ({ sx: ida ? 1 - 0.8 * u : 0.2 + 0.8 * u, sy: ida ? 1 + 0.4 * u : 1.4 - 0.4 * u, alfa: Math.floor(t / 0.03) % 2 ? 1 : 0.35 });
        let p = null;
        if (t < 0.85) p = {};
        else if (t < 1.0) p = { sy: 1 - 0.1 * Math.sin(Math.PI * fatia(t, 0.85, 1.0)) };
        else if (t < 1.12) p = estica(fatia(t, 1.0, 1.12), true);
        else if (t >= 1.32 && t < 1.44) p = { x: ATRAS, ...estica(fatia(t, 1.32, 1.44), false), sx: -(0.2 + 0.8 * fatia(t, 1.32, 1.44)) };
        else if (t >= 1.44 && t < 2.3) {
          const arma = fatia(t, 1.44, 1.6), soco = fatia(t, 1.6, 1.68), volta = fatia(t, 1.9, 2.2);
          p = { x: ATRAS - 5 * soco + 5 * volta + 1.5 * arma * (1 - soco), sx: -1, rot: -6 * arma * (1 - soco) + 8 * soco * (1 - volta), bracos: t >= 1.6 && t < 1.9 ? [0, -1.5] : null };
        } else if (t >= 2.3 && t < 2.42) p = { x: ATRAS, ...estica(fatia(t, 2.3, 2.42), true), sx: -(1 - 0.8 * fatia(t, 2.3, 2.42)) };
        else if (t >= 2.6 && t < 2.72) p = estica(fatia(t, 2.6, 2.72), false);
        else if (t >= 2.72) p = { y: t >= 2.8 && t < 3.0 ? -4 * Math.sin(Math.PI * fatia(t, 2.8, 3.0)) : 0 };
        if (p) clawdDB(g, { ...R, ...p });
        linhasVel(g, 0, ATRAS, t - 1.0); linhasVel(g, ATRAS, 0, t - 2.3);
        impacto(g, ATRAS - 14, -8, t - 1.6);
      },
    };
  },
  // ergue os braços e junta energia numa esfera azul que cresce em cima dele; joga no alvo
  genki: k => {
    const alvo = k % 2 ? 'monstro' : 'robo', AX = 44, BATE = 2.9;
    return {
      dur: 4.2, espaco: { frente: 84, tras: 30 },
      quadro(g, t, R) {
        if (t < BATE + 0.05) { const { x, y } = chegando(alvo, t, 76, AX); desenhaInimigo(g, alvo, x, y, { t, golpe: t > 2.8 }); }
        const ergue = sai(fatia(t, 0.9, 1.1)) * (1 - fatia(t, 3.3, 3.6)), joga = fatia(t, 2.5, 2.7);
        const pulo = t >= 3.7 && t < 3.95 ? -4 * Math.sin(Math.PI * fatia(t, 3.7, 3.95)) : 0;
        clawdDB(g, { ...R, y: pulo, olhos: t > 0.9 && t < 2.6 ? 'cima' : 'abertos', bracos: ergue > 0 ? [-4.5 * ergue * (1 - joga), -4.5 * ergue] : null, rot: 10 * joga * (1 - fatia(t, 3.0, 3.3)) });
        const cy0 = -(ALTURA * 1.5 + 6);
        if (t >= 1.1 && t < 2.5) {
          const u = fatia(t, 1.1, 2.5), r = 1.5 + 8.5 * sai(u);
          for (let j = 0; j < 8; j++) {  // pontinhos de luz vindo de longe
            const f = (t / 0.5 + j / 8) % 1, an = j * 0.785 + 0.2, d = 34 * (1 - f) + r;
            g.fillStyle = rgba('#DBEAFE', f); g.fillRect(Math.round(Math.cos(an) * d), Math.round(cy0 - r + Math.sin(an) * d * 0.6), 1, 1);
          }
          bolaKi(g, 0, cy0 - r, r, t);
        } else if (t >= 2.5 && t < BATE) {
          const u = fatia(t, 2.5, BATE), r = 10 - 2 * u, x = AX * entra(u), y = (cy0 - 10) + (-9 - (cy0 - 10)) * entra(u) - 14 * Math.sin(Math.PI * u);
          bolaKi(g, x, y, r, t);
        }
        if (t >= BATE && t < BATE + 0.45) {  // domo da explosão
          const u = fatia(t, BATE, BATE + 0.45), r = 16 * sai(Math.min(1, u * 1.8));
          g.save(); g.globalAlpha *= 1 - u;
          discos(g, AX, -6, r);
          g.restore();
        }
        fumaca(g, AX, -6, t - 2.95, 0.8); estrelinhas(g, AX, -8, t - 2.95, 0.9, 8);
      },
    };
  },
  // um visor verde no olho dele lê o "poder", que sobe até estourar em 8000+; ele leva um susto
  rastreador: () => ({
    dur: 3.6, espaco: { frente: 24, tras: 20 },
    quadro(g, t, R) {
      let p = {};
      if (t >= 2.4 && t < 2.75) { const u = fatia(t, 2.4, 2.75); p = { x: -5 * u, y: -6 * Math.sin(Math.PI * u), olhos: 'cima' }; }
      else if (t >= 2.75) p = { x: -5 + 5 * fatia(t, 3.3, 3.6), rot: t > 2.9 && t < 3.3 ? 5 * Math.sin((t - 2.9) * 30) : 0 };
      clawdDB(g, { ...R, ...p });
      if (t < 2.4) {
        const esc = sai(fatia(t, 0, 0.3)), treme = t > 2.1 ? (Math.floor(t / 0.04) % 2 ? 0.75 : -0.75) : 0, verm = t > 2.1;
        g.save(); g.translate(treme, 0); g.globalAlpha *= esc;
        g.fillStyle = '#6B7280'; g.fillRect(9, -15, 4.5, 4.5); g.fillRect(6, -15, 3, 1.5);  // peça na orelha
        g.fillStyle = verm ? 'rgba(239,68,68,.55)' : (Math.floor(t / 0.2) % 2 ? 'rgba(74,222,128,.6)' : 'rgba(74,222,128,.42)');
        g.fillRect(2, -13.5, 6, 6);  // lente no olho da frente
        g.fillStyle = verm ? '#B91C1C' : '#16A34A'; g.fillRect(2, -13.5, 6, 1); g.fillRect(7, -13.5, 1, 6);
        g.restore();
        if (t >= 0.3) {
          const u = fatia(t, 0.3, 2.1), v = t < 2.1 ? String(Math.round((100 + 7900 * entra(u)) / 10) * 10) : '8000+';
          const cor = t < 2.1 ? '#4ADE80' : (Math.floor(t / 0.15) % 2 ? '#F59E0B' : '#EF4444');
          textoPx(g, v, Math.round(-largPx(v) / 2) + 3, -38, cor);
        }
      }
      if (t >= 2.4 && t < 3.0) {  // estouro do visor
        const d = t - 2.4;
        impacto(g, 5, -11, d, 0.7);
        for (let j = 0; j < 8; j++) {
          const an = j * 0.785 + 0.3, r = 3 + 26 * sai(d / 0.6);
          g.fillStyle = rgba(j % 2 ? '#4ADE80' : '#FDE047', 1 - d / 0.6);
          g.fillRect(Math.round(5 + Math.cos(an) * r), Math.round(-11 + Math.sin(an) * r + 30 * d * d), 1.5, 1.5);
        }
        fumaca(g, 5, -12, d - 0.05, 0.5);
      }
    },
  }),
  // dá a volta no cartão montado na nuvenzinha amarela, a 120 px/s (a nuvem aparece e some em 0,3 s).
  // O Mundo não anda durante a cena: o quadro põe o Clawd onde ele estaria (poseEm) e, como a volta
  // é inteira, ele termina no mesmo lugar.
  nuvem: (k, m) => {
    const per = m.perimetro();
    return {
      dur: per / 120 + 0.6, espaco: { frente: 0, tras: 0 },
      andou: t => 120 * lim(t - 0.3, 0, per / 120),
      quadro(g, t, R, mm) {
        const esc = lim(Math.min(t, this.dur - t) / 0.3, 0, 1), e = mm.host.escala || 1, p = mm.poseEm(this.andou(t));
        g.save();
        g.setTransform(e, 0, 0, e, 0, 0); g.translate(p.x, p.y); g.rotate(p.a);
        for (let j = 1; j <= 4 && esc === 1; j++) fiapo(g, -12 - j * 5, -3 + Math.sin(mm.T * 6 + j), j / 5);
        desenhaNuvemP(g, 0, -4, mm.T, esc);
        clawdDB(g, { ...R, y: -5 * esc });
        g.restore();
      },
    };
  },
};
// o domo da esfera gigante: 3 discos (fora, meio, miolo)
function discos(g, x, y, r) {
  disco(g, x, y, r, '#93C5FD'); disco(g, x, y, r * 0.7, '#DBEAFE'); disco(g, x, y, r * 0.4, '#FFFFFF');
}

module.exports = { CENAS };
