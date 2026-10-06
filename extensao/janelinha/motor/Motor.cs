// Lado Windows do motor das animações (motor.js): abre o node, manda o estado da
// janelinha (uma linha JSON por mensagem) e cola os quadros que voltam num
// WriteableBitmap. Ler e escrever ficam em threads próprias: a janela nunca espera
// o motor. Compilado pelo overlay.ps1 (Add-Type) na 1ª vez e guardado em
// ClaudeMonitorMotor.dll; o PowerShell só liga os eventos.
using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

namespace ClaudeMonitor
{
    public class Motor
    {
        readonly Image alvo;
        readonly Dispatcher ui;
        Process proc;
        Stream saida;
        Stream entrada;
        readonly BlockingCollection<string> fila = new BlockingCollection<string>(64);
        readonly object trava = new object();
        byte[] buf;            // o quadro inteiro, BGRA pré-multiplicado
        byte[] dados = new byte[0];
        int W, H;
        int sujoX0 = int.MaxValue, sujoY0 = int.MaxValue, sujoX1, sujoY1;
        bool pendente;
        WriteableBitmap bmp;

        public volatile bool Vivo;
        public long Quadros;          // quadros recebidos (o teste e o diário olham)
        public string Pronto;         // o JSON da mensagem P
        public event Action<string> Linha;   // pro diário (na thread da janela)
        public event Action<int> Saiu;       // código de saída (na thread da janela)
        public event Action Primeiro;        // chegou o 1º quadro (na thread da janela)
        public event Action ChegouPronto;    // chegou a mensagem P: o layout de cada tema (na thread da janela)

        public Motor(Image alvo) { this.alvo = alvo; ui = alvo.Dispatcher; }

        // node: o node.exe; comoNode: é o executável do VS Code (Electron), que só vira
        // node com ELECTRON_RUN_AS_NODE=1
        public void Iniciar(string node, bool comoNode, string script, string argumentos)
        {
            var psi = new ProcessStartInfo(node, "\"" + script + "\" " + argumentos)
            {
                UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
            };
            if (comoNode) psi.EnvironmentVariables["ELECTRON_RUN_AS_NODE"] = "1";
            else psi.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
            proc = new Process { StartInfo = psi, EnableRaisingEvents = true };
            proc.ErrorDataReceived += (s, e) => { if (!string.IsNullOrEmpty(e.Data)) Avisar("motor (stderr): " + e.Data); };
            proc.Exited += (s, e) =>
            {
                Vivo = false;
                int codigo = -1;
                try { codigo = proc.ExitCode; } catch { }
                ui.BeginInvoke(new Action(() => { if (Saiu != null) Saiu(codigo); }));
            };
            proc.Start();
            Vivo = true;
            proc.BeginErrorReadLine();
            saida = proc.StandardOutput.BaseStream;
            entrada = proc.StandardInput.BaseStream;  // em bytes: o StreamWriter dele usa a página de código do console
            new Thread(Ler) { IsBackground = true, Name = "motor-ler" }.Start();
            new Thread(Escrever) { IsBackground = true, Name = "motor-escrever" }.Start();
        }

        public void Enviar(string json)
        {
            // fila cheia = motor travado: descarta em vez de travar a janela
            if (Vivo) fila.TryAdd(json);
        }

        public void Parar()
        {
            Vivo = false;
            try { if (proc != null && !proc.HasExited) proc.Kill(); } catch { }
        }

        void Escrever()
        {
            var utf8 = new UTF8Encoding(false);
            try
            {
                foreach (var json in fila.GetConsumingEnumerable())
                {
                    var b = utf8.GetBytes(json + "\n");
                    entrada.Write(b, 0, b.Length);
                    entrada.Flush();
                }
            }
            catch { }  // o motor saiu: o Exited avisa
        }

        void LerTudo(byte[] b, int n)
        {
            int lido = 0;
            while (lido < n)
            {
                int k = saida.Read(b, lido, n - lido);
                if (k <= 0) throw new EndOfStreamException();
                lido += k;
            }
        }

