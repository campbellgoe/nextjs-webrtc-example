// import Link from 'next/link'
import Layout from '../components/Layout'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'

const IndexPage = () => {
  const router = useRouter()
  const [roomName, setRoomName] = useState('')

  const joinRoom = () => {
    router.push(`/room/${roomName || Math.random().toString(36).slice(2)}`)
  }
  return (
    <Layout title="Home | Next.js + TypeScript Example">
      <Head>
        <title>Native WebRTC API with NextJS</title>
        <meta name="description" content="Use Native WebRTC API for video conferencing" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <h1>Let's join a room!</h1>
        <input
          onChange={e => {
            setRoomName(e.target.value)
          }}
          value={roomName}
        />
        <button
          onClick={joinRoom}
        >
          Join room
        </button>
      </main>
    </Layout>
  )
}

export default IndexPage
