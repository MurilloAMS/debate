console.log("JavaScript externo carregado com sucesso!");
function mostrarAlerta() {
    alert("Você clicou no botão!");
  }
  function mudarTexto() {
    document.getElementById("mensagem").textContent = "Texto alterado com sucesso!";
  }
  document.getElementById("meuBotao").addEventListener("click", function () {
    alert("Botão clicado com JS moderno!");
  });