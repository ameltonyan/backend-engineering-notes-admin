const credentialsKey = "backend-engineering-notes-admin:credentials";

export function readCredentials() {
  return sessionStorage.getItem(credentialsKey) || "";
}

export function saveCredentials(credentials: string) {
  sessionStorage.setItem(credentialsKey, credentials);
}

export function clearCredentials() {
  sessionStorage.removeItem(credentialsKey);
}
