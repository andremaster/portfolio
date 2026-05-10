// Funcionalidade 1: Menu Mobile Responsivo
const btnMobile = document.getElementById('btn-mobile');
const menuNavegacao = document.getElementById('menu-navegacao');

btnMobile.addEventListener('click', function() {
    // Adiciona ou remove a classe que mostra o menu no celular
    menuNavegacao.classList.toggle('ativo');
});

// Fechar menu mobile ao clicar num link
const linksMenu = document.querySelectorAll('.menu a');
linksMenu.forEach(function(link) {
    link.addEventListener('click', function() {
        menuNavegacao.classList.remove('ativo');
    });
});

// Funcionalidade 2: Troca de Tema (Claro / Escuro)
const btnTema = document.getElementById('btn-tema');
const htmlElement = document.documentElement; // Pega a tag <html>

btnTema.addEventListener('click', function() {
    // Verifica qual o tema atual e inverte
    if (htmlElement.getAttribute('data-theme') === 'escuro') {
        htmlElement.removeAttribute('data-theme');
        btnTema.innerText = 'Modo Escuro';
    } else {
        htmlElement.setAttribute('data-theme', 'escuro');
        btnTema.innerText = 'Modo Claro';
    }
});

// Funcionalidade 3: Validacao e Simulacao de Envio do Formulario
const formulario = document.getElementById('formulario-contato');
const alertaMensagem = document.getElementById('mensagem-alerta');

formulario.addEventListener('submit', function(evento) {
    // Previne que a pagina recarregue (comportamento padrao do form)
    evento.preventDefault();

    // Pega os valores dos campos
    const campoNome = document.getElementById('nome').value.trim();
    const campoEmail = document.getElementById('email').value.trim();
    const campoMensagem = document.getElementById('mensagem').value.trim();

    // Validacao 1: Campos vazios
    if (campoNome === '' || campoEmail === '' || campoMensagem === '') {
        // Utilizando uma mensagem customizada ao inves do alert bloqueante
        mostrarAlerta('Por favor, preencha todos os campos obrigatórios.', '#f8d7da', '#721c24', '#f5c6cb');
        return; // Para a execucao aqui
    }

    // Validacao 2: Formato de e-mail basico com Expressao Regular (Regex)
    const padraoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!padraoEmail.test(campoEmail)) {
        mostrarAlerta('Por favor, insira um endereço de e-mail válido.', '#f8d7da', '#721c24', '#f5c6cb');
        return;
    }

    // Se passou nas validacoes, simula o sucesso
    mostrarAlerta('Mensagem enviada com sucesso! Entrarei em contato em breve.', '#d4edda', '#155724', '#c3e6cb');
    
    // Limpa os campos do formulario
    formulario.reset();
});

// Funcao auxiliar para mostrar alertas de forma visual na pagina
function mostrarAlerta(texto, corFundo, corTexto, corBorda) {
    alertaMensagem.innerText = texto;
    alertaMensagem.style.backgroundColor = corFundo;
    alertaMensagem.style.color = corTexto;
    alertaMensagem.style.borderColor = corBorda;
    alertaMensagem.style.display = 'block';

    // Esconde a mensagem apos 5 segundos
    setTimeout(function() {
        alertaMensagem.style.display = 'none';
    }, 5000);
}
