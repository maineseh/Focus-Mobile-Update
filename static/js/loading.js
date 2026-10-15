// Tela de carregamento do Focus (gatinho).
// Carregado SÍNCRONO no <head> de todas as páginas. Faz 3 coisas:
//  1) Na abertura de uma página (carregamento completo), cobre a tela até o CSS
//     terminar de carregar — assim ninguém vê a página "desmontada" por 1 segundo.
//  2) Na navegação boosted do htmx (troca só o <body>), mostra o gatinho enquanto
//     a página nova chega E até o CSS dela (que vem dentro do <body>) carregar.
//     Era isso que fazia a página "quebrar e voltar ao normal" no celular.
//  3) Em links/formulários que recarregam a página inteira (ex.: login, sair).
// O overlay fica pendurado no <html> (não no <body>), então sobrevive à troca do
// <body>. O CSS e o gatinho estão embutidos aqui, pra aparecer na hora, sem rede.
(function () {
    if (window.FocusLoading) return;

    var CAT = 'data:image/png;base64,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';
    var TEMAS = {"dark": ["#1a2230", "#f7f9fc"], "purple": ["#f7f6fb", "#2c243d"], "algodao": ["#fdf6f8", "#4a3b46"], "focusnight": ["#0d0b1a", "#eae8ff"], "dracula": ["#282a36", "#f8f8f2"], "metallic": ["#1c1d21", "#eceef2"], "nature": ["#f6f3ea", "#33403a"], "sunset": ["#2b1630", "#fff1e8"], "arctic": ["#f4f8fb", "#33424f"], "grape": ["#1f1425", "#f3e6f7"], "sakura": ["#fff5f8", "#4a2f3d"], "cyber": ["#05070d", "#e6faff"], "tema13": ["#fff5f5", "#3d0c11"], "tema22": ["#f4fbf5", "#0b2a4a"], "lavender": ["#07050c", "#e8def9"]};
    var PADRAO = ['#f2efea', '#455a64'];
    var MIN_VISIVEL = 280;      // ms mínimos na tela (evita "piscar")
    var MAX_ESPERA_CSS = 4000;  // nunca fica preso esperando CSS
    var FAILSAFE = 15000;       // nunca fica preso na tela, aconteça o que acontecer

    var css =
        '#focus-loading{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
        'opacity:0;visibility:hidden;pointer-events:none;transition:opacity .16s ease,visibility 0s linear .16s;' +
        '-webkit-tap-highlight-color:transparent}' +
        '#focus-loading.fl-on{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .12s ease,visibility 0s}' +
        // gatinho: tamanho do celular; maior no computador
        '#focus-loading .fl-cat{position:relative;width:120px;height:120px;transform-origin:50% 100%;' +
        'animation:fl-hop 1.3s cubic-bezier(.3,.7,.4,1) infinite}' +
        '#focus-loading .fl-cat img{display:block;width:100%;height:100%;object-fit:contain;' +
        'filter:drop-shadow(0 6px 10px rgba(0,0,0,.16))}' +
        // sombrinha no chão que acompanha o pulinho
        '#focus-loading .fl-sombra{width:84px;height:12px;border-radius:50%;margin-top:-10px;' +
        'background:currentColor;opacity:.16;animation:fl-sombra 1.3s cubic-bezier(.3,.7,.4,1) infinite}' +
        '#focus-loading .fl-txt{font:800 16px/1 "Baloo 2","Nunito",system-ui,sans-serif;letter-spacing:.4px;opacity:.85;' +
        'display:flex;align-items:center;gap:3px;margin-top:6px}' +
        '#focus-loading .fl-dots{display:inline-flex;gap:2px}' +
        '#focus-loading .fl-dots span{display:inline-block;animation:fl-dot 1.2s infinite ease-in-out}' +
        '#focus-loading .fl-dots span:nth-child(2){animation-delay:.18s}' +
        '#focus-loading .fl-dots span:nth-child(3){animation-delay:.36s}' +
        '@media (min-width:900px){#focus-loading .fl-cat{width:200px;height:200px}' +
        '#focus-loading .fl-sombra{width:140px;height:16px;margin-top:-14px}' +
        '#focus-loading .fl-txt{font-size:22px;margin-top:10px}}' +
        // pulinho fofo: agacha, pula com uma inclinadinha, cai e amassa de leve
        '@keyframes fl-hop{' +
        '0%{transform:translateY(0) scale(1.06,.9) rotate(0)}' +
        '18%{transform:translateY(0) scale(.96,1.06) rotate(0)}' +
        '42%{transform:translateY(-22px) scale(.98,1.04) rotate(-5deg)}' +
        '60%{transform:translateY(-22px) scale(.98,1.04) rotate(5deg)}' +
        '82%{transform:translateY(0) scale(1.07,.9) rotate(0)}' +
        '92%{transform:translateY(0) scale(.98,1.03) rotate(0)}' +
        '100%{transform:translateY(0) scale(1.06,.9) rotate(0)}}' +
        '@keyframes fl-sombra{0%,100%{transform:scaleX(1.05);opacity:.18}45%,60%{transform:scaleX(.7);opacity:.08}}' +
        '@keyframes fl-dot{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-5px);opacity:1}}' +
        '@media (prefers-reduced-motion:reduce){#focus-loading .fl-cat,#focus-loading .fl-sombra,#focus-loading .fl-dots span{animation:none!important}}' +
        'html.fl-reduce #focus-loading .fl-cat,html.fl-reduce #focus-loading .fl-sombra,html.fl-reduce #focus-loading .fl-dots span{animation:none!important}';

    var estilo = document.createElement('style');
    estilo.id = 'focus-loading-style';
    estilo.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(estilo);

    var el = document.createElement('div');
    el.id = 'focus-loading';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'Carregando');
    el.innerHTML = '<div class="fl-cat"><img alt="" draggable="false" src="' + CAT + '"></div><div class="fl-sombra"></div>' +
        '<div class="fl-txt">Carregando<span class="fl-dots"><span>.</span><span>.</span><span>.</span></span></div>';

    var estado = { visivel: false, desde: 0, token: 0, failsafe: null };

    function acessibilidadeReduzida() {
        try {
            var c = JSON.parse(localStorage.getItem('focus_accessibility') || '{}');
            if (c && c.reduceMotion) document.documentElement.classList.add('fl-reduce');
        } catch (e) { /* ignora */ }
    }

    // Cores do tema: com <body> pronto, lê as variáveis reais; antes disso, usa o
    // tema salvo no localStorage (mesma chave que o resto do site usa).
    function aplicarCores() {
        var bg = PADRAO[0], fg = PADRAO[1];
        try {
            var b = document.body;
            if (b) {
                var cs = getComputedStyle(b);
                var v = cs.getPropertyValue('--bg').trim();
                var t = cs.getPropertyValue('--text').trim();
                if (v) { bg = v; if (t) fg = t; }
            } else {
                var tema = localStorage.getItem('focus_theme');
                if (tema && TEMAS[tema]) { bg = TEMAS[tema][0]; fg = TEMAS[tema][1]; }
            }
        } catch (e) { /* ignora */ }
        el.style.background = bg;
        el.style.color = fg;
    }

    function montar() {
        if (!el.parentNode) document.documentElement.appendChild(el);
    }

    function mostrar() {
        estado.token++;
        montar();
        aplicarCores();
        acessibilidadeReduzida();
        if (!estado.visivel) {
            estado.visivel = true;
            estado.desde = Date.now();
            // força o navegador a registrar o estado "escondido" antes da transição
            void el.offsetWidth;
            el.classList.add('fl-on');
        }
        clearTimeout(estado.failsafe);
        estado.failsafe = setTimeout(function () { esconderAgora(); }, FAILSAFE);
    }

    function esconderAgora() {
        clearTimeout(estado.failsafe);
        estado.visivel = false;
        el.classList.remove('fl-on');
    }

    // Espera todos os <link rel=stylesheet> (inclusive os que vieram dentro do
    // <body> da página nova) terminarem de carregar.
    function esperarCss(cb) {
        var links = document.querySelectorAll('link[rel~="stylesheet"]');
        var pendentes = 0, feito = false;
        function fim() { if (!feito) { feito = true; cb(); } }
        function um() { pendentes--; if (pendentes <= 0) fim(); }
        for (var i = 0; i < links.length; i++) {
            var l = links[i];
            if (l.sheet || l.getAttribute('media') === 'print') continue;
            pendentes++;
            l.addEventListener('load', um, { once: true });
            l.addEventListener('error', um, { once: true });
        }
        if (pendentes === 0) fim();
        setTimeout(fim, MAX_ESPERA_CSS);
    }

    // Esconde quando: o mínimo de tempo passou + o CSS carregou + o navegador
    // já aplicou o layout (2 quadros).
    function esconder() {
        if (!estado.visivel) return;
        var meuToken = estado.token;
        esperarCss(function () {
            var restante = Math.max(0, MIN_VISIVEL - (Date.now() - estado.desde));
            setTimeout(function () {
                var raf = window.requestAnimationFrame || function (f) { setTimeout(f, 16); };
                raf(function () {
                    raf(function () {
                        if (meuToken !== estado.token) return; // chegou outra navegação, mantém
                        esconderAgora();
                    });
                });
            }, restante);
        });
    }

    window.FocusLoading = { show: mostrar, hide: esconder };

    // ---------- 1) Abertura da página ----------
    // Se o gatinho ainda não puder aparecer antes do 1º desenho, não tem problema:
    // esse script roda dentro do <head>, antes do <body> ser pintado.
    mostrar();
    var jaCarregou = false;
    function aoCarregar() {
        if (jaCarregou) return;
        jaCarregou = true;
        aplicarCores();
        esconder();
    }
    if (document.readyState === 'complete') {
        aoCarregar();
    } else {
        window.addEventListener('load', aoCarregar);
        // imagens lentas não devem segurar a tela: 1,5s depois do DOM pronto, libera.
        document.addEventListener('DOMContentLoaded', function () {
            aplicarCores();
            setTimeout(aoCarregar, 1500);
        });
    }
    // Voltar pelo botão do navegador (cache de página): nunca fica preso.
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) { estado.visivel = true; estado.desde = 0; esconder(); }
    });

    // ---------- 2) Navegação boosted do htmx ----------
    function ehBoosted(ev) {
        var d = ev.detail || {};
        if (d.boosted) return true;
        var rc = d.requestConfig;
        if (rc && rc.boosted) return true;
        var h = (rc && rc.headers) || {};
        return h['HX-Boosted'] === 'true';
    }
    document.addEventListener('htmx:beforeRequest', function (ev) {
        if (ehBoosted(ev)) mostrar();
    });
    // O elemento do clique some na troca do <body>; por isso esses eventos
    // (disparados no body/alvo) são os confiáveis pra saber que a página chegou.
    document.addEventListener('htmx:afterSwap', esconder);
    document.addEventListener('htmx:afterSettle', esconder);
    document.addEventListener('htmx:historyRestore', function () { if (estado.visivel) esconder(); });
    document.addEventListener('htmx:historyCacheMiss', mostrar);
    document.addEventListener('htmx:historyCacheMissLoad', esconder);
    // Falhas: tira o gatinho (o spa.js já recarrega a página em erro de resposta).
    ['htmx:sendError', 'htmx:timeout', 'htmx:swapError', 'htmx:targetError'].forEach(function (n) {
        document.addEventListener(n, esconderAgora);
    });
    document.addEventListener('htmx:responseError', function () { /* spa.js recarrega */ });
    // Resposta sem troca de conteúdo (ex.: 204): o elemento continua na página.
    document.addEventListener('htmx:afterRequest', function (ev) {
        var elt = ev.target;
        if (elt && elt.isConnected && estado.visivel && ehBoosted(ev)) {
            var d = ev.detail || {};
            if (d.failed || d.successful === false) esconderAgora();
        }
    });

    // ---------- 3) Navegação completa (sem htmx) ----------
    document.addEventListener('click', function (ev) {
        if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
        if (!a) return;
        var href = a.getAttribute('href') || '';
        if (!href || href.charAt(0) === '#' || /^(javascript|mailto|tel|blob|data):/i.test(href)) return;
        if (a.hasAttribute('download') || (a.target && a.target !== '_self')) return;
        if (a.origin !== location.origin) return;
        if (a.pathname === location.pathname && a.search === location.search) return;
        // htmx boosted? então o htmx cuida (ele chama preventDefault antes de nós)
        mostrar();
    }, false);
    document.addEventListener('submit', function (ev) {
        if (ev.defaultPrevented) return;
        var f = ev.target;
        if (!f || (f.target && f.target !== '_self')) return;
        mostrar();
    }, false);
    // Se a pessoa sair da página de verdade, tudo bem; se a navegação for cancelada
    // (download, 204), o failsafe libera a tela.
})();
