/**
 * How many member faces a group ever shows, on the detail header and on a card alike.
 *
 * The API's preview-member page size (`GROUP_PREVIEW_MEMBER_COUNT` in the groups service)
 * is this same number: the "+N others" label counts the members the faces leave out, so a
 * card that received fewer faces than the header shows would do that arithmetic against a
 * different base and the two surfaces would disagree about the same group.
 */
export const GROUP_FACE_COUNT = 5

/**
 * The members no face stands for, or 0 when the stack accounts for everyone.
 *
 * It counts against the number of face *slots*, never the faces currently loaded: the
 * header fetches its faces, so subtracting what has arrived would label a group "+1,840
 * others" for one frame and "+1,835 others" after, and a failed fetch would leave the
 * count permanently wrong. At or below the slot count there is no remainder to name, so
 * the label is dropped rather than restating a total the faces already show.
 */
export function othersBeyondFaces(memberCount: number) {
  return Math.max(memberCount - GROUP_FACE_COUNT, 0)
}
