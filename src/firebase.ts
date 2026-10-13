import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  addDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { companyId, firebaseConfig, firebaseEnabled } from './firebase-config'

export type Room = {
  id: string
  name: string
  location: string
  capacity: number
  openTime: string
  closeTime: string
  color: string
  companyId: string
  active: boolean
}

export type Reservation = {
  id: string
  userId: string
  userName: string
  companyId: string
  roomId: string
  roomName: string
  date: string
  blocks: string[]
  hours: number
  status: 'confirmed' | 'cancelled'
  createdAt: number
  slotKeys?: string[]
}

export type Profile = {
  uid: string
  name: string
  email: string
  role: 'user' | 'admin'
  companyId: string
  status?: 'pending' | 'approved' | 'rejected'
}

export type AccessRequest = Profile & { status: 'pending' }

export type PackageInfo = {
  monthlyHours: number
  label: string
}

export type WorkspaceData = {
  rooms: Room[]
  reservations: Reservation[]
  hoursUsed: number
  packageInfo: PackageInfo
}

export const auth = firebaseEnabled
  ? getAuth(initializeApp(firebaseConfig))
  : null
export const db = firebaseEnabled ? getFirestore() : null

export const signIn = (email: string, password: string) => {
  if (!auth) throw new Error('Firebase não está configurado.')
  return signInWithEmailAndPassword(auth, email, password)
}

export const register = async (name: string, email: string, password: string) => {
  if (!auth || !db) throw new Error('Firebase não está configurado.')
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, { displayName: name })
  const profile: Profile = {
    uid: credential.user.uid,
    name,
    email,
    role: 'user',
    companyId,
    status: 'pending',
  }
  await setDoc(doc(db, 'users', credential.user.uid), profile)
  return credential.user
}

export const logOut = () => auth ? signOut(auth) : Promise.resolve()

export async function loadProfile(user: User): Promise<Profile | null> {
  if (!db) throw new Error('Firebase não está configurado.')
  const profileRef = doc(db, 'users', user.uid)
  const profileSnapshot = await getDoc(profileRef)
  if (profileSnapshot.exists()) return profileSnapshot.data() as Profile
  return null
}

export function subscribeToProfile(
  uid: string,
  onData: (profile: Profile | null) => void,
  onError: (error: Error) => void,
) {
  if (!db) return () => undefined
  return onSnapshot(doc(db, 'users', uid), (snapshot) => {
    onData(snapshot.exists() ? snapshot.data() as Profile : null)
  }, onError)
}

export function subscribeToPendingAccounts(
  company: string,
  onData: (accounts: AccessRequest[]) => void,
  onError: (error: Error) => void,
  onNewRequest: (account: AccessRequest) => void,
) {
  if (!db) return () => undefined
  let initialized = false
  return onSnapshot(
    query(collection(db, 'users'), where('companyId', '==', company), where('status', '==', 'pending')),
    (snapshot) => {
      onData(snapshot.docs.map((item) => item.data() as AccessRequest))
      if (initialized) {
        snapshot.docChanges()
          .filter((change) => change.type === 'added')
          .forEach((change) => onNewRequest(change.doc.data() as AccessRequest))
      }
      initialized = true
    },
    onError,
  )
}

export async function updateAccountAccess(
  uid: string,
  status: 'approved' | 'rejected',
  role: Profile['role'],
) {
  if (!db) throw new Error('Firebase não está configurado.')
  await updateDoc(doc(db, 'users', uid), { status, role })
}

export function subscribeToWorkspace(
  company: string,
  onData: (data: Partial<WorkspaceData>) => void,
  onError: (error: Error) => void,
  usageMonth = monthKey(),
  onUsage: (hoursUsed: number) => void = () => undefined,
) {
  if (!db) return () => undefined
  const unsubscribe = [
    onSnapshot(
      query(collection(db, 'rooms'), where('companyId', '==', company)),
      (snapshot) => onData({ rooms: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Room) }),
      onError,
    ),
    onSnapshot(
      query(collection(db, 'reservations'), where('companyId', '==', company)),
      (snapshot) => onData({ reservations: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Reservation) }),
      onError,
    ),
    onSnapshot(doc(db, 'companies', company, 'packages', 'active'), (snapshot) => {
      const data = snapshot.data()
      onData({ packageInfo: data ? { monthlyHours: data.monthlyHours, label: data.label || 'Plano mensal' } : { monthlyHours: 50, label: 'Plano mensal' } })
    }, onError),
    onSnapshot(doc(db, 'companies', company, 'monthlyUsage', usageMonth), (snapshot) => {
      const hoursUsed = snapshot.exists() ? Number(snapshot.data().hoursUsed || 0) : 0
      onData({ hoursUsed })
      onUsage(hoursUsed)
    }, onError),
  ]
  return () => unsubscribe.forEach((stop) => stop())
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function slotId(room: string, date: string, time: string) {
  return `${room}_${date}_${time}`
}

