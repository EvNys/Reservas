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
  deleteDoc,
  doc,
  getDocs,
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

export type Company = {
  id: string
  name: string
  createdAt: number
  packageInfo?: PackageInfo
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

  const profile: Profile = {
    uid: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'Usuário',
    email: user.email || '',
    role: 'user',
    companyId,
    status: 'pending',
  }
  await setDoc(profileRef, profile)
  return profile
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

export function subscribeToCompanyAccounts(
  company: string,
  onData: (accounts: Profile[]) => void,
  onError: (error: Error) => void,
) {
  if (!db) return () => undefined
  return onSnapshot(
    query(collection(db, 'users'), where('companyId', '==', company)),
    (snapshot) => onData(
      snapshot.docs
        .map((item) => ({ ...item.data(), uid: item.id }) as Profile)
        .filter((account) => account.status === undefined || account.status === 'approved'),
    ),
    onError,
  )
}

export function subscribeToAllAccounts(
  onData: (accounts: Profile[]) => void,
  onError: (error: Error) => void,
) {
  if (!db) return () => undefined
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    onData(snapshot.docs.map((item) => ({ ...item.data(), uid: item.id }) as Profile))
  }, onError)
}

export function subscribeToCompanies(
  onData: (companies: Company[]) => void,
  onError: (error: Error) => void,
) {
  if (!db) return () => undefined
  const packageSubscriptions = new Map<string, () => void>()
  const companyData = new Map<string, Company>()
  const emit = () => onData([...companyData.values()])
  const unsubscribeCompanies = onSnapshot(collection(db, 'companies'), (snapshot) => {
    const companyIds = new Set(snapshot.docs.map((item) => item.id))
    for (const [id, unsubscribe] of packageSubscriptions) {
      if (companyIds.has(id)) continue
      unsubscribe()
      packageSubscriptions.delete(id)
      companyData.delete(id)
    }
    snapshot.docs.forEach((item) => {
      const current = {
        ...item.data(),
        id: item.id,
        packageInfo: companyData.get(item.id)?.packageInfo,
      } as Company
      companyData.set(item.id, current)
      if (packageSubscriptions.has(item.id)) return
      packageSubscriptions.set(item.id, onSnapshot(
        doc(db, 'companies', item.id, 'packages', 'active'),
        (packageSnapshot) => {
          const currentCompany = companyData.get(item.id)
          if (!currentCompany) return
          const packageData = packageSnapshot.data()
          companyData.set(item.id, {
            ...currentCompany,
            packageInfo: packageData
              ? { label: packageData.label || 'Plano mensal', monthlyHours: packageData.monthlyHours }
              : { label: 'Plano mensal', monthlyHours: 50 },
          })
          emit()
        },
        onError,
      ))
    })
    emit()
  }, onError)
  return () => {
    unsubscribeCompanies()
    packageSubscriptions.forEach((unsubscribe) => unsubscribe())
    packageSubscriptions.clear()
  }
}

export async function ensureCompany(id: string, name: string) {
  if (!db) throw new Error('Firebase não está configurado.')
  const companyRef = doc(db, 'companies', id)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(companyRef)
    if (!snapshot.exists()) transaction.set(companyRef, { name, createdAt: Date.now() })
  })
}

export async function createCompany(name: string): Promise<Company> {
  if (!db) throw new Error('Firebase não está configurado.')
  const normalizedName = name.trim()
  if (!normalizedName) throw new Error('Informe o nome da empresa.')
  const companyRef = doc(collection(db, 'companies'))
  const company = { id: companyRef.id, name: normalizedName, createdAt: Date.now() }
  await setDoc(companyRef, { name: company.name, createdAt: company.createdAt })
  return company
}

