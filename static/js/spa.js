// Cola do "modo SPA" do Focus.
// Com hx-boost="true" no <body>, o htmx troca a página inteira (o <body>
// todo) via AJAX ao navegar, em vez de recarregar o documento. O CSS de
// cada página viaja junto (o <link> dela fica dentro do próprio <body>,
// logo no topo), e o menu já chega com o item certo marcado como "active"
// direto do servidor — não precisamos sincronizar nada disso na mão.
// O que sobra pra esse arquivo cuidar: fechar o dropdown do perfil e voltar
// o scroll pro topo a cada troca de "página".
// Os scripts que precisam sobreviver à troca (trilha sonora, acessibilidade)
// ficam no <head>, que nunca é tocado pelo swap — por isso não reiniciam.
(function () {
    // Liga a View Transitions API nativa do navegador nos swaps do htmx.
    // A CSS de transição (::view-transition-old/new) já existe em
    // accessibility.css desde que a meta tag foi adicionada, mas sem isso
    // aqui ela nunca era usada de verdade: hx-boost navega via AJAX, não é
    // uma navegação real de página, então a meta tag sozinha não fazia nada.
    // Com globalViewTransitions ligado, o htmx chama document.startViewTransition()
    // em cada troca — em navegadores sem suporte (ex: Firefox mais antigo),
    // ele cai de volta pra troca instantânea normal, sem quebrar nada.
    // ATENÇÃO: no celular, a transição nativa mostrava a página nova ANTES do
    // CSS dela terminar de carregar (a página "quebrava" e depois voltava ao
    // normal). Agora quem cuida da troca é a tela de carregamento do gatinho
    // (static/js/loading.js), que cobre a tela até o CSS estar pronto.
    if (window.htmx) {
        htmx.config.globalViewTransitions = false;
    }

    document.body.addEventListener('htmx:afterSettle', function () {
        window.scrollTo(0, 0);
        var dd = document.getElementById('userDropdown');
        if (dd) dd.classList.remove('show');
        focusAtualizarOndeParei();
    });

    // Voltar/avançar no histórico do navegador restaura o <body> do cache do
    // htmx sem rodar nada da página — então refazemos o registro e o menu aqui.
    document.body.addEventListener('htmx:historyRestore', focusAtualizarOndeParei);
    window.addEventListener('pageshow', focusAtualizarOndeParei);

    // "Estudos" e "Comunidades" no menu de cima sempre levavam pro início
    // (lista de módulos / lista de amigos), mesmo quando a pessoa estava
    // no meio de algo — um cronômetro rodando numa disciplina, ou uma
    // conversa — e só tinha saído dali rapidinho pra outra aba. Agora,
    // sempre que a pessoa visita uma disciplina/módulo (Estudos) ou uma
    // DM/grupo (Comunidades), essa página guarda a própria URL; aqui a
    // gente lê essa "última parada" e aponta o link do menu pra ela em vez
    // do início — só nesses dois itens do menu, escopado com
    // "nav.navbar-main" pra não mexer em nenhum outro link da página
    // (como a setinha de "voltar" de dentro de uma disciplina, que
    // continua subindo um nível como sempre).
    //
    // IMPORTANTE: quem grava a "última parada" NÃO é mais um <script> inline
    // dentro de cada página lendo window.location. Com hx-boost, o htmx roda
    // os scripts da página nova ANTES de atualizar a URL do navegador — então
    // window.location ainda era o da página ANTERIOR e o "onde parei" ficava
    // sempre uma página atrasado (ou preso no início). Agora cada página
    // renderiza um marcador <i id="focus-onde-parei" data-secao data-url>
    // com a URL correta vinda do servidor, e a função abaixo lê ele.
    // data-url vazio (páginas de lista) significa "zerar": voltar pra lista
    // de módulos/amigos e clicar no menu tem que ficar na lista.
    // A "última parada" de Estudos/Comunidades agora é guardada no SERVIDOR
    // (sessão): o menu abre /meus_estudos e /comunidades e o servidor retoma
    // de onde parou; só a setinha de voltar (?inicio=1) zera. Limpa o que o
    // modo antigo deixou no localStorage pra não sobrar lixo.
    try {
        localStorage.removeItem('focus_ultimo_estudos');
        localStorage.removeItem('focus_ultimo_comunidades');
    } catch (e) { /* ignora */ }
    function focusAtualizarOndeParei() {}
    window.focusAtualizarOndeParei = focusAtualizarOndeParei;

    // (Aviso pra próxima vez que eu mexer aqui: já tentei evitar o
    // recarregamento completo nessa navegação usando htmx.ajax() com
    // select:'body'/swap:'outerHTML' — isso QUEBROU a navegação (tela
    // ficou toda branca), porque a resposta do servidor é uma página HTML
    // inteira, e o htmx não consegue "selecionar" a tag <body> de dentro
    // de um documento completo do mesmo jeito que faz com fragmentos —
    // NÃO REPETIR essa abordagem. O jeito seguro de evitar o "flash" de
    // tema é aplicar a classe do tema o quanto antes no <body>, não tentar
    // reinventar a navegação do htmx na mão.
    window.focusNavegarSemPiscar = function (url) {
        window.location.href = url;
    };

    // Se uma navegação boosted falhar (ex: sessão expirada), recarrega de
    // verdade em vez de deixar a página travada num estado inconsistente.
    // Se a página que falhou era a "última parada" guardada (ex: disciplina
    // ou grupo excluído), esquece ela — senão o menu ficaria apontando pra
    // uma página que não abre mais.
    document.body.addEventListener('htmx:responseError', function () {
        window.location.reload();
    });

    // Celular: ao tocar num campo de texto, rola até ele ficar bem visível acima do
    // teclado (a barra de baixo some sozinha enquanto digita, via CSS).
    document.addEventListener('focusin', function (ev) {
        var el = ev.target;
        if (!el || !el.matches || !el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=hidden]), textarea')) return;
        if (!window.matchMedia('(max-width: 900px)').matches) return;
        setTimeout(function () {
            if (document.activeElement === el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 320);
    });
})();


// Recorte de imagem sob demanda. Com hx-boost o htmx só troca o <body>: os
// <script>/<link> do <head> da página nova NÃO são carregados. Então, se a
// pessoa chegava em "Editar Perfil" (ou no grupo) clicando no menu, o
// image-cropper.js nunca existia e escolher a foto não fazia NADA até
// recarregar o site. Este "atalho" carrega o script e o CSS na hora que
// precisam e depois chama o recorte de verdade (que substitui este atalho).
if (!window.abrirRecorteImagem) {
    window.abrirRecorteImagem = function (arquivo, aoConfirmar) {
        if (!document.querySelector('link[href*="image-cropper.css"]')) {
            var css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = '/static/css/image-cropper.css';
            document.head.appendChild(css);
        }
        var js = document.createElement('script');
        js.src = '/static/js/image-cropper.js';
        js.onload = function () { window.abrirRecorteImagem(arquivo, aoConfirmar); };
        js.onerror = function () { alert('Não deu pra abrir o editor de foto. Recarregue a página e tente de novo.'); };
        document.head.appendChild(js);
    };
}