export async function createReservation(
  profile: Profile,
  room: Room,
  date: string,
  blocks: string[],
) {
  if (!db) throw new Error('Firebase não está configurado.')
  if (blocks.length === 0) throw new Error('Selecione pelo menos um horário.')
  const sortedBlocks = [...new Set(blocks)].sort()
  if (sortedBlocks.length > 20) throw new Error('Selecione no máximo 20 blocos de 30 minutos por reserva.')
  const bookingId = doc(collection(db, 'reservations')).id
  const bookingRef = doc(db, 'reservations', bookingId)
  const usageRef = doc(db, 'companies', profile.companyId, 'monthlyUsage', monthKey(new Date(`${date}T12:00:00`)))
  const packageRef = doc(db, 'companies', profile.companyId, 'packages', 'active')
  const slotRefs = sortedBlocks.map((time) => doc(db!, 'roomSlots', slotId(room.id, date, time)))
  const hours = sortedBlocks.length * 0.5

  await runTransaction(db, async (transaction) => {
    const slotSnapshots = await Promise.all(slotRefs.map((reference) => transaction.get(reference)))
    const usageSnapshot = await transaction.get(usageRef)
    const packageSnapshot = await transaction.get(packageRef)
    if (slotSnapshots.some((snapshot) => snapshot.exists())) {
      throw new Error('Um ou mais horários acabaram de ser reservados. Atualize a agenda.')
    }
    const monthlyHours = Number(packageSnapshot.data()?.monthlyHours ?? 50)
    const hoursUsed = Number(usageSnapshot.data()?.hoursUsed ?? 0)
    if (hoursUsed + hours > monthlyHours) {
      throw new Error(`Saldo insuficiente. Restam ${Math.max(0, monthlyHours - hoursUsed).toFixed(1)} horas neste mês.`)
    }

    const reservation: Omit<Reservation, 'id'> = {
      userId: profile.uid,
      userName: profile.name,
      companyId: profile.companyId,
      roomId: room.id,
      roomName: room.name,
      date,
      blocks: sortedBlocks,
      slotKeys: sortedBlocks.map((time) => slotId(room.id, date, time)),
      hours,
      status: 'confirmed',
      createdAt: Date.now(),
    }
    transaction.set(bookingRef, reservation)
    slotRefs.forEach((reference, index) => transaction.set(reference, {
      reservationId: bookingId,
      companyId: profile.companyId,
      roomId: room.id,
      date,
      time: sortedBlocks[index],
    }))
    transaction.set(usageRef, {
      month: monthKey(new Date(`${date}T12:00:00`)),
      hoursUsed: hoursUsed + hours,
      lastReservationId: bookingId,
      companyId: profile.companyId,
    })
  })
}

export async function cancelReservation(reservation: Reservation) {
  if (!db) throw new Error('Firebase não está configurado.')
  const bookingRef = doc(db, 'reservations', reservation.id)
  const usageRef = doc(db, 'companies', reservation.companyId, 'monthlyUsage', monthKey(new Date(`${reservation.date}T12:00:00`)))
  const slotRefs = reservation.blocks.map((time) => doc(db!, 'roomSlots', slotId(reservation.roomId, reservation.date, time)))

  await runTransaction(db, async (transaction) => {
    const [bookingSnapshot, usageSnapshot] = await Promise.all([
      transaction.get(bookingRef),
      transaction.get(usageRef),
    ])
    await Promise.all(slotRefs.map((reference) => transaction.get(reference)))
    if (!bookingSnapshot.exists() || bookingSnapshot.data()?.status !== 'confirmed') {
      throw new Error('Esta reserva não está mais ativa.')
    }
    const hoursUsed = Number(usageSnapshot.data()?.hoursUsed ?? 0)
    transaction.update(bookingRef, { status: 'cancelled' })
    transaction.set(usageRef, {
      month: monthKey(new Date(`${reservation.date}T12:00:00`)),
      hoursUsed: Math.max(0, hoursUsed - reservation.hours),
      lastReservationId: reservation.id,
      companyId: reservation.companyId,
    })
    slotRefs.forEach((reference) => transaction.delete(reference))
  })
}

export async function addRoom(room: Omit<Room, 'id'>) {
  if (!db) throw new Error('Firebase não está configurado.')
  await addDoc(collection(db, 'rooms'), room)
}

export async function updateRoom(room: Room) {
  if (!db) throw new Error('Firebase não está configurado.')
  const { id, ...roomData } = room
  await updateDoc(doc(db, 'rooms', id), roomData)
}

export async function savePackage(company: string, packageInfo: PackageInfo) {
  if (!db) throw new Error('Firebase não está configurado.')
  await setDoc(doc(db, 'companies', company, 'packages', 'active'), packageInfo)
}
