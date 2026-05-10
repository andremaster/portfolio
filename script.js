/* Fundamentos da Programação Web - UNINTER
   Scripts para interação e validação do portfólio
*/

document.addEventListener('DOMContentLoaded', function() {
    
    // --- FUNCIONALIDADE: Alternar Tema Claro/Escuro ---
    const themeBtn = document.getElementById('theme-toggle');
    const body = document.body;

    themeBtn.addEventListener('click', function() {
        // Altera o atributo data-theme para disparar as cores do CSS
        if (body.getAttribute('data-theme') === 'dark') {
            body.removeAttribute('data-theme');
            themeBtn.innerText = 'Modo Escuro';
        } else {
            body.setAttribute('data-theme', 'dark');
            themeBtn.innerText = 'Modo Claro';
        }
    });

    // --- FUNCIONALIDADE: Menu Mobile Responsivo ---
    const mobileBtn = document.getElementById('mobile-menu');
    const navLinks = document.getElementById('nav-links');

    mobileBtn.addEventListener('click', function() {
        // Ativa ou desativa a classe para mostrar o menu em dispositivos móveis
        navLinks.classList.toggle('active');
    });

    // Fecha o menu ao clicar em um link para facilitar a navegação
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
        });
    });

    // --- FUNCIONALIDADE: Validação do Formulário de Contato ---
    const contactForm = document.getElementById('contact-form');
    const messageBox = document.getElementById('form-message');

    contactForm.addEventListener('submit', function(event) {
        // Impede o recarregamento da página ao enviar
        event.preventDefault();

        // Coleta de dados dos campos do formulário
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const message = document.getElementById('message').value.trim();

        // Função interna para exibir avisos visuais no formulário
        function showNotification(text, type) {
            messageBox.innerText = text;
            messageBox.className = type === 'success' ? 'success' : 'error';
            messageBox.style.display = 'block';
            
            // Oculta a mensagem após 5 segundos
            setTimeout(() => {
                messageBox.style.display = 'none';
            }, 5000);
        }

        // Validação obrigatória: Verifica se os campos estão preenchidos
        if (name === "" || email === "" || message === "") {
            showNotification("Erro: Todos os campos devem ser preenchidos.", "error");
            return;
        }

        // Validação obrigatória: Formato de e-mail usando Expressão Regular
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            showNotification("Erro: Por favor, insira um e-mail válido.", "error");
            return;
        }

        // --- SIMULAÇÃO DE ENVIO COM SUCESSO ---
        // Exibe mensagem de confirmação e limpa os campos
        showNotification("Mensagem enviada com sucesso!", "success");
        contactForm.reset();
    });
});