        void Ler()
        {
            var cab = new byte[8];
            try
            {
                while (true)
                {
                    LerTudo(cab, 8);
                    if (cab[0] != 'C' || cab[1] != 'M') { Avisar("motor: mensagem fora do formato, parei de ler"); Parar(); return; }
                    int n = BitConverter.ToInt32(cab, 4);
                    if (n < 0 || n > 64 * 1024 * 1024) { Avisar("motor: mensagem grande demais (" + n + ")"); Parar(); return; }
                    if (dados.Length < n) dados = new byte[n];  // reaproveita: um quadro novo a cada 33 ms
                    LerTudo(dados, n);
                    char tipo = (char)cab[2];
                    if (tipo == 'Q') Quadro(n);
                    else if (tipo == 'L') Avisar(Encoding.UTF8.GetString(dados, 0, n));
                    else if (tipo == 'P')
                    {
                        Pronto = Encoding.UTF8.GetString(dados, 0, n);
                        ui.BeginInvoke(new Action(() => { if (ChegouPronto != null) ChegouPronto(); }));
                    }
                }
            }
            catch (EndOfStreamException) { }
            catch (Exception e) { Avisar("motor: erro lendo: " + e.Message); }
        }

        static int U16(byte[] b, int i) { return b[i] | (b[i + 1] << 8); }

        void Quadro(int n)
        {
            int w0 = U16(dados, 0), h0 = U16(dados, 2), x = U16(dados, 4), y = U16(dados, 6), w = U16(dados, 8), h = U16(dados, 10);
            if (12 + w * h * 4 > n || x + w > w0 || y + h > h0) { Avisar("motor: quadro com tamanho errado"); return; }
            bool primeiro;
            lock (trava)
            {
                if (w0 != W || h0 != H || buf == null) { W = w0; H = h0; buf = new byte[W * H * 4]; }
                for (int r = 0; r < h; r++) Buffer.BlockCopy(dados, 12 + r * w * 4, buf, ((y + r) * W + x) * 4, w * 4);
                sujoX0 = Math.Min(sujoX0, x); sujoY0 = Math.Min(sujoY0, y);
                sujoX1 = Math.Max(sujoX1, x + w); sujoY1 = Math.Max(sujoY1, y + h);
                primeiro = Quadros == 0;
                Quadros++;
                if (pendente) return;  // a janela ainda não colou o anterior: junta os dois
                pendente = true;
            }
            ui.BeginInvoke(DispatcherPriority.Render, new Action(Aplicar));
            if (primeiro) ui.BeginInvoke(DispatcherPriority.Render, new Action(() => { if (Primeiro != null) Primeiro(); }));  // depois do Aplicar: já tem o que mostrar
        }

        void Aplicar()
        {
            lock (trava)
            {
                pendente = false;
                if (buf == null) return;
                if (bmp == null || bmp.PixelWidth != W || bmp.PixelHeight != H)
                {
                    bmp = new WriteableBitmap(W, H, 96, 96, PixelFormats.Pbgra32, null);
                    alvo.Source = bmp;
                    sujoX0 = 0; sujoY0 = 0; sujoX1 = W; sujoY1 = H;
                }
                if (sujoX1 > sujoX0 && sujoY1 > sujoY0)
                    bmp.WritePixels(new Int32Rect(sujoX0, sujoY0, sujoX1 - sujoX0, sujoY1 - sujoY0), buf, W * 4, (sujoY0 * W + sujoX0) * 4);
                sujoX0 = int.MaxValue; sujoY0 = int.MaxValue; sujoX1 = 0; sujoY1 = 0;
            }
        }

        // o quadro atual, pro -Foto (BGRA pré-multiplicado, W x H)
        public byte[] Copia(out int w, out int h)
        {
            lock (trava) { w = W; h = H; return buf == null ? null : (byte[])buf.Clone(); }
        }

        void Avisar(string texto)
        {
            ui.BeginInvoke(new Action(() => { if (Linha != null) Linha(texto); }));
        }
    }
}
