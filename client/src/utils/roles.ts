import type { User } from '../types'

export function canSeek(user: User | null | undefined) {
  return Boolean(user && (user.role === 'seeker' || user.role === 'both'))
}

export function canPost(user: User | null | undefined) {
  return Boolean(user && (user.role === 'poster' || user.role === 'both'))
}
