import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Sheets full edit scope, Google Drive file, and read-only scopes
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/drive.readonly");

let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== "undefined" ? localStorage.getItem("google_oauth_token") : null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  console.log("[Google Auth] Inicializando escuta de estado de autenticação Firebase...");
  return onAuthStateChanged(auth, async (user: User | null) => {
    console.log("[Google Auth] onAuthStateChanged disparado. Usuário:", user ? user.email : "Nenhum");
    if (user) {
      if (!cachedAccessToken) {
        cachedAccessToken = typeof window !== "undefined" ? localStorage.getItem("google_oauth_token") : null;
        console.log("[Google Auth] Buscando token cacheado de localStorage:", cachedAccessToken ? "Encontrado" : "Não encontrado");
      }
      if (cachedAccessToken) {
        console.log("[Google Auth] Sucesso: Usuário autenticado no Firebase e token de acesso OAuth disponível.");
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        console.warn("[Google Auth] Alerta: Usuário está autenticado no Firebase, mas não possui token do Google Drive armazenado no dispositivo.");
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      console.log("[Google Auth] Ninguém logado no Firebase. Limpando sessão local...");
      cachedAccessToken = null;
      if (typeof window !== "undefined") {
        localStorage.removeItem("google_oauth_token");
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Start Google sign-in popup flow
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    console.log("[Google Auth] Iniciando fluxo de Sign-In do Google via Popup...");
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    console.log("[Google Auth] Login efetuado para o usuário:", result.user.email);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      console.error("[Google Auth] Erro Crítico: Credencial retornada não contém token de acesso OAuth.");
      throw new Error("Não foi possível adquirir o token de acesso do Google.");
    }

    cachedAccessToken = credential.accessToken;
    console.log("[Google Auth] Token de acesso obtido com sucesso! Persistindo no localStorage.");
    if (typeof window !== "undefined") {
      localStorage.setItem("google_oauth_token", cachedAccessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("[Google Auth] Falha crítica no fluxo de assinatura/Sign-In:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  console.log("[Google Auth] Executando log-out do Firebase e removendo credenciais.");
  await auth.signOut();
  cachedAccessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("google_oauth_token");
  }
  console.log("[Google Auth] Logout completo.");
};
