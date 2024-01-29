let APP_ID = "872a80beb58c4a50ba57e24a83290ab2";

let token = null;
let uid = String(Math.floor(Math.random() * 10000));
let client;
let channel;

let queryString = window.location.search;
let urlParms = new URLSearchParams(queryString);
let roomId = urlParms.get("room");

if (!roomId) {
  window.location = "lobby.html";
}

let localStream;
let remoteStream;
let peerConnection;

const server = {
  iceServer: [
    { urls: ["stun1.l.google.com:19302", "stun2.l.google.com:19302"] },
  ],
};

let constrains = {
  video: {
    width: { min: 640, ideal: 1920, max: 1920 },
    height: { min: 480, ideal: 1080, max: 1080 },
  },
  audio: true,
};

const init = async () => {
  client = await AgoraRTM.createInstance(APP_ID);
  await client.login({
    uid,
    token,
  });

  channel = client.createChannel(roomId);
  await channel.join();

  channel.on("MemberJoined", handleUserJoin);

  channel.on("MemberLeft", handleUserLeft);

  client.on("MessageFromPeer", handleMessageFromPeer);

  localStream = await navigator.mediaDevices.getUserMedia(constrains);
  document.getElementById("user-1").srcObject = localStream;
};

const handleUserLeft = (MemberID) => {
  document.getElementById("user-2").style.display = "none";
  document.getElementById("user-1").classList.remove("small-frame");
};

const handleMessageFromPeer = async (message, MemeberId) => {
  message = JSON.parse(message.text);
  if (message.type === "offer") {
    createAnswer(MemeberId, message.offer);
  }

  if (message.type === "answer") {
    addAnswer(message.answer);
  }

  if (message.type === "candidate") {
    if (peerConnection) {
      peerConnection.addIceCandidate(message.candidate);
    }
  }
};

const handleUserJoin = async (MemberID) => {
  console.log("A new user joined the channel", MemberID);
  createOffer(MemberID);
};

const createPeerConnection = async (MemberID) => {
  peerConnection = new RTCPeerConnection(server);
  remoteStream = new MediaStream();
  document.getElementById("user-2").srcObject = remoteStream;
  document.getElementById("user-2").style.display = "block";

  document.getElementById("user-1").classList.add("small-frame");

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    document.getElementById("user-1").srcObject = localStream;
  }

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      client.sendMessageToPeer(
        {
          text: JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
          }),
        },
        MemberID
      );
    }
  };
};

const createOffer = async (MemberID) => {
  await createPeerConnection(MemberID);

  let offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "offer", offer: offer }) },
    MemberID
  );
};

const createAnswer = async (MemberID, offer) => {
  await createPeerConnection(MemberID);
  await peerConnection.setRemoteDescription(offer);

  let answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "answer", answer: answer }) },
    MemberID
  );
};

const addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    peerConnection.setRemoteDescription(answer);
  }
};

const leaveChannel = async () => {
  await channel.leave();
  await client.logout();
};

const toggleCamera = async () => {
  let videoTrack = localStream
    .getTracks()
    .find((track) => track.kind === "video");
  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    document.getElementById("camera-btn").style.backgroundColor =
      "rgb(255, 80, 80)";
  } else {
    videoTrack.enabled = true;
    document.getElementById("camera-btn").style.backgroundColor =
      "rgb(179, 102, 249, 0.9)";
  }
};

const toggleMic = async () => {
  let audioTrack = localStream
    .getTracks()
    .find((track) => track.kind === "audio");
  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    document.getElementById("mic-btn").style.backgroundColor =
      "rgb(255, 80, 80)";
  } else {
    audioTrack.enabled = true;
    document.getElementById("mic-btn").style.backgroundColor =
      "rgb(179, 102, 249, 0.9)";
  }
};

window.addEventListener("beforeunload", leaveChannel);
document.getElementById("camera-btn").addEventListener("click", toggleCamera);
document.getElementById("mic-btn").addEventListener("click", toggleMic);

init();
