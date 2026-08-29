// 계정 시스템 없이, 세션별로 "이 브라우저가 곧 이 사람"임을 로컬에 기억해두는 가벼운 방식.
// 나중에 정식 서비스로 확장할 때는 이 부분을 실제 auth로 교체하면 됨.

export type LocalIdentity = {
  memberId: string;
  nickname: string;
  color: string;
  deviceKey: string;
};

const KEY_PREFIX = "haenggan:";

function storageKey(sessionCode: string) {
  return `${KEY_PREFIX}${sessionCode}`;
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

// 이 브라우저가 참여한 적 있는 모든 행간(세션 코드 + 그때 쓴 신원)을 훑어온다.
// "haenggan:pref:*", "haenggan:hint:*" 같은 설정 키는 코드 뒤에 ':'가 있어 걸러진다.
export function listLocalSessions(): { code: string; identity: LocalIdentity }[] {
  if (typeof window === "undefined") return [];
  const out: { code: string; identity: LocalIdentity }[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      const code = key.slice(KEY_PREFIX.length);
      if (!code || code.includes(":")) continue;
      try {
        const identity = JSON.parse(window.localStorage.getItem(key) || "") as LocalIdentity;
        if (identity && identity.memberId) out.push({ code, identity });
      } catch {
        // 손상된 항목은 무시
      }
    }
  } catch {
    // localStorage 접근 자체가 막힌 환경
  }
  return out;
}

export function forgetLocalSession(sessionCode: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(sessionCode));
  } catch {
    // ignore
  }
}

export function newDeviceKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dk_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}
