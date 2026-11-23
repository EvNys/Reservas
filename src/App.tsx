import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  CircleHelp,
  Clock3,
  DoorOpen,
  Download,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  Users,
  X,
} from "lucide-react";
import {
  companyId,
  firebaseEnabled,
  whatsappNumber,
} from "./firebase-config";
import type {
  AccessRequest,
  AuditLog,
  Company,
  CompanyContract,
  NewAuditLog,
  Profile,
  Reservation,
  Room,
  WorkspaceData,
} from "./firebase";

type View =
  | "reserve"
  | "mine"
  | "manage"
  | "companies"
  | "users"
  | "audit"
  | "logistics";

const initialDate = localDate(new Date());
const emptyWorkspaceData: WorkspaceData = {
  rooms: [],
  reservations: [],
  creditsUsed: 0,
  packageInfo: { monthlyCredits: 50, label: "Plano mensal" },
};
const demoProfile: Profile = {
  uid: "demo-user",
  name: "Camila Nogueira",
  email: "camila@acme.com",
  role: "admin",
  companyId,
  status: "approved",
};
const demoAccessRequests: AccessRequest[] = [
  {
    uid: "demo-pending-1",
    name: "Pedro Martins",
    email: "pedro@acme.com",
    role: "user",
    companyId,
    status: "pending",
  },
];
const demoAccounts: Profile[] = [
  {
    uid: "demo-colleague",
    name: "Rafael Costa",
    email: "rafael@acme.com",
    role: "user",
    companyId,
    status: "approved",
  },
  {
    uid: "demo-marina",
    name: "Marina Alves",
    email: "marina@acme.com",
    role: "user",
    companyId,
    status: "approved",
  },
];
const demoRooms: Room[] = [
  {
    id: "sala-ipe",
    name: "Sala Ipê",
    location: "2º andar · Ala norte",
    capacity: 8,
    openTime: "08:00",
    closeTime: "18:00",
    creditsPerHour: 1,
    color: "blue",
    active: true,
  },
  {
    id: "sala-aurora",
    name: "Sala Aurora",
    location: "3º andar · Ala sul",
    capacity: 12,
    openTime: "08:00",
    closeTime: "19:00",
    creditsPerHour: 1,
    color: "violet",
    active: true,
  },
  {
    id: "sala-patio",
    name: "Sala Pátio",
    location: "Térreo · Próximo ao café",
    capacity: 6,
    openTime: "09:00",
    closeTime: "17:00",
    creditsPerHour: 1,
    color: "amber",
    active: true,
  },
  {
    id: "sala-ideias",
    name: "Sala Ideias",
    location: "2º andar · Ala norte",
    capacity: 4,
    openTime: "08:00",
    closeTime: "18:00",
    creditsPerHour: 1,
    color: "emerald",
    active: true,
  },
];

type SavedDemoWorkspace = WorkspaceData & {
  hoursUsed?: number;
  packageInfo?: {
    label?: string;
    monthlyCredits?: number;
    monthlyHours?: number;
  };
  rooms?: (Room & { creditsPerHour?: number })[];
};

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timestampNow() {
  return Date.now();
}

function normalizeDemoWorkspace(savedData: SavedDemoWorkspace): WorkspaceData {
  return {
    ...savedData,
    rooms: (savedData.rooms || []).map((room) => ({
      ...room,
      creditsPerHour: room.creditsPerHour ?? 1,
    })),
    creditsUsed: savedData.creditsUsed ?? savedData.hoursUsed ?? 0,
    packageInfo: {
      label: savedData.packageInfo?.label || "Plano mensal",
      monthlyCredits:
        savedData.packageInfo?.monthlyCredits ??
        savedData.packageInfo?.monthlyHours ??
        50,
    },
  };
}

function seedWorkspace(): WorkspaceData {
  const seedReservations: Reservation[] = [
    {
      id: "demo-booking-1",
      userId: "demo-colleague",
      userName: "Rafael Costa",
      companyId,
      roomId: "sala-ipe",
      roomName: "Sala Ipê",
      date: initialDate,
      blocks: ["10:00", "10:30", "11:00", "11:30"],
      hours: 2,
      status: "confirmed",
      createdAt: Date.now(),
    },
    {
      id: "demo-booking-2",
      userId: "demo-user",
      userName: demoProfile.name,
      companyId,
      roomId: "sala-aurora",
      roomName: "Sala Aurora",
      date: initialDate,
      blocks: ["14:00", "14:30"],
      hours: 1,
      status: "confirmed",
      createdAt: Date.now(),
    },
    {
      id: "demo-booking-3",
      userId: "demo-marina",
      userName: "Marina Alves",
      companyId,
      roomId: "sala-patio",
      roomName: "Sala Pátio",
      date: initialDate,
      blocks: ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30"],
      hours: 3,
      status: "confirmed",
      createdAt: Date.now(),
    },
  ];
  try {
    const saved = localStorage.getItem("reservas-demo");
    if (saved)
      return normalizeDemoWorkspace(JSON.parse(saved) as SavedDemoWorkspace);
  } catch (error) {
    console.error(
      "Não foi possível carregar os dados locais da demonstração.",
      error,
    );
  }
  return {
    rooms: demoRooms,
    reservations: seedReservations,
    creditsUsed: 31.5,
    packageInfo: { monthlyCredits: 50, label: "Plano corporativo" },
  };
}

function reservationCredits(booking: Reservation) {
  return booking.creditsCost ?? booking.hours;
}

function roomCreditsPerHour(room: Room) {
  return room.creditsPerHour ?? 1;
}

