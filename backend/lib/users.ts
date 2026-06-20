export type UserRecord = {
  sub: string;
  userName: string;
};

export interface UserRepository {
  upsert(user: UserRecord): Promise<void>;
  findUserName(sub: string): Promise<string | null>;
}

const MAX_USER_NAME_LENGTH = 256;

export function sanitizeUserName(value: string): string {
  return [...value]
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code > 0x1f && code !== 0x7f;
    })
    .join("")
    .slice(0, MAX_USER_NAME_LENGTH);
}