export async function deleteCompanyIfUnused(company: string) {
  if (!db) throw new Error('Firebase não está configurado.')
  const [users, rooms, reservations, monthlyUsage, userMonthlyUsage, packages] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('companyId', '==', company))),
    getDocs(query(collection(db, 'rooms'), where('companyId', '==', company))),
    getDocs(query(collection(db, 'reservations'), where('companyId', '==', company))),
    getDocs(collection(db, 'companies', company, 'monthlyUsage')),
    getDocs(collection(db, 'companies', company, 'userMonthlyUsage')),
    getDocs(collection(db, 'companies', company, 'packages')),
  ])
  const references = [
    [users.size, 'usuários'],
    [rooms.size, 'salas'],
    [reservations.size, 'reservas'],
    [monthlyUsage.size + userMonthlyUsage.size, 'registros de uso'],
  ] as const
  const linked = references.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`)
  if (linked.length) {
    throw new Error(`Não é possível excluir esta empresa: ela possui ${linked.join(', ')} vinculados.`)
  }
  await Promise.all(packages.docs.map((packageDocument) => deleteDoc(packageDocument.ref)))
  await deleteDoc(doc(db, 'companies', company))
}

export async function updateAccountCompany(uid: string, company: string) {
  if (!db) throw new Error('Firebase não está configurado.')
  if (!company.trim()) throw new Error('Selecione uma empresa válida.')
  await updateDoc(doc(db, 'users', uid), { companyId: company })
}

export async function updateAccountAccess(
  uid: string,
  status: 'approved' | 'rejected',
  role: Profile['role'],
) {
  if (!db) throw new Error('Firebase não está configurado.')
  await updateDoc(doc(db, 'users', uid), {
    status,
    role,
  })
}

export async function initializeUserMonthlyUsage(
  company: string,
  userId: string,
  usageMonth: string,
  hoursUsed: number,
) {
  if (!db) throw new Error('Firebase não está configurado.')
  if (!Number.isFinite(hoursUsed) || hoursUsed < 0 || !/^\d{4}-\d{2}$/.test(usageMonth)) {
    throw new Error('Não foi possível inicializar um saldo mensal inválido.')
  }
  const usageRef = doc(db, 'companies', company, 'userMonthlyUsage', `${userId}_${usageMonth}`)
  await runTransaction(db, async (transaction) => {
    const usageSnapshot = await transaction.get(usageRef)
    if (usageSnapshot.exists()) return
    transaction.set(usageRef, { companyId: company, userId, month: usageMonth, hoursUsed })
  })
}

export function subscribeToWorkspace(
  company: string,
  onData: (data: Partial<WorkspaceData>) => void,
  onError: (error: Error) => void,
  onReservationsLoaded: () => void = () => undefined,
) {
  if (!db) return () => undefined
  const unsubscribe = [
    onSnapshot(
      query(collection(db, 'rooms'), where('companyId', '==', company)),
      (snapshot) => onData({ rooms: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Room) }),
      onError,
    ),
    (() => {
      let initialized = false
      return onSnapshot(
        query(collection(db, 'reservations'), where('companyId', '==', company)),
        (snapshot) => {
          onData({ reservations: snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Reservation) })
          if (!initialized) onReservationsLoaded()
          initialized = true
        },
        onError,
      )
    })(),
    onSnapshot(doc(db, 'companies', company, 'packages', 'active'), (snapshot) => {
      const data = snapshot.data()
      onData({ packageInfo: data ? { monthlyHours: data.monthlyHours, label: data.label || 'Plano mensal' } : { monthlyHours: 50, label: 'Plano mensal' } })
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
  const roomRef = doc(db, 'rooms', room.id)
  const usageMonth = monthKey(new Date(`${date}T12:00:00`))
  const userUsageRef = doc(db, 'companies', room.companyId, 'userMonthlyUsage', `${profile.uid}_${usageMonth}`)
  const packageRef = doc(db, 'companies', room.companyId, 'packages', 'active')
  const slotRefs = sortedBlocks.map((time) => doc(db!, 'roomSlots', slotId(room.id, date, time)))
  const hours = sortedBlocks.length * 0.5

  await runTransaction(db, async (transaction) => {
    const slotSnapshots = await Promise.all(slotRefs.map((reference) => transaction.get(reference)))
    const [roomSnapshot, userUsageSnapshot, packageSnapshot] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(userUsageRef),
      transaction.get(packageRef),
    ])
    const roomData = roomSnapshot.data()
    if (!roomSnapshot.exists() || roomData?.active !== true || roomData.companyId !== room.companyId || typeof roomData.name !== 'string') {
      throw new Error('A sala não está disponível para reservas.')
    }
    if (slotSnapshots.some((snapshot) => snapshot.exists())) {
      throw new Error('Um ou mais horários acabaram de ser reservados. Atualize a agenda.')
    }
    const monthlyHours = Number(packageSnapshot.data()?.monthlyHours ?? 50)
    const hoursUsed = Number(userUsageSnapshot.data()?.hoursUsed ?? 0)
    if (hoursUsed + hours > monthlyHours) {
      throw new Error(`Saldo insuficiente. Restam ${Math.max(0, monthlyHours - hoursUsed).toFixed(1)} horas neste mês.`)
    }
    const reservation: Omit<Reservation, 'id'> = {
      userId: profile.uid,
      userName: profile.name,
      companyId: roomData.companyId,
      roomId: room.id,
      roomName: roomData.name,
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
      companyId: roomData.companyId,
      roomId: room.id,
      date,
      time: sortedBlocks[index],
    }))
    transaction.set(userUsageRef, {
      month: usageMonth,
      hoursUsed: hoursUsed + hours,
      lastReservationId: bookingId,
      userId: profile.uid,
      companyId: profile.companyId,
    })
  })
}

export async function cancelReservation(reservation: Reservation) {
  if (!db) throw new Error('Firebase não está configurado.')
  const bookingRef = doc(db, 'reservations', reservation.id)
  const usageMonth = monthKey(new Date(`${reservation.date}T12:00:00`))
  const userUsageRef = doc(db, 'companies', reservation.companyId, 'userMonthlyUsage', `${reservation.userId}_${usageMonth}`)
  const slotRefs = reservation.blocks.map((time) => doc(db!, 'roomSlots', slotId(reservation.roomId, reservation.date, time)))

  await runTransaction(db, async (transaction) => {
    const [bookingSnapshot, userUsageSnapshot] = await Promise.all([
      transaction.get(bookingRef),
      transaction.get(userUsageRef),
    ])
    await Promise.all(slotRefs.map((reference) => transaction.get(reference)))
    if (!bookingSnapshot.exists() || bookingSnapshot.data()?.status !== 'confirmed') {
      throw new Error('Esta reserva não está mais ativa.')
    }
    const userHoursUsed = Number(userUsageSnapshot.data()?.hoursUsed ?? 0)
    transaction.update(bookingRef, { status: 'cancelled' })
    if (userUsageSnapshot.exists()) {
      transaction.set(userUsageRef, {
        month: usageMonth,
        hoursUsed: Math.max(0, userHoursUsed - reservation.hours),
        lastReservationId: reservation.id,
        userId: reservation.userId,
        companyId: reservation.companyId,
      })
    }
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
  const normalizedPackage = { label: packageInfo.label.trim(), monthlyHours: packageInfo.monthlyHours }
  if (!normalizedPackage.label || !Number.isFinite(normalizedPackage.monthlyHours) || normalizedPackage.monthlyHours < 0) {
    throw new Error('Informe um nome de pacote e uma quantidade válida de horas mensais.')
  }
  await setDoc(doc(db, 'companies', company, 'packages', 'active'), normalizedPackage)
}
