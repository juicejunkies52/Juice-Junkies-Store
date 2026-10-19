// Thin wrapper around an Ably realtime channel for a single Last Stand
// co-op room. One player is "host" (runs the real simulation and
// broadcasts state); the other is "guest" (sends input, renders whatever
// the host sends). Ably just relays messages -- it has no idea which side
// is which, that's purely a convention this game enforces.

import Ably from 'ably'

export function randomRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export class AblyRoom {
  client: Ably.Realtime
  channel: Ably.RealtimeChannel
  clientId: string

  private constructor(client: Ably.Realtime, channel: Ably.RealtimeChannel, clientId: string) {
    this.client = client
    this.channel = channel
    this.clientId = clientId
  }

  static async connect(room: string, clientId: string, game: string = 'laststand'): Promise<AblyRoom> {
    const client = new Ably.Realtime({
      authUrl: `/api/ably-auth?room=${encodeURIComponent(room)}&clientId=${encodeURIComponent(clientId)}&game=${encodeURIComponent(game)}`,
      clientId
    })
    await new Promise<void>((resolve, reject) => {
      client.connection.once('connected', () => resolve())
      client.connection.once('failed', (err) => reject(err))
    })
    const channel = client.channels.get(`${game}:${room}`)
    await channel.attach()
    return new AblyRoom(client, channel, clientId)
  }

  publish(event: string, data: unknown) {
    this.channel.publish(event, data).catch(() => {})
  }

  subscribe(event: string, handler: (data: any) => void) {
    const listener = (msg: Ably.Message) => handler(msg.data)
    this.channel.subscribe(event, listener)
    return () => this.channel.unsubscribe(event, listener)
  }

  enterPresence(data: unknown) {
    this.channel.presence.enter(data).catch(() => {})
  }

  onPresence(handler: (members: Ably.PresenceMessage[]) => void) {
    const update = async () => {
      try {
        const members = await this.channel.presence.get()
        handler(members)
      } catch {
        // Fine -- next presence event will retry.
      }
    }
    this.channel.presence.subscribe(update)
    update()
    return () => this.channel.presence.unsubscribe(update)
  }

  close() {
    try {
      this.client.close()
    } catch {
      // Fine.
    }
  }
}
