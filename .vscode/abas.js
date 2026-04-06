const transmissoesPorTema = {
  politica: [
    { titulo: "Bolsonaro x Lula", descricao: "Debate ao vivo" },
    { titulo: "Congresso em Foco", descricao: "Análise política" }
  ],
  religiao: [
    { titulo: "Ciência x Fé", descricao: "Reflexões espirituais" },
    { titulo: "Fé e Sociedade", descricao: "Discussão aberta" }
  ],
  futebol: [
    { titulo: "Neymar Jr.", descricao: "Copa de 2026" },
    { titulo: "Clássico das Américas", descricao: "Brasil x Argentina" }
  ],
  tecnologia: [
    { titulo: "Inteligência Artificial", descricao: "Avanços da IA" },
    { titulo: "Futuro da Internet", descricao: "Web3 e Metaverso" }
  ],
  familia: [
    { titulo: "Educação dos Filhos", descricao: "Papel dos pais" },
    { titulo: "Relacionamentos Saudáveis", descricao: "Conselhos" }
  ],
  economia: [
    { titulo: "Crise Imobiliária", descricao: "Análise do mercado" },
    { titulo: "Inflação e Salários", descricao: "Tendências econômicas" }
  ]
};

const containerGrid = document.querySelector("main.grid");
if (!containerGrid) {
  console.error("Container 'main.grid' não encontrado no HTML!");
} else {
  console.log("Container encontrado:", containerGrid);
}

const botoesTema = document.querySelectorAll("nav.topics button");
console.log("Botoes de tema encontrados:", botoesTema.length);

botoesTema.forEach(botao => {
  botao.addEventListener("click", () => {
    const tema = botao.dataset.topic;
    console.log("Botão clicado com tema:", tema);

    const transmissoes = transmissoesPorTema[tema] || [];
    console.log("Transmissões encontradas:", transmissoes);

    if (!containerGrid) return;

    containerGrid.innerHTML = transmissoes.map(transmissao => `
      <div class="card">
        <div class="play-icon"></div>
        <p>${transmissao.titulo}</p>
        <small>${transmissao.descricao}</small>
        <button>Assistir</button>
      </div>
    `).join("");
  });
});