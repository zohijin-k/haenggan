// 계정 시스템 없이, 세션별로 "이 브라우저가 곧 이 사람"임을 로컬에 기억해두는 가벼운 방식.
// 나중에 정식 서비스로 확장할 때는 이 부분을 실제 auth로 교체하면 됨.

type LocalIdentity = {
  memberId: string;
  nickname: string;
  color: string;
  deviceKey: string;
};

function storageKey(sessionCode: string) {
  return `haenggan:${sessionCode}`;
}

export function getLocalIdentity(sessionCode: string): LocalIdentity | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(sessionCode));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalIdentity;
  } catch {
    return null;
  }
}

export function setLocalIdentity(sessionCode: string, identity: LocalIdentity) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(sessionCode), JSON.stringify(identity));
}

export function newDeviceKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dk_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}
