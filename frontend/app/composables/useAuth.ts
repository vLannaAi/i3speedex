import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  type CognitoUserAttribute,
} from 'amazon-cognito-identity-js'
import type { UserContext } from '~/types'

interface AuthState {
  user: UserContext | null
  isAuthenticated: boolean
  isLoading: boolean
  session: CognitoUserSession | null
}

const state = reactive<AuthState>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  session: null,
})

let userPool: CognitoUserPool | null = null
let cognitoUser: CognitoUser | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

function getUserPool(): CognitoUserPool {
  if (!userPool) {
    const config = useRuntimeConfig()
    userPool = new CognitoUserPool({
      UserPoolId: config.public.cognitoUserPoolId,
      ClientId: config.public.cognitoClientId,
    })
  }
  return userPool
}

function parseIdToken(idToken: string): UserContext {
  const payload = JSON.parse(atob(idToken.split('.')[1]!))
  const rawGroups = payload['cognito:groups'] || []
  let groups: string[]
  if (Array.isArray(rawGroups)) {
    groups = rawGroups
  } else if (typeof rawGroups === 'string') {
    const trimmed = rawGroups.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      groups = trimmed.slice(1, -1).split(',').map((s: string) => s.trim()).filter(Boolean)
    } else {
      groups = [trimmed]
    }
  } else {
    groups = []
  }

  return {
    username: payload['cognito:username'] || payload.username || payload.sub,
    email: payload.email,
    groups,
    operatorId: payload['custom:operatorId'],
    role: payload['custom:role'],
  }
}

function scheduleRefresh(session: CognitoUserSession) {
  if (refreshTimer) clearTimeout(refreshTimer)
  const idToken = session.getIdToken()
  const expiresAt = idToken.getExpiration() * 1000
  // Refresh 5 minutes before expiry
  const refreshIn = Math.max(expiresAt - Date.now() - 5 * 60 * 1000, 30_000)
  refreshTimer = setTimeout(() => refreshSession(), refreshIn)
}

function refreshSession(): Promise<CognitoUserSession | null> {
  return new Promise((resolve) => {
    const pool = getUserPool()
    const currentUser = pool.getCurrentUser()
    if (!currentUser) {
      state.isAuthenticated = false
      state.user = null
      state.session = null
      resolve(null)
      return
    }
    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        state.isAuthenticated = false
        state.user = null
        state.session = null
        resolve(null)
        return
      }
      // Force refresh
      const refreshToken = session.getRefreshToken()
      currentUser.refreshSession(refreshToken, (refreshErr: Error | null, newSession: CognitoUserSession) => {
        if (refreshErr || !newSession) {
          state.isAuthenticated = false
          state.user = null
          state.session = null
          resolve(null)
          return
        }
        state.session = newSession
        state.user = parseIdToken(newSession.getIdToken().getJwtToken())
        state.isAuthenticated = true
        scheduleRefresh(newSession)
        resolve(newSession)
      })
    })
  })
}

export function useAuth() {
  function getIdToken(): string | null {
    return state.session?.getIdToken()?.getJwtToken() || null
  }

  function login(email: string, password: string): Promise<{ success: boolean; newPasswordRequired?: boolean; error?: string }> {
    return new Promise((resolve) => {
      const pool = getUserPool()
      cognitoUser = new CognitoUser({ Username: email, Pool: pool })
      const authDetails = new AuthenticationDetails({ Username: email, Password: password })

      cognitoUser.authenticateUser(authDetails, {
        onSuccess(session: CognitoUserSession) {
          state.session = session
          state.user = parseIdToken(session.getIdToken().getJwtToken())
          state.isAuthenticated = true
          state.isLoading = false
          scheduleRefresh(session)
          resolve({ success: true })
        },
        onFailure(err: Error) {
          state.isLoading = false
          resolve({ success: false, error: err.message || 'Authentication failed' })
        },
        newPasswordRequired(_userAttributes: CognitoUserAttribute[]) {
          state.isLoading = false
          resolve({ success: false, newPasswordRequired: true })
        },
      })
    })
  }

  function completeNewPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!cognitoUser) {
        resolve({ success: false, error: 'Invalid session' })
        return
      }
      cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
        onSuccess(session: CognitoUserSession) {
          state.session = session
          state.user = parseIdToken(session.getIdToken().getJwtToken())
          state.isAuthenticated = true
          scheduleRefresh(session)
          resolve({ success: true })
        },
        onFailure(err: Error) {
          resolve({ success: false, error: err.message || 'Password change failed' })
        },
      })
    })
  }

  function forgotPassword(email: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const pool = getUserPool()
      const user = new CognitoUser({ Username: email, Pool: pool })
      user.forgotPassword({
        onSuccess() {
          resolve({ success: true })
        },
        onFailure(err: Error) {
          resolve({ success: false, error: err.message })
        },
      })
    })
  }

  function confirmForgotPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const pool = getUserPool()
      const user = new CognitoUser({ Username: email, Pool: pool })
      user.confirmPassword(code, newPassword, {
        onSuccess() {
          resolve({ success: true })
        },
        onFailure(err: Error) {
          resolve({ success: false, error: err.message })
        },
      })
    })
  }

  function logout() {
    if (refreshTimer) clearTimeout(refreshTimer)
    const pool = getUserPool()
    const currentUser = pool.getCurrentUser()
    if (currentUser) {
      currentUser.signOut()
    }
    state.session = null
    state.user = null
    state.isAuthenticated = false
    navigateTo('/login')
  }

  function restoreSession(): Promise<boolean> {
    return new Promise((resolve) => {
      const pool = getUserPool()
      const currentUser = pool.getCurrentUser()
      if (!currentUser) {
        state.isLoading = false
        resolve(false)
        return
      }
      currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          state.isLoading = false
          resolve(false)
          return
        }
        cognitoUser = currentUser
        state.session = session
        state.user = parseIdToken(session.getIdToken().getJwtToken())
        state.isAuthenticated = true
        state.isLoading = false
        scheduleRefresh(session)
        resolve(true)
      })
    })
  }

  const isAdmin = computed(() => state.user?.groups.includes('admin') ?? false)
  const isOperator = computed(() => state.user?.groups.includes('operator') ?? false)
  const canWrite = computed(() => isAdmin.value || isOperator.value)

  return {
    user: computed(() => state.user),
    isAuthenticated: computed(() => state.isAuthenticated),
    isLoading: computed(() => state.isLoading),
    isAdmin,
    isOperator,
    canWrite,
    getIdToken,
    login,
    completeNewPassword,
    forgotPassword,
    confirmForgotPassword,
    logout,
    restoreSession,
    refreshSession,
  }
}
