import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, deleteUser, type User as FirebaseUser } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";

type Profile = { id: string; full_name: string | null; avatar_url: string | null; currency: string };

type AuthCtx = {
  session: any | null;
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInWithMock: (email: string, fullName?: string) => void;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

const LOCAL_SESSION_KEY = "expenso:local_session";

function getStoredLocalSession(): any | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const signInWithMock = (email: string, fullName?: string) => {
    const cleanEmail = email.toLowerCase().trim();
    const userId = `user_${cleanEmail.replace(/[^a-z0-9]/g, "_")}`;
    const name = fullName?.trim() || cleanEmail.split("@")[0] || "User";
    const mockUser = {
      uid: userId,
      id: userId,
      email: cleanEmail,
      displayName: name,
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(mockUser));
    }
    setUser(mockUser);
    setProfile({ id: userId, full_name: name, avatar_url: null, currency: "INR" });
  };

  useEffect(() => {
    try {
      const unsub = onAuthStateChanged(auth, (fbUser) => {
        if (fbUser) {
          if (!fbUser.emailVerified && !fbUser.uid.startsWith("user_")) {
            setUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          const mappedUser = {
            uid: fbUser.uid,
            id: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
          };
          setUser(mappedUser);
          setProfile({
            id: fbUser.uid,
            full_name: fbUser.displayName || fbUser.email?.split("@")[0] || "User",
            avatar_url: fbUser.photoURL || null,
            currency: "INR",
          });
          setLoading(false);

          try {
            const uRef = doc(db, "users", fbUser.uid);
            setDoc(uRef, {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "User",
              updatedAt: new Date().toISOString(),
            }, { merge: true }).catch(() => {});
          } catch {}
        } else {
          const localSess = getStoredLocalSession();
          if (localSess) {
            setUser(localSess);
            setProfile({
              id: localSess.uid || localSess.id,
              full_name: localSess.displayName || localSess.email?.split("@")[0] || "User",
              avatar_url: null,
              currency: "INR",
            });
          } else {
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
        }
      });
      return () => unsub();
    } catch {
      const localSess = getStoredLocalSession();
      if (localSess) {
        setUser(localSess);
        setProfile({
          id: localSess.uid || localSess.id,
          full_name: localSess.displayName || localSess.email?.split("@")[0] || "User",
          avatar_url: null,
          currency: "INR",
        });
      }
      setLoading(false);
    }
  }, []);

  const value: AuthCtx = {
    session: user ? { user } : null,
    user,
    profile,
    loading,
    signOut: async () => {
      if (typeof window !== "undefined") {
        try { localStorage.removeItem(LOCAL_SESSION_KEY); } catch {}
      }
      try { await firebaseSignOut(auth); } catch {}
      setUser(null);
      setProfile(null);
    },
    deleteAccount: async () => {
      if (typeof window !== "undefined") {
        try { localStorage.removeItem(LOCAL_SESSION_KEY); } catch {}
      }
      try {
        if (auth.currentUser) {
          await deleteUser(auth.currentUser);
        }
      } catch (err) {
        try { await firebaseSignOut(auth); } catch {}
      }
      setUser(null);
      setProfile(null);
    },
    refreshProfile: async () => {
      if (user?.uid) {
        setProfile({ id: user.uid, full_name: user.displayName || user.email?.split("@")[0] || "User", avatar_url: null, currency: "INR" });
      }
    },
    signInWithMock,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
