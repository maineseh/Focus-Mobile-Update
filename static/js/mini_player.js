// Mini-janelas flutuantes do Focus: cronômetro (uma janela POR DISCIPLINA) + música.
//
// Como funciona:
//  - Tudo fica DESLIGADO por padrão. Na aba Cronômetro de uma disciplina, o botão
//    "Ativar mini-janela" cria a janela DESSA disciplina. Cada disciplina ativada
//    tem a sua própria janela, com o próprio nome, cronômetro e posição — elas não
//    se misturam nem trocam de nome.
//  - A música tem a sua janelinha própria, que só aparece se "Música na mini-janela"
//    estiver ativado em Configurações (vem ligado).
//  - Na página da disciplina, a janela dela só ESPELHA o cronômetro da página. Ao sair,
//    a janela assume o MESMO cronômetro (mesma chave do localStorage) e, se a sessão
//    terminar, registra os minutos na disciplina, igual a página faria.
//  - Arrastável (mouse, dedo ou setas do teclado); clicar numa janela traz ela pra frente,
//    então dá pra mexer em qualquer uma mesmo se estiverem sobrepostas.
//  - Este arquivo vive no <head>, que o htmx não troca; o <body> é trocado a cada
//    navegação, então as janelas são re-anexadas. Cópias antigas (que o htmx guarda no
//    histórico do navegador) são removidas antes de salvar e a cada atualização.
//  - Só aparece com conta logada (o servidor injeta window.FOCUS_UID).
(function () {
    if (window.FocusMini) return;

    var K_ATIVO = 'focus_mini_ativo', K_DISCS = 'focus_mini_discs', K_POS = 'focus_mini_pos2',
        K_MIN = 'focus_mini_min2', K_MUSICA = 'focus_mini_musica', K_ANTIGO = 'focus_mini_disc';
    var janelas = {};            // chave -> { el, tipo, disc }
    var Z_BASE = 9100, Z_MAX = 9400, zTopo = Z_BASE, paginaId = null, infoPagina = null;
    var avisos = {};             // chave -> { msg, ate }

    // ---------- armazenamento (sempre com try/catch: pode estar bloqueado) ----------
    function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function gravar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function lerJSON(k, padrao) { try { var v = JSON.parse(ler(k)); return v == null ? padrao : v; } catch (e) { return padrao; } }

    function logado() { return typeof window.FOCUS_UID !== 'undefined' && window.FOCUS_UID !== null; }
    // As opções ficam guardadas POR USUÁRIO (chave + id). Assim, quem cria uma conta nova
    // (ou entra com outra conta no mesmo navegador) começa sempre com tudo DESATIVADO.
    function kUser(k) { return k + '_u' + (logado() ? window.FOCUS_UID : 'x'); }
    function ativo() { return ler(kUser(K_ATIVO)) === '1'; }
    function musicaOn() { return ler(kUser(K_MUSICA)) === '1'; }   // padrão: desligada
    function avisar() { try { document.dispatchEvent(new CustomEvent('focusmini:change')); } catch (e) {} }

    // disciplinas com janela: { "12": {id, nome, urlSessao, urlPagina, uid}, ... }
    function discs() {
        var todas = lerJSON(K_DISCS, {}), ok = {};
        // migração: versão anterior guardava uma disciplina só
        var antigo = lerJSON(K_ANTIGO, null);
        if (antigo && antigo.id && !ler(K_DISCS) && ativo()) { todas[antigo.id] = antigo; gravar(K_DISCS, JSON.stringify(todas)); }
        try { localStorage.removeItem(K_ANTIGO); } catch (e) {}
        Object.keys(todas).forEach(function (id) { if (todas[id] && todas[id].uid === window.FOCUS_UID) ok[id] = todas[id]; });
        return ok;
    }
    function gravarDiscs(o) { gravar(K_DISCS, JSON.stringify(o)); }
    function chaveTimer(d) { return 'focus_pomodoro_' + d.id; }

    // ---------- cronômetro ----------
    function lerTimer(d) {
        var base = { total: 1500, restante: 1500, rodando: false, modo: 25 };
        var e = lerJSON(chaveTimer(d), null);
        if (!e || !e.totalSegundos) return base;
        var rest = e.segundosRestantes;
        if (e.rodando) rest = Math.max(0, rest - Math.floor((Date.now() - e.marcador) / 1000));
        return { total: e.totalSegundos, restante: rest, rodando: !!e.rodando, modo: e.modoAtivo || Math.round(e.totalSegundos / 60) };
    }
    function gravarTimer(d, t) {
        gravar(chaveTimer(d), JSON.stringify({ totalSegundos: t.total, segundosRestantes: t.restante, rodando: t.rodando, marcador: Date.now(), modoAtivo: t.modo }));
    }
    function limparTimer(d) { try { localStorage.removeItem(chaveTimer(d)); } catch (e) {} }

    function registrar(d, minutos) {
        if (!d || !d.urlSessao || minutos <= 0) return;
        try {
            fetch(d.urlSessao, {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'minutos=' + minutos
            }).then(function (r) {
                if (r.status === 404) { var o = discs(); delete o[d.id]; gravarDiscs(o); atualizar(); }   // disciplina apagada
            }).catch(function () {});
        } catch (e) {}
    }

    function bipe() {
        try {
            var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
            var c = new C(), o = c.createOscillator(), g = c.createGain();
            o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.0001; o.connect(g); g.connect(c.destination);
            var t = c.currentTime; g.gain.exponentialRampToValueAtTime(0.15, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
            o.start(t); o.stop(t + 1); setTimeout(function () { try { c.close(); } catch (e) {} }, 1500);
        } catch (e) {}
        try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    }
    function aviso(chave, msg, ms) { avisos[chave] = { msg: msg, ate: Date.now() + ms }; }

    function naPagina(d) { return !!document.getElementById('pomodoroDisplay') && String(paginaId) === String(d.id); }

    function acaoPlay(d) {
        if (naPagina(d)) { if (window.iniciarPausar) window.iniciarPausar(); return; }
        var t = lerTimer(d);
        if (t.rodando) t.rodando = false; else { if (t.restante <= 0) t.restante = t.total; t.rodando = true; }
        gravarTimer(d, t); atualizar();
    }
    function acaoReiniciar(d) {
        if (naPagina(d)) { if (window.resetarPomodoro) window.resetarPomodoro(); return; }
        limparTimer(d); atualizar();
    }
    function acaoEncerrar(d) {
        if (naPagina(d)) { if (window.terminarSessao) window.terminarSessao(); return; }
        var t = lerTimer(d), min = Math.round((t.total - t.restante) / 60);
        if (min > 0) { registrar(d, min); aviso('t' + d.id, 'Sessão salva: ' + min + ' min ✔', 6000); }
        limparTimer(d); atualizar();
    }
    function acaoModo(d, min) {
        if (naPagina(d)) {
            var b = document.querySelector('.pomodoro-modes button[data-min="' + min + '"]');
            if (b && window.setModo) window.setModo(min, b); return;
        }
        var t = lerTimer(d); if (t.rodando) return;
        t.total = min * 60; t.restante = t.total; t.modo = min; gravarTimer(d, t); atualizar();
    }
    function fechar(d) {                // X da janela da disciplina: tira só ela
        var o = discs(); delete o[d.id]; gravarDiscs(o); atualizar(); avisar();
    }

    // ---------- música (usa o FocusSoundtrack que já existe) ----------
    function totalTrilhas() { var s = window.FocusSoundtrack; return window.FOCUS_PREMIUM === false ? 1 : (s && s.TRILHAS ? s.TRILHAS.length : 6); }
    function musicaPlay() { var s = window.FocusSoundtrack; if (s) { s.setEnabled(!s.getConfig().ligado); atualizar(); } }
    function musicaTroca(p) {
        var s = window.FocusSoundtrack; if (!s) return;
        var n = totalTrilhas(), i = s.getConfig().trilha; s.setTrilha(((i + p) % n + n) % n); atualizar();
    }

    // ---------- visual ----------
    var ICONE = '.fm-janela i[class*="fa-"]{font-family:"Font Awesome 6 Free","Font Awesome 5 Free"!important;font-style:normal;font-weight:900!important;line-height:1;display:inline-block}';
    var CSS = ICONE +
    '.fm-janela{--fm-borda:#8a949c;--fm-trilha:#d5dade;--fm-preench:#587894;--fm-chip:#9aa3aa;' +
    '--fm-borda:color-mix(in srgb,var(--text,#33424d) 75%,var(--card-bg,#fff));--fm-trilha:color-mix(in srgb,var(--text,#33424d) 18%,var(--card-bg,#fff));' +
    '--fm-preench:color-mix(in srgb,var(--accent-text,var(--primary,#587894)) 45%,var(--text,#33424d));--fm-chip:color-mix(in srgb,var(--text,#33424d) 68%,var(--card-bg,#fff));' +
    'position:fixed;z-index:9100;width:min(300px,calc(100vw - 24px));box-sizing:border-box;' +
    'background:var(--card-bg,#fff);color:var(--text,#33424d);border:2px solid var(--fm-borda);border-radius:26px;' +
    'box-shadow:0 0 0 1px color-mix(in srgb,var(--card-bg,#fff) 70%,transparent),0 12px 30px rgba(0,0,0,.30);font-family:"Nunito",system-ui,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none}' +
    '.fm-janela *{box-sizing:border-box}' +
    '.fm-janela button{font-family:inherit;border:0;cursor:pointer;color:inherit;background:transparent;font-weight:800}' +
    '.fm-janela button:focus-visible,.fm-janela .fm-topo:focus-visible{outline:3px solid var(--accent,#ffd174);outline-offset:2px}' +
    '.fm-topo{display:flex;align-items:center;gap:8px;padding:10px 10px 6px 16px;cursor:grab;border-radius:26px 26px 0 0}' +
    '.fm-janela.fm-arrastando .fm-topo{cursor:grabbing}' +
    '.fm-titulo{flex:1;min-width:0;font-size:12.5px;font-weight:800;color:var(--text,#33424d);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.fm-ib{width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;color:var(--text,#33424d)}' +
    '.fm-ib:hover{background:var(--fm-trilha)}' +
    '.fm-corpo{padding:0 16px 14px}' +
    '.fm-tempo{font-size:40px;line-height:1.1;font-weight:900;letter-spacing:-1px;text-align:center;font-variant-numeric:tabular-nums;font-family:"Baloo 2","Nunito",sans-serif}' +
    '.fm-barra{height:8px;border-radius:99px;background:var(--fm-trilha);overflow:hidden;margin:6px 0 10px}' +
    '.fm-barra i{display:block;height:100%;width:0;border-radius:99px;background:var(--fm-preench);transition:width .4s linear}' +
    '.fm-chips{display:flex;gap:6px;justify-content:center;margin-bottom:10px}' +
    '.fm-chip{padding:5px 12px;border-radius:99px;font-size:12.5px;border:2px solid var(--fm-chip)!important;color:var(--text,#33424d)}' +
    '.fm-chip.on{background:var(--accent,#ffd174);border-color:var(--fm-borda)!important;color:var(--on-accent,#1a1a1a)}' +
    '.fm-chip:disabled{opacity:.45;cursor:default}' +
    '.fm-ctl{display:flex;gap:8px;justify-content:center;align-items:center}' +
    '.fm-btn{height:40px;min-width:40px;padding:0 14px;border-radius:99px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:13.5px;border:2px solid var(--fm-chip)!important;color:var(--text,#33424d)}' +
    '.fm-btn.fm-principal{background:var(--accent,#ffd174);border-color:var(--fm-borda)!important;color:var(--on-accent,#1a1a1a);min-width:104px}' +
    '.fm-ok{font-size:13px;font-weight:800;text-align:center;padding:2px 0 8px;color:var(--text)}' +
    '.fm-musica{display:flex;align-items:center;gap:4px;margin:6px 16px 14px;padding:4px;border-radius:99px;background:var(--fm-trilha);border:1px solid var(--fm-chip)}' +
    '.fm-musica .fm-nome{flex:1;min-width:0;text-align:center;font-size:12.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.fm-musica .fm-ib{width:32px;height:32px}' +
    '.fm-musica .fm-ib.fm-mplay{background:var(--accent,#ffd174);color:var(--on-accent,#1a1a1a);border:2px solid var(--fm-borda)}' +
    '.fm-mini{display:none}' +
    '.fm-janela.fm-min{width:auto;border-radius:99px}' +
    '.fm-janela.fm-min .fm-corpo,.fm-janela.fm-min .fm-musica,.fm-janela.fm-min .fm-titulo{display:none}' +
    '.fm-janela.fm-min .fm-topo{padding:6px 8px 6px 14px;border-radius:99px}' +
    '.fm-janela.fm-min .fm-mini{display:inline;font-size:18px;font-weight:900;font-variant-numeric:tabular-nums;font-family:"Baloo 2","Nunito",sans-serif}' +
    '.fm-janela.fm-min.fm-tipo-musica .fm-mini{display:inline;font-size:13px}' +
    'body.high-contrast .fm-janela{background:#000!important;color:#fff!important;border-color:#ffe600!important}' +
    'body.high-contrast .fm-janela{--fm-borda:#ffe600;--fm-trilha:#444;--fm-preench:#ffe600;--fm-chip:#ffe600}' +
    'body.high-contrast .fm-principal,body.high-contrast .fm-chip.on,body.high-contrast .fm-mplay{background:#ffe600!important;color:#000!important}' +
    '@media (prefers-reduced-motion:reduce){.fm-barra i{transition:none}}' +
    'body.reduce-motion .fm-barra i{transition:none}';

    function htmlTopo(titulo) {
        return '<div class="fm-topo" tabindex="0" role="group" aria-label="Janela ' + titulo + '. Arraste ou use as setas para mover.">' +
          '<i class="fa-solid fa-grip-vertical" aria-hidden="true" style="opacity:.5;font-size:12px"></i>' +
          '<span class="fm-mini"></span><span class="fm-titulo"></span>' +
          '<button type="button" class="fm-ib fm-bmin" aria-label="Minimizar ou expandir"><i class="fa-solid fa-minus"></i></button>' +
          '<button type="button" class="fm-ib fm-bx" aria-label="Fechar esta janela" title="Fechar esta janela"><i class="fa-solid fa-xmark"></i></button></div>';
    }
    var HTML_TIMER =
        '<div class="fm-corpo"><div class="fm-ok" style="display:none"></div>' +
        '<div class="fm-tempo">25:00</div><div class="fm-barra"><i></i></div>' +
        '<div class="fm-chips"><button type="button" class="fm-chip" data-m="5">5</button><button type="button" class="fm-chip" data-m="15">15</button><button type="button" class="fm-chip" data-m="25">25</button></div>' +
        '<div class="fm-ctl"><button type="button" class="fm-btn fm-reset" aria-label="Reiniciar" title="Reiniciar (sem salvar)"><i class="fa-solid fa-rotate-left"></i></button>' +
        '<button type="button" class="fm-btn fm-principal fm-play"><i class="fa-solid fa-play"></i> Iniciar</button>' +
        '<button type="button" class="fm-btn fm-fim" aria-label="Terminar e salvar" title="Terminar e salvar os minutos"><i class="fa-solid fa-flag-checkered"></i></button></div></div>';
    var HTML_MUSICA =
        '<div class="fm-musica"><button type="button" class="fm-ib fm-prev" aria-label="Trilha anterior"><i class="fa-solid fa-backward-step"></i></button>' +
        '<span class="fm-nome">Música</span>' +
        '<button type="button" class="fm-ib fm-next" aria-label="Próxima trilha"><i class="fa-solid fa-forward-step"></i></button>' +
        '<button type="button" class="fm-ib fm-mplay" aria-label="Tocar ou pausar música"><i class="fa-solid fa-play"></i></button></div>';

    function q(j, s) { return j.el.querySelector(s); }

    function criar(chave, tipo, d) {
        if (!document.getElementById('focusMiniCss')) {
            var st = document.createElement('style'); st.id = 'focusMiniCss'; st.textContent = CSS;
            (document.head || document.documentElement).appendChild(st);
        }
        var el = document.createElement('div');
        el.className = 'fm-janela fm-tipo-' + tipo; el.setAttribute('data-fm', chave);
        el.setAttribute('role', 'region');
        el.innerHTML = htmlTopo(tipo === 'musica' ? 'Música' : d.nome) + (tipo === 'musica' ? HTML_MUSICA : HTML_TIMER);
        document.body.appendChild(el);
        var j = { el: el, tipo: tipo, disc: d, chave: chave };
        janelas[chave] = j;
        el.setAttribute('aria-label', tipo === 'musica' ? 'Mini-janela de música' : 'Mini-janela do cronômetro: ' + d.nome);
        q(j, '.fm-titulo').textContent = tipo === 'musica' ? 'Música' : d.nome;

        q(j, '.fm-bmin').onclick = function () { setMin(chave, !el.classList.contains('fm-min')); atualizar(); posicionar(j); };
        q(j, '.fm-bx').onclick = function () { if (tipo === 'musica') FocusMini.setMusica(false); else fechar(j.disc); };
        if (tipo === 'musica') {
            q(j, '.fm-prev').onclick = function () { musicaTroca(-1); };
            q(j, '.fm-next').onclick = function () { musicaTroca(1); };
            q(j, '.fm-mplay').onclick = musicaPlay;
        } else {
            q(j, '.fm-play').onclick = function () { acaoPlay(j.disc); };
            q(j, '.fm-reset').onclick = function () { acaoReiniciar(j.disc); };
            q(j, '.fm-fim').onclick = function () { acaoEncerrar(j.disc); };
            [].forEach.call(el.querySelectorAll('.fm-chip'), function (b) { b.onclick = function () { acaoModo(j.disc, parseInt(b.dataset.m, 10)); }; });
        }
        el.addEventListener('pointerdown', function () { trazParaFrente(el); }, true);   // traz pra frente
        ligarArrastar(j);
        ajustarZoom(j);
        posicionar(j);
        return j;
    }

    // Fica acima da barra de cima (z-index 9000) e do menu dela, mas abaixo dos modais e avisos
    // do site (9500+). Pra nunca passar desse teto, os níveis são renumerados quando enchem.
    function trazParaFrente(el) {
        if (zTopo >= Z_MAX) {
            var ordem = Object.keys(janelas).map(function (k) { return janelas[k].el; })
                .sort(function (a, b) { return (parseInt(a.style.zIndex, 10) || Z_BASE) - (parseInt(b.style.zIndex, 10) || Z_BASE); });
            ordem.forEach(function (e, i) { e.style.zIndex = Z_BASE + i; });
            zTopo = Z_BASE + ordem.length;
        }
        el.style.zIndex = ++zTopo;
    }

    // O "Tamanho da letra" (acessibilidade) aplica `zoom` no <body>. Como a janela vive dentro do
    // body, o zoom multiplicava as coordenadas dela e o card ficava longe do mouse ao arrastar.
    // Aqui anulamos esse zoom só na janela (zoom = 1/z), então posição e mouse voltam a coincidir.
    function zoomDoBody() {
        var z = 1;
        try { z = parseFloat(getComputedStyle(document.body).zoom); } catch (e) {}
        return (z && isFinite(z) && z > 0) ? z : 1;
    }
    function ajustarZoom(j) {
        var z = zoomDoBody();
        if (j.z === z) return false;
        j.z = z; j.el.style.zoom = z === 1 ? '' : String(1 / z);
        return true;
    }

    // ---------- posição / arrastar ----------
    function getMin(chave) { return !!lerJSON(K_MIN, {})[chave]; }
    function setMin(chave, v) { var o = lerJSON(K_MIN, {}); if (v) o[chave] = 1; else delete o[chave]; gravar(K_MIN, JSON.stringify(o)); }
    function limitar(el, x, y) {
        var w = el.offsetWidth, h = el.offsetHeight, m = 8;
        return { x: Math.max(m, Math.min(window.innerWidth - w - m, x)), y: Math.max(m, Math.min(window.innerHeight - h - m, y)) };
    }
    // Posição inicial (sem posição salva): janelas empilhadas em coluna a partir do canto
    // inferior direito, sem cobrir umas às outras; se a coluna enche, abre outra à esquerda.
    function posicaoPadrao(chave) {
        var cx = window.innerWidth - 16, cy = window.innerHeight - 16, largAnt = 0, r = { x: 8, y: 8 };
        var chaves = Object.keys(janelas);
        for (var i = 0; i < chaves.length; i++) {
            var e = janelas[chaves[i]].el, w = e.offsetWidth, h = e.offsetHeight;
            if (cy - h < 8 && largAnt) { cx -= largAnt + 12; cy = window.innerHeight - 16; }
            r = { x: cx - w, y: cy - h }; cy = r.y - 12; largAnt = Math.max(largAnt, w);
            if (chaves[i] === chave) break;
        }
        return r;
    }
    function posicionar(j) {
        var el = j.el, p = lerJSON(K_POS, {})[j.chave], x, y;
        if (p && typeof p.x === 'number') { x = p.x; y = p.y; }
        else { var d = posicaoPadrao(j.chave); x = d.x; y = d.y; }
        var c = limitar(el, x, y); el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
    }
    function salvarPos(j, x, y) { var o = lerJSON(K_POS, {}); o[j.chave] = { x: x, y: y }; gravar(K_POS, JSON.stringify(o)); }
    function ligarArrastar(j) {
        var el = j.el, topo = q(j, '.fm-topo'), dx = 0, dy = 0, drag = false;
        topo.addEventListener('pointerdown', function (e) {
            if (e.target.closest('button')) return;
            var r = el.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; drag = true;
            el.classList.add('fm-arrastando'); try { topo.setPointerCapture(e.pointerId); } catch (x) {}
        });
        topo.addEventListener('pointermove', function (e) {
            if (!drag) return; var c = limitar(el, e.clientX - dx, e.clientY - dy); el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
        });
        function fim() { if (!drag) return; drag = false; el.classList.remove('fm-arrastando'); salvarPos(j, parseInt(el.style.left, 10), parseInt(el.style.top, 10)); }
        topo.addEventListener('pointerup', fim); topo.addEventListener('pointercancel', fim);
        // clicar no relógio da pílula minimizada expande de volta
        q(j, '.fm-mini').addEventListener('click', function () { if (el.classList.contains('fm-min')) { setMin(j.chave, false); atualizar(); posicionar(j); } });
        topo.addEventListener('keydown', function (e) {
            var passo = e.shiftKey ? 48 : 12, x = parseInt(el.style.left, 10), y = parseInt(el.style.top, 10), ok = true;
            if (e.key === 'ArrowLeft') x -= passo; else if (e.key === 'ArrowRight') x += passo;
            else if (e.key === 'ArrowUp') y -= passo; else if (e.key === 'ArrowDown') y += passo; else ok = false;
            if (!ok) return; e.preventDefault(); var c = limitar(el, x, y); el.style.left = c.x + 'px'; el.style.top = c.y + 'px'; salvarPos(j, c.x, c.y);
        });
    }
    window.addEventListener('resize', function () { Object.keys(janelas).forEach(function (k) { posicionar(janelas[k]); }); });

    // ---------- atualização ----------
    function fmt(s) { s = Math.max(0, s); return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); }

    function removerJanela(chave) {
        var j = janelas[chave]; if (j && j.el.parentNode) j.el.parentNode.removeChild(j.el); delete janelas[chave];
    }

    function atualizar() {
        if (!document.body) return;
        var desejadas = {};
        if (logado() && ativo()) {
            var o = discs();
            Object.keys(o).forEach(function (id) { desejadas['t' + id] = { tipo: 'timer', d: o[id] }; });
            if (musicaOn() && window.FocusSoundtrack) desejadas.musica = { tipo: 'musica' };
        }
        // some o que não deve existir (inclusive cópias mortas vindas do histórico do htmx)
        Object.keys(janelas).forEach(function (k) { if (!desejadas[k]) removerJanela(k); });
        [].forEach.call(document.querySelectorAll('.fm-janela'), function (n) {
            var j = janelas[n.getAttribute('data-fm')];
            if (!j || j.el !== n) n.parentNode.removeChild(n);
        });
        // cria / reanexa / atualiza
        // Cada janela é tratada separada (try/catch): se uma falhar, as outras continuam aparecendo.
        Object.keys(desejadas).forEach(function (k) {
            try {
                var des = desejadas[k], j = janelas[k];
                if (!j) j = criar(k, des.tipo, des.d);
                else if (!j.el.isConnected) { document.body.appendChild(j.el); posicionar(j); }
                if (ajustarZoom(j)) posicionar(j);   // mudou o tamanho da letra: recoloca a janela
                if (des.tipo === 'timer') { j.disc = des.d; desenharTimer(j); } else desenharMusica(j);
                j.el.classList.toggle('fm-min', getMin(k));
            } catch (err) {
                if (window.console && console.error) console.error('[mini-janela ' + k + ']', err);
            }
        });
    }

    function desenharTimer(j) {
        var d = j.disc, tempo, prog = 0, rodando = false, modo = 25;
        if (q(j, '.fm-titulo').textContent !== d.nome) q(j, '.fm-titulo').textContent = d.nome;
        if (naPagina(d)) {
            tempo = document.getElementById('pomodoroDisplay').textContent.trim();
            var anel = document.getElementById('pomodoroRing'), g = anel ? parseFloat(anel.style.getPropertyValue('--pomodoro-progress')) : 0;
            prog = isNaN(g) ? 0 : g / 360 * 100;
            var b = document.getElementById('btnIniciar'); rodando = !!(b && /Pausar/.test(b.textContent));
            var at = document.querySelector('.pomodoro-modes button.active'); modo = at ? parseInt(at.dataset.min, 10) : 0;
        } else {
            var t = lerTimer(d);
            if (t.rodando && t.restante <= 0) {   // terminou enquanto estava fora da página
                registrar(d, Math.round(t.total / 60)); limparTimer(d);
                aviso(j.chave, 'Sessão concluída! 🎉 +' + Math.round(t.total / 60) + ' min', 8000); bipe(); t = lerTimer(d);
            }
            tempo = fmt(t.restante); rodando = t.rodando; modo = t.modo; prog = t.total ? (t.total - t.restante) / t.total * 100 : 0;
        }
        q(j, '.fm-tempo').textContent = tempo; q(j, '.fm-mini').textContent = tempo;
        q(j, '.fm-barra i').style.width = Math.min(100, Math.max(0, prog)) + '%';
        var html = rodando ? '<i class="fa-solid fa-pause"></i> Pausar' : '<i class="fa-solid fa-play"></i> Iniciar';
        if (q(j, '.fm-play').getAttribute('data-r') !== String(rodando)) { q(j, '.fm-play').innerHTML = html; q(j, '.fm-play').setAttribute('data-r', String(rodando)); }
        [].forEach.call(j.el.querySelectorAll('.fm-chip'), function (c) { c.classList.toggle('on', parseInt(c.dataset.m, 10) === modo); c.disabled = rodando; });
        var av = avisos[j.chave], ok = q(j, '.fm-ok'), mostrar = !!(av && Date.now() < av.ate);
        ok.style.display = mostrar ? '' : 'none'; if (mostrar) ok.textContent = av.msg;
    }

    function desenharMusica(j) {
        var s = window.FocusSoundtrack; if (!s) return;
        var cfg = s.getConfig(), tr = s.TRILHAS[cfg.trilha] || s.TRILHAS[0];
        q(j, '.fm-nome').textContent = tr.nome; q(j, '.fm-mini').textContent = tr.nome;
        var ic = cfg.ligado ? 'fa-pause' : 'fa-play', btn = q(j, '.fm-mplay');
        if (btn.getAttribute('data-i') !== ic) { btn.innerHTML = '<i class="fa-solid ' + ic + '"></i>'; btn.setAttribute('data-i', ic); }
        var varias = totalTrilhas() > 1; q(j, '.fm-prev').style.visibility = q(j, '.fm-next').style.visibility = varias ? '' : 'hidden';
    }

    // O htmx guarda uma foto do <body> no histórico. Se as janelas estiverem nela, ao voltar
    // na página aparecem cópias mortas (sem botões funcionando, com nome velho). Por isso
    // tiramos as janelas do DOM só durante a "foto" e colocamos de volta em seguida.
    document.addEventListener('htmx:beforeHistorySave', function () {
        Object.keys(janelas).forEach(function (k) { var e = janelas[k].el; if (e.parentNode) e.parentNode.removeChild(e); });
        setTimeout(atualizar, 0);
    });
    document.addEventListener('htmx:afterSettle', atualizar);
    document.addEventListener('htmx:historyRestore', atualizar);
    window.addEventListener('pageshow', atualizar);
    window.addEventListener('storage', atualizar);   // outra aba mudou algo

    // ---------- API pública ----------
    window.FocusMini = {
        isAtivo: ativo,
        setAtivo: function (v) { gravar(kUser(K_ATIVO), v ? '1' : '0'); atualizar(); avisar(); },
        isMusica: musicaOn,
        chaveUsuario: kUser,
        setMusica: function (v) { gravar(kUser(K_MUSICA), v ? '1' : '0'); atualizar(); avisar(); },
        // a página da disciplina avisa quem ela é (não cria janela por si só)
        registrarDisciplina: function (info) {
            if (!logado() || !info || !info.id) return;
            info.uid = window.FOCUS_UID; infoPagina = info; paginaId = info.id;
            var o = discs();
            if (o[info.id]) { o[info.id] = info; gravarDiscs(o); }   // atualiza o nome se foi renomeada
            atualizar();
        },
        temDisciplina: function (id) { return !!discs()[id]; },
        alternarDisciplina: function () {
            if (!infoPagina) return false;
            var o = discs();
            if (o[infoPagina.id]) delete o[infoPagina.id]; else { o[infoPagina.id] = infoPagina; gravar(kUser(K_ATIVO), '1'); setMin('t' + infoPagina.id, false); }
            gravarDiscs(o); atualizar(); avisar(); return !!o[infoPagina.id];
        }
    };

    setInterval(atualizar, 250);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', atualizar); else atualizar();
})();
