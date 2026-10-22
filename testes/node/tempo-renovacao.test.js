'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('renova em 30 s: barras Claude/Codex mostram <1m; sessões mantêm agora', {
  skip: process.platform !== 'win32',
}, () => {
  const fonte = fs.readFileSync(path.join(__dirname, '../../extensao/janelinha/overlay.ps1'), 'utf8');
  const funcoes = ['Tr', 'NomeNoIdioma', 'Tempo', 'RitmoDe', 'DadosDoMedidor'].map(nome => {
    const trecho = fonte.match(new RegExp('^function ' + nome + '\\([^]*?^\\}', 'm'));
    assert.ok(trecho, nome);
    return trecho[0];
  }).join('\n');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `${funcoes}
    $config = @{ tema = 'padrao'; ritmo = $false }
    $coresDoUso = @{ padrao = @('#fff', '#fff', '#fff') }
    $duracaoDaJanela = @{}
    $renova = [DateTimeOffset]::Now.AddSeconds(30).ToString('o')
    @{
      sessoes = @(Tempo 0.5; Tempo 1; Tempo 80)
      contadores = @(foreach ($rotulo in '5h', '7d', '30d', '120min') {
        (DadosDoMedidor $rotulo @{ utilization = 42; resets_at = $renova }).falta
      })
      minutos = (DadosDoMedidor '5h' @{ utilization = 42; resets_at = [DateTimeOffset]::Now.AddSeconds(90).ToString('o') }).falta
      semReset = (DadosDoMedidor '5h' @{ utilization = 42 }).falta
      expirado = (DadosDoMedidor '5h' @{ utilization = 42; resets_at = [DateTimeOffset]::Now.AddSeconds(-30).ToString('o') }).falta
      ingles = $(& { $config.idioma = 'en'; @(Tempo 0.5; (DadosDoMedidor '5h' @{ utilization = 42; resets_at = $renova }).falta) })
    } | ConvertTo-Json -Compress
  `], { encoding: 'utf8', timeout: 15000, windowsHide: true });
  assert.equal(r.status, 0, r.error?.message || r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), {
    sessoes: ['agora', '1m', '1h20'],
    contadores: ['<1m', '<1m', '<1m', '<1m'],
    minutos: '1m', semReset: '', expirado: '',
    ingles: ['now', '<1m'],  // Idioma = English no botão direito
  });
});
