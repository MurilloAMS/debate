function login() {
  const usuario = document.getElementById('usuario').value;
  const senha = document.getElementById('senha').value;

  if (usuario && senha) {
    localStorage.setItem('nomeUsuario', usuario);
    localStorage.setItem('logado', 'true');

    window.location.href = '/index.html';

  } else {
    alert('Preencha usuário e senha!');
  }
}