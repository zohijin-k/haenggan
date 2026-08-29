import { customAlphabet } from "nanoid";

// 헷갈리는 문자(0/O, 1/I 등) 제거한 6자리 초대 코드
const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const generateSessionCode = customAlphabet(alphabet, 6);
