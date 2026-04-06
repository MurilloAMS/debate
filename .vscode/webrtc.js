// Conexão WebRTC
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localVideo.srcObject = stream;
    // Aqui conectaria com o servidor WebRTC/Sinalização
    console.log("Câmera e microfone capturados");
  })
  .catch(error => {
    console.error("Erro ao acessar câmera/microfone:", error);
  });