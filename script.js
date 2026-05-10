/* Definição das variáveis de cores para os temas claro e escuro */
:root {
    --bg-color: #f4f4f9;
    --card-bg: #ffffff;
    --text-color: #333333;
    --primary-color: #0056b3;
    --border-color: #dddddd;
    --success-bg: #d4edda;
    --success-text: #155724;
    --error-bg: #f8d7da;
    --error-text: #721c24;
}

/* Estilos aplicados quando o tema escuro está ativo */
[data-theme="dark"] {
    --bg-color: #121212;
    --card-bg: #1e1e1e;
    --text-color: #e0e0e0;
    --primary-color: #4da3ff;
    --border-color: #333333;
}

/* Reset básico e configurações globais */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Arial, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-color);
    line-height: 1.6;
    transition: background-color 0.3s, color 0.3s;
}

.container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Cabeçalho e Navegação */
header {
    background-color: var(--card-bg);
    border-bottom: 1px solid var(--border-color);
    position: fixed;
    width: 100%;
    top: 0;
    z-index: 100;
}

.navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 70px;
}

.logo-text {
    font-weight: bold;
    font-size: 1.2rem;
    text-decoration: none;
    color: var(--primary-color);
}

.nav-links {
    display: flex;
    list-style: none;
    gap: 20px;
}

.nav-links a {
    text-decoration: none;
    color: var(--text-color);
    font-weight: 500;
}

.nav-buttons {
    display: flex;
    gap: 10px;
}

/* Botões Customizados */
button {
    padding: 8px 15px;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid var(--primary-color);
}

.btn-primary {
    background-color: var(--primary-color);
    color: white;
}

.btn-secondary {
    background: transparent;
    color: var(--primary-color);
}

.btn-mobile {
    display: none;
    background: transparent;
    color: var(--text-color);
    font-size: 1.5rem;
    border: none;
}

/* Seções e Layout */
main {
    margin-top: 100px;
}

.card {
    background-color: var(--card-bg);
    padding: 30px;
    border-radius: 8px;
    margin-bottom: 30px;
    border: 1px solid var(--border-color);
}

h1, h2 {
    color: var(--primary-color);
    margin-bottom: 20px;
}

.tech-tags span {
    display: inline-block;
    background: var(--primary-color);
    color: white;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 0.85rem;
    margin: 5px 5px 0 0;
}

.timeline-item {
    padding: 15px 0;
    border-bottom: 1px solid var(--border-color);
}

.project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
}

.project-card {
    border: 1px solid var(--border-color);
    padding: 20px;
    border-radius: 6px;
}

/* Formulário e Validação */
.form-group {
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
}

label {
    margin-bottom: 5px;
    font-weight: bold;
}

input, textarea {
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-color);
    color: var(--text-color);
}

textarea {
    height: 120px;
}

.hidden {
    display: none;
}

#form-message {
    padding: 15px;
    margin-bottom: 20px;
    border-radius: 4px;
    font-weight: bold;
}

.success {
    background-color: var(--success-bg);
    color: var(--success-text);
}

.error {
    background-color: var(--error-bg);
    color: var(--error-text);
}

/* Responsividade Mobile */
@media (max-width: 768px) {
    .btn-mobile {
        display: block;
    }

    .nav-links {
        display: none;
        flex-direction: column;
        position: absolute;
        top: 70px;
        left: 0;
        width: 100%;
        background-color: var(--card-bg);
        padding: 20px;
        border-bottom: 1px solid var(--border-color);
    }

    .nav-links.active {
        display: flex;
    }
}

footer {
    text-align: center;
    padding: 40px 0;
    font-size: 0.9rem;
    color: #888;
}
