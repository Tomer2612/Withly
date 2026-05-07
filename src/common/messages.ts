export const ERROR_MESSAGES = {
  UPLOAD_IMAGE_ONLY: 'אפשר להעלות רק קבצי תמונה',
  UPLOAD_IMAGE_OR_VIDEO_ONLY: 'אפשר להעלות רק תמונות או סרטונים',
  UPLOAD_VIDEO_ONLY: 'אפשר להעלות רק קבצי וידאו',
  UPLOAD_FILE_TYPE_NOT_SUPPORTED: 'סוג קובץ לא נתמך',

  CANNOT_DELETE_LAST_PAYMENT_METHOD: 'לא ניתן למחוק את אמצעי התשלום האחרון',
  CARD_IN_USE: 'הכרטיס מחויב בקהילות פעילות',

  COMMUNITY_NOT_FOUND: 'קהילה לא נמצאה',
  COURSE_NOT_FOUND: 'קורס לא נמצא',
  CHAPTER_NOT_FOUND: 'פרק לא נמצא',
  LESSON_NOT_FOUND: 'שיעור לא נמצא',
  NOT_ENROLLED_IN_COURSE: 'לא רשום לקורס זה',

  NO_PERMISSION_CREATE_COURSE: 'אין לך הרשאה ליצור קורסים בקהילה זו',
  NO_PERMISSION_EDIT_COURSE: 'אין לך הרשאה לערוך קורס זה',
  NO_PERMISSION_DELETE_COURSE: 'אין לך הרשאה למחוק קורס זה',
} as const;

export const SUCCESS_MESSAGES = {
  COURSE_DELETED: 'הקורס נמחק בהצלחה',
  CHAPTER_DELETED: 'הפרק נמחק בהצלחה',
  LESSON_DELETED: 'השיעור נמחק בהצלחה',
} as const;
