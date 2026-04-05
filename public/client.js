import { auth, onAuthStateChanged } from '/firebase.js';

(() => {
  const qs = new URLSearchParams(location.search);
  let role = qs.get('role') || 'audience';
  const room = qs.get('room') || 'sala1';

  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');

  let ws;
  let pc;
  let localStream;

  let mediaRecorder;
  let recordedChunks = [];

  let userId;
  let username;

  const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';

  // ===================== LOGIN =====================
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      alert('Você precisa estar logado');
      location.href = '/login.html';
      return;
    }

    userId = user.uid;
    username = user.displayName || user.email || 'Usuário';

    connect();
  });

  // ===================== CONEXÃO =====================
  function connect() {
    ws = new WebSocket(`${wsProto}://${location.host}`);

    ws.onopen = () => {
      send({
        type: 'join',
        room,
        role,
        userId,
        username
      });

      // 🔥 AVISA O SISTEMA QUE A LIVE COMEÇOU
      if (role === 'host') {
        send({
          type: 'room-started',
          room,
          host: username
        });

        startStreaming();
      }
    };

    ws.onmessage = async (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }

      if (msg.type === 'offer') await onOffer(msg.sdp);
      if (msg.type === 'answer') await pc.setRemoteDescription(msg.sdp);
      if (msg.type === 'candidate') await pc.addIceCandidate(msg.candidate);

      if (msg.type === 'end-live') {
        stopRecording();
        alert('Live encerrada');
        location.href = '/';
      }

      // 🔥 RECEBER PREVIEW (feed)
      if (msg.type === 'request-preview' && role === 'host') {
        if (pc && pc.localDescription) {
          send({
            type: 'preview',
            room,
            sdp: pc.localDescription
          });
        }
      }
    };
  }

  function send(obj) {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(obj));
    }
  }

  // ===================== STREAM =====================
  async function getStream() {
    if (localStream) return localStream;

    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    if (localVideo) localVideo.srcObject = localStream;

    return localStream;
  }

  function createPeer() {
    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send({
          type: 'candidate',
          candidate: e.candidate
        });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideo) {
        remoteVideo.srcObject = e.streams[0];
      }
    };
  }

  // ===================== HOST =====================
  async function startStreaming() {
    await getStream();
    createPeer();

    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    startRecording();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    send({
      type: 'offer',
      sdp: offer
    });
  }

  // ===================== AUDIENCE =====================
  async function onOffer(offer) {
    await getStream();

    createPeer();

    await pc.setRemoteDescription(offer);

    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    send({
      type: 'answer',
      sdp: answer
    });
  }

  // ===================== GRAVAÇÃO =====================
  function startRecording() {
    if (!localStream) return;

    mediaRecorder = new MediaRecorder(localStream);
    recordedChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = uploadVideo;

    mediaRecorder.start();
    console.log('🔴 Gravando live...');
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  }

  async function uploadVideo() {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });

    // download automático
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live-${room}.webm`;
    a.click();

    // upload servidor
    const formData = new FormData();
    formData.append('video', blob);
    formData.append('room', room);
    formData.append('userId', userId);

    await fetch('/upload', {
      method: 'POST',
      body: formData
    });

    console.log('✅ Live salva!');
  }

})();