function formatCredits(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function saveDemoWorkspace(data: WorkspaceData) {
  try {
    localStorage.setItem("reservas-demo", JSON.stringify(data));
  } catch (error) {
    console.error(
      "Não foi possível salvar os dados locais da demonstração.",
      error,
    );
  }
}

function monthLabel(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function shortDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(new Date(`${date}T12:00:00`))
    .replace(".", "");
}

function timeBlocks(room: Room) {
  const blocks: string[] = [];
  const [openHour, openMinute] = room.openTime.split(":").map(Number);
  const [closeHour, closeMinute] = room.closeTime.split(":").map(Number);
  let cursor = openHour * 60 + openMinute;
  const close = closeHour * 60 + closeMinute;
  while (cursor + 30 <= close) {
    blocks.push(
      `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`,
    );
    cursor += 30;
  }
  return blocks;
}

function timeMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function rangeBlocks(start: string, end: string) {
  const blocks: string[] = [];
  for (
    let cursor = timeMinutes(start);
    cursor < timeMinutes(end);
    cursor += 30
  ) {
    blocks.push(
      `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`,
    );
  }
  return blocks;
}

function formatRanges(blocks: string[]) {
  const sorted = [...blocks].sort();
  const ranges: { start: string; end: string }[] = [];
  sorted.forEach((time) => {
    const [hour, minute] = time.split(":").map(Number);
    const endMinutes = hour * 60 + minute + 30;
    const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    const last = ranges[ranges.length - 1];
    if (last?.end === time) last.end = end;
    else ranges.push({ start: time, end });
  });
  return ranges;
}

function makeWhatsAppLink(message: string) {
  const phone = whatsappNumber.replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function App() {
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());
  const today = localDate(currentDateTime);
  const currentMonth = today.slice(0, 7);
  const currentTime = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(currentDateTime);
  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const [workspaceState, setWorkspaceState] = useState(() => ({
    companyId,
    data: seedWorkspace(),
  }));
  const [profile, setProfile] = useState<Profile | null>(
    firebaseEnabled ? null : demoProfile,
  );
  const [pendingAccounts, setPendingAccounts] = useState<AccessRequest[]>(
    firebaseEnabled ? [] : demoAccessRequests,
  );
  const [companyAccounts, setCompanyAccounts] = useState<Profile[]>(
    firebaseEnabled ? [] : [demoProfile, ...demoAccounts],
  );
  const [allAccounts, setAllAccounts] = useState<Profile[]>(
    firebaseEnabled
      ? []
      : [demoProfile, ...demoAccounts, ...demoAccessRequests],
  );
  const [companies, setCompanies] = useState<Company[]>(
    firebaseEnabled
      ? []
      : [
          {
            id: companyId,
            name: "Empresa principal",
            createdAt: 0,
            packageInfo: { label: "Plano corporativo", monthlyCredits: 50 },
          },
        ],
  );
  const [companyContracts, setCompanyContracts] = useState<
    Record<string, CompanyContract[]>
  >({});
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLogsLoaded, setAuditLogsLoaded] = useState(!firebaseEnabled);
  const [clearingAuditLogs, setClearingAuditLogs] = useState(false);
  const [accountRoles, setAccountRoles] = useState<
    Record<string, Profile["role"]>
  >({});
  const [accountCompanyDrafts, setAccountCompanyDrafts] = useState<
    Record<string, string>
  >({});
  const [accountSearch, setAccountSearch] = useState("");
  const [platformAccountSearch, setPlatformAccountSearch] = useState("");
  const [logisticsSearch, setLogisticsSearch] = useState("");
  const [companyBusy, setCompanyBusy] = useState(false);
  const [deletingCompanies, setDeletingCompanies] = useState<
    Record<string, boolean>
  >({});
  const [savingCompanyPackages, setSavingCompanyPackages] = useState<
    Record<string, boolean>
  >({});
  const [savingCompanyAccounts, setSavingCompanyAccounts] = useState<
    Record<string, boolean>
  >({});
  const [companyContractDrafts, setCompanyContractDrafts] = useState<
    Record<string, string>
  >({});
  const [savingCompanyContracts, setSavingCompanyContracts] = useState<
    Record<string, boolean>
  >({});
  const [deletingCompanyContracts, setDeletingCompanyContracts] = useState<
    Record<string, boolean>
  >({});
  const [companyAccountsSnapshot, setCompanyAccountsSnapshot] = useState<
    string | null
  >(firebaseEnabled ? null : companyId);
  const isHubAdmin = profile?.role === "admin";
  const isAdmin = profile?.role === "admin";
  const activeCompanyId = profile?.companyId || companyId;
  const workspace =
    workspaceState.companyId === activeCompanyId
      ? workspaceState.data
      : emptyWorkspaceData;
  const setWorkspace = useCallback(
    (update: WorkspaceData | ((current: WorkspaceData) => WorkspaceData)) => {
      setWorkspaceState((current) => {
        const currentData =
          current.companyId === activeCompanyId
            ? current.data
            : emptyWorkspaceData;
        return {
          companyId: activeCompanyId,
          data: typeof update === "function" ? update(currentData) : update,
        };
      });
    },
    [activeCompanyId],
  );
  const [view, setView] = useState<View>("reserve");
  const [date, setDate] = useState(today);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const [reservationsSnapshot, setReservationsSnapshot] = useState<
    string | null
  >(null);
  const initializedUsage = useRef(new Set<string>());
  const selectedMonth = date.slice(0, 7);

  useEffect(() => {
    if (firebaseEnabled) return;
    function syncDemoWorkspace(event: StorageEvent) {
      if (event.key !== "reservas-demo") return;
      try {
        const data = event.newValue
          ? normalizeDemoWorkspace(
              JSON.parse(event.newValue) as SavedDemoWorkspace,
            )
          : seedWorkspace();
        setWorkspaceState({ companyId, data });
      } catch (error) {
        console.error(
          "Não foi possível sincronizar os dados da demonstração entre abas.",
          error,
        );
        setToast("Não foi possível sincronizar os dados da demonstração.");
      }
    }
    window.addEventListener("storage", syncDemoWorkspace);
    return () => window.removeEventListener("storage", syncDemoWorkspace);
  }, []);

  useEffect(() => {
    if (!firebaseEnabled) return;
    let unsubscribeAuth: (() => void) | undefined;
    let unsubscribeProfile: (() => void) | undefined;
    let activeUid: string | null = null;
    let cancelled = false;
    void import("./firebase")
      .then(({ auth: firebaseAuth, loadProfile, subscribeToProfile }) => {
        if (cancelled || !firebaseAuth) return;
        unsubscribeAuth = firebaseAuth.onAuthStateChanged(async (user) => {
          unsubscribeProfile?.();
          unsubscribeProfile = undefined;
          activeUid = user?.uid ?? null;
          if (!user) {
            setProfile(null);
            return;
          }
          try {
            const loadedProfile = await loadProfile(user);
            if (cancelled || activeUid !== user.uid) return;
            if (!loadedProfile) {
              setProfile(null);
              setAuthError("Aguardando a confirmação dos dados da conta…");
              unsubscribeProfile = subscribeToProfile(
                user.uid,
                (updatedProfile) => {
                  setProfile(updatedProfile);
                  if (updatedProfile) setAuthError("");
                },
                (error) => setAuthError(errorMessage(error)),
              );
              return;
            }
            setProfile(loadedProfile);
            unsubscribeProfile = subscribeToProfile(
              user.uid,
              setProfile,
              (error) => setAuthError(errorMessage(error)),
            );
          } catch (error) {
            if (!cancelled && activeUid === user.uid)
              setAuthError(errorMessage(error));
          }
        });
      })
      .catch((error: unknown) => setAuthError(errorMessage(error)));
    return () => {
      cancelled = true;
      unsubscribeAuth?.();
      unsubscribeProfile?.();
    };
  }, []);

  useEffect(() => {
    if (
      !firebaseEnabled ||
      profile?.role !== "admin" ||
      profile.status === "pending" ||
      profile.status === "rejected"
    )
      return;
    let unsubscribe: () => void = () => {};
    let cancelled = false;
    void import("./firebase")
      .then(({ subscribeToPendingAccounts }) => {
        if (cancelled) return;
        unsubscribe = subscribeToPendingAccounts(
          setPendingAccounts,
          (error) =>
            setToast(`Erro ao carregar solicitações: ${error.message}`),
          (account) =>
            setToast(`Nova solicitação de acesso de ${account.name}.`),
        );
      })
      .catch((error: unknown) =>
        setToast(`Erro ao carregar solicitações: ${errorMessage(error)}`),
      );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [profile]);

  useEffect(() => {
    if (
      !firebaseEnabled ||
      profile?.role !== "admin" ||
      profile.status === "pending" ||
      profile.status === "rejected"
    )
      return;
    let unsubscribe: () => void = () => {};
    let cancelled = false;
    void import("./firebase")
      .then(({ subscribeToCompanyAccounts }) => {
        if (cancelled) return;
        unsubscribe = subscribeToCompanyAccounts(
          profile.companyId,
          (accounts) => {
            setCompanyAccounts(accounts);
            setCompanyAccountsSnapshot(profile.companyId);
          },
          (error) => setToast(`Erro ao carregar usuários: ${error.message}`),
        );
      })
      .catch((error: unknown) =>
        setToast(`Erro ao carregar usuários: ${errorMessage(error)}`),
      );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [profile]);

  useEffect(() => {
    if (!firebaseEnabled || !isAdmin) return;
    let unsubscribeAccounts: () => void = () => {};
    let unsubscribeCompanies: () => void = () => {};
    let cancelled = false;
    void import("./firebase")
      .then(
        ({
          deleteRejectedAccounts,
          ensureCompany,
          subscribeToAllAccounts,
          subscribeToCompanies,
        }) => {
          if (cancelled) return;
          unsubscribeAccounts = subscribeToAllAccounts(
            (accounts) => {
              setAllAccounts(accounts);
              setAccountCompanyDrafts((drafts) =>
                Object.fromEntries(
                  accounts.map((account) => [
                    account.uid,
                    drafts[account.uid] || account.companyId,
                  ]),
                ),
              );
            },
            (error) => setToast(`Erro ao carregar usuários: ${error.message}`),
          );
          unsubscribeCompanies = subscribeToCompanies(setCompanies, (error) =>
            setToast(`Erro ao carregar empresas: ${error.message}`),
          );
          void deleteRejectedAccounts().catch((error: unknown) =>
            setToast(
              `Erro ao excluir perfis rejeitados: ${errorMessage(error)}`,
            ),
          );
          void ensureCompany(companyId, "Empresa principal").catch(
            (error: unknown) =>
              setToast(
                `Erro ao preparar a empresa principal: ${errorMessage(error)}`,
              ),
          );
        },
      )
      .catch((error: unknown) =>
        setToast(`Erro ao abrir a administração: ${errorMessage(error)}`),
      );
    return () => {
      cancelled = true;
      unsubscribeAccounts();
      unsubscribeCompanies();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!firebaseEnabled || !isAdmin || !companies.length) {
      return;
    }
    let cancelled = false;
    const unsubscribes: (() => void)[] = [];
    void import("./firebase")
      .then(({ subscribeToCompanyContracts }) => {
        if (cancelled) return;
        companies.forEach((company) => {
          unsubscribes.push(
            subscribeToCompanyContracts(
              company.id,
              (contracts) =>
                setCompanyContracts((current) => ({
                  ...current,
                  [company.id]: contracts,
                })),
              (error) =>
                setToast(
                  `Erro ao carregar contratos de ${company.name}: ${error.message}`,
                ),
            ),
          );
        });
      })
      .catch((error: unknown) =>
        setToast(`Erro ao carregar contratos: ${errorMessage(error)}`),
      );
    return () => {
      cancelled = true;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [companies, isAdmin]);

  useEffect(() => {
    if (!firebaseEnabled || !isAdmin) return;
    let cancelled = false;
    let unsubscribe = () => {};
    void import("./firebase")
      .then(({ subscribeToAuditLogs }) => {
        if (cancelled) return;
        unsubscribe = subscribeToAuditLogs(
          (logs) => {
            setAuditLogs(logs);
            setAuditLogsLoaded(true);
          },
          (error) => {
            setAuditLogsLoaded(true);
            setToast(`Erro ao carregar o audit log: ${error.message}`);
          },
        );
      })
      .catch((error: unknown) => {
        setAuditLogsLoaded(true);
        setToast(`Erro ao carregar o audit log: ${errorMessage(error)}`);
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!firebaseEnabled || !profile) return;
    let unsubscribe: () => void = () => {};
    let cancelled = false;
    void import("./firebase")
      .then(({ subscribeToWorkspace }) => {
        if (cancelled) return;
        unsubscribe = subscribeToWorkspace(
          activeCompanyId,
          (incoming) => setWorkspace((old) => ({ ...old, ...incoming })),
          (error) => setToast(`Erro ao sincronizar: ${error.message}`),
          () => setReservationsSnapshot(`${activeCompanyId}_${selectedMonth}`),
        );
      })
      .catch((error: unknown) =>
        setToast(`Erro ao conectar ao Firebase: ${errorMessage(error)}`),
      );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [profile, activeCompanyId, selectedMonth, setWorkspace]);

  useEffect(() => {
    if (
      !firebaseEnabled ||
      profile?.role !== "admin" ||
      companyAccountsSnapshot !== profile.companyId ||
      reservationsSnapshot !== `${activeCompanyId}_${selectedMonth}`
    )
      return;
    const monthReservations = workspace.reservations.filter(
      (booking) =>
        booking.companyId === activeCompanyId &&
        booking.date.slice(0, 7) === selectedMonth &&
        booking.status === "confirmed",
    );
    void import("./firebase")
      .then(({ initializeUserMonthlyUsage }) => {
        companyAccounts.forEach((account) => {
          const key = `${activeCompanyId}_${account.uid}_${selectedMonth}`;
          if (initializedUsage.current.has(key)) return;
          initializedUsage.current.add(key);
          const creditsUsed = monthReservations
            .filter((booking) => booking.userId === account.uid)
            .reduce((total, booking) => total + reservationCredits(booking), 0);
          void initializeUserMonthlyUsage(
            activeCompanyId,
            account.uid,
            selectedMonth,
            creditsUsed,
          ).catch((error: unknown) => {
            initializedUsage.current.delete(key);
            setToast(
              `Erro ao sincronizar o saldo de ${account.name}: ${errorMessage(error)}`,
            );
          });
        });
      })
      .catch((error: unknown) =>
        setToast(
          `Erro ao inicializar saldo dos usuários: ${errorMessage(error)}`,
        ),
      );
  }, [
    profile,
    activeCompanyId,
    companyAccounts,
    companyAccountsSnapshot,
    reservationsSnapshot,
    workspace.reservations,
    selectedMonth,
  ]);

  const allRooms = workspace.rooms;
  const rooms = allRooms.filter((room) => room.active);
  const room = rooms.find((item) => item.id === selectedRoom) || rooms[0];
  const userPackage = workspace.packageInfo;
  const currentUsage = workspace.reservations
    .filter(
      (booking) =>
        booking.userId === profile?.uid &&
        booking.date.slice(0, 7) === selectedMonth &&
        booking.status === "confirmed",
    )
    .reduce((total, booking) => total + reservationCredits(booking), 0);
  const remaining = Math.max(0, userPackage.monthlyCredits - currentUsage);
  const bookingHours = selectedBlocks.length * 0.5;
  const bookingCredits = bookingHours * (room ? roomCreditsPerHour(room) : 0);
  const occupiedBlocks = new Set(
    workspace.reservations
      .filter(
        (item) =>
          item.date === date &&
          item.status === "confirmed" &&
          item.roomId === room?.id,
      )
      .flatMap((item) => item.blocks),
  );
  const userReservations = workspace.reservations
    .filter(
      (item) =>
        item.userId === profile?.uid &&
        item.status === "confirmed" &&
        item.date >= today,
    )
    .sort((left, right) => left.date.localeCompare(right.date));
  const filteredAccounts = companyAccounts
    .filter((account) =>
      `${account.name} ${account.email}`
        .toLocaleLowerCase("pt-BR")
        .includes(accountSearch.trim().toLocaleLowerCase("pt-BR")),
    )
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  const filteredPlatformAccounts = allAccounts
    .filter((account) =>
      `${account.name} ${account.email}`
        .toLocaleLowerCase("pt-BR")
        .includes(platformAccountSearch.trim().toLocaleLowerCase("pt-BR")),
    )
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  const logisticsAccounts = allAccounts
    .filter((account) => {
      const companyName =
        companies.find((company) => company.id === account.companyId)?.name ||
        account.companyId;
      return `${account.name} ${account.email} ${companyName}`
        .toLocaleLowerCase("pt-BR")
        .includes(logisticsSearch.trim().toLocaleLowerCase("pt-BR"));
    })
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  const reservationsByUser = workspace.reservations.reduce<
    Record<string, { total: number; confirmed: number; cancelled: number }>
  >((counts, booking) => {
    const userCounts = counts[booking.userId] || {
      total: 0,
      confirmed: 0,
      cancelled: 0,
    };
    userCounts.total += 1;
    if (booking.status === "confirmed") userCounts.confirmed += 1;
    else userCounts.cancelled += 1;
    counts[booking.userId] = userCounts;
    return counts;
  }, {});
  const confirmedReservationCount = workspace.reservations.filter(
    (booking) => booking.status === "confirmed",
  ).length;
  const monthDate = new Date(`${date}T12:00:00`);
  const dayCount = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  const firstWeekday =
    (new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay() + 6) %
    7;

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 4600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function toggleBlock(block: string) {
    setSelectedBlocks((current) =>
      current.includes(block)
        ? current.filter((item) => item !== block)
        : [...current, block].sort(),
    );
  }

  function chooseDate(nextDate: string) {
    setDate(nextDate);
    setSelectedBlocks([]);
  }

  async function recordAuditEvent(event: NewAuditLog) {
    if (!profile) return;
    const createdAt = timestampNow();
    if (!firebaseEnabled) {
      setAuditLogs((current) =>
        [
          {
            ...event,
            id: `demo-audit-${createdAt}-${Math.random().toString(36).slice(2)}`,
            actorUid: profile.uid,
            actorName: profile.name,
            actorRole: profile.role,
            createdAt,
          },
          ...current,
        ].slice(0, 500),
      );
      setAuditLogsLoaded(true);
      return;
    }
    try {
      const { createAuditLog } = await import("./firebase");
      await createAuditLog(profile, event);
    } catch (error) {
      console.error("Não foi possível registrar o evento de auditoria.", error);
      setToast(
        `A operação foi concluída, mas não foi possível registrar no audit log: ${errorMessage(error)}`,
      );
    }
  }

  async function handleClearAuditLogs() {
    if (!isAdmin || !auditLogs.length) return;
    if (
      !window.confirm(
        "Deseja limpar todo o audit log? Esta ação não pode ser desfeita.",
      )
    ) {
      return;
    }
    setClearingAuditLogs(true);
    try {
      if (firebaseEnabled) {
        const { clearAuditLogs } = await import("./firebase");
        await clearAuditLogs();
      } else {
        setAuditLogs([]);
      }
      setToast("Audit log limpo com sucesso.");
    } catch (error) {
      setToast(`Não foi possível limpar o audit log: ${errorMessage(error)}`);
    } finally {
      setClearingAuditLogs(false);
    }
  }

  async function handleBooking() {
    if (!profile || !room || !selectedBlocks.length) return;
    if (bookingCredits > remaining) {
      setToast(
        "Seu pacote não tem créditos suficientes. Fale com nosso time para continuar.",
      );
      return;
    }
    setBusy(true);
    try {
      let reservationId: string;
      if (firebaseEnabled) {
        const { createReservation } = await import("./firebase");
        reservationId = await createReservation(
          profile,
          room,
          date,
          selectedBlocks,
        );
      } else {
        if (selectedBlocks.some((block) => occupiedBlocks.has(block))) {
          throw new Error(
            "Um ou mais horários acabaram de ser reservados. Atualize a agenda.",
          );
        }
        const createdAt = timestampNow();
        const reservation: Reservation = {
          id: `demo-${createdAt}`,
          userId: profile.uid,
          userName: profile.name,
          companyId: profile.companyId,
          roomId: room.id,
          roomName: room.name,
          date,
          blocks: selectedBlocks,
          hours: bookingHours,
          creditsCost: bookingCredits,
          status: "confirmed",
          createdAt,
        };
        reservationId = reservation.id;
        const updated: WorkspaceData = {
          ...workspace,
          reservations: [...workspace.reservations, reservation],
          creditsUsed:
            date.slice(0, 7) === currentMonth
              ? workspace.creditsUsed + bookingCredits
              : workspace.creditsUsed,
        };
        setWorkspace(updated);
        saveDemoWorkspace(updated);
      }
      setSelectedBlocks([]);
      setToast("Reserva confirmada. A sala já está garantida para você.");
      await recordAuditEvent({
        companyId: profile.companyId,
        action: "Reserva criada",
        entityType: "Reserva",
        entityId: reservationId,
        details: `${room.name} · ${shortDate(date)} · ${selectedBlocks.join(", ")}`,
      });
    } catch (error) {
      setToast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function handleAddTimeRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room) return;
    const form = new FormData(event.currentTarget);
    const start = String(form.get("rangeStart"));
    const end = String(form.get("rangeEnd"));
    const availableBlocks = timeBlocks(room);
    const requestedBlocks = rangeBlocks(start, end);
    if (
      !requestedBlocks.length ||
      (timeMinutes(end) - timeMinutes(start)) % 30 !== 0 ||
      requestedBlocks.some((block) => !availableBlocks.includes(block)) ||
      timeMinutes(end) > timeMinutes(room.closeTime)
    ) {
      setToast(
        "Escolha um intervalo válido dentro do horário de funcionamento da sala.",
      );
      return;
    }
    if (requestedBlocks.some((block) => occupiedBlocks.has(block))) {
      setToast(
        "O intervalo inclui um horário já reservado. Escolha outro período.",
      );
      return;
    }
    if (
      requestedBlocks.some(
        (block) => date < today || (date === today && block <= currentTime),
      )
    ) {
      setToast("O intervalo inclui horários que já passaram.");
      return;
    }
    const combinedBlocks = [
      ...new Set([...selectedBlocks, ...requestedBlocks]),
    ].sort();
    if (combinedBlocks.length > 20) {
      setToast("Selecione no máximo 20 blocos de 30 minutos por reserva.");
      return;
    }
    setSelectedBlocks(combinedBlocks);
  }

  async function handleCancel(reservation: Reservation) {
    try {
      if (firebaseEnabled) {
        const { cancelReservation } = await import("./firebase");
        await cancelReservation(reservation);
      } else {
        const updated = {
          ...workspace,
          reservations: workspace.reservations.map((item) =>
            item.id === reservation.id
              ? { ...item, status: "cancelled" as const }
              : item,
          ),
          creditsUsed:
            reservation.date.slice(0, 7) === currentMonth
              ? Math.max(
                  0,
                  workspace.creditsUsed - reservationCredits(reservation),
                )
              : workspace.creditsUsed,
        };
        setWorkspace(updated);
        saveDemoWorkspace(updated);
      }
      setToast("Reserva cancelada e horários liberados.");
      await recordAuditEvent({
        companyId: reservation.companyId,
        action: "Reserva cancelada",
        entityType: "Reserva",
        entityId: reservation.id,
        details: `${reservation.roomName} · ${shortDate(reservation.date)}`,
      });
    } catch (error) {
      setToast(errorMessage(error));
    }
  }

  async function handleAddRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newRoom: Omit<Room, "id"> = {
      name: String(form.get("name")).trim(),
      location: String(form.get("location")).trim(),
      capacity: Number(form.get("capacity")),
      openTime: String(form.get("openTime")),
      closeTime: String(form.get("closeTime")),
      creditsPerHour: Number(form.get("creditsPerHour")),
      color: "blue",
      active: true,
    };
    if (
      !Number.isFinite(newRoom.creditsPerHour) ||
      newRoom.creditsPerHour < 0
    ) {
      setToast("Informe uma tarifa válida de créditos por hora.");
      return;
    }
    try {
      let roomId: string;
      if (firebaseEnabled) {
        const { addRoom } = await import("./firebase");
        roomId = await addRoom(newRoom);
      } else {
        roomId = `sala-${Date.now()}`;
        const updated = {
          ...workspace,
          rooms: [...workspace.rooms, { ...newRoom, id: roomId }],
        };
        setWorkspace(updated);
        saveDemoWorkspace(updated);
      }
      formElement.reset();
      setToast("Sala adicionada com sucesso.");
      await recordAuditEvent({
        companyId: activeCompanyId,
        action: "Sala adicionada",
        entityType: "Sala",
        entityId: roomId,
        details: newRoom.name,
      });
    } catch (error) {
      setToast(errorMessage(error));
    }
  }

  async function handleUpdateRoom(
    room: Room,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const updatedRoom: Room = {
      ...room,
      name: String(form.get("name")).trim(),
      location: String(form.get("location")).trim(),
      capacity: Number(form.get("capacity")),
      openTime: String(form.get("openTime")),
      closeTime: String(form.get("closeTime")),
      creditsPerHour: Number(form.get("creditsPerHour")),
      active: form.get("active") === "on",
    };
    if (
      !Number.isFinite(updatedRoom.creditsPerHour) ||
      updatedRoom.creditsPerHour < 0
    ) {
      setToast("Informe uma tarifa válida de créditos por hora.");
      return;
    }
    try {
      if (firebaseEnabled) {
        const { updateRoom } = await import("./firebase");
        await updateRoom(updatedRoom);
      } else {
        const updated = {
          ...workspace,
          rooms: workspace.rooms.map((item) =>
            item.id === room.id ? updatedRoom : item,
          ),
        };
        setWorkspace(updated);
        saveDemoWorkspace(updated);
      }
      setToast("Configurações da sala atualizadas.");
      await recordAuditEvent({
        companyId: activeCompanyId,
        action: "Sala atualizada",
        entityType: "Sala",
        entityId: room.id,
        details: updatedRoom.name,
      });
    } catch (error) {
      setToast(errorMessage(error));
    }
  }

  async function handleSaveCompanyPackage(
    company: Company,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const nextPackage = {
      label: String(form.get("label")).trim(),
      monthlyCredits: Number(form.get("monthlyCredits")),
    };
    if (
      !nextPackage.label ||
      !Number.isFinite(nextPackage.monthlyCredits) ||
      nextPackage.monthlyCredits < 0
    ) {
      setToast(
        "Informe um nome de pacote e uma quantidade válida de créditos mensais.",
      );
      return;
    }
    setSavingCompanyPackages((current) => ({ ...current, [company.id]: true }));
    try {
      if (firebaseEnabled) {
        const { savePackage } = await import("./firebase");
        await savePackage(company.id, nextPackage);
      } else {
        setCompanies((current) =>
          current.map((item) =>
            item.id === company.id
              ? { ...item, packageInfo: nextPackage }
              : item,
          ),
        );
        if (company.id === activeCompanyId) {
          const updated = { ...workspace, packageInfo: nextPackage };
          setWorkspace(updated);
          saveDemoWorkspace(updated);
        }
      }
      formElement.reset();
      setToast(`Pacote da empresa ${company.name} atualizado.`);
      await recordAuditEvent({
        companyId: company.id,
        action: "Pacote atualizado",
        entityType: "Pacote",
        entityId: company.id,
        details: `${company.name} · ${nextPackage.label} · ${nextPackage.monthlyCredits} créditos`,
      });
    } catch (error) {
      setToast(
        `Não foi possível salvar o pacote de ${company.name}: ${errorMessage(error)}`,
      );
    } finally {
      setSavingCompanyPackages((current) => ({
        ...current,
        [company.id]: false,
      }));
    }
  }

  async function handleDeleteCompany(company: Company) {
    if (
      !window.confirm(
        `Deseja excluir a empresa ${company.name}? Só será possível excluir empresas sem usuários, reservas, registros de uso ou contratos.`,
      )
    )
      return;
    setDeletingCompanies((current) => ({ ...current, [company.id]: true }));
    try {
      if (firebaseEnabled) {
        const { deleteCompanyIfUnused } = await import("./firebase");
        await deleteCompanyIfUnused(company.id);
      } else {
        const linkedAccounts = allAccounts.filter(
          (account) => account.companyId === company.id,
        ).length;
        const linkedReservations = workspace.reservations.filter(
          (reservation) => reservation.companyId === company.id,
        ).length;
        if (linkedAccounts || linkedReservations) {
          throw new Error(
            "Existem usuários ou reservas vinculados a esta empresa.",
          );
        }
      }
      setCompanies((current) =>
        current.filter((item) => item.id !== company.id),
      );
      setToast(`Empresa ${company.name} excluída.`);
      await recordAuditEvent({
        companyId: company.id,
        action: "Empresa excluída",
        entityType: "Empresa",
        entityId: company.id,
        details: company.name,
      });
    } catch (error) {
      setToast(
        `Não foi possível excluir ${company.name}: ${errorMessage(error)}`,
      );
    } finally {
      setDeletingCompanies((current) => ({ ...current, [company.id]: false }));
    }
  }

  async function handleCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const details = {
      name: String(form.get("name")).trim(),
      cnpj: String(form.get("cnpj")),
      legalRepresentative: String(form.get("legalRepresentative")),
      phone: String(form.get("phone")),
      email: String(form.get("email")),
      observations: String(form.get("observations")),
    };
    if (!details.name) {
      setToast("Informe o nome da empresa.");
      return;
    }
    setCompanyBusy(true);
    try {
      let createdCompanyId: string;
      if (firebaseEnabled) {
        const { createCompany } = await import("./firebase");
        const company = await createCompany(details);
        createdCompanyId = company.id;
        setCompanies((current) => [...current, company]);
      } else {
        createdCompanyId = `empresa-${Date.now()}`;
        setCompanies((current) => [
          ...current,
          {
            id: createdCompanyId,
            ...details,
            createdAt: Date.now(),
          },
        ]);
      }
      formElement.reset();
      setToast(`Empresa ${details.name} cadastrada com sucesso.`);
      await recordAuditEvent({
        companyId: createdCompanyId,
        action: "Empresa criada",
        entityType: "Empresa",
        entityId: createdCompanyId,
        details: details.name,
      });
    } catch (error) {
      setToast(`Não foi possível cadastrar a empresa: ${errorMessage(error)}`);
    } finally {
      setCompanyBusy(false);
    }
  }

  async function handleSaveCompanyContract(
    company: Company,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const text = companyContractDrafts[company.id]?.trim() || "";
    if (!text) {
      setToast("Cole o texto do contrato antes de salvar.");
      return;
    }
    setSavingCompanyContracts((current) => ({
      ...current,
      [company.id]: true,
    }));
    try {
      const { saveCompanyContract } = await import("./firebase");
      const contract = await saveCompanyContract(company.id, text);
      setCompanyContractDrafts((current) => ({
        ...current,
        [company.id]: "",
      }));
      setToast(`Contrato salvo para ${company.name}.`);
      await recordAuditEvent({
        companyId: company.id,
        action: "Contrato salvo",
        entityType: "Contrato",
        entityId: contract.id,
        details: company.name,
      });
    } catch (error) {
      setToast(`Não foi possível salvar o contrato: ${errorMessage(error)}`);
    } finally {
      setSavingCompanyContracts((current) => ({
        ...current,
        [company.id]: false,
      }));
    }
  }

  async function handleDeleteCompanyContract(
    company: Company,
    contract: CompanyContract,
  ) {
    setDeletingCompanyContracts((current) => ({
      ...current,
      [contract.id]: true,
    }));
    try {
      const { deleteCompanyContract } = await import("./firebase");
      await deleteCompanyContract(company.id, contract);
      setToast(`Contrato ${contract.name} removido.`);
      await recordAuditEvent({
        companyId: company.id,
        action: "Contrato removido",
        entityType: "Contrato",
        entityId: contract.id,
        details: `${company.name} · ${contract.name}`,
      });
    } catch (error) {
      setToast(`Não foi possível remover o contrato: ${errorMessage(error)}`);
    } finally {
      setDeletingCompanyContracts((current) => ({
        ...current,
        [contract.id]: false,
      }));
    }
  }

  async function handleDownloadCompanyContract(contract: CompanyContract) {
    try {
      const { downloadCompanyContract } = await import("./firebase");
      const blob = await downloadCompanyContract(contract);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = contract.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setToast(`Não foi possível baixar o contrato: ${errorMessage(error)}`);
    }
  }

  async function handleSaveAccountCompany(account: Profile) {
    const nextCompanyId = accountCompanyDrafts[account.uid];
    if (
      !nextCompanyId ||
      !companies.some((company) => company.id === nextCompanyId)
    ) {
      setToast("Selecione uma empresa cadastrada.");
      return;
    }
    setSavingCompanyAccounts((current) => ({
      ...current,
      [account.uid]: true,
    }));
    try {
      if (firebaseEnabled) {
        const { updateAccountCompany } = await import("./firebase");
        await updateAccountCompany(account.uid, nextCompanyId);
      }
      setAllAccounts((accounts) =>
        accounts.map((item) =>
          item.uid === account.uid
            ? { ...item, companyId: nextCompanyId }
            : item,
        ),
      );
      setCompanyAccounts((accounts) =>
        accounts.map((item) =>
          item.uid === account.uid
            ? { ...item, companyId: nextCompanyId }
            : item,
        ),
      );
      setPendingAccounts((accounts) =>
        accounts.map((item) =>
          item.uid === account.uid
            ? { ...item, companyId: nextCompanyId }
            : item,
        ),
      );
      const companyName = companies.find(
        (company) => company.id === nextCompanyId,
      )?.name;
      setToast(`${account.name} alocado(a) à empresa ${companyName}.`);
      await recordAuditEvent({
        companyId: nextCompanyId,
        action: "Usuário alocado",
        entityType: "Usuário",
        entityId: account.uid,
        details: `${account.name} · ${companyName || nextCompanyId}`,
      });
    } catch (error) {
      setToast(
        `Não foi possível alocar ${account.name}: ${errorMessage(error)}`,
      );
    } finally {
      setSavingCompanyAccounts((current) => ({
        ...current,
        [account.uid]: false,
      }));
    }
  }

  async function handleAccountDecision(
    account: AccessRequest,
    approved: boolean,
  ) {
    const role = accountRoles[account.uid] || "user";
    try {
      if (firebaseEnabled) {
        const { updateAccountAccess } = await import("./firebase");
        await updateAccountAccess(
          account.uid,
          approved ? "approved" : "rejected",
          role,
        );
      } else {
        setPendingAccounts((accounts) =>
          accounts.filter((item) => item.uid !== account.uid),
        );
        if (approved)
          setCompanyAccounts((accounts) => [
            ...accounts,
            {
              ...account,
              status: "approved",
            },
          ]);
      }
      setToast(
        approved
          ? `Acesso permitido para ${account.name} como ${role === "admin" ? "administrador" : "usuário"}.`
          : `Solicitação de ${account.name} recusada e perfil removido.`,
      );
      await recordAuditEvent({
        companyId: account.companyId,
        action: approved ? "Acesso aprovado" : "Acesso recusado",
        entityType: "Usuário",
        entityId: account.uid,
        details: `${account.name}${approved ? ` · papel ${role}` : ""}`,
      });
    } catch (error) {
      setToast(`Não foi possível atualizar o acesso: ${errorMessage(error)}`);
    }
  }

  async function handleLogOut() {
    try {
      const { logOut } = await import("./firebase");
      await logOut();
      setProfile(null);
      setAuthError("");
    } catch (error) {
      setAuthError(errorMessage(error));
    }
  }

  if (firebaseEnabled && !profile) {
    return <AuthScreen error={authError} onError={setAuthError} />;
  }
  if (!profile) return null;
  if (
    firebaseEnabled &&
    profile.status !== "approved" &&
    profile.status !== undefined
  ) {
    return (
      <AccessStatusScreen
        profile={profile}
        rejected={profile.status === "rejected"}
        onLogOut={() => void handleLogOut()}
      />
    );
  }

  const dayTitle = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
  const roomColor = room ? room.color : "blue";
  const whatsappMessage = `Olá! Gostaria de saber sobre a renovação do pacote de créditos da empresa. Meu saldo atual é de ${formatCredits(remaining)} créditos.`;
  const viewTitles: Record<View, string> = {
    reserve: "Reservar",
    mine: "Minhas reservas",
    manage: "Gestão",
    companies: "Empresas",
    users: "Usuários",
    audit: "Auditoria",
    logistics: "Logística",
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col border-r border-slate-200 bg-white px-5 py-6 transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <a
          href="#"
          className="mb-10 flex items-center gap-3 px-1"
          aria-label="Espaço, início"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200">
            <DoorOpen size={22} />
          </span>
          <span>
            <span className="block text-[17px] font-bold tracking-tight">
              espaço
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              reservas internas
            </span>
          </span>
        </a>

        <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.17em] text-slate-400">
          Workspace
        </div>
        <nav className="space-y-1">
          <SideLink
            active={view === "reserve"}
            icon={<CalendarDays size={18} />}
            label="Reservar espaço"
            onClick={() => {
              setView("reserve");
              setSidebarOpen(false);
            }}
          />
          <SideLink
            active={view === "mine"}
            icon={<LayoutDashboard size={18} />}
            label="Minhas reservas"
            count={userReservations.length || undefined}
            onClick={() => {
              setView("mine");
              setSidebarOpen(false);
            }}
          />
          {isHubAdmin && (
            <SideLink
              active={view === "manage"}
              icon={<Settings2 size={18} />}
              label="Gestão"
              count={pendingAccounts.length || undefined}
              onClick={() => {
                setView("manage");
                setSidebarOpen(false);
              }}
            />
          )}
          {isAdmin && (
            <>
              <SideLink
                active={view === "companies"}
                icon={<Building2 size={18} />}
                label="Empresas"
                onClick={() => {
                  setView("companies");
                  setSidebarOpen(false);
                }}
              />
              <SideLink
                active={view === "users"}
                icon={<Users size={18} />}
                label="Usuários"
                onClick={() => {
                  setView("users");
                  setSidebarOpen(false);
                }}
              />
              <SideLink
                active={view === "audit"}
                icon={<ClipboardList size={18} />}
                label="Auditoria"
                onClick={() => {
                  setView("audit");
                  setSidebarOpen(false);
                }}
              />
              <SideLink
                active={view === "logistics"}
                icon={<Truck size={18} />}
                label="Logística"
                onClick={() => {
                  setView("logistics");
                  setSidebarOpen(false);
                }}
              />
            </>
          )}
        </nav>

        <div className="mt-9 mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.17em] text-slate-400">
          Sua empresa
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Créditos disponíveis
            </span>
            <Sparkles size={14} className="text-blue-500" />
          </div>
          <div className="mt-3 flex items-end gap-1.5">
            <span className="text-[26px] font-bold leading-none tracking-tight">
              {formatCredits(remaining)}
            </span>
            <span className="pb-0.5 text-xs text-slate-500">
              / {formatCredits(userPackage.monthlyCredits)} créditos
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{
                width: `${Math.min(100, (currentUsage / Math.max(1, userPackage.monthlyCredits)) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-[10px] leading-4 text-slate-500">
            {userPackage.label} · {monthLabel(date)}
          </p>
        </div>

        <a
          href={makeWhatsAppLink(whatsappMessage)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-between rounded-xl bg-blue-50 px-3 py-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          Precisa de mais créditos? <ArrowUpRight size={15} />
        </a>

        <div className="mt-auto rounded-xl bg-[#f7f8fa] p-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={profile.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">
                {profile.name}
              </div>
              <div className="truncate text-[10px] text-slate-500">
                {profile.role === "admin" ? "Administrador" : profile.email}
              </div>
            </div>
            {firebaseEnabled && (
              <button
                title="Sair"
                onClick={() =>
                  void import("./firebase")
                    .then(({ logOut }) => logOut())
                    .catch((error: unknown) => setToast(errorMessage(error)))
                }
                className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
          {!firebaseEnabled && (
            <div className="mt-2 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Modo
              demonstração
            </div>
          )}
        </div>
      </aside>

      {sidebarOpen && (
        <button
          aria-label="Fechar menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-slate-950/30 lg:hidden"
        />
      )}
      <main className="min-h-screen lg:pl-[248px]">
        <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              aria-label="Abrir menu"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={19} />
            </button>
            <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
              <span>Espaços</span>
              <span>/</span>
              <span className="font-semibold capitalize text-slate-700">
                {viewTitles[view]}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:block">
              {new Intl.DateTimeFormat("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date(`${today}T12:00:00`))}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
              {initials(profile.name)}
            </span>
          </div>
        </header>

        <div className="mx-auto max-w-[1460px] px-5 py-7 md:px-8 md:py-9">
          {view === "reserve" && (
            <section>
              <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-blue-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />{" "}
                    ESPAÇOS DA EMPRESA
                  </div>
                  <h1 className="text-[28px] font-bold tracking-tight md:text-[34px]">
                    Encontre seu espaço.
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-500">
                    Salas prontas para suas melhores ideias.
                  </p>
                </div>
                <button
                  onClick={() => chooseDate(today)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold shadow-sm hover:bg-slate-50"
                >
                  <CalendarDays size={15} /> Ir para hoje
                </button>
              </div>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_332px]">
                <div className="min-w-0 space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold">
                          Escolha uma sala
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {rooms.length} espaços disponíveis para todas as empresas
                        </p>
                      </div>
                      <span className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{" "}
                        Disponível agora
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                      {rooms.map((item) => {
                        const selected = room?.id === item.id;
                        const reservations = workspace.reservations.filter(
                          (booking) =>
                            booking.date === date &&
                            booking.roomId === item.id &&
                            booking.status === "confirmed",
                        );
                        const total = timeBlocks(item).length;
                        const available = Math.max(
                          0,
                          total -
                            reservations.reduce(
                              (sum, booking) => sum + booking.blocks.length,
                              0,
                            ),
                        );
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setSelectedRoom(item.id);
                              setSelectedBlocks([]);
                            }}
                            className={`group rounded-xl border p-3.5 text-left transition ${selected ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                          >
                            <div className="flex items-start justify-between">
                              <RoomGlyph color={item.color} />
                              <span
                                className={`h-4 w-4 rounded-full border ${selected ? "flex items-center justify-center border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}
                              >
                                {selected && (
                                  <Check size={10} strokeWidth={3} />
                                )}
                              </span>
                            </div>
                            <div className="mt-3 text-sm font-bold">
                              {item.name}
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                              <MapPin size={11} />
                              {item.location}
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[10px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <Users size={11} /> Até {item.capacity} pessoas
                              </span>
                              <span className="text-right">
                                <span className="block font-semibold text-blue-700">
                                  {formatCredits(roomCreditsPerHour(item))}{" "}
                                  créditos/h
                                </span>
                                <span className="text-emerald-700">
                                  {available} horários
                                </span>
                              </span>
                            </div>
                          </button>
                        );
                      })}
                      {!rooms.length && (
                        <p className="col-span-full rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                          Nenhuma sala ativa ainda. Peça para um administrador
                          cadastrar os espaços.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-bold">
                          Selecione a data
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Escolha um dia para ver a disponibilidade
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          aria-label="Mês anterior"
                          onClick={() =>
                            chooseDate(
                              localDate(
                                new Date(
                                  monthDate.getFullYear(),
                                  monthDate.getMonth() - 1,
                                  Math.min(monthDate.getDate(), 28),
                                ),
                              ),
                            )
                          }
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <span className="min-w-[130px] text-center text-xs font-semibold capitalize">
                          {monthLabel(date)}
                        </span>
                        <button
                          aria-label="Próximo mês"
                          onClick={() =>
                            chooseDate(
                              localDate(
                                new Date(
                                  monthDate.getFullYear(),
                                  monthDate.getMonth() + 1,
                                  Math.min(monthDate.getDate(), 28),
                                ),
                              ),
                            )
                          }
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                        >
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-7 gap-1.5">
                      {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map(
                        (weekday) => (
                          <div
                            key={weekday}
                            className="pb-1 text-center text-[10px] font-semibold uppercase text-slate-400"
                          >
                            {weekday}
                          </div>
                        ),
                      )}
                      {Array.from({ length: firstWeekday }, (_, index) => (
                        <span key={`blank-${index}`} />
                      ))}
                      {Array.from({ length: dayCount }, (_, index) => {
                        const day = index + 1;
                        const dayDate = `${date.slice(0, 7)}-${String(day).padStart(2, "0")}`;
                        const isSelected = date === dayDate;
                        const isToday = today === dayDate;
                        const count = workspace.reservations.filter(
                          (booking) =>
                            booking.date === dayDate &&
                            booking.status === "confirmed",
                        ).length;
                        return (
                          <button
                            key={dayDate}
                            onClick={() => chooseDate(dayDate)}
                            className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-xs transition ${isSelected ? "bg-blue-600 font-bold text-white shadow-sm shadow-blue-200" : isToday ? "font-bold text-blue-700 hover:bg-blue-50" : "text-slate-700 hover:bg-slate-100"}`}
                          >
                            {day}
                            {count > 0 && (
                              <span
                                className={`absolute bottom-1 h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-blue-500"}`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {room && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-base font-bold">
                            Horários disponíveis
                          </h2>
                          <p className="mt-1 text-xs capitalize text-slate-500">
                            {dayTitle} · {room.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <i className="h-2.5 w-2.5 rounded border border-slate-200 bg-white" />{" "}
                            Livre
                          </span>
                          <span className="flex items-center gap-1.5">
                            <i className="h-2.5 w-2.5 rounded bg-slate-200" />{" "}
                            Reservado
                          </span>
                          <span className="flex items-center gap-1.5">
                            <i className="h-2.5 w-2.5 rounded bg-blue-600" />{" "}
                            Selecionado
                          </span>
                        </div>
                      </div>
                      <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Clock3 size={13} /> Intervalos de 30 minutos
                        </span>
                        <span>
                          {room.openTime} – {room.closeTime}
                        </span>
                      </div>
                      <form
                        onSubmit={handleAddTimeRange}
                        className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3"
                      >
                        <div className="mr-auto">
                          <div className="text-[11px] font-semibold text-slate-700">
                            Adicionar intervalo contínuo
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            O horário final não é incluído.
                          </div>
                        </div>
                        <label className="form-label">
                          De
                          <select
                            name="rangeStart"
                            defaultValue={room.openTime}
                            className="form-input mt-1 py-2"
                          >
                            {timeBlocks(room).map((block) => (
                              <option key={block} value={block}>
                                {block}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="form-label">
                          Até
                          <select
                            name="rangeEnd"
                            defaultValue={timeBlocks(room)[2] || room.closeTime}
                            className="form-input mt-1 py-2"
                          >
                            {[
                              ...new Set([
                                ...timeBlocks(room).slice(1),
                                room.closeTime,
                              ]),
                            ].map((block) => (
                              <option key={block} value={block}>
                                {block}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-blue-700">
                          Adicionar
                        </button>
                      </form>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                        {timeBlocks(room).map((block) => {
                          const reserved = occupiedBlocks.has(block);
                          const selected = selectedBlocks.includes(block);
                          const isPast =
                            date < today ||
                            (date === today && block <= currentTime);
                          return (
                            <button
                              key={block}
                              disabled={
                                reserved ||
                                isPast ||
                                (!selected && selectedBlocks.length >= 20)
                              }
                              onClick={() => toggleBlock(block)}
                              className={`rounded-lg border py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed ${selected ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-100" : reserved ? "border-slate-100 bg-slate-100 text-slate-400 line-through" : isPast || selectedBlocks.length >= 20 ? "border-slate-100 bg-slate-50 text-slate-300" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"}`}
                            >
                              {block}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-[10px] text-slate-400">
                        A sala custa {formatCredits(roomCreditsPerHour(room))}{" "}
                        créditos por hora. Selecione vários períodos para
                        reservar; o limite é de 10 horas por solicitação.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-5">
                  <div className="sticky top-[88px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-bold">Resumo da reserva</h2>
                      <span className="rounded-md bg-blue-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                        Nova reserva
                      </span>
                    </div>
                    {room ? (
                      <>
                        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                          <RoomGlyph color={roomColor} />
                          <div>
                            <div className="text-xs font-bold">{room.name}</div>
                            <div className="mt-0.5 text-[10px] text-slate-500">
                              {room.location} ·{" "}
                              {formatCredits(roomCreditsPerHour(room))}{" "}
                              créditos/h
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3 border-b border-slate-100 pb-4">
                          <SummaryRow
                            icon={<CalendarDays size={14} />}
                            label="Data"
                            value={shortDate(date)}
                          />
                          <SummaryRow
                            icon={<AlarmClock size={14} />}
                            label="Duração"
                            value={`${bookingHours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`}
                          />
                          <SummaryRow
                            icon={<Sparkles size={14} />}
                            label="Custo"
                            value={`${formatCredits(bookingCredits)} créditos`}
                          />
                        </div>
                        <div className="py-4">
                          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                            <span>Períodos selecionados</span>
                            <span>{selectedBlocks.length} blocos</span>
                          </div>
                          {selectedBlocks.length ? (
                            <div className="space-y-1.5">
                              {formatRanges(selectedBlocks).map((range) => (
                                <div
                                  key={range.start}
                                  className="flex items-center justify-between rounded-md border border-slate-100 px-2.5 py-2 text-xs"
                                >
                                  <span>
                                    {range.start} — {range.end}
                                  </span>
                                  <button
                                    aria-label={`Remover período ${range.start}`}
                                    onClick={() =>
                                      setSelectedBlocks((old) =>
                                        old.filter(
                                          (block) =>
                                            block < range.start ||
                                            block >= range.end,
                                        ),
                                      )
                                    }
                                    className="text-slate-400 hover:text-rose-600"
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-center text-[10px] text-slate-400">
                              Escolha horários no calendário
                            </div>
                          )}
                        </div>
                        {bookingCredits > remaining && (
                          <div className="mb-3 rounded-lg bg-amber-50 p-3 text-[10px] leading-4 text-amber-800">
                            Seu pacote não cobre este período. Restam{" "}
                            {formatCredits(remaining)} créditos.
                          </div>
                        )}
                        <button
                          disabled={!selectedBlocks.length || busy}
                          onClick={() => void handleBooking()}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-xs font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                        >
                          {busy ? (
                            "Confirmando…"
                          ) : (
                            <>
                              Confirmar reserva <ArrowRight size={15} />
                            </>
                          )}
                        </button>
                        <p className="mt-2.5 text-center text-[9px] leading-4 text-slate-400">
                          A reserva é confirmada na hora e os horários ficam
                          bloqueados.
                        </p>
                        {remaining < 1 && (
                          <a
                            href={makeWhatsAppLink(whatsappMessage)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-700"
                          >
                            Falar com nosso time no WhatsApp{" "}
                            <ArrowUpRight size={13} />
                          </a>
                        )}
                      </>
                    ) : (
                      <p className="py-6 text-center text-xs text-slate-400">
                        Cadastre uma sala para começar.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                    <span className="mt-0.5 text-blue-600">
                      <CircleHelp size={16} />
                    </span>
                    <p className="text-[10px] leading-4 text-blue-800">
                      Precisa de mais créditos? Nossa equipe ajuda com a renovação
                      do pacote.{" "}
                      <a
                        href={makeWhatsAppLink(whatsappMessage)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold underline underline-offset-2"
                      >
                        Fale com a gente.
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {view === "mine" && (
            <section>
              <PageHeading
                eyebrow="SEU ESPAÇO DE TRABALHO"
                title="Minhas reservas"
                description="Acompanhe seus próximos encontros e gerencie seus horários."
              />
              <div className="mt-7 grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Próximas reservas"
                  value={String(
                    userReservations.length,
                  )}
                  icon={<CalendarDays size={18} />}
                />
                <MetricCard
                  label="Créditos usados neste mês"
                  value={`${workspace.reservations
                    .filter(
                      (item) =>
                        item.userId === profile.uid &&
                        item.date.slice(0, 7) === currentMonth &&
                        item.status === "confirmed",
                    )
                    .reduce((sum, item) => sum + reservationCredits(item), 0)
                    .toLocaleString("pt-BR")} créditos`}
                  icon={<Clock3 size={18} />}
                />
                <MetricCard
                  label="Meu pacote"
                  value={`${formatCredits(remaining)} créditos`}
                  icon={<Sparkles size={18} />}
                />
              </div>
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <h2 className="text-sm font-bold">Sua agenda</h2>
                  <button
                    onClick={() => setView("reserve")}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-700"
                  >
                    <Plus size={15} /> Nova reserva
                  </button>
                </div>
                {userReservations.length ? (
                  <div className="divide-y divide-slate-100">
                    {userReservations.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex flex-wrap items-center gap-4 px-5 py-4"
                      >
                        <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                          <span className="text-[9px] font-bold uppercase">
                            {new Intl.DateTimeFormat("pt-BR", {
                              month: "short",
                            })
                              .format(new Date(`${booking.date}T12:00:00`))
                              .replace(".", "")}
                          </span>
                          <span className="text-base font-bold leading-4">
                            {booking.date.slice(-2)}
                          </span>
                        </div>
                        <div className="min-w-[130px] flex-1">
                          <div className="text-sm font-semibold">
                            {booking.roomName}
                          </div>
                          <div className="mt-1 text-xs capitalize text-slate-500">
                            {shortDate(booking.date)}
                          </div>
                        </div>
                        <div className="min-w-[120px] text-xs text-slate-600">
                          {formatRanges(booking.blocks)
                            .map((range) => `${range.start}–${range.end}`)
                            .join(", ")}
                        </div>
                        <div className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                          Confirmada
                        </div>
                        {booking.date >= today && (
                          <button
                            onClick={() => void handleCancel(booking)}
                            className="rounded-md px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <CalendarDays
                      className="mx-auto text-slate-300"
                      size={28}
                    />
                    <p className="mt-3 text-sm font-semibold">
                      Nenhuma reserva por enquanto
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Escolha uma sala e encontre o horário ideal para você.
                    </p>
                    <button
                      onClick={() => setView("reserve")}
                      className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                    >
                      Encontrar uma sala
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {view === "companies" && isAdmin && (
            <section>
              <PageHeading
                eyebrow="ADMINISTRAÇÃO GLOBAL"
                title="Empresas"
                description="Cadastre as empresas que poderão receber usuários no sistema."
              />
              <form
                onSubmit={(event) => void handleCreateCompany(event)}
                className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h2 className="mb-4 text-sm font-bold">Cadastrar empresa</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="form-label sm:col-span-2 xl:col-span-3">
                    Nome da empresa
                    <input
                      name="name"
                      required
                      maxLength={120}
                      className="form-input mt-1.5"
                      placeholder="Ex.: Acme Tecnologia"
                    />
                  </label>
                  <label className="form-label">
                    CNPJ
                    <input
                      name="cnpj"
                      required
                      maxLength={18}
                      className="form-input mt-1.5"
                      placeholder="00.000.000/0000-00"
                    />
                  </label>
                  <label className="form-label">
                    Representante legal
                    <input
                      name="legalRepresentative"
                      required
                      maxLength={120}
                      className="form-input mt-1.5"
                    />
                  </label>
                  <label className="form-label">
                    Telefone
                    <input
                      name="phone"
                      type="tel"
                      required
                      maxLength={30}
                      className="form-input mt-1.5"
                      placeholder="(00) 00000-0000"
                    />
                  </label>
                  <label className="form-label">
                    E-mail
                    <input
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      className="form-input mt-1.5"
                      placeholder="contato@empresa.com.br"
                    />
                  </label>
                  <label className="form-label sm:col-span-2">
                    Observações
                    <textarea
                      name="observations"
                      rows={3}
                      maxLength={1000}
                      className="form-input mt-1.5 resize-y"
                      placeholder="Informações adicionais sobre a empresa"
                    />
                  </label>
                </div>
                <button
                  disabled={companyBusy}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400"
                >
                  <Plus size={15} />
                  {companyBusy ? "Cadastrando…" : "Cadastrar empresa"}
                </button>
              </form>
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-bold">Empresas cadastradas</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Estas empresas estarão disponíveis para alocação de
                      usuários.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold">
                    {companies.length}
                  </span>
                </div>
                {companies.length ? (
                  <div className="divide-y divide-slate-100">
                    {[...companies]
                      .sort((left, right) =>
                        left.name.localeCompare(right.name, "pt-BR"),
                      )
                      .map((company) => {
                        const userCount = allAccounts.filter(
                          (account) => account.companyId === company.id,
                        ).length;
                        const packageInfo = company.packageInfo || {
                          label: "Plano mensal",
                          monthlyCredits: 50,
                        };
                        return (
                          <div key={company.id} className="space-y-4 px-5 py-5">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
                                <Building2 size={17} />
                              </span>
                              <div className="min-w-[180px] flex-1">
                                <div className="text-xs font-semibold">
                                  {company.name}
                                </div>
                                <div className="mt-1 break-all text-[10px] text-slate-500">
                                  ID: {company.id}
                                </div>
                              </div>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                                {userCount}{" "}
                                {userCount === 1 ? "usuário" : "usuários"}
                              </span>
                              <button
                                disabled={deletingCompanies[company.id]}
                                onClick={() =>
                                  void handleDeleteCompany(company)
                                }
                                className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingCompanies[company.id]
                                  ? "Excluindo…"
                                  : "Excluir empresa"}
                              </button>
                            </div>
                            <dl className="grid gap-x-5 gap-y-3 rounded-xl border border-slate-100 p-4 text-xs sm:grid-cols-2 xl:grid-cols-3">
                              <div>
                                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  CNPJ
                                </dt>
                                <dd className="mt-1 text-slate-700">
                                  {company.cnpj || "Não informado"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Representante legal
                                </dt>
                                <dd className="mt-1 text-slate-700">
                                  {company.legalRepresentative ||
                                    "Não informado"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Telefone
                                </dt>
                                <dd className="mt-1 text-slate-700">
                                  {company.phone || "Não informado"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  E-mail
                                </dt>
                                <dd className="mt-1 break-all text-slate-700">
                                  {company.email || "Não informado"}
                                </dd>
                              </div>
                              <div className="sm:col-span-2">
                                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Observações
                                </dt>
                                <dd className="mt-1 whitespace-pre-wrap text-slate-700">
                                  {company.observations || "Nenhuma observação"}
                                </dd>
                              </div>
                            </dl>
                            <div className="rounded-xl border border-slate-100 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <h3 className="text-xs font-bold">
                                    Texto dos contratos
                                  </h3>
                                  <p className="mt-1 text-[10px] text-slate-500">
                                    Cole o texto do contrato para registrar e
                                    consultar as condições acordadas.
                                  </p>
                                </div>
                              </div>
                              <form
                                onSubmit={(event) =>
                                  void handleSaveCompanyContract(company, event)
                                }
                                className="mt-3 grid gap-2"
                              >
                                <label className="form-label">
                                  Texto do contrato
                                  <textarea
                                    value={
                                      companyContractDrafts[company.id] || ""
                                    }
                                    onChange={(event) =>
                                      setCompanyContractDrafts((current) => ({
                                        ...current,
                                        [company.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Cole aqui o texto completo do contrato"
                                    rows={6}
                                    disabled={!firebaseEnabled}
                                    className="form-input mt-1.5 min-h-32 resize-y text-xs"
                                  />
                                </label>
                                <button
                                  type="submit"
                                  disabled={
                                    savingCompanyContracts[company.id] ||
                                    !firebaseEnabled
                                  }
                                  className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                  <Plus size={14} />
                                  {savingCompanyContracts[company.id]
                                    ? "Salvando…"
                                    : "Salvar contrato"}
                                </button>
                              </form>
                              {companyContracts[company.id]?.length ? (
                                <ul className="mt-3 divide-y divide-slate-100">
                                  {companyContracts[company.id].map(
                                    (contract) => (
                                      <li
                                        key={contract.id}
                                        className="flex items-start gap-2 py-3"
                                      >
                                        <FileText
                                          size={15}
                                          className="mt-0.5 shrink-0 text-blue-600"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <p className="text-[11px] font-medium text-slate-700">
                                            {contract.name || "Contrato"}
                                            {contract.createdAt ? (
                                              <span className="ml-2 font-normal text-slate-400">
                                                {new Date(
                                                  contract.createdAt,
                                                ).toLocaleDateString("pt-BR")}
                                              </span>
                                            ) : null}
                                          </p>
                                          {contract.text ? (
                                            <details className="mt-1">
                                              <summary className="cursor-pointer text-[10px] text-blue-700">
                                                Ver texto do contrato
                                              </summary>
                                              <p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-600">
                                                {contract.text}
                                              </p>
                                            </details>
                                          ) : (
                                            <div className="mt-1 flex items-center gap-2">
                                              <p className="text-[10px] text-slate-500">
                                                Contrato em PDF importado
                                                anteriormente.
                                              </p>
                                              {contract.storagePath && (
                                                <button
                                                  onClick={() =>
                                                    void handleDownloadCompanyContract(
                                                      contract,
                                                    )
                                                  }
                                                  className="rounded-md p-1 text-blue-700 hover:bg-blue-50"
                                                  aria-label={`Baixar ${contract.name}`}
                                                  title="Baixar contrato"
                                                >
                                                  <Download size={14} />
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        <button
                                          disabled={
                                            deletingCompanyContracts[
                                              contract.id
                                            ]
                                          }
                                          onClick={() =>
                                            void handleDeleteCompanyContract(
                                              company,
                                              contract,
                                            )
                                          }
                                          className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                          aria-label={`Remover ${contract.name}`}
                                          title="Remover contrato"
                                        >
                                          {deletingCompanyContracts[
                                            contract.id
                                          ] ? (
                                            <span className="text-[9px]">
                                              …
                                            </span>
                                          ) : (
                                            <Trash2 size={15} />
                                          )}
                                        </button>
                                      </li>
                                    ),
                                  )}
                                </ul>
                              ) : (
                                <p className="mt-3 text-[10px] text-slate-500">
                                  Nenhum contrato salvo para esta empresa.
                                </p>
                              )}
                            </div>
                            <form
                              key={`${company.id}-${packageInfo.label}-${packageInfo.monthlyCredits}`}
                              onSubmit={(event) =>
                                void handleSaveCompanyPackage(company, event)
                              }
                              className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"
                            >
                              <label className="form-label">
                                Pacote da empresa
                                <input
                                  name="label"
                                  defaultValue={packageInfo.label}
                                  required
                                  maxLength={100}
                                  className="form-input mt-1.5"
                                />
                              </label>
                              <label className="form-label">
                                Créditos por mês
                                <input
                                  name="monthlyCredits"
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  defaultValue={packageInfo.monthlyCredits}
                                  required
                                  className="form-input mt-1.5"
                                />
                              </label>
                              <button
                                disabled={savingCompanyPackages[company.id]}
                                className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                              >
                                {savingCompanyPackages[company.id]
                                  ? "Salvando…"
                                  : "Salvar pacote"}
                              </button>
                              <p className="text-[10px] leading-4 text-slate-500 sm:col-span-3">
                                Este pacote define o saldo mensal de créditos
                                para cada usuário da empresa.
                              </p>
                            </form>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="px-5 py-10 text-center text-xs text-slate-500">
                    Nenhuma empresa cadastrada ainda.
                  </p>
                )}
              </div>
            </section>
          )}

          {view === "users" && isAdmin && (
            <section>
              <PageHeading
                eyebrow="ADMINISTRAÇÃO GLOBAL"
                title="Usuários"
                description="Consulte as contas e defina a empresa à qual cada usuário pertence."
              />
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-bold">Contas do sistema</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      A alocação mantém o papel e o estado de acesso atuais.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold">
                    {allAccounts.length} usuários
                  </span>
                </div>
                <label className="relative m-5 mb-0 block max-w-md">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={platformAccountSearch}
                    onChange={(event) =>
                      setPlatformAccountSearch(event.target.value)
                    }
                    placeholder="Buscar por nome ou e-mail"
                    aria-label="Buscar usuários por nome ou e-mail"
                    className="form-input pl-9"
                  />
                </label>
                {filteredPlatformAccounts.length ? (
                  <div className="mt-4 divide-y divide-slate-100">
                    {filteredPlatformAccounts.map((account) => {
                      const companyIdDraft =
                        accountCompanyDrafts[account.uid] || account.companyId;
                      const assignedCompany = companies.find(
                        (company) => company.id === account.companyId,
                      );
                      const statusLabel =
                        account.status === "pending"
                          ? "Pendente"
                          : "Ativo";
                      return (
                        <div
                          key={account.uid}
                          className="flex flex-wrap items-center gap-3 px-5 py-4"
                        >
                          <Avatar name={account.name} />
                          <div className="min-w-[180px] flex-1">
                            <div className="text-xs font-semibold">
                              {account.name}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">
                              {account.email}
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${account.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                          >
                            {statusLabel}
                          </span>
                          <label className="form-label min-w-[200px] flex-1 sm:max-w-[300px]">
                            Empresa
                            <select
                              value={companyIdDraft}
                              onChange={(event) =>
                                setAccountCompanyDrafts((drafts) => ({
                                  ...drafts,
                                  [account.uid]: event.target.value,
                                }))
                              }
                              className="form-input mt-1 py-2"
                            >
                              {!assignedCompany && (
                                <option value={account.companyId}>
                                  Empresa não cadastrada ({account.companyId})
                                </option>
                              )}
                              {companies.map((company) => (
                                <option key={company.id} value={company.id}>
                                  {company.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            disabled={
                              savingCompanyAccounts[account.uid] ||
                              companyIdDraft === account.companyId
                            }
                            onClick={() =>
                              void handleSaveAccountCompany(account)
                            }
                            className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {savingCompanyAccounts[account.uid]
                              ? "Salvando…"
                              : "Salvar empresa"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-5 py-10 text-center text-xs text-slate-500">
                    {platformAccountSearch
                      ? "Nenhum usuário encontrado para essa busca."
                      : "Nenhuma conta cadastrada ainda."}
                  </p>
                )}
              </div>
            </section>
          )}

          {view === "audit" && isAdmin && (
            <section>
              <PageHeading
                eyebrow="ADMINISTRAÇÃO GLOBAL"
                title="Auditoria"
                description="Consulte as ações administrativas, reservas e cancelamentos registrados."
              />
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-bold">Audit log</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {auditLogs.length
                        ? `Exibindo até ${auditLogs.length} dos 500 eventos mais recentes.`
                        : "Os eventos serão registrados conforme as ações ocorrerem."}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={clearingAuditLogs || !auditLogs.length}
                    onClick={() => void handleClearAuditLogs()}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                    {clearingAuditLogs ? "Limpando…" : "Limpar log"}
                  </button>
                </div>
                {!auditLogsLoaded ? (
                  <p className="px-5 py-10 text-center text-xs text-slate-500">
                    Carregando eventos…
                  </p>
                ) : auditLogs.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-3 font-semibold">
                            Data e hora
                          </th>
                          <th className="px-5 py-3 font-semibold">Usuário</th>
                          <th className="px-5 py-3 font-semibold">Ação</th>
                          <th className="px-5 py-3 font-semibold">Detalhes</th>
                          <th className="px-5 py-3 font-semibold">Empresa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="align-top">
                            <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                              {new Date(log.createdAt).toLocaleString("pt-BR")}
                            </td>
                            <td className="px-5 py-3">
                              <span className="font-medium text-slate-800">
                                {log.actorName}
                              </span>
                              <span className="mt-1 block text-[10px] text-slate-400">
                                {log.actorRole === "admin"
                                  ? "Administrador"
                                  : "Usuário"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-700">
                              {log.action}
                            </td>
                            <td className="max-w-md whitespace-pre-wrap break-words px-5 py-3 text-slate-600">
                              {log.details}
                            </td>
                            <td className="px-5 py-3 text-slate-500">
                              {companies.find(
                                (company) => company.id === log.companyId,
                              )?.name || log.companyId}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-5 py-12 text-center">
                    <ClipboardList
                      className="mx-auto text-slate-300"
                      size={28}
                    />
                    <p className="mt-3 text-sm font-semibold">
                      Nenhum evento registrado
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Quando houver novas ações, elas aparecerão nesta tabela.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {view === "logistics" && isAdmin && (
            <section>
              <PageHeading
                eyebrow="ADMINISTRAÇÃO GLOBAL"
                title="Logística"
                description="Acompanhe o tamanho da operação e a distribuição de reservas por usuário."
              />
              <div className="mt-7 grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Total de usuários"
                  value={String(allAccounts.length)}
                  icon={<Users size={18} />}
                />
                <MetricCard
                  label="Empresas cadastradas"
                  value={String(companies.length)}
                  icon={<Building2 size={18} />}
                />
                <MetricCard
                  label="Reservas confirmadas"
                  value={String(confirmedReservationCount)}
                  icon={<CalendarDays size={18} />}
                />
              </div>
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-bold">Reservas por usuário</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Contagem de reservas registradas, incluindo cancelamentos.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold">
                    {allAccounts.length} usuários
                  </span>
                </div>
                <label className="relative m-5 mb-0 block max-w-md">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={logisticsSearch}
                    onChange={(event) => setLogisticsSearch(event.target.value)}
                    placeholder="Buscar por usuário ou empresa"
                    aria-label="Buscar por usuário ou empresa"
                    className="form-input pl-9"
                  />
                </label>
                {logisticsAccounts.length ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Usuário</th>
                          <th className="px-5 py-3 font-semibold">Empresa</th>
                          <th className="px-5 py-3 text-right font-semibold">
                            Total
                          </th>
                          <th className="px-5 py-3 text-right font-semibold">
                            Confirmadas
                          </th>
                          <th className="px-5 py-3 text-right font-semibold">
                            Canceladas
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {logisticsAccounts.map((account) => {
                          const userReservations =
                            reservationsByUser[account.uid] || {
                              total: 0,
                              confirmed: 0,
                              cancelled: 0,
                            };
                          const companyName =
                            companies.find(
                              (company) => company.id === account.companyId,
                            )?.name || "Empresa não cadastrada";
                          return (
                            <tr key={account.uid}>
                              <td className="px-5 py-3">
                                <span className="font-medium text-slate-800">
                                  {account.name}
                                </span>
                                <span className="mt-1 block text-[10px] text-slate-400">
                                  {account.email}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-slate-600">
                                {companyName}
                              </td>
                              <td className="px-5 py-3 text-right font-semibold text-slate-700">
                                {userReservations.total}
                              </td>
                              <td className="px-5 py-3 text-right text-emerald-700">
                                {userReservations.confirmed}
                              </td>
                              <td className="px-5 py-3 text-right text-slate-500">
                                {userReservations.cancelled}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="px-5 py-10 text-center text-xs text-slate-500">
                    {logisticsSearch
                      ? "Nenhum usuário ou empresa encontrado."
                      : "Nenhuma conta cadastrada ainda."}
                  </p>
                )}
              </div>
            </section>
          )}

          {view === "manage" && isHubAdmin && (
            <section>
              <PageHeading
                eyebrow="ADMINISTRAÇÃO"
                title="Gestão dos espaços"
                description="Gerencie usuários, reservas e salas da empresa."
              />
              <div className="mt-6 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm md:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="rounded-lg bg-amber-50 p-2 text-amber-700">
                    <Bell size={18} />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold">
                      Solicitações de acesso
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Defina o perfil e aprove o acesso do usuário.
                    </p>
                  </div>
                  <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                    {pendingAccounts.length} pendentes
                  </span>
                </div>
                {pendingAccounts.length ? (
                  <div className="space-y-2">
                    {pendingAccounts.map((account) => (
                      <div
                        key={account.uid}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3"
                      >
                        <Avatar name={account.name} />
                        <div className="min-w-[150px] flex-1">
                          <div className="text-xs font-semibold">
                            {account.name}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            {account.email}
                          </div>
                        </div>
                        <label className="form-label flex items-center gap-2">
                          Papel
                          <select
                            aria-label={`Papel para ${account.name}`}
                            value={accountRoles[account.uid] || "user"}
                            onChange={(event) =>
                              setAccountRoles((roles) => ({
                                ...roles,
                                [account.uid]:
                                  event.target.value === "admin"
                                    ? "admin"
                                    : "user",
                              }))
                            }
                            className="form-input py-2"
                          >
                            <option value="user">Usuário</option>
                            <option value="admin">Administrador</option>
                          </select>
                        </label>
                        <button
                          onClick={() =>
                            void handleAccountDecision(account, false)
                          }
                          className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          Recusar
                        </button>
                        <button
                          onClick={() =>
                            void handleAccountDecision(account, true)
                          }
                          className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-blue-700"
                        >
                          Permitir acesso
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-500">
                    Não há solicitações aguardando aprovação.
                  </p>
                )}
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
                    <Users size={18} />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold">Usuários da empresa</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Consulte os dados, o pacote ativo e as reservas de cada
                      pessoa.
                    </p>
                  </div>
                  <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold">
                    {companyAccounts.length} usuários
                  </span>
                </div>
                <label className="relative mb-4 block max-w-md">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={accountSearch}
                    onChange={(event) => setAccountSearch(event.target.value)}
                    placeholder="Buscar por nome ou e-mail"
                    aria-label="Buscar usuários por nome ou e-mail"
                    className="form-input pl-9"
                  />
                </label>
                {filteredAccounts.length ? (
                  <div className="space-y-2">
                    {filteredAccounts.map((account) => {
                      const bookings = workspace.reservations
                        .filter(
                          (booking) =>
                            booking.companyId === activeCompanyId &&
                            booking.userId === account.uid,
                        )
                        .sort((left, right) =>
                          right.date.localeCompare(left.date),
                        );
                      const activeBookings = bookings.filter(
                        (booking) => booking.status === "confirmed",
                      );
                      const accountUsage = activeBookings
                        .filter(
                          (booking) =>
                            booking.date.slice(0, 7) === selectedMonth,
                        )
                        .reduce(
                          (total, booking) =>
                            total + reservationCredits(booking),
                          0,
                        );
                      return (
                        <details
                          key={account.uid}
                          className="rounded-xl border border-slate-100"
                        >
                          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-3">
                            <Avatar name={account.name} />
                            <span className="min-w-37.5 flex-1">
                              <span className="block text-xs font-semibold">
                                {account.name}
                              </span>
                              <span className="mt-0.5 block text-[10px] text-slate-500">
                                {account.email}
                              </span>
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                              {account.role === "admin"
                                ? "Administrador"
                                : "Usuário"}
                            </span>
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-700">
                              {activeBookings.length} reservas ativas
                            </span>
                          </summary>
                          <div className="grid gap-4 border-t border-slate-100 p-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                            <div className="space-y-3">
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Informações da conta
                                </div>
                                <div className="mt-2 space-y-2 text-xs text-slate-600">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-800">
                                      E-mail
                                    </span>
                                    {account.email}
                                  </div>
                                  <div>
                                    <span className="font-medium text-slate-800">
                                      Perfil
                                    </span>{" "}
                                    ·{" "}
                                    {account.role === "admin"
                                      ? "Administrador"
                                      : "Usuário"}
                                  </div>
                                  <div>
                                    <span className="font-medium text-slate-800">
                                      Acesso
                                    </span>{" "}
                                    · Ativo
                                  </div>
                                </div>
                              </div>
                              <div className="rounded-lg bg-blue-50 p-3">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                                  Pacote da empresa
                                </div>
                                <div className="mt-1 text-xs font-semibold text-slate-800">
                                  {workspace.packageInfo.label}
                                </div>
                                <div className="mt-0.5 text-[10px] text-slate-600">
                                  {formatCredits(
                                    workspace.packageInfo.monthlyCredits,
                                  )}{" "}
                                  créditos por mês · saldo em {monthLabel(date)}:{" "}
                                  {Math.max(
                                    0,
                                    workspace.packageInfo.monthlyCredits -
                                      accountUsage,
                                  ).toLocaleString("pt-BR")}{" "}
                                  créditos
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="mb-2 flex items-center justify-between">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Reservas
                                </div>
                                <span className="text-[10px] text-slate-500">
                                  {bookings.length} no total
                                </span>
                              </div>
                              {bookings.length ? (
                                <div className="max-h-52 space-y-2 overflow-y-auto">
                                  {bookings.map((booking) => (
                                    <div
                                      key={booking.id}
                                      className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
                                    >
                                      <CalendarDays
                                        size={14}
                                        className="shrink-0 text-slate-400"
                                      />
                                      <span className="min-w-25 flex-1 text-[11px] font-semibold text-slate-700">
                                        {booking.roomName} ·{" "}
                                        {shortDate(booking.date)}
                                      </span>
                                      <span className="text-[10px] text-slate-500">
                                        {formatRanges(booking.blocks)
                                          .map(
                                            (range) =>
                                              `${range.start}–${range.end}`,
                                          )
                                          .join(", ")}{" "}
                                        · {booking.hours} h ·{" "}
                                        {formatCredits(reservationCredits(booking))}{" "}
                                        créditos
                                      </span>
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${booking.status === "confirmed" ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}
                                      >
                                        {booking.status === "confirmed"
                                          ? "Confirmada"
                                          : "Cancelada"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-500">
                                  Este usuário ainda não tem reservas.
                                </p>
                              )}
                            </div>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-500">
                    {accountSearch
                      ? "Nenhum usuário encontrado para essa busca."
                      : "Ainda não há usuários com acesso aprovado."}
                  </p>
                )}
              </div>
              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold">Salas cadastradas</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Espaços e horários de funcionamento
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold">
                      {rooms.length} ativas
                    </span>
                  </div>
                  <div className="space-y-2">
                    {allRooms.map((item) => (
                      <details
                        key={item.id}
                        className="rounded-xl border border-slate-100"
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                          <span className="flex min-w-0 items-center gap-3">
                            <RoomGlyph color={item.color} />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold">
                                {item.name}
                              </span>
                              <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                                {item.location} · {item.openTime}–
                                {item.closeTime} ·{" "}
                                {formatCredits(roomCreditsPerHour(item))}{" "}
                                créditos/h
                              </span>
                            </span>
                          </span>
                          <span
                            className={`shrink-0 rounded px-2 py-1 text-[9px] font-semibold ${item.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                          >
                            {item.active ? "Ativa" : "Inativa"}
                          </span>
                        </summary>
                        <form
                          onSubmit={(event) =>
                            void handleUpdateRoom(item, event)
                          }
                          className="grid gap-2 border-t border-slate-100 p-3 sm:grid-cols-2"
                        >
                          <input
                            name="name"
                            required
                            defaultValue={item.name}
                            aria-label="Nome da sala"
                            className="form-input"
                          />
                          <input
                            name="location"
                            required
                            defaultValue={item.location}
                            aria-label="Localização"
                            className="form-input"
                          />
                          <label className="form-label">
                            Capacidade
                            <input
                              name="capacity"
                              type="number"
                              min="1"
                              required
                              defaultValue={item.capacity}
                              className="form-input mt-1"
                            />
                          </label>
                          <label className="form-label">
                            Créditos por hora
                            <input
                              name="creditsPerHour"
                              type="number"
                              min="0"
                              step="0.5"
                              required
                              defaultValue={roomCreditsPerHour(item)}
                              className="form-input mt-1"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="form-label">
                              Abre
                              <input
                                name="openTime"
                                type="time"
                                step="1800"
                                required
                                defaultValue={item.openTime}
                                className="form-input mt-1"
                              />
                            </label>
                            <label className="form-label">
                              Fecha
                              <input
                                name="closeTime"
                                type="time"
                                step="1800"
                                required
                                defaultValue={item.closeTime}
                                className="form-input mt-1"
                              />
                            </label>
                          </div>
                          <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
                            <input
                              name="active"
                              type="checkbox"
                              defaultChecked={item.active}
                              className="accent-blue-600"
                            />{" "}
                            Sala ativa para reservas
                          </label>
                          <button className="justify-self-start rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-slate-700">
                            Salvar alterações
                          </button>
                        </form>
                      </details>
                    ))}
                  </div>
                  <form
                    onSubmit={handleAddRoom}
                    className="mt-5 border-t border-slate-100 pt-5"
                  >
                    <h3 className="mb-3 text-xs font-bold">
                      Adicionar uma sala
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        name="name"
                        required
                        placeholder="Nome da sala"
                        className="form-input"
                      />
                      <input
                        name="location"
                        required
                        placeholder="Localização"
                        className="form-input"
                      />
                      <label className="form-label">
                        Capacidade
                        <input
                          name="capacity"
                          type="number"
                          min="1"
                          required
                          defaultValue="8"
                          className="form-input mt-1"
                        />
                      </label>
                      <label className="form-label">
                        Créditos por hora
                        <input
                          name="creditsPerHour"
                          type="number"
                          min="0"
                          step="0.5"
                          required
                          defaultValue="1"
                          className="form-input mt-1"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="form-label">
                          Abre
                          <input
                            name="openTime"
                            type="time"
                            step="1800"
                            required
                            defaultValue="08:00"
                            className="form-input mt-1"
                          />
                        </label>
                        <label className="form-label">
                          Fecha
                          <input
                            name="closeTime"
                            type="time"
                            step="1800"
                            required
                            defaultValue="18:00"
                            className="form-input mt-1"
                          />
                        </label>
                      </div>
                    </div>
                    <button className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
                      <Plus size={14} /> Adicionar sala
                    </button>
                  </form>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold">Reservas recentes</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Atividade da empresa
                        </p>
                      </div>
                      <ShieldCheck className="text-emerald-600" size={18} />
                    </div>
                    <div className="space-y-3">
                      {workspace.reservations
                        .filter(
                          (item) =>
                            item.companyId === activeCompanyId &&
                            item.status === "confirmed" && item.date >= today,
                        )
                        .slice()
                        .sort(
                          (a, b) =>
                            a.date.localeCompare(b.date) ||
                            a.createdAt - b.createdAt,
                        )
                        .slice(0, 8)
                        .map((booking) => (
                          <div
                            key={booking.id}
                            className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold">
                                {booking.userName}{" "}
                                <span className="font-normal text-slate-500">
                                  · {booking.roomName}
                                </span>
                              </div>
                              <div className="mt-1 text-[10px] capitalize text-slate-400">
                                {shortDate(booking.date)} ·{" "}
                                {booking.hours.toLocaleString("pt-BR")} h ·{" "}
                                {formatCredits(reservationCredits(booking))}{" "}
                                créditos
                              </div>
                            </div>
                            <button
                              onClick={() => void handleCancel(booking)}
                              className="shrink-0 rounded bg-rose-50 px-2 py-1 text-[9px] font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              Cancelar
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
        <footer className="border-t border-slate-200/80 px-5 py-4 text-center text-[10px] text-slate-400 md:px-8">
          Feito para bons encontros. · Os horários são exibidos no fuso local da
          empresa.
        </footer>
      </main>
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 flex max-w-[min(92vw,420px)] items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs font-medium text-slate-700 shadow-xl"
        >
          <span className="mt-0.5 text-blue-600">
            <Check size={16} />
          </span>
          <span className="flex-1 leading-5">{toast}</span>
          <button
            aria-label="Fechar aviso"
            onClick={() => setToast("")}
            className="text-slate-400 hover:text-slate-700"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function errorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "permission-denied"
  ) {
    return "O Firestore bloqueou a gravação (403). Confirme se as regras atualizadas estão publicadas no mesmo projeto Firebase usado pela aplicação.";
  }
  if (error instanceof Error) return error.message;
  return "Não foi possível concluir a operação.";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
      {initials(name)}
    </span>
  );
}

function SideLink({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition ${active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] ${active ? "bg-white text-blue-700" : "bg-slate-100 text-slate-500"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function RoomGlyph({ color }: { color: string }) {
  const styles: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles[color] || styles.blue}`}
    >
      <DoorOpen size={17} />
    </span>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <span className="flex items-center gap-2 text-slate-500">
        {icon}
        {label}
      </span>
      <span className="font-semibold capitalize text-slate-700">{value}</span>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-bold tracking-[0.16em] text-blue-600">
        {eyebrow}
      </div>
      <h1 className="text-[28px] font-bold tracking-tight md:text-[34px]">
        {title}
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-2 text-xl font-bold">{value}</div>
      </div>
      <span className="rounded-lg bg-blue-50 p-2.5 text-blue-600">{icon}</span>
    </div>
  );
}

function AuthScreen({
  error,
  onError,
}: {
  error: string;
  onError: (error: string) => void;
}) {
  const [isRegister, setIsRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const firebase = await import("./firebase");
      if (isRegister)
        await firebase.register(
          String(form.get("name")).trim(),
          String(form.get("email")),
          String(form.get("password")),
        );
      else
        await firebase.signIn(
          String(form.get("email")),
          String(form.get("password")),
        );
    } catch (cause) {
      const code =
        cause && typeof cause === "object" && "code" in cause
          ? String(cause.code)
          : "";
      onError(
        code === "auth/invalid-credential"
          ? "E-mail ou senha incorretos."
          : code === "permission-denied" ||
              code === "firestore/permission-denied"
            ? "O Firebase recusou a gravação do pedido. Publique as regras atualizadas do Firestore e entre novamente para concluir o cadastro."
            : errorMessage(cause),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-5">
      <div className="grid w-full max-w-[880px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-[1fr_1.05fr]">
        <div className="hidden flex-col justify-between bg-blue-700 p-9 text-white md:flex">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <DoorOpen size={22} />
            </span>
            <strong className="text-lg">espaço</strong>
          </div>
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              Seu próximo encontro começa aqui
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight">
              Um espaço para cada grande ideia.
            </h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">
              Encontre a sala certa, reserve seus horários e deixe o resto com a
              gente.
            </p>
          </div>
          <div className="text-xs text-blue-200">
            Reservas internas simplificadas.
          </div>
        </div>
        <form onSubmit={submit} className="p-7 md:p-10">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 md:hidden">
            <DoorOpen size={21} />
          </span>
          <h2 className="mt-5 text-2xl font-bold tracking-tight">
            {isRegister ? "Crie sua conta" : "Boas-vindas de volta"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isRegister
              ? "Use seu e-mail corporativo para começar."
              : "Entre para consultar e reservar salas."}
          </p>
          {isRegister && (
            <label className="form-label mt-6 block">
              Nome completo
              <input
                name="name"
                required
                autoComplete="name"
                className="form-input mt-1.5"
                placeholder="Seu nome"
              />
            </label>
          )}
          <label className={`form-label block ${isRegister ? "mt-4" : "mt-7"}`}>
            E-mail corporativo
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="form-input mt-1.5"
              placeholder="voce@empresa.com"
            />
          </label>
          <label className="form-label mt-4 block">
            Senha
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={isRegister ? "new-password" : "current-password"}
              className="form-input mt-1.5"
              placeholder="Mínimo 6 caracteres"
            />
          </label>
          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-700"
            >
              {error}
            </div>
          )}
          <button
            disabled={busy}
            className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-400"
          >
            {busy ? "Aguarde…" : isRegister ? "Criar conta" : "Entrar"}
          </button>
          <p className="mt-5 text-center text-xs text-slate-500">
            {isRegister ? "Já tem uma conta?" : "Ainda não tem uma conta?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                onError("");
              }}
              className="font-semibold text-blue-700 hover:underline"
            >
              {isRegister ? "Fazer login" : "Criar conta"}
            </button>
          </p>
        </form>
      </div>
    </main>
  );
}

function AccessStatusScreen({
  profile,
  rejected,
  onLogOut,
}: {
  profile: Profile;
  rejected: boolean;
  onLogOut: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-5">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <span
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${rejected ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-700"}`}
        >
          {rejected ? <X size={23} /> : <Bell size={22} />}
        </span>
        <h1 className="mt-5 text-xl font-bold">
          {rejected ? "Acesso não autorizado" : "Aguardando aprovação"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {rejected
            ? `A solicitação de ${profile.email} foi recusada. Entre em contato com o administrador da empresa para mais informações.`
            : `Sua solicitação foi enviada ao administrador. Você poderá acessar a plataforma após a aprovação.`}
        </p>
        {!rejected && (
          <p className="mt-3 text-xs text-slate-400">
            Esta página será atualizada quando o administrador decidir.
          </p>
        )}
        <button
          onClick={onLogOut}
          className="mt-6 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Sair da conta
        </button>
      </section>
    </main>
  );
}

export default App;
