export interface ValidationRules {
  minWords: number;
  minChars: number;
  minSentences: number;
  antiSpamMinutes: number;
}

export interface CommentData {
  text: string;
  userId: string;
  lastCommentAt?: Date | null;
  currentTimestamp: Date;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export function validateComment(
  comment: CommentData,
  rules: ValidationRules
): ValidationResult {
  const text = comment.text.trim();
  const currentMs = new Date(comment.currentTimestamp).getTime();

  // 1. Basic content checks
  if (!text) {
    return { isValid: false, reason: "Comment is empty" };
  }

  // 2. Character count
  if (text.length < rules.minChars) {
    return { isValid: false, reason: `Too short (min ${rules.minChars} chars)` };
  }

  // 3. Word count
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < rules.minWords) {
    return { isValid: false, reason: `Too few words (min ${rules.minWords})` };
  }

  // 4. Sentence count
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length < rules.minSentences) {
    return { isValid: false, reason: `Too few sentences (min ${rules.minSentences})` };
  }

  // 5. Meaningless content (Point 22)
  if (/^\d+$/.test(text)) {
    return { isValid: false, reason: "Comment consists only of digits" };
  }

  if (words.length === 1 && words[0].length < 3) {
    return { isValid: false, reason: "Comment is too short (single short word)" };
  }

  // Check for repeating characters (e.g. "aaaaaa")
  if (/(.)\1{5,}/.test(text)) {
    return { isValid: false, reason: "Excessive repeating characters" };
  }
  
  // Basic emoji/symbol check
  const alphaNumericMatch = text.match(/[а-яА-Яa-zA-Z0-9]/g);
  if (!alphaNumericMatch || alphaNumericMatch.length < text.length * 0.3) {
    if (text.length < 15) {
        return { isValid: false, reason: "Comment contains too many symbols/emojis" };
    }
  }

  // 6. Anti-spam (Throttle) - Point 24, 25, 26, 27
  if (comment.lastCommentAt && rules.antiSpamMinutes > 0) {
    const diffMs = currentMs - new Date(comment.lastCommentAt).getTime();
    const diffMins = diffMs / (1000 * 60);
    if (diffMins < rules.antiSpamMinutes) {
      return { isValid: false, reason: "Slow down! You're commenting too frequently." };
    }
  }

  return { isValid: true };
}
