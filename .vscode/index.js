const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${wsProto}://${location.host}`);

const ROOM = 'teste';
const contador = document.getElementById('contador-sala-teste');

// pegar usuário logado
const username = localStorage.getItem('nomeUsuario') || 'Visitante';

// conexão
ws.addEventListener('open', () => {
  ws.send(JSON.stringify({
    type: 'join',
    room: ROOM,
    role: 'audience',
    username: username
  }));
});

// mensagens do servidor
ws.addEventListener('message', (ev) => {
  let msg;
  try { msg = JSON.parse(ev.data); } catch { return; }

  // contador de pessoas
  if (msg.type === 'count' && contador) {
    contador.textContent = `👥 ${msg.count}`;
  }
});