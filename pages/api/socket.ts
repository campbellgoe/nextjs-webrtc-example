import { Server } from 'socket.io'

const maxRoomSize = 2

const SocketHandler = (req, res) => {
  if(res.socket.server.io){
    console.log('Socket is already attached')
    return res.end()
  }

  const io = new Server(res.socket.server)
  res.socket.server.io = io

  io.on("connection", socket => {
    console.log(`User Connected: ${socket.id}`)

    // triggered when a peer hits the join room button
    socket.on("join", roomName => {
      const { rooms } = io.sockets.adapter
      const room = rooms.get(roomName)

      if(!room){
        socket.join(roomName)
        socket.emit("created")
      } else if(room.size < maxRoomSize){
        socket.join(roomName)
        socket.emit("joined")
      } else {
        socket.emit("full")
      }
      console.log('rooms:', rooms)
    })

    // triggered when the person who joined the room is ready to communicate
    socket.on("ready", roomName => {
      // informs the other peers in the room
      socket.broadcast.to(roomName).emit("ready")
    })

    // triggered when server gets an icecandidate from a peer in the room
    socket.on("ice-candidate", (candidate, roomName: string) => {
      console.log('ice-candidate', candidate)
      //sends candidate to the other peers in the room
      socket.broadcast.to(roomName).emit("ice-candidate", candidate)
    })

    // triggered when server gets an offer from a peer in the room
    socket.on("offer", (offer, roomName) => {
      // Sends Offer to the other peer in the room.
      socket.broadcast.to(roomName).emit("offer", offer)
    })

    // triggered when server gets an answer from a peer in the room
    socket.on("answer", (answer, roomName) => {
      // Sends Answer to the other peer in the room.
      socket.broadcast.to(roomName).emit("answer", answer)
    })

    // triggered when a peer leaves a room
    socket.on("leave", roomName => {
      socket.leave(roomName);
      socket.broadcast.to(roomName).emit("leave");
    })


  })

  return res.end()
}

export default SocketHandler
