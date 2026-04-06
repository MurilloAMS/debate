// Função para deslogar o usuário
function logout() {
    // Remove o usuário logado do localStorage
    localStorage.removeItem("usuario");
    // Remove o status de logado (caso use)
    localStorage.setItem("logado", "false");
    // Redireciona para a página de login
    window.location.href = "login.html";
  }
  
  // Exemplo: adiciona evento no botão de logout, se existir
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", logout);
  }