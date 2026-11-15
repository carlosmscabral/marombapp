/**
 * Brazilian Portuguese (`pt-BR`) localization for Firebase Auth and Firestore SDK errors (#21, REQ-002).
 * Maps `FirebaseError.code` values, embedded SDK codes, and initialization failures to user-facing
 * PT-BR copy with a localized fallback so raw English SDK messages never render in the UI.
 */

export const FIREBASE_CONFIG_ERROR_PT_BR =
  'Configuração do Firebase inválida ou indisponível. Verifique as credenciais do aplicativo.';

export const GENERIC_FIREBASE_ERROR_PT_BR =
  'Ocorreu um erro inesperado. Tente novamente.';

const FIREBASE_ERROR_PT_BR: Record<string, string> = {
  config: FIREBASE_CONFIG_ERROR_PT_BR,
  'auth/invalid-api-key':
    'Chave de acesso do Firebase inválida. Verifique a configuração do aplicativo.',
  'auth/api-key-not-valid':
    'Chave de acesso do Firebase inválida. Verifique a configuração do aplicativo.',
  'auth/configuration-not-found': FIREBASE_CONFIG_ERROR_PT_BR,
  'auth/project-not-found': FIREBASE_CONFIG_ERROR_PT_BR,
  'auth/invalid-app-credential': FIREBASE_CONFIG_ERROR_PT_BR,
  'auth/invalid-app-id': FIREBASE_CONFIG_ERROR_PT_BR,
  'auth/app-not-authorized': FIREBASE_CONFIG_ERROR_PT_BR,
  'app/no-app': FIREBASE_CONFIG_ERROR_PT_BR,
  'app/invalid-app-argument': FIREBASE_CONFIG_ERROR_PT_BR,
  'auth/network-request-failed':
    'Sem conexão de rede. Verifique sua internet e tente novamente.',
  'auth/popup-blocked':
    'A janela de login foi bloqueada pelo navegador. Permita pop-ups e tente novamente.',
  'auth/popup-closed-by-user':
    'A janela de login foi fechada antes de concluir o acesso.',
  'auth/cancelled-popup-request':
    'A solicitação de login anterior foi cancelada. Tente novamente.',
  'auth/too-many-requests':
    'Muitas tentativas seguidas. Aguarde um instante e tente novamente.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/unauthorized-domain': 'Este domínio não está autorizado para login.',
  'auth/operation-not-allowed':
    'O login com Google não está habilitado neste projeto.',
  'auth/internal-error': 'Erro interno de autenticação. Tente novamente.',
  'auth/web-storage-unsupported':
    'O armazenamento local do navegador está desativado ou indisponível.',
  'permission-denied': 'Sem permissão para acessar ou salvar estes dados.',
  'auth/insufficient-permission':
    'Sem permissão para acessar ou salvar estes dados.',
  unauthenticated: 'Sessão expirada ou não autenticada. Entre novamente.',
  unavailable:
    'Serviço temporariamente indisponível. Verifique sua conexão e tente novamente.',
  'deadline-exceeded':
    'A operação demorou demais. Verifique sua conexão e tente novamente.',
  'not-found': 'Registro não encontrado.',
  'already-exists': 'Este registro já existe.',
  'resource-exhausted':
    'Limite de requisições atingido. Aguarde um instante e tente novamente.',
  'failed-precondition':
    'Não foi possível concluir a operação no estado atual.',
  aborted: 'A operação foi interrompida. Tente novamente.',
  cancelled: 'A operação foi cancelada.',
  'invalid-argument': 'Dados inválidos informados.',
  internal: 'Erro interno no servidor. Tente novamente.',
  'data-loss': 'Erro ao ler os dados armazenados.',
  unknown: GENERIC_FIREBASE_ERROR_PT_BR,
};

/**
 * Extracts and normalizes a Firebase error code from a `FirebaseError`, `Error` message, or raw code string.
 */
function extractFirebaseErrorCode(err: unknown): string | null {
  let rawCode: string | null = null;

  if (err && typeof err === 'object') {
    const codeProp = (err as { code?: unknown }).code;
    if (typeof codeProp === 'string' && codeProp.trim().length > 0) {
      rawCode = codeProp.trim();
    } else {
      const msgProp = (err as { message?: unknown }).message;
      if (typeof msgProp === 'string' && msgProp.trim().length > 0) {
        const msg = msgProp.trim();
        if (msg.toLowerCase() === 'config') {
          rawCode = 'config';
        } else {
          const parenMatch = /\(([a-z0-9-]+\/[a-z0-9_.-]+|[a-z0-9-]+)\)/i.exec(msg);
          if (parenMatch?.[1]) {
            rawCode = parenMatch[1];
          } else if (/missing or insufficient permissions/i.test(msg)) {
            rawCode = 'permission-denied';
          }
        }
      }
    }
  } else if (typeof err === 'string' && err.trim().length > 0) {
    const trimmed = err.trim();
    const parenMatch = /\(([a-z0-9-]+\/[a-z0-9_.-]+|[a-z0-9-]+)\)/i.exec(trimmed);
    rawCode = parenMatch?.[1] ?? trimmed;
  }

  if (!rawCode) return null;

  const lower = rawCode.toLowerCase().replace(/\.+$/, '');
  if (lower.startsWith('auth/api-key-not-valid')) {
    return 'auth/api-key-not-valid';
  }
  if (lower.startsWith('firestore/')) {
    return lower.slice('firestore/'.length);
  }
  return lower;
}

/**
 * Maps a Firebase Auth, Firestore, or initialization error to idiomatic PT-BR user-facing copy.
 * Falls back to `fallback` (defaulting to `GENERIC_FIREBASE_ERROR_PT_BR`) and never leaks raw SDK `err.message`.
 */
export function localizeFirebaseError(
  err: unknown,
  fallback: string = GENERIC_FIREBASE_ERROR_PT_BR,
): string {
  const code = extractFirebaseErrorCode(err);
  if (code && FIREBASE_ERROR_PT_BR[code]) {
    return FIREBASE_ERROR_PT_BR[code];
  }
  return fallback;
}
