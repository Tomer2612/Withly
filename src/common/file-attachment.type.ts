/**
 * Shape of a file attachment stored in `Post.files` and `Lesson.files`
 * (both Prisma `Json[]` columns). Keeping this as a typed interface
 * — rather than inlining `{ url: string; name: string }` at every
 * cast site — is the D4 tradeoff: same Json[] storage, stronger
 * static guarantees about what's actually in there.
 */
export interface FileAttachment {
  url: string;
  name: string;
}
