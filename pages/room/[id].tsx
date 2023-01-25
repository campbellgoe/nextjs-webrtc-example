import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { DefaultEventsMap } from 'socket.io/dist/typed-events'
import useSocket from '../../hooks/useSocket'

const Room = () => {
  useSocket()

  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);

  const router = useRouter()
  const userVideoRef = useRef<HTMLVideoElement>()
  const peerVideoRef = useRef<HTMLVideoElement>()
  const rtcConnectionRef = useRef(null)
  const socketRef = useRef<Socket<DefaultEventsMap, DefaultEventsMap>>()
  const userStreamRef = useRef<MediaStream>()
  const hostRef = useRef(false)

  const { id: roomName } = router.query
  
  const handleRoomJoined = () => {
    navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: { width: 500, height: 500 },
    })
    .then((stream) => {
      /* use the stream */
      userStreamRef.current = stream;
      userVideoRef.current.srcObject = stream;
      userVideoRef.current.onloadedmetadata = () => {
        userVideoRef.current.play();
      };
      socketRef.current.emit('ready', roomName);
    })
    .catch((err) => {
      /* handle the error */
      console.log('error', err);
    });
  };

  const handleRoomCreated = () => {
    hostRef.current = true
    handleRoomJoined()
    // navigator.mediaDevices.getUserMedia({
    //   audio: true,
    //   video: { width: 500, height: 500 },
    // })
    // .then(stream => {
    //   userStreamRef.current = stream
    //   userVideoRef.current.srcObject = stream
    //   userVideoRef.current.onloadedmetadata = () => {
    //     userVideoRef.current.play()
    //   }
    // })
    // .catch(err => {
    //   console.error(err)
    // })
  }

  const ICE_SERVERS = {
    iceServers: [
      {
        urls: 'stun:openrelay.metered.ca:80'
      }
    ]
  }

  const handleICECandidateEvent = (event) => {
    if (event.candidate) {
      socketRef.current.emit('ice-candidate', event.candidate, roomName);
    }
  };

  const handlerNewIceCandidateMsg = (incoming) => {
    // We cast the incoming candidate to RTCIceCandidate
    const candidate = new RTCIceCandidate(incoming);
    rtcConnectionRef.current
      .addIceCandidate(candidate)
      .catch((e) => console.log(e));
  };

  const handleTrackEvent = (event) => {
    peerVideoRef.current.srcObject = event.streams[0];
  };

  const createPeerConnection = () => {
    // create a RTC Peer Connection
    const connection = new RTCPeerConnection(ICE_SERVERS)

    // implement our onicecandidate method for when we received a ICE candidate from the STUN server
    connection.onicecandidate = handleICECandidateEvent

    // implement our onTrack method for when we receive tracks
    connection.ontrack = handleTrackEvent
    return connection
  }

  const initiateCall = () => {
    if(hostRef.current){
      rtcConnectionRef.current = createPeerConnection()
      rtcConnectionRef.current.addTrack(
        userStreamRef.current.getTracks()[0],
        userStreamRef.current
      )
      rtcConnectionRef.current.addTrack(
        userStreamRef.current.getTracks()[1],
        userStreamRef.current,
      )
      rtcConnectionRef.current
      .createOffer()
      .then(offer => {
        rtcConnectionRef.current.setLocalDescription(offer)
        socketRef.current.emit('offer', offer, roomName)
      })
      .catch(err => {
        console.error(err)
      })
    }
  }

  const handleReceivedOffer = (offer) => {
    if (!hostRef.current) {
      rtcConnectionRef.current = createPeerConnection();
      rtcConnectionRef.current.addTrack(
        userStreamRef.current.getTracks()[0],
        userStreamRef.current,
      );
      rtcConnectionRef.current.addTrack(
        userStreamRef.current.getTracks()[1],
        userStreamRef.current,
      );
      rtcConnectionRef.current.setRemoteDescription(offer);

      rtcConnectionRef.current
        .createAnswer()
        .then((answer) => {
          rtcConnectionRef.current.setLocalDescription(answer);
          socketRef.current.emit('answer', answer, roomName);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };
  
  const handleAnswer = (answer) => {
    rtcConnectionRef.current
      .setRemoteDescription(answer)
      .catch((err) => console.log(err));
  };

  const leaveRoom = () => {
    socketRef.current.emit('leave', roomName); // Let's the server know that user has left the room.

    if (userVideoRef.current.srcObject) {
      // @ts-ignore
      userVideoRef.current.srcObject.getTracks().forEach((track) => track.stop()); // Stops receiving all track of User.
    }
    if (peerVideoRef.current.srcObject) {
      // @ts-ignore
      peerVideoRef.current.srcObject.getTracks()
        .forEach((track) => track.stop()); // Stops receiving audio track of Peer.
    }

    // Checks if there is peer on the other side and safely closes the existing connection established with the peer.
    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.ontrack = null;
      rtcConnectionRef.current.onicecandidate = null;
      rtcConnectionRef.current.close();
      rtcConnectionRef.current = null;
    }
    router.push('/')
  };

  const onPeerLeave = () => {
    // This person is now the creator because they are the only person in the room.
    hostRef.current = true;
    if (peerVideoRef.current.srcObject) {
      (peerVideoRef.current.srcObject as MediaStream).getTracks()
        .forEach((track) => track.stop()); // Stops receiving all track of Peer.
    }

    // Safely closes the existing connection established with the peer who left.
    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.ontrack = null;
      rtcConnectionRef.current.onicecandidate = null;
      rtcConnectionRef.current.close();
      rtcConnectionRef.current = null;
    }
  }

  const toggleMediaStream = (type, state) => {
    userStreamRef.current.getTracks().forEach((track) => {
      if (track.kind === type) {
        // eslint-disable-next-line no-param-reassign
        track.enabled = !state;
      }
    });
  };

  const toggleMic = () => {
    toggleMediaStream('audio', micActive);
    setMicActive((prev) => !prev);
  };

  const toggleCamera = () => {
    toggleMediaStream('video', cameraActive);
    setCameraActive((prev) => !prev);
  };

  useEffect(() => {
    socketRef.current = io()

    // first we join a room
    socketRef.current.emit('join', roomName)

    socketRef.current.on('created', handleRoomCreated)

    socketRef.current.on('joined', handleRoomJoined);
    // If the room didn't exist, the server would emit the room was 'created'

    // Whenever the next person joins, the server emits 'ready'
    socketRef.current.on('ready', initiateCall);

    // Emitted when a peer leaves the room
    socketRef.current.on('leave', onPeerLeave);

    // If the room is full, we show an alert
    socketRef.current.on('full', () => {
      router.push('/')
    });

    // Events that are webRTC speccific
    socketRef.current.on('offer', handleReceivedOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handlerNewIceCandidateMsg);

    return () => {
      socketRef.current.disconnect()
    }
  }, [roomName])

  return (
    <div>
      <video autoPlay ref={userVideoRef}/>
      <video autoPlay ref={peerVideoRef}/>
      <button onClick={toggleMic} type="button">
        {micActive ? 'Mute Mic' : 'UnMute Mic'}
      </button>
      <button onClick={leaveRoom} type="button">
        Leave
      </button>
      <button onClick={toggleCamera} type="button">
        {cameraActive ? 'Stop Camera' : 'Start Camera'}
      </button>
    </div>
  )
}

export default Room

