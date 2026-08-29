import type { Doc, Id } from '../_generated/dataModel'

export function isOwnedBy(ownerId: Id<'users'>, userId: Id<'users'>): boolean {
  return ownerId === userId
}

export function isDeleted(deletedAt: number | undefined): boolean {
  return deletedAt !== undefined
}

export function canReadLetterMetadata(letter: Doc<'letters'>, userId: Id<'users'>): boolean {
  return isOwnedBy(letter.ownerId, userId) && !isDeleted(letter.deletedAt)
}

export function canReadLetterContent(letter: Doc<'letters'>, userId: Id<'users'>): boolean {
  if (!canReadLetterMetadata(letter, userId)) {
    return false
  }

  if (letter.status === 'draft') {
    return true
  }

  if (!letter.sealed) {
    return true
  }

  return letter.status === 'delivered' && letter.openedAt !== undefined
}

export function isReplyableParent(letter: Doc<'letters'>, userId: Id<'users'>): boolean {
  return canReadLetterContent(letter, userId) && letter.status === 'delivered'
}